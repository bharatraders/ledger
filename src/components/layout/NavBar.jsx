import { Link } from 'react-router-dom';
import { useArchivedParties, useTrash } from '../../hooks/useParties';
import { SessionIcons } from './SessionControls';

export default function NavBar({ title, sub, belowSub, onBack, backLabel, actions, sessionControls = true, desktopIcons = true, backPill = false, backHideClass = '' }) {
  const archivedQ = useArchivedParties();
  const trashQ = useTrash();
  const archivedCount = archivedQ.data?.length ?? 0;
  const trashCount = (trashQ.partiesQ.data?.length ?? 0) + (trashQ.entriesQ.data?.length ?? 0);
  const showBack = !!onBack;
  // The top row holds the back control and, when session controls apply, the icon
  // cluster. backHideClass (e.g. "lg:hidden") drops the back control at chosen
  // breakpoints — when it is the row's only content the class lands on the row
  // itself too, so no empty strip is left behind there.
  const rowIcons = sessionControls && desktopIcons;

  return (
    <header className="bg-head px-[18px] pb-5 pt-[18px] text-headink">
      {/* Top row: back pill/link on the left, plus the Devices/Lock/Theme icons at the
          top right on desktop (md+). Below md the same icons sit in the title row instead.
          The two-pane home sidebar passes desktopIcons=false — its copy lives in the
          right pane's sticky navbar. */}
      {showBack || rowIcons ? (
        <div
          className={`flex items-center gap-2.5 ${showBack ? 'pb-2' : 'md:pb-2'} ${
            showBack && !rowIcons ? backHideClass : ''
          }`}
        >
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className={`${
                backPill
                  ? 'rounded-full bg-white/10 px-4 py-2 font-semibold'
                  : 'text-base opacity-90'
              } ${backHideClass}`}
            >
              {'<'} {backLabel || 'All parties'}
            </button>
          ) : null}
          {rowIcons ? (
            <SessionIcons className="ml-auto hidden flex-none items-center gap-2 md:flex" />
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold leading-tight md:text-[22px]">{title}</h1>
          {sub ? <div className="mt-0.5 text-[15px] opacity-75">{sub}</div> : null}
        </div>
        <div className="ml-auto flex flex-none items-center gap-2">
          {actions}
          {/* Below md the icons sit here, where the "Theme"/"Lock" labels used to be;
              md+ shows them in the top row (or the sticky right-pane navbar). */}
          {sessionControls ? <SessionIcons className="flex items-center gap-2 md:hidden" /> : null}
        </div>
      </div>
      {/* belowSub: extra header content on its own row under the title/sub block — the
          party page renders its notes here so they share the name/phone styling. Kept
          outside the flex row above so long text never squeezes the action buttons. */}
      {belowSub}
      {!onBack ? (
        <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Sections">
          <Link to="/archive" className="rounded-full bg-white/10 px-3 py-1.5">
            Archive{archivedCount ? ` (${archivedCount})` : ''}
          </Link>
          <Link to="/trash" className="rounded-full bg-white/10 px-3 py-1.5">
            Recently Deleted{trashCount ? ` (${trashCount})` : ''}
          </Link>
          {/* The Devices link is the icon in the title row (and the top row / sticky
              navbar on md+), so no pill here any more. */}
        </nav>
      ) : null}
    </header>
  );
}
