import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';

// Mounted by the pathless layout route in router.jsx, which is the ONLY place the app
// touches @tanstack/react-query — so this module and the provider it carries are part of
// the lazily-loaded ledger chunk, not the entry bundle that /register and /login need.
//
// The client is a module singleton, so it is created once when the chunk first loads and
// survives lock/unlock (locking unmounts these screens but not the module).
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

export default function LedgerShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
