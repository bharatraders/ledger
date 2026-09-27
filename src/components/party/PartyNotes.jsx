// Party-level note, rendered inside the party header directly under the name/phone
// line (NavBar's belowSub slot) with that block's sub styling — no longer a card of
// its own below the balance. Renders nothing when there is no text, so parties
// created before 011_party_notes.sql look exactly as they did before.
// whitespace-pre-wrap keeps the line breaks the user typed.
export default function PartyNotes({ notes }) {
  const text = (notes || '').trim();
  if (!text) return null;
  return (
    <p className="mt-1 text-[15px] opacity-75 whitespace-pre-wrap break-words">{text}</p>
  );
}
