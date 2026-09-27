// Live cross-device sync — the counterpart to the mutate-then-patch contract in
// cache.js. While the ledger is unlocked, one Supabase Realtime channel streams
// every INSERT/UPDATE/DELETE on `parties` and `entries` (from ANY device,
// including this one) and applies it to the React Query cache with the same
// apply* helpers the mutation flows use.
//
// Guarantees:
//   - No invalidateQueries / refetch: events carry the full server row, so the
//     cache is patched from confirmed server state. The normal case costs zero
//     extra GETs — own writes come back as echoes and re-patch identical rows
//     (every handler is idempotent).
//   - Datasets this session never fetched are left alone, exactly like the
//     mutation helpers; their first mount does the one-time fetch. The single
//     exception is the trash backfill below (only runs when the trash list is
//     already on screen), mirroring ensureMapEntry in cache.js.
//   - Realtime auth: WebSockets cannot send the x-device-secret header, so the
//     channel authenticates with a short-lived JWT minted by the realtime-token
//     Edge Function (backend/supabase/functions/realtime-token + sql/012).
//     Until that function is deployed, the app works exactly as before — after
//     5 failed token attempts sync simply stays off (logged to the console).
import { supabase } from './supabaseClient';
import { fetchEntries } from './api/entries';
import {
  applyCreatedParty,
  applyUpdatedParty,
  applyArchiveState,
  applyDeletedParty,
  applyRestoredParty,
  applyPurgedParty,
  insertTrashEntries,
  applyCreatedEntry,
  applyDeletedEntry,
  applyRestoredEntry,
  applyPurgedEntry,
} from './cache';

const TOKEN_TTL_MS = 55 * 60 * 1000; // must match realtime-token's TOKEN_TTL_SECONDS
const TOKEN_REFRESH_MS = TOKEN_TTL_MS - 25 * 60 * 1000; // rotate well before expiry
const TOKEN_FAILURE_LIMIT = 5; // then give up quietly (device likely revoked)
const BACKOFF_MIN_MS = 5000;
const BACKOFF_MAX_MS = 5 * 60 * 1000;

let qc = null;
let channel = null;
let refreshTimer = null;
let retryTimer = null;
let stopped = true;
let tokenFailures = 0;
let channelFailures = 0;
// Bumped on every start/stop so an in-flight connect() (token fetch in progress
// during a lock/unlock or a StrictMode remount) can never tear down or supersede
// a newer one — stale generations bail out at every await boundary.
let generation = 0;
// Synchronous record of each party's deleted-state as events arrive; async
// handlers re-check it afterwards so a racing restore/purge wins over stale work.
const partyDeleted = new Map();

const log = (...args) => console.debug('[ledger-sync]', ...args);
const backoff = (failures) => Math.min(BACKOFF_MIN_MS * 2 ** Math.min(failures, 6), BACKOFF_MAX_MS);

// Wraps a handler so its async work (ensureMapEntry fetches, trash backfill)
// can never surface as an unhandled rejection.
const guard = (fn) => (msg) => Promise.resolve().then(() => fn(msg)).catch((e) => console.warn('[ledger-sync] handler failed', e));

async function applyToken() {
  const { data, error } = await supabase.functions.invoke('realtime-token', { method: 'POST' });
  if (error) throw new Error(error.message || 'realtime-token request failed');
  if (!data?.token) throw new Error('realtime-token returned no token');
  // Diagnostic: open the app with ?syncdebug to print the minted token so its
  // signature can be checked offline (backend/scripts/verify-realtime-token.mjs).
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('syncdebug')) {
    log('minted token (syncdebug)', data.token);
  }
  // Manual-token mode: realtime-js preserves this across resubscribes/heartbeats.
  await supabase.realtime.setAuth(data.token);
}

function retry(fn, delay) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(fn, delay);
}

// Full (re)connect: fresh token, then a brand-new channel. Re-run on channel
// errors and on token refresh failures — each run starts with a new token, so a
// server-closed socket (expired token) heals on the next attempt.
async function connect() {
  const gen = generation;
  if (stopped) return;
  try {
    await applyToken();
    tokenFailures = 0;
  } catch (e) {
    tokenFailures += 1;
    log('token attempt failed', tokenFailures, e);
    if (tokenFailures < TOKEN_FAILURE_LIMIT) {
      retry(connect, backoff(tokenFailures));
    } else {
      console.warn('[ledger-sync] giving up on realtime auth (function not deployed or device revoked); live sync stays off until reload');
    }
    return;
  }
  if (stopped || gen !== generation) return;

  if (channel) {
    const old = channel;
    channel = null;
    supabase.removeChannel(old);
  }
  const ch = supabase.channel('ledger-changes');
  channel = ch;
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, guard(onPartyEvent));
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, guard(onEntryEvent));
  ch.subscribe((status, err) => {
    if (channel !== ch || gen !== generation) return; // superseded channel (stale callback)
    // Log the full error object: err.cause carries the raw server reply, which
    // realtime-js docs specifically warn can be hidden behind err.message alone.
    log('channel', status, err ? String(err.message || err) : '', err ?? '');
    if (status === 'SUBSCRIBED') {
      channelFailures = 0;
      return;
    }
    if (!stopped && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
      channelFailures += 1;
      retry(connect, backoff(channelFailures));
    }
  });
}


// ---- Cache lookups shared by the handlers -----------------------------------

const inList = (which, id) => (qc.getQueryData(['parties', which]) || []).some((p) => p.id === id);
const wasInTrashParties = (id) => (qc.getQueryData(['trash', 'parties']) || []).some((p) => p.id === id);

