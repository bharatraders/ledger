import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTrash } from '../../hooks/useTrash';
import { restoreParty } from '../../lib/api/parties';
import { restoreEntry as restoreEntryApi } from '../../lib/api/entries';
import { entryPhotos } from '../../lib/api/entries';
import { daysLeft, fetchDeletedEntryPhotoPathsForParty, purgeNow } from '../../lib/api/trash';
import {
  applyPurgedEntry,
  applyPurgedParty,
  applyRestoredEntry,
  applyRestoredParty,
} from '../../lib/cache';
import { fmtAmount, fmtDate } from '../../utils/format';
import { isAuthError } from '../../lib/api/auth';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AppShell from '../layout/AppShell';
import NavBar from '../layout/NavBar';
import ConfirmDialog from '../sheets/ConfirmDialog';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';

export default function RecentlyDeletedScreen() {
  const [tab, setTab] = useState('parties');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lock } = useAuth();
  const { toast } = useToast();
  const { partiesQ, entriesQ } = useTrash();
  const err = partiesQ.error || entriesQ.error;
  useEffect(() => {
    if (err && isAuthError(err)) lock();
  }, [err, lock]);
  // Mutation contract: the RPC runs first — only on success do these helpers patch
  // the local caches (trash lists, party lists, entries) from the row on screen.
  // No invalidateQueries, so nothing here triggers a GET.
  async function doRestoreParty(party) {
    try {
      await restoreParty(party.id);
      await applyRestoredParty(queryClient, party);
      toast('Party restored');
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not restore. Try again.');
    }
  }
  async function doRestoreEntry(entry) {
    try {
      await restoreEntryApi(entry.id);
      applyRestoredEntry(queryClient, entry);
      toast('Entry restored');
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not restore. Try again.');
    }
  }
  async function doPurge() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'party') {
        // Photo cleanup needs every photo path of the party's entries: read from the
        // just-fetched trash cache; only if that cache is somehow missing, fall back
        // to fetching the paths (data the purge itself needs — not a UI refresh).
        const cached = queryClient.getQueryData(['trash', 'entries']);
        const photos = cached
          ? cached.filter((e) => e.party_id === confirm.item.id).flatMap((e) => entryPhotos(e))
          : await fetchDeletedEntryPhotoPathsForParty(confirm.item.id);
        await purgeNow('party', confirm.item.id, photos);
        applyPurgedParty(queryClient, confirm.item.id);
        toast('Party permanently deleted');
      } else {
        await purgeNow('entry', confirm.item.id, entryPhotos(confirm.item));
        applyPurgedEntry(queryClient, confirm.item);
        toast('Entry permanently deleted');
      }
      setConfirm(null);
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not delete. Try again.');
    } finally {
      setBusy(false);
    }
  }
  const parties = partiesQ.data || [];
  const entries = entriesQ.data || [];
  const loading = partiesQ.isLoading || entriesQ.isLoading;
  return (
    <AppShell>
      <NavBar title="Recently Deleted" sub="Kept for 45 days, then removed forever" onBack={() => navigate('/')} backLabel="All parties" backPill />
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2 rounded-[14px] border border-rule bg-card p-1.5">
        {['parties', 'entries'].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-[10px] px-3 py-2.5 font-bold capitalize ${tab === t ? 'bg-accent text-white dark:text-[#0D1322]' : 'text-muted'}`}>
            {t} ({t === 'parties' ? parties.length : entries.length})
          </button>
        ))}
      </div>
      <div className="mx-4 mb-10 mt-3 flex flex-col gap-2.5">
        {loading ? <Spinner /> : tab === 'parties' ? (
          <>
            {parties.map((p) => (
              <div key={p.id} className="rounded-[14px] border border-rule bg-card p-3.5">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-muted">Deleted {p.deleted_at ? fmtDate(p.deleted_at.slice(0, 10)) : ''} · Purges in {daysLeft(p.purge_at)} days</div>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => doRestoreParty(p)} className="flex-1 rounded-xl border border-rule bg-paper px-3 py-2.5 font-bold">Restore</button>
                  <button type="button" onClick={() => setConfirm({ kind: 'party', item: p })} className="flex-1 rounded-xl bg-dr px-3 py-2.5 font-bold text-white dark:text-[#0D1322]">Delete permanently</button>
                </div>
              </div>
            ))}
            {!parties.length ? <EmptyState>Nothing in Recently Deleted.</EmptyState> : null}
          </>
        ) : (
          <>
            {entries.map((e) => (
              <div key={e.id} className="rounded-[14px] border border-rule bg-card p-3.5">
                <div className="font-semibold">{e.parties?.name || 'Party'} · <span className="num">₹{fmtAmount(e.amount)}</span> {e.type === 'd' ? 'Debit' : 'Credit'}</div>
                <div className="text-sm text-muted">{fmtDate(e.entry_date)}{e.remark ? ` · ${e.remark}` : ''} · Purges in {daysLeft(e.purge_at)} days</div>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => doRestoreEntry(e)} className="flex-1 rounded-xl border border-rule bg-paper px-3 py-2.5 font-bold">Restore</button>
                  <button type="button" onClick={() => setConfirm({ kind: 'entry', item: e })} className="flex-1 rounded-xl bg-dr px-3 py-2.5 font-bold text-white dark:text-[#0D1322]">Delete permanently</button>
                </div>
              </div>
            ))}
            {!entries.length ? <EmptyState>Nothing in Recently Deleted.</EmptyState> : null}
          </>
        )}
      </div>
      {confirm ? (
        <ConfirmDialog title={confirm.kind === 'party' ? 'Delete this party forever?' : 'Delete this entry forever?'} description="This cannot be undone. Any attached photos will also be removed." confirmLabel="Delete permanently" busy={busy} onCancel={() => setConfirm(null)} onConfirm={doPurge} />
      ) : null}
    </AppShell>
  );
}

