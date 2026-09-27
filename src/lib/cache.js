// Local-state cache updates — the only way screens apply mutations to the UI.
//
// Contract (fetch-once / mutate-then-patch):
//   1. Call the mutation API (POST/PUT/RPC) first and await it.
//   2. Only after it succeeds, call the matching apply*() helper here with the
//      confirmed row(s). The helper patches whatever this session has already
//      fetched — it never invalidates, refetches or re-renders from the server.
//   3. If a dataset was never fetched this session (cache entry missing), the
//      helper leaves it alone; its first mount will do the one-time fetch.
//
// The remote DB remains the source of truth for writes; this module only keeps the
// session's cached copy consistent so no GET fires after a button click.
import { fetchEntries } from './api/entries';
import { sortEntries } from '../utils/ageing';

// Both entry-list queries Home/Archive render from: ['entries-map'] and
// ['entries-map-archived'] (keys are stable; the maps are objects keyed by party id).
const MAP_QUERY_KEYS = ['entries-map', 'entries-map-archived'];
const PARTY_LIST_KEYS = [['parties', 'active'], ['parties', 'archived']];
const TRASH_TTL_MS = 45 * 86400000; // mirrors purge_at = now() + interval '45 days'

const byName = (a, b) => a.name.localeCompare(b.name);
const byPurgeAt = (a, b) => String(a.purge_at || '').localeCompare(String(b.purge_at || ''));

function has(qc, key) {
  return qc.getQueryData(key) !== undefined;
}

// Patches a cached list only when it exists — a never-fetched list stays
// unfetched so its first mount performs the single fetch.
function patch(qc, key, updater) {
  if (!has(qc, key)) return;
  qc.setQueryData(key, updater(qc.getQueryData(key)));
}

function removeFromPartyLists(qc, id) {
  PARTY_LIST_KEYS.forEach((key) => patch(qc, key, (list) => list.filter((p) => p.id !== id)));
}

function insertIntoPartyList(qc, key, party) {
  patch(qc, key, (list) => [...list.filter((p) => p.id !== party.id), party].sort(byName));
}

function upsertEntry(list, entry) {
  return sortEntries([...list.filter((e) => e.id !== entry.id), entry]);
}

// Applies to every cached entries-map (Home's and Archive's) that knows this party.
function patchMapForParty(qc, partyId, updater) {
  qc.getQueriesData({ predicate: (q) => MAP_QUERY_KEYS.includes(q.queryKey[0]) }).forEach(([key, map]) => {
    if (!map || !(partyId in map)) return;
    qc.setQueryData(key, { ...map, [partyId]: updater(map[partyId]) });
  });
}

function dropFromMaps(qc, partyId) {
  qc.getQueriesData({ predicate: (q) => MAP_QUERY_KEYS.includes(q.queryKey[0]) }).forEach(([key, map]) => {
    if (!map || !(partyId in map)) return;
    const { [partyId]: _dropped, ...rest } = map;
    qc.setQueryData(key, rest);
  });
}

function seedMap(qc, mapKey, partyId, value) {
  const map = qc.getQueryData([mapKey]);
  if (map === undefined || partyId in map) return;
  qc.setQueryData([mapKey], { ...map, [partyId]: value });
}

// Makes sure the given entries-map knows this party's entries, cheapest source first:
// copy from the other map, then this session's ['entries', id] cache, and only if the
// data exists nowhere locally does a single fetchEntries() for that one party run.
async function ensureMapEntry(qc, mapKey, party) {
  const map = qc.getQueryData([mapKey]);
  if (map === undefined) return; // map never fetched — its first mount fetches everything
  if (party.id in map) return;
  const otherKey = MAP_QUERY_KEYS.find((k) => k !== mapKey);
  const other = qc.getQueryData([otherKey]);
  if (other && party.id in other) {
    qc.setQueryData([mapKey], { ...map, [party.id]: other[party.id] });
    return;
  }
  const local = qc.getQueryData(['entries', party.id]);
  if (local) {
    qc.setQueryData([mapKey], { ...map, [party.id]: local });
    return;
  }
  const rows = await fetchEntries(party.id);
  qc.setQueryData([mapKey], { ...(qc.getQueryData([mapKey]) || {}), [party.id]: rows });
}

