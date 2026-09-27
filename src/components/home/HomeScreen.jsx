import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useParties } from '../../hooks/useParties';
import { fetchEntries } from '../../lib/api/entries';
import { createParty } from '../../lib/api/parties';
import { applyCreatedParty } from '../../lib/cache';
import { computeBalance } from '../../utils/ageing';
import { fmtAmount } from '../../utils/format';
import { isAuthError } from '../../lib/api/auth';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AppShell from '../layout/AppShell';
import NavBar from '../layout/NavBar';
import TotalsBar from './TotalsBar';
import SearchBar from './SearchBar';
import PartyListItem from './PartyListItem';
import PartySheet from '../sheets/PartySheet';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';

function useEntriesMap(parties) {
  // Stable key on purpose: the party-id list used to be part of the key, so adding a
  // party changed the key and re-fetched every party's entries. The map is patched
  // in place instead (see src/lib/cache.js) and fetched exactly once per session.
  return useQuery({
    queryKey: ['entries-map'],
    queryFn: async () => {
      const out = {};
      await Promise.all(
        (parties || []).map(async (p) => {
          out[p.id] = await fetchEntries(p.id);
        })
      );
      return out;
    },
    enabled: !!parties,
  });
}

export default function HomeScreen({ onSelectParty, selectedId, embedded, desktopIcons = true }) {
  const [q, setQ] = useState('');
  const [showPartySheet, setShowPartySheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lock } = useAuth();
  const { toast } = useToast();
  const partiesQ = useParties();
  const entriesMapQ = useEntriesMap(partiesQ.data);

  useEffect(() => {
    if (partiesQ.error && isAuthError(partiesQ.error)) lock();
  }, [partiesQ.error, lock]);

  const parties = partiesQ.data || [];
  const entriesMap = entriesMapQ.data || {};

  let toGet = 0;
  let toPay = 0;
  parties.forEach((p) => {
    const b = computeBalance(entriesMap[p.id] || []);
    if (b > 0) toGet += b;
    else toPay += -b;
  });

  const query = q.trim().toLowerCase();
  const list = parties
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exact = parties.some((p) => p.name.toLowerCase() === query);

  function open(id) {
    if (onSelectParty) onSelectParty(id);
    else navigate(`/party/${id}`);
  }

  async function saveParty({ name, phone, notes }) {
    setSaving(true);
    try {
      const p = await createParty({ name, phone, notes });
      // Mutation first; only on success the confirmed row joins the local cache —
      // no invalidate, so no refetch of the parties list.
      applyCreatedParty(queryClient, p);
      setShowPartySheet(false);
      setQ('');
      toast('Party added');
      open(p.id);
    } finally {
      setSaving(false);
    }
  }

  const inner = (
    <>
      <NavBar
        title="Party Ledger"
        sub={`${parties.length} parties`}
        actions={null}
        desktopIcons={desktopIcons}
      />
      <div className="px-[18px]">
        <TotalsBar toGet={fmtAmount(toGet)} toPay={fmtAmount(toPay)} />
      </div>
      <SearchBar value={q} onChange={setQ} />
      <div className="mx-4 mb-28 mt-2 flex flex-col gap-2.5">
        {query && !exact ? (
          <button
            type="button"
            onClick={() => setShowPartySheet(true)}
            className="w-full rounded-[14px] bg-accent p-4 text-lg font-bold text-white dark:text-[#0D1322]"
          >
            + Add “{q.trim()}” as new party
          </button>
        ) : null}
        {partiesQ.isLoading || entriesMapQ.isLoading ? (
          <Spinner />
        ) : (
          <>
            {list.map((p) => (
              <div key={p.id} className={selectedId === p.id ? 'rounded-[14px] ring-2 ring-accent' : ''}>
                <PartyListItem
                  party={p}
                  entries={entriesMap[p.id] || []}
                  onOpen={() => open(p.id)}
                />
              </div>
            ))}
            {!list.length && !query ? <EmptyState>No parties yet. Tap the button below to add one.</EmptyState> : null}
            {!list.length && query ? <EmptyState>No party matches “{q.trim()}”.</EmptyState> : null}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowPartySheet(true)}
        className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] right-[max(16px,calc(50%-304px))] rounded-full bg-accent px-[22px] py-4 font-bold text-white shadow-lg dark:text-[#0D1322] lg:right-8"
      >
        + New party
      </button>
      {showPartySheet ? (
        <PartySheet
          initialName={q.trim()}
          saving={saving}
          onSave={saveParty}
          onClose={() => setShowPartySheet(false)}
        />
      ) : null}
    </>
  );

  if (embedded) return <div className="w-full">{inner}</div>;
  return <AppShell>{inner}</AppShell>;
}
