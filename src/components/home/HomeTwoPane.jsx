import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeScreen from './HomeScreen';
import PartyScreen from '../party/PartyScreen';

// Tablet/laptop (>= md): party list as a fixed left sidebar, selected party in the
// right pane. Phone (< md): behaves exactly like before — full-screen list, and the
// selected party renders full-screen via the /party/:id route semantics.
export default function HomeTwoPane() {
  const [selectedId, setSelectedId] = useState(null);
  const navigate = useNavigate();
  const params = useParams();

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
          <HomeScreen onSelectParty={select} selectedId={selectedId} embedded />
        </div>
        <div className="hidden min-h-screen md:block">
          {selectedId || params.id ? (
            <PartyScreen key={selectedId || params.id} partyId={selectedId || params.id} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="grid h-full place-items-center p-10 text-center text-muted">
              <p>Select a party to view its ledger.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