// ---- Parties ---------------------------------------------------------------

export function applyCreatedParty(qc, party) {
  insertIntoPartyList(qc, party.is_archived ? ['parties', 'archived'] : ['parties', 'active'], party);
  if (!has(qc, ['party', party.id])) qc.setQueryData(['party', party.id], party);
  if (!has(qc, ['entries', party.id])) qc.setQueryData(['entries', party.id], []);
  seedMap(qc, 'entries-map', party.id, []);
  seedMap(qc, 'entries-map-archived', party.id, []);
}

export function applyUpdatedParty(qc, party) {
  if (has(qc, ['party', party.id])) qc.setQueryData(['party', party.id], party);
  PARTY_LIST_KEYS.forEach((key) =>
    patch(qc, key, (list) =>
      list.some((p) => p.id === party.id)
        ? [...list.filter((p) => p.id !== party.id), party].sort(byName)
        : list
    )
  );
  // Deleted copies shown in Recently Deleted embed parties(name) for display.
  patch(qc, ['trash', 'entries'], (list) =>
    list.map((e) => (e.party_id === party.id ? { ...e, parties: { name: party.name } } : e))
  );
}

// Archives/unarchives after archive_party() succeeded. The row moves between the local
// lists; the target entries-map entry is reused from wherever it is already cached.
export async function applyArchiveState(qc, party, archived) {
  const updated = {
    ...party,
    is_archived: archived,
    archived_at: archived ? new Date().toISOString() : null,
    deleted_at: null,
    purge_at: null,
  };
  removeFromPartyLists(qc, party.id);
  insertIntoPartyList(qc, archived ? ['parties', 'archived'] : ['parties', 'active'], updated);
  qc.setQueryData(['party', party.id], updated);
  await ensureMapEntry(qc, archived ? 'entries-map-archived' : 'entries-map', updated);
}

// soft_delete_party() succeeded: the party leaves the local lists and (if this session
// has already fetched them) appears in the trash caches with the same timestamps the
// RPC wrote: deleted_at = now(), purge_at = now() + 45 days.
export function applyDeletedParty(qc, party, entries) {
  removeFromPartyLists(qc, party.id);
  // The server's own timestamps (present on live-sync events and echoes of this
  // device's writes) win over local estimates so every path converges on
  // identical rows.
  const iso = party.deleted_at || new Date().toISOString();
  const purgeAt = party.purge_at || new Date(new Date(iso).getTime() + TRASH_TTL_MS).toISOString();
  patch(qc, ['trash', 'parties'], (list) =>
    [...list.filter((p) => p.id !== party.id), { ...party, deleted_at: iso, purge_at: purgeAt }].sort(byPurgeAt)
  );
  patch(qc, ['trash', 'entries'], (list) => {
    const added = (entries || [])
      .filter((e) => !e.deleted_at && !list.some((t) => t.id === e.id))
      .map((e) => ({ ...e, deleted_at: iso, purge_at: purgeAt, deleted_with_party: true, parties: { name: party.name } }));
    return [...list, ...added].sort(byPurgeAt);
  });
}

// restore_party() succeeded; `party` is the trash row that was on screen.
export async function applyRestoredParty(qc, party) {
  patch(qc, ['trash', 'parties'], (list) => list.filter((p) => p.id !== party.id));
  // restore_party() only revives rows marked deleted_with_party — entries deleted
  // individually stay in Recently Deleted until restored one by one.
  patch(qc, ['trash', 'entries'], (list) => list.filter((e) => !(e.party_id === party.id && e.deleted_with_party)));
  const live = { ...party, deleted_at: null, purge_at: null };
  insertIntoPartyList(qc, live.is_archived ? ['parties', 'archived'] : ['parties', 'active'], live);
  qc.setQueryData(['party', party.id], live);
  await ensureMapEntry(qc, live.is_archived ? 'entries-map-archived' : 'entries-map', live);
}

// purge_now('party') succeeded: everything about the party leaves the local cache.
export function applyPurgedParty(qc, partyId) {
  patch(qc, ['trash', 'parties'], (list) => list.filter((p) => p.id !== partyId));
  patch(qc, ['trash', 'entries'], (list) => list.filter((e) => e.party_id !== partyId));
  removeFromPartyLists(qc, partyId);
  dropFromMaps(qc, partyId);
  qc.removeQueries({ queryKey: ['party', partyId] });
  qc.removeQueries({ queryKey: ['entries', partyId] });
}

