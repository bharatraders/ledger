import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useArchivedParties } from '../../hooks/useParties';
import { fetchEntries } from '../../lib/api/entries';
import { setArchived } from '../../lib/api/parties';
import { isAuthError } from '../../lib/api/auth';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AppShell from '../layout/AppShell';
import NavBar from '../layout/NavBar';
import PartyListItem from '../home/PartyListItem';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';

export default function ArchiveScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lock } = useAuth();
  const { toast } = useToast();
  const archivedQ = useArchivedParties();

  const parties = archivedQ.data || [];
  const entriesMapQ = useQuery({
    queryKey: ['entries-map-archived', parties.map((p) => p.id).join(',')],
    queryFn: async () => {
      const out = {};
      await Promise.all(
        parties.map(async (p) => {
          out[p.id] = await fetchEntries(p.id);
        })
      );
      return out;
    },
    enabled: !!archivedQ.data,
  });

  useEffect(() => {
    const err = archivedQ.error || entriesMapQ.error;
    if (err && isAuthError(err)) lock();
  }, [archivedQ.error, entriesMapQ.error, lock]);

  async function unarchive(id) {
    try {
      await setArchived(id, false);
      await queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast('Party unarchived');
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not update. Try again.');
    }
  }

  const entriesMap = entriesMapQ.data || {};

  return (
    <AppShell>
      <NavBar title="Archive" sub={`${parties.length} archived`} onBack={() => navigate('/')} backLabel="All parties" />
      <div className="mx-4 mb-10 mt-4 flex flex-col gap-2.5">
        {archivedQ.isLoading || entriesMapQ.isLoading ? (
          <Spinner />
        ) : (
          <>
            {parties.map((p) => (
              <PartyListItem
                key={p.id}
                party={p}
                entries={entriesMap[p.id] || []}
                onOpen={() => navigate(`/party/${p.id}`)}
                action={
                  <button
                    type="button"
                    onClick={() => unarchive(p.id)}
                    className="flex-none rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-bold"
                  >
                    Unarchive
                  </button>
                }
              />
            ))}
            {!parties.length ? <EmptyState>Nothing archived. Archiving removes a party from Home without deleting it.</EmptyState> : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