function findParty(id) {
  return (
    qc.getQueryData(['party', id]) ||
    (qc.getQueryData(['parties', 'active']) || []).find((p) => p.id === id) ||
    (qc.getQueryData(['parties', 'archived']) || []).find((p) => p.id === id) ||
    null
  );
}

// The party's live entries from whichever cache already holds them; null means
// "never fetched this session" (first mount does the one-time fetch).
function cachedLiveEntries(partyId) {
  const direct = qc.getQueryData(['entries', partyId]);
  if (direct) return direct.filter((e) => !e.deleted_at);
  for (const key of ['entries-map', 'entries-map-archived']) {
    const map = qc.getQueryData([key]);
    if (map && partyId in map) return map[partyId].filter((e) => !e.deleted_at);
  }
  return null;
}

// A DELETE event's `old` carries only the primary key (REPLICA IDENTITY default),
// so the party_id needed by applyPurgedEntry is recovered from the caches.
function findEntryAnywhere(entryId) {
  const trash = (qc.getQueryData(['trash', 'entries']) || []).find((e) => e.id === entryId);
  if (trash) return trash;
  const lists = qc.getQueriesData({ predicate: (q) => q.queryKey[0] === 'entries' && q.queryKey.length === 2 });
  for (const [, list] of lists) {
    const hit = (list || []).find((e) => e.id === entryId);
    if (hit) return hit;
  }
  const maps = qc.getQueriesData({ predicate: (q) => String(q.queryKey[0]).startsWith('entries-map') });
  for (const [, map] of maps) {
    for (const rows of Object.values(map || {})) {
      const hit = (rows || []).find((e) => e.id === entryId);
      if (hit) return hit;
    }
  }
  return null;
}

// ---- parties ----------------------------------------------------------------

async function onRemotePartyDeleted(row) {
  const live = cachedLiveEntries(row.id);
  const trashFetched = qc.getQueryData(['trash', 'entries']) !== undefined;
  if (live || !trashFetched) {
    // Either we have the live rows, or nobody is looking at the trash — either
    // way there is nothing to fetch; leave unfetched datasets alone.
    applyDeletedParty(qc, row, live || []);
    return;
  }
  // Trash is on screen but this session never loaded this party's entries: fetch
  // them once (same spirit as ensureMapEntry) so Recently Deleted shows them.
  let rows = [];
  try {
    rows = await fetchEntries(row.id, { includeDeleted: true });
  } catch (e) {
    log('trash backfill fetch failed', e);
    return;
  }
  if (!qc || partyDeleted.get(row.id) !== true) return; // restored/purged meanwhile
  insertTrashEntries(qc, rows.filter((r) => r.deleted_with_party));
  applyDeletedParty(qc, row, rows.filter((r) => !r.deleted_at));
}

async function onPartyEvent(msg) {
  if (!qc) return;
  if (msg.errors) return log('party event errors', msg.errors);
  const row = msg.new;
  const old = msg.old;
  if (msg.eventType === 'INSERT' && row?.id && !row.deleted_at) {
    applyCreatedParty(qc, row);
  } else if (msg.eventType === 'UPDATE' && row?.id) {
    if (row.deleted_at) {
      partyDeleted.set(row.id, true);
      await onRemotePartyDeleted(row);
    } else {
      const restoring = partyDeleted.get(row.id) === true || wasInTrashParties(row.id);
      partyDeleted.set(row.id, false);
      if (restoring) {
        await applyRestoredParty(qc, row);
      } else if (inList('active', row.id) && row.is_archived) {
        await applyArchiveState(qc, row, true);
      } else if (inList('archived', row.id) && !row.is_archived) {
        await applyArchiveState(qc, row, false);
      } else {
        applyUpdatedParty(qc, row);
      }
    }
  } else if (msg.eventType === 'DELETE' && old?.id) {
    partyDeleted.delete(old.id);
    applyPurgedParty(qc, old.id);
  }
}

// ---- entries ----------------------------------------------------------------

async function onEntryEvent(msg) {
  if (!qc) return;
  if (msg.errors) return log('entry event errors', msg.errors);
  const row = msg.new;
  const old = msg.old;
  if (msg.eventType === 'INSERT' && row?.id && !row.deleted_at) {
    applyCreatedEntry(qc, row.party_id, row);
  } else if (msg.eventType === 'UPDATE' && row?.id) {
    if (row.deleted_at) {
      applyDeletedEntry(qc, row.party_id, row, findParty(row.party_id)?.name);
    } else {
      // Covers restore, plain edits and photo changes alike: the row is live, so
      // drop it from the trash (no-op if absent) and upsert it into live caches.
      applyRestoredEntry(qc, row);
    }
  } else if (msg.eventType === 'DELETE' && old?.id) {
    applyPurgedEntry(qc, findEntryAnywhere(old.id) || { id: old.id });
  }
}

// ---- Lifecycle ---------------------------------------------------------------

// Called by LedgerShell on mount (i.e. while the ledger is unlocked).
export function startRealtimeSync(queryClient) {
  if (!stopped) return;
  generation += 1;
  stopped = false;
  qc = queryClient;
  tokenFailures = 0;
  channelFailures = 0;
  partyDeleted.clear();
  connect();
  refreshTimer = setInterval(() => {
    applyToken()
      .then(() => {
        tokenFailures = 0;
      })
      .catch((e) => log('background token refresh failed', e));
  }, TOKEN_REFRESH_MS);
}

// Called on unmount/lock. Safe to call when never started.
export function stopRealtimeSync() {
  generation += 1;
  stopped = true;
  clearTimeout(retryTimer);
  clearInterval(refreshTimer);
  retryTimer = null;
  refreshTimer = null;
  if (channel) {
    const old = channel;
    channel = null;
    supabase.removeChannel(old);
  }
  qc = null;
  partyDeleted.clear();
}