// ---- Entries ---------------------------------------------------------------

export function applyCreatedEntry(qc, partyId, entry) {
  patch(qc, ['entries', partyId], (list) => upsertEntry(list, entry));
  patchMapForParty(qc, partyId, (list) => upsertEntry(list, entry));
}

export function applyUpdatedEntry(qc, partyId, entry) {
  applyCreatedEntry(qc, partyId, entry);
}

// Photo changes own entries.photo_path; keeps the cached rows in step without a refetch.
export function applyEntryPhotoPath(qc, partyId, entryId, photoPath) {
  const patchRow = (list) => list.map((e) => (e.id === entryId ? { ...e, photo_path: photoPath } : e));
  patch(qc, ['entries', partyId], patchRow);
  patchMapForParty(qc, partyId, patchRow);
}

// soft_delete_entry() succeeded; `entry` is the row the user acted on. On live-sync
// events the row already carries the server's own deleted_at/purge_at/
// deleted_with_party — those values win over local estimates. `partyName` is optional:
// CDC rows carry no parties(name) join, so the name falls back to whatever cache has it.
export function applyDeletedEntry(qc, partyId, entry, partyName) {
  patch(qc, ['entries', partyId], (list) => list.filter((e) => e.id !== entry.id));
  patchMapForParty(qc, partyId, (list) => list.filter((e) => e.id !== entry.id));
  const nameFallback = partyName || findPartyName(qc, partyId);
  patch(qc, ['trash', 'entries'], (list) => {
    const existing = list.find((e) => e.id === entry.id);
    const name = nameFallback || existing?.parties?.name;
    return [
      ...list.filter((e) => e.id !== entry.id),
      {
        ...entry,
        deleted_at: entry.deleted_at || new Date().toISOString(),
        purge_at: entry.purge_at || new Date(Date.now() + TRASH_TTL_MS).toISOString(),
        deleted_with_party: entry.deleted_with_party ?? false,
        parties: name ? { name } : entry.parties,
      },
    ].sort(byPurgeAt);
  });
}

// restore_entry() succeeded; `entry` is the trash row that was on screen.
export function applyRestoredEntry(qc, entry) {
  patch(qc, ['trash', 'entries'], (list) => list.filter((e) => e.id !== entry.id));
  const { parties: _join, ...row } = entry;
  const live = { ...row, deleted_at: null, purge_at: null, deleted_with_party: false };
  patch(qc, ['entries', live.party_id], (list) => upsertEntry(list, live));
  patchMapForParty(qc, live.party_id, (list) => upsertEntry(list, live));
}

// purge_now('entry') succeeded: the row leaves every cache that could hold it.
export function applyPurgedEntry(qc, entry) {
  patch(qc, ['trash', 'entries'], (list) => list.filter((e) => e.id !== entry.id));
  patch(qc, ['entries', entry.party_id], (list) => list.filter((e) => e.id !== entry.id));
  patchMapForParty(qc, entry.party_id, (list) => list.filter((e) => e.id !== entry.id));
}

// ---- Live sync support (used by src/lib/realtimeSync.js) --------------------

// Best-effort party-name lookup for delete events: a CDC row carries no
// parties(name) join, so the name is pulled from whichever cache holds it.
function findPartyName(qc, partyId) {
  for (const key of [['party', partyId], ...PARTY_LIST_KEYS]) {
    const name = qc.getQueryData(key)?.name;
    if (name) return name;
  }
  return qc.getQueryData(['trash', 'parties'])?.find((p) => p.id === partyId)?.name;
}

// Rows fetched with includeDeleted after a remote party delete go into a cached
// trash list verbatim (server timestamps intact), deduped by id.
export function insertTrashEntries(qc, rows) {
  if (!rows.length) return;
  patch(qc, ['trash', 'entries'], (list) => {
    const added = rows.filter((r) => !list.some((t) => t.id === r.id));
    return added.length ? [...list, ...added].sort(byPurgeAt) : list;
  });
}
