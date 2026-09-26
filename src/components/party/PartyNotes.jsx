// Party-level note, shown on the party screen directly under the balance. Renders
// nothing when there is no text, so parties created before 011_party_notes.sql look
// exactly as they did before. whitespace-pre-wrap keeps the line breaks the user typed.
export default function PartyNotes({ notes }) {
  const text = (notes || '').trim();
  if (!text) return null;
  return (
    <section className="mx-4 mt-4 rounded-[14px] border border-rule bg-card p-3.5 shadow-sm">
      <h2 className="mb-1 font-bold">Notes</h2>
      <p className="whitespace-pre-wrap break-words">{text}</p>
    </section>
  );
}
