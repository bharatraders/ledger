import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Spinner from './components/common/Spinner';
import AppShell from './components/layout/AppShell';
// Eager on purpose: the three setup screens plus the guards are small and are exactly
// what an unregistered browser needs, so they stay in the entry chunk.
import CreatePinScreen from './components/auth/CreatePinScreen';
import DeviceRegistrationScreen from './components/auth/DeviceRegistrationScreen';
import SignInScreen from './components/auth/SignInScreen';

// Everything below lives in its own chunk and is fetched only once the PIN is verified
// and status becomes 'ready'. That is why /register and /login never pull the ledger
// code, the sheets, the hooks — or LedgerShell, which carries @tanstack/react-query.
const LedgerShell = lazy(() => import('./LedgerShell'));
const HomeTwoPane = lazy(() => import('./components/home/HomeTwoPane'));
const PartyScreen = lazy(() => import('./components/party/PartyScreen'));
const ArchiveScreen = lazy(() => import('./components/archive/ArchiveScreen'));
const RecentlyDeletedScreen = lazy(() => import('./components/trash/RecentlyDeletedScreen'));
const DevicesSettingsScreen = lazy(() => import('./components/auth/DevicesSettingsScreen'));

// Every non-ready auth status maps to exactly one screen, so the guards below can
// send a browser to the right step no matter which URL it landed on.
const SETUP_PATH = {
  register: '/register',
  'create-pin': '/create-pin',
  unlock: '/login',
};

function setupPathFor(status) {
  return SETUP_PATH[status] || '/login';
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

// Home, party, archive, trash and settings all need an unlocked ledger.
function RequireUnlocked({ children }) {
  const { status } = useAuth();
  if (status === 'checking') return <Probing />;
  if (status !== 'ready') return <Navigate to={setupPathFor(status)} replace />;
  return children;
}

// The three setup steps. Each is valid only at its own step, so a stale bookmark — or
// this browser being revoked in another tab — can never skip registration.
function RequireStep({ step, children }) {
  const { status } = useAuth();
  if (status === 'checking') return <Probing />;
  if (status === 'ready') return <Navigate to="/" replace />;
  if (status !== step) return <Navigate to={setupPathFor(status)} replace />;
  return children;
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

export default function Router() {
  // The Suspense boundary is what makes the split work: while a route's ledger chunk is
  // still downloading, the same spinner the guards use is shown instead of the app.
  return (
    <Suspense fallback={<Probing />}>
      <Routes>
      <Route
        path="/register"
        element={
          <RequireStep step="register">
            <DeviceRegistrationScreen />
          </RequireStep>
        }
      />
      <Route
        path="/create-pin"
        element={
          <RequireStep step="create-pin">
            <CreatePinScreen />
          </RequireStep>
        }
      />
      <Route
        path="/login"
        element={
          <RequireStep step="unlock">
            <SignInScreen />
          </RequireStep>
        }
      />
      {/* One pathless layout route for the whole unlocked app: RequireUnlocked keeps
          doing the access check, LedgerShell then supplies the data layer + <Outlet />,
          and each screen inside is a separate lazy chunk. */}
      <Route
        element={
          <RequireUnlocked>
            <LedgerShell />
          </RequireUnlocked>
        }
      >
        <Route path="/" element={<HomeTwoPane />} />
        <Route path="/party/:id" element={<PartyRoute />} />
        <Route path="/archive" element={<ArchiveScreen />} />
        <Route path="/trash" element={<RecentlyDeletedScreen />} />
        <Route path="/settings/devices" element={<DevicesSettingsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
