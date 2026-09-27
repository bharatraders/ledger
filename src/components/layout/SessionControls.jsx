import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Global session controls: the same three actions (Devices, Lock, Theme) as icon
// chips, reused at every breakpoint and in every host:
//   - NavBar title row (md:hidden) — where the old "Theme"/"Lock" labels sat on phones.
//   - NavBar top row (md+) — top-right of full-width screens (Archive, Trash, ...).
//   - HomeTwoPane's sticky right-pane navbar — home + party views on desktop.
// One implementation, so the theme toggle and the lock/navigation logic live in one
// place instead of being duplicated across those hosts.
function useTheme() {
  function toggle() {
    const el = document.documentElement;
    const next = el.classList.contains('dark') ? 'light' : 'dark';
    el.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('party-ledger-theme', next);
    } catch {
      // ignore
    }
  }
  return { toggle };
}

function useSessionActions() {
  const { lock } = useAuth();
  const navigate = useNavigate();
  const { toggle } = useTheme();

  function handleLock() {
    lock();
    navigate('/login', { replace: true });
  }

  return { toggle, handleLock };
}

// All hosts sit on the dark (bg-head) surface; the glyphs take the surrounding ink
// colour via stroke-current. Chips match the app's other header buttons (bg-white/10).
const iconBaseCls = 'flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/10';

// 24-grid stroke glyphs, same recipe as the search icon in home/SearchBar.jsx,
// so no icon library is needed. stroke-current inherits the surrounding ink colour.
function DeviceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[22px] w-[22px] stroke-current"
    >
      <rect x="5" y="2" width="14" height="20" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[22px] w-[22px] stroke-current"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[22px] w-[22px] stroke-current"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function SessionIcons({ className = '' }) {
  const { toggle, handleLock } = useSessionActions();
  return (
    <div className={className}>
      <Link to="/settings/devices" aria-label="Devices" title="Devices" className={iconBaseCls}>
        <DeviceIcon />
      </Link>
      <button
        type="button"
        onClick={handleLock}
        aria-label="Lock ledger"
        title="Lock ledger"
        className={iconBaseCls}
      >
        <LockIcon />
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
        className={iconBaseCls}
      >
        <ThemeIcon />
      </button>
    </div>
  );
}

