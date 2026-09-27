import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';
import { startRealtimeSync, stopRealtimeSync } from './lib/realtimeSync';

// Mounted by the pathless layout route in router.jsx, which is the ONLY place the app
// touches @tanstack/react-query — so this module and the provider it carries are part of
// the lazily-loaded ledger chunk, not the entry bundle that /register and /login need.
//
// The client is a module singleton, so it is created once when the chunk first loads and
// survives lock/unlock (locking unmounts these screens but not the module).
//
// Fetch-once-and-cache: staleTime/gcTime Infinity mean every dataset is fetched exactly
// once per session and then served from the local cache — navigating between screens,
// refocusing the tab or remounting a component never triggers a GET. Mutations never
// invalidate (see src/lib/cache.js): they POST/PUT first and patch the cache with the
// confirmed row only after the API call succeeds, so the remote DB stays the source of
// truth while this session's view updates locally. Writes made on ANOTHER device arrive
// live through src/lib/realtimeSync.js (started below) and are patched with the same
// apply* helpers; a full page reload remains the fallback that rebuilds everything from
// the server. Queries in error state still refetch
// on mount/reconnect because they hold no data, so failed loads can recover.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: Infinity, gcTime: Infinity } },
});

export default function LedgerShell({ children }) {
  // Realtime sync lives here because LedgerShell mounts exactly while the ledger is
  // unlocked (RequireUnlocked wraps it) and unmounts on lock — the same lifetime the
  // channel should have. start/stop are idempotent, so StrictMode double-invocation
  // only tears down and immediately re-establishes the subscription.
  useEffect(() => {
    startRealtimeSync(queryClient);
    return () => stopRealtimeSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children ?? <Outlet />}
    </QueryClientProvider>
  );
}
