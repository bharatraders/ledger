import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useParty } from '../../hooks/useParties';
import { createEntry, entryPhotos, softDeleteEntry, updateEntry } from '../../lib/api/entries';
import { setArchived, softDeleteParty, updateParty } from '../../lib/api/parties';
import {
  applyArchiveState,
  applyCreatedEntry,
  applyDeletedEntry,
  applyDeletedParty,
  applyEntryPhotoPath,
  applyUpdatedEntry,
  applyUpdatedParty,
} from '../../lib/cache';
import { deleteEntryPhoto, setEntryPhotoPaths, uploadEntryPhotos, uploadEntryPhoto, getSignedPhotoUrl } from '../../lib/api/storage';
import { computeAgeing, computeBalance, runningBalances, sortEntries } from '../../utils/ageing';
import { fmtAmount } from '../../utils/format';
import { formatPhone } from '../../utils/phone';
import { isAuthError } from '../../lib/api/auth';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AppShell from '../layout/AppShell';
import NavBar from '../layout/NavBar';
import BalanceBox from './BalanceBox';
import PartyNotes from './PartyNotes';
import ActionButtons from './ActionButtons';
import AgeingPanel from './AgeingPanel';
import EntryList from './EntryList';
import PartySheet from '../sheets/PartySheet';
import EntrySheet from '../sheets/EntrySheet';
import ShareSheet from '../sheets/ShareSheet';
import ConfirmDialog from '../sheets/ConfirmDialog';
import PhotoViewer from '../sheets/PhotoViewer';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';

