import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Spinner from './components/common/Spinner';
import AppShell from './components/layout/AppShell';
// Eager on purpose: the three setup screens are small and are exactly what an
// unregistered browser needs, so they stay in the entry chunk.
import CreatePinScreen from './components/auth/CreatePinScreen';
import DeviceRegistrationScreen from './components/auth/DeviceRegistrationScreen';
import SignInScreen from './components/auth/SignInScreen';

// Everything below lives in its own chunk and is fetched only once the PIN is
// verified and status becomes 'ready'. That is why the locked "/" view never
// pulls the ledger code, the sheets, the hooks — or LedgerShell, which carries
// @tanstack/react-query.
const LedgerShell = lazy(() => import('./LedgerShell'));
const HomeTwoPane = lazy(() => import('./components/home/HomeTwoPane'));
const PartyScreen = lazy(() => import('./components/party/PartyScreen'));
const ArchiveScreen = lazy(() => import('./components/archive/ArchiveScreen'));
const RecentlyDeletedScreen = lazy(() => import('./components/trash/RecentlyDeletedScreen'));
const DevicesSettingsScreen = lazy(() => import('./components/auth/DevicesSettingsScreen'));

// Single-URL app: "/" is the only entry point when not signed in.
//   - register / create-pin / unlock -> "/" itself renders DeviceRegistration /
//     CreatePin / SignIn for the current status.
//   - ready -> "/" renders the ledger home inside the LedgerShell data layer.
// Legacy /register, /create-pin, /login URLs are kept only as redirects to "/"
// so old bookmarks never strand the user on a dead step.
function RootSwitch() {
  const { status } = useAuth();
  if (status === 'checking') return <Probing />;
  if (status === 'register') return <DeviceRegistrationScreen />;
  if (status === 'create-pin') return <CreatePinScreen />;
  if (status !== 'ready') return <SignInScreen />;
  return (
    <LedgerShell>
      <HomeTwoPane />
    </LedgerShell>
  );
}

function Probing() {
  return (
    <AppShell>
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Opening ledger…" />
      </div>
    </AppShell>
  );
}

function useIsWideScreen() {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => setWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

// Deep-linking straight to a party keeps the two-pane layout on wide screens
// (HomeTwoPane reads :id off the URL); phones get the standalone screen.
function PartyRoute() {
  return useIsWideScreen() ? <HomeTwoPane /> : <PartyScreen />;
}

// Unlocked ledger screens share one guard: signed in -> the requested screen
// inside LedgerShell; anything else -> back to "/" (which renders the right
// setup step). So a locked browser can never sit on /register, /login,
// /archive, /party/:id, ... — only "/" or the ledger itself.
function UnlockedShell({ children }) {
  const { status } = useAuth();
  if (status === 'checking') return <Probing />;
  if (status !== 'ready') return <Navigate to="/" replace />;
  return <LedgerShell>{children}</LedgerShell>;
}

export default function Router() {
  // The Suspense boundary is what makes the split work: while a route's ledger
  // chunk is still downloading, the same spinner the guards use is shown.
  return (
    <Suspense fallback={<Probing />}>
      <Routes>
      <Route path="/" element={<RootSwitch />} />
      <Route path="/party/:id" element={<UnlockedShell><PartyRoute /></UnlockedShell>} />
      <Route path="/archive" element={<UnlockedShell><ArchiveScreen /></UnlockedShell>} />
      <Route path="/trash" element={<UnlockedShell><RecentlyDeletedScreen /></UnlockedShell>} />
      <Route path="/settings/devices" element={<UnlockedShell><DevicesSettingsScreen /></UnlockedShell>} />
      {/* Legacy auth URLs: always collapse back to "/". */}
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/create-pin" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

