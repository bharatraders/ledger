import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeScreen from './HomeScreen';
import PartyScreen from '../party/PartyScreen';
import { SessionIcons } from '../layout/SessionControls';

// Tablet/laptop (>= md): party list as a fixed left sidebar, selected party in the
// right pane. Phone (< md): behaves exactly like before — full-screen list, and the
// selected party renders full-screen via the /party/:id route semantics.
export default function HomeTwoPane() {
  const [selectedId, setSelectedId] = useState(null);
  const navigate = useNavigate();
  const params = useParams();
  // The right pane shows either a party or the empty placeholder below. Its sticky
  // navbar (rendered next) carries the one copy of the session controls for every
  // view type down here, so the sidebar header never shows them (desktopIcons=false).
  const partyId = selectedId || params.id;
  const hasParty = !!partyId;

  function select(id) {
    setSelectedId(id);
    // On small screens there is no right pane visible, so push the route.
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      navigate(`/party/${id}`);
    }
  }

  return (
    <div className="w-full">
      <div className="md:grid md:grid-cols-[20rem_1fr]">
        <div className="min-h-screen border-rule md:border-r">
          <HomeScreen onSelectParty={select} selectedId={selectedId} embedded desktopIcons={false} />
        </div>
        {/* One sticky navbar owns the session controls for the whole right pane, so
            the icons stay put for every view type below — empty placeholder, party
            ledger, loading — and never duplicate into the left sidebar. */}
        <div className="hidden min-h-screen md:flex md:flex-col">
          <div className="sticky top-0 z-10 flex items-center justify-end bg-head px-[18px] py-3 text-headink">
            <SessionIcons className="flex items-center gap-2" />
          </div>
          {hasParty ? (
            <PartyScreen key={partyId} partyId={partyId} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center text-muted">
              <p>Select a party to view its ledger.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
