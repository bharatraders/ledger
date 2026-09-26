import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useParty } from '../../hooks/useParties';
import { createEntry, softDeleteEntry, updateEntry } from '../../lib/api/entries';
import { setArchived, softDeleteParty, updateParty } from '../../lib/api/parties';
import { deleteEntryPhoto, setEntryPhotoPath, uploadEntryPhoto, getSignedPhotoUrl } from '../../lib/api/storage';
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
  const [viewerUrl, setViewerUrl] = useState('');
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
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['party', id] }),
      queryClient.invalidateQueries({ queryKey: ['entries', id] }),
      queryClient.invalidateQueries({ queryKey: ['parties'] }),
      queryClient.invalidateQueries({ queryKey: ['entries-map'] }),
    ]);
  }
  // Replace overwrites the deterministic `${partyId}/${entryId}.jpg` object, so a new
  // photo leaves no orphan behind. Remove nulls the column first, then drops the object
  // (photos_delete in 006_storage.sql allows it).
  async function applyPhotoChange(entry, { photoBlob, removePhoto }) {
    if (photoBlob) {
      try {
        const path = await uploadEntryPhoto(id, entry.id, photoBlob);
        await setEntryPhotoPath(entry.id, path);
      } catch {
        toast('Entry saved, but photo upload failed.');
      }
      return;
    }
    if (removePhoto) {
      try {
        await setEntryPhotoPath(entry.id, null);
        await deleteEntryPhoto(entry.photo_path);
      } catch {
        toast('Entry saved, but the photo could not be removed.');
      }
    }
  }

  async function saveEntry({ type, amount, date, remark, photoBlob, removePhoto }) {
    setSavingEntry(true);
    try {
      if (editingEntry) {
        await updateEntry({ id: editingEntry.id, type, amount, entryDate: date, remark });
        await applyPhotoChange(editingEntry, { photoBlob, removePhoto });
        setEditingEntry(null);
        await refresh();
        toast(`Entry updated to \u20B9${fmtAmount(amount)}`);
      } else {
        const created = await createEntry({ partyId: id, type, amount, entryDate: date, remark, photoPath: null });
        if (photoBlob) {
          try {
            const path = await uploadEntryPhoto(id, created.id, photoBlob);
            await setEntryPhotoPath(created.id, path);
          } catch {
            toast('Entry saved, but photo upload failed.');
          }
        }
        setEntryType(null);
        await refresh();
        toast(`${type === 'd' ? 'Debit' : 'Credit'} of \u20B9${fmtAmount(amount)} saved`);
      }
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not save. Try again.');
    } finally {
      setSavingEntry(false);
    }
  }

  async function savePartyDetails({ name, phone, notes }) {
    setSavingDetails(true);
    try {
      await updateParty({ id, name, phone, notes });
      setDetailsOpen(false);
      await refresh();
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
      await refresh();
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
      await queryClient.invalidateQueries({ queryKey: ['parties'] });
      await queryClient.invalidateQueries({ queryKey: ['trash'] });
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
      await setArchived(id, !party.is_archived);
      await refresh();
      toast(party.is_archived ? 'Party unarchived' : 'Party archived');
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not update. Try again.');
    }
  }
  async function viewPhoto(entry) {
    if (!entry.photo_path) return;
    try {
      const url = await getSignedPhotoUrl(entry.photo_path);
      setViewerUrl(url);
    } catch {
      toast('Could not load photo.');
    }
  }
  if (partyQ.isLoading || entriesQ.isLoading) {
    return (
      <AppShell>
        <NavBar title="Loading" onBack={back} />
        <Spinner />
      </AppShell>
    );
  }
  if (!party) {
    return (
      <AppShell>
        <NavBar title="Party" onBack={back} />
        <EmptyState>Party not found.</EmptyState>
      </AppShell>
    );
  }
  return (
    <AppShell>
      {/* Share/Archive/Delete are all party actions, so they live here as buttons.
          Archive and Delete previously hid behind a "..." menu; promoting them is why
          the global Theme/Lock controls are dropped on this page (sessionControls). */}
      <NavBar
        title={party.name}
        sub={party.phone ? formatPhone(party.phone) : ''}
        onBack={back}
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
      <PartyNotes notes={party.notes} />
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
      {viewerUrl ? <PhotoViewer src={viewerUrl} onClose={() => setViewerUrl('')} /> : null}
    </AppShell>
  );
}

