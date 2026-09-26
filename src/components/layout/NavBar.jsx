import { Link, useNavigate } from 'react-router-dom';
import { useArchivedParties, useTrash } from '../../hooks/useParties';
import { useAuth } from '../../context/AuthContext';

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

export default function NavBar({ title, sub, onBack, backLabel, actions, sessionControls = true }) {
  const { lock } = useAuth();
  const { toggle } = useTheme();
  const navigate = useNavigate();
  const archivedQ = useArchivedParties();
  const trashQ = useTrash();
  const archivedCount = archivedQ.data?.length ?? 0;
  const trashCount = (trashQ.partiesQ.data?.length ?? 0) + (trashQ.entriesQ.data?.length ?? 0);

  function handleLock() {
    lock();
    navigate('/login', { replace: true });
  }

  return (
    <header className="bg-head px-[18px] pb-5 pt-[18px] text-headink">
      {onBack ? (
        <button type="button" onClick={onBack} className="pb-2 text-base opacity-90">
          {'<'} {backLabel || 'All parties'}
        </button>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">{title}</h1>
          {sub ? <div className="mt-0.5 text-[15px] opacity-75">{sub}</div> : null}
        </div>
        <div className="ml-auto flex flex-none items-center gap-2">
          {actions}
          {sessionControls ? (
            <>
              <button
                type="button"
                onClick={toggle}
                aria-label="Toggle dark mode"
                className="rounded-xl bg-white/10 px-3 py-2.5 font-semibold"
              >
                Theme
              </button>
              <button
                type="button"
                onClick={handleLock}
                className="rounded-xl bg-white/10 px-3 py-2.5 font-semibold"
              >
                Lock
              </button>
            </>
          ) : null}
        </div>
      </div>
      {!onBack ? (
        <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Sections">
          <Link to="/archive" className="rounded-full bg-white/10 px-3 py-1.5">
            Archive{archivedCount ? ` (${archivedCount})` : ''}
          </Link>
          <Link to="/trash" className="rounded-full bg-white/10 px-3 py-1.5">
            Recently Deleted{trashCount ? ` (${trashCount})` : ''}
          </Link>
          <Link to="/settings/devices" className="rounded-full bg-white/10 px-3 py-1.5">
            Devices
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
