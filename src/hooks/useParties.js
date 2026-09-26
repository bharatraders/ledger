import { useQuery } from '@tanstack/react-query';
import { fetchActiveParties, fetchArchivedParties, fetchParty } from '../lib/api/parties';
import { fetchEntries } from '../lib/api/entries';
import { fetchDeletedEntries, fetchDeletedParties } from '../lib/api/trash';

export function useParties() {
  return useQuery({ queryKey: ['parties', 'active'], queryFn: fetchActiveParties });
}

export function useArchivedParties() {
  return useQuery({ queryKey: ['parties', 'archived'], queryFn: fetchArchivedParties });
}

export function useParty(id) {
  const partyQ = useQuery({ queryKey: ['party', id], queryFn: () => fetchParty(id), enabled: !!id });
  const entriesQ = useQuery({
    queryKey: ['entries', id],
    queryFn: () => fetchEntries(id),
    enabled: !!id,
  });
  return { partyQ, entriesQ };
}

export function useTrash() {
  const partiesQ = useQuery({ queryKey: ['trash', 'parties'], queryFn: fetchDeletedParties });
  const entriesQ = useQuery({ queryKey: ['trash', 'entries'], queryFn: fetchDeletedEntries });
  return { partiesQ, entriesQ };
}