export default function PartyScreen({ partyId: propId, onBack }) {
  const params = useParams();
  const id = propId || params.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lock } = useAuth();
  const { toast } = useToast();
  const { partyQ, entriesQ } = useParty(id);
  const [entryType, setEntryType] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewerUrls, setViewerUrls] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const err = partyQ.error || entriesQ.error;
  useEffect(() => {
    if (err && isAuthError(err)) lock();
  }, [err, lock]);
  const party = partyQ.data;
  const entries = entriesQ.data || [];
  const balance = computeBalance(entries);
  const ageing = computeAgeing(entries);
  const runMap = runningBalances(entries);
  const desc = sortEntries(entries, false);
  function back() {
    if (onBack) onBack();
    else navigate('/');
  }
  // Mutation contract: POST/PUT/RPC first — the local cache is patched with the
  // confirmed row only after it succeeds (src/lib/cache.js). No invalidate/refetch.
  // Photos: kept photos stay at their stored paths (stable per index), new blobs
  // are appended after them; removed ones are deleted from Storage after the row
  // update succeeds, so a failed save never orphans the visible set.
  async function applyPhotoChange(entry, { photoBlobs = [], keepPhotoPaths, photoBlob, removePhoto }) {
    const existing = entryPhotos(entry);
    const keep = Array.isArray(keepPhotoPaths) ? keepPhotoPaths.filter(Boolean) : null;
    const blobs = Array.isArray(photoBlobs) && photoBlobs.length ? photoBlobs : photoBlob ? [photoBlob] : [];
    // No new multi-photo payload — fall back to the legacy single-photo flow.
    if (!keep && !blobs.length) {
      if (photoBlob) {
        try {
          const path = await uploadEntryPhoto(id, entry.id, photoBlob);
          await setEntryPhotoPath(entry.id, path);
          applyEntryPhotoPath(queryClient, id, entry.id, path);
        } catch {
          toast('Entry saved, but photo upload failed.');
        }
        return;
      }
      if (removePhoto) {
        try {
          await setEntryPhotoPaths(entry.id, []);
          applyEntryPhotoPath(queryClient, id, entry.id, []);
          await Promise.all(existing.map((p) => deleteEntryPhoto(p).catch(() => {})));
        } catch {
          toast('Entry saved, but the photo could not be removed.');
        }
      }
      return;
    }
    const keepList = keep || (removePhoto ? [] : existing);
    try {
      const uploaded = blobs.length ? await uploadEntryPhotos(id, entry.id, blobs, keepList.length) : [];
      const finalPaths = [...keepList, ...uploaded];
      await setEntryPhotoPaths(entry.id, finalPaths);
      applyEntryPhotoPath(queryClient, id, entry.id, finalPaths);
      const removed = existing.filter((p) => !finalPaths.includes(p));
      await Promise.all(removed.map((p) => deleteEntryPhoto(p).catch(() => {})));
    } catch {
      toast('Entry saved, but photos could not be updated.');
    }
  }

  async function saveEntry({ type, amount, date, remark, photoBlobs, keepPhotoPaths, photoBlob, removePhoto }) {
    setSavingEntry(true);
    try {
      if (editingEntry) {
        const updated = await updateEntry({ id: editingEntry.id, type, amount, entryDate: date, remark });
        // Patch the confirmed row first, then the photo change, so the later
        // photo_path patch cannot be overwritten by a stale copy of the row.
        applyUpdatedEntry(queryClient, id, updated);
        await applyPhotoChange(editingEntry, { photoBlobs, keepPhotoPaths, photoBlob, removePhoto });
        setEditingEntry(null);
        toast(`Entry updated to ★ ${fmtAmount(amount)}`);
      } else {
        const created = await createEntry({ partyId: id, type, amount, entryDate: date, remark, photoPath: null });
        applyCreatedEntry(queryClient, id, created);
        const blobs = Array.isArray(photoBlobs) && photoBlobs.length ? photoBlobs : photoBlob ? [photoBlob] : [];
        if (blobs.length) {
          try {
            const paths = await uploadEntryPhotos(id, created.id, blobs);
            await setEntryPhotoPaths(created.id, paths);
            applyEntryPhotoPath(queryClient, id, created.id, paths);
          } catch {
            toast('Entry saved, but photo upload failed.');
          }
        }
        setEntryType(null);
        toast(`${type === 'd' ? 'Debit' : 'Credit'} of ★ ${fmtAmount(amount)} saved`);
      }
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not save. Try again.');
    } finally {
      setSavingEntry(false);
    }
  }

  async function savePartyDetails({ name, phone, notes, address }) {
    setSavingDetails(true);
    try {
      const updated = await updateParty({ id, name, phone, notes, address });
      setDetailsOpen(false);
      applyUpdatedParty(queryClient, updated);
      toast('Party updated');
    } catch (e) {
      if (isAuthError(e)) lock();
      // Anything else (e.g. the unique name index) is re-thrown so PartySheet can show
      // "This party already exists." and keep the sheet open with the user's edits.
      else throw e;
    } finally {
      setSavingDetails(false);
    }
  }
  async function doDeleteEntry(entry) {
    setBusy(true);
    try {
      await softDeleteEntry(entry.id);
      setConfirm(null);
      applyDeletedEntry(queryClient, id, entry, party?.name);
      toast('Entry deleted');
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not delete. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function doDeleteParty() {
    setBusy(true);
    try {
      await softDeleteParty(id);
      setConfirm(null);
      applyDeletedParty(queryClient, party, entries);
      toast('Party deleted');
      back();
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not delete. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function toggleArchive() {
    try {
      const next = !party.is_archived;
      await setArchived(id, next);
      await applyArchiveState(queryClient, party, next);
      toast(party.is_archived ? 'Party unarchived' : 'Party archived');
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not update. Try again.');
    }
  }
  async function viewPhoto(entry, startIndex = 0) {
    const paths = entryPhotos(entry);
    if (!paths.length) return;
    try {
      const urls = await Promise.all(paths.map((p) => getSignedPhotoUrl(p)));
      setViewerUrls(urls);
      setViewerIndex(Math.min(Math.max(startIndex, 0), urls.length - 1));
    } catch {
      toast('Could not load photo.');
    }
  }
  if (partyQ.isLoading || entriesQ.isLoading) {
    return (
      <AppShell>
        <NavBar title="Loading" onBack={back} backPill backHideClass="lg:hidden" />
        <Spinner />
      </AppShell>
    );
  }
  if (!party) {
    return (
      <AppShell>
        <NavBar title="Party" onBack={back} backPill backHideClass="lg:hidden" />
        <EmptyState>Party not found.</EmptyState>
      </AppShell>
    );
  }
  return (
    <AppShell>
      {/* Share/Archive/Delete are all party actions, so they live here as buttons.
          Archive and Delete previously hid behind a "..." menu; promoting them is why
          this header keeps no global Theme/Lock controls (sessionControls) — on
          desktop they sit in the right pane's sticky navbar, and phone party screens
          never showed them here. The "< All parties" pill shows on sm/md and is
          hidden at lg+ (backHideClass), where the desktop sidebar is the way back;
          onBack still marks this as a sub-page so the section nav pills stay hidden. */}
      <NavBar
        title={party.name}
        sub={party.phone ? formatPhone(party.phone) : ''}
        belowSub={
          <>
            {party.address ? <p className="mt-1 text-[15px] opacity-75 whitespace-pre-wrap break-words">📍 {party.address}</p> : null}
            <PartyNotes notes={party.notes} />
          </>
        }
        onBack={back}
        backPill
        backHideClass="lg:hidden"
        sessionControls={false}
        actions={
          <>
            <button type="button" onClick={() => setShareOpen(true)} className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 font-semibold">
              <span aria-hidden="true">Share</span>
            </button>
            <button type="button" onClick={() => setDetailsOpen(true)} className="rounded-xl bg-white/10 px-3.5 py-2.5 font-semibold">
              Edit
            </button>
            <button type="button" onClick={toggleArchive} className="rounded-xl bg-white/10 px-3.5 py-2.5 font-semibold">
              {party.is_archived ? 'Unarchive' : 'Archive'}
            </button>
            <button type="button" onClick={() => setConfirm({ kind: 'party' })} className="rounded-xl bg-white/10 px-3.5 py-2.5 font-semibold">
              Delete
            </button>
          </>
        }
      />
      <div className="px-[18px]">
        <BalanceBox balance={balance} />
      </div>
      <ActionButtons onAdd={setEntryType} />
      <AgeingPanel ageing={ageing} />
      {!entries.length ? (
        <EmptyState>No entries yet. Tap Debit or Credit to add the first one.</EmptyState>
      ) : (
        <EntryList entries={desc} ageing={ageing} runningMap={runMap} onDelete={(e) => setConfirm({ kind: 'entry', entry: e })} onEdit={setEditingEntry} onView={viewPhoto} />
      )}
      {entryType ? <EntrySheet type={entryType} saving={savingEntry} onSave={saveEntry} onClose={() => setEntryType(null)} /> : null}
      {editingEntry ? (
        <EntrySheet
          key={editingEntry.id}
          entry={editingEntry}
          type={editingEntry.type}
          saving={savingEntry}
          onSave={saveEntry}
          onClose={() => setEditingEntry(null)}
        />
      ) : null}
      {detailsOpen ? (
        <PartySheet
          title="Edit party"
          submitLabel="Save changes"
          initialName={party.name}
          initialPhone={party.phone || ''}
          initialNotes={party.notes || ''}
          initialAddress={party.address || ''}
          saving={savingDetails}
          onSave={savePartyDetails}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
      {shareOpen ? <ShareSheet party={party} entries={entries} onClose={() => setShareOpen(false)} /> : null}
      {confirm?.kind === 'entry' ? (
        <ConfirmDialog title="Delete this entry?" description="This entry will move to Recently Deleted for 45 days." confirmLabel="Delete entry" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => doDeleteEntry(confirm.entry)} />
      ) : null}
      {confirm?.kind === 'party' ? (
        <ConfirmDialog title="Delete party?" description="The party and all its entries will move to Recently Deleted for 45 days. You can restore them any time before that." confirmLabel="Delete party" busy={busy} onCancel={() => setConfirm(null)} onConfirm={doDeleteParty} />
      ) : null}
      {viewerUrls.length ? (
        <PhotoViewer photos={viewerUrls} index={viewerIndex} onIndex={setViewerIndex} onClose={() => setViewerUrls([])} />
      ) : null}
    </AppShell>
  );
}

