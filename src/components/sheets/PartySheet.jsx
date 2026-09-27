import { useState } from 'react';
import BottomSheet from './BottomSheet';
import { PHONE_TEMPLATE, formatPhone, normalizePhone, phoneError } from '../../utils/phone';

// Used for both creating and editing a party: the caller passes initialName/Phone/Notes
// plus a title and submit label. `phone` is held as bare digits while formatPhone()
// renders the input mask.
export default function PartySheet({
  initialName = '',
  initialPhone = '',
  initialNotes = '',
  title = 'Add new party',
  submitLabel = 'Save party',
  onSave,
  onClose,
  saving,
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(normalizePhone(initialPhone));
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState('');

  async function save() {
    const nm = name.trim();
    if (!nm) {
      setError('Enter the party name.');
      return;
    }
    const pe = phoneError(phone);
    if (pe) {
      setError(pe);
      return;
    }
    setError('');
    try {
      await onSave({ name: nm, phone, notes });
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || e?.code === '23505') {
        setError('This party already exists.');
      } else if (msg.includes('notes') && (msg.includes('schema cache') || msg.includes('column'))) {
        setError('Database is missing the notes column. Run backend/sql/011_party_notes.sql, then try again.');
      } else {
        setError('Could not save. Try again.');
      }
    }
  }

  return (
    <BottomSheet title={title} onClose={onClose}>
      <label htmlFor="pn" className="mb-1 mt-3 block text-[15px] font-semibold text-muted">
        Party name
      </label>
      <input
        id="pn"
        className="w-full rounded-xl border-2 border-rule bg-paper p-3.5"
        placeholder="Party name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label htmlFor="pp" className="mb-1 mt-3 block text-[15px] font-semibold text-muted">
        WhatsApp number (optional)
      </label>
      <input
        id="pp"
        type="tel"
        autoComplete="tel"
        className="w-full rounded-xl border-2 border-rule bg-paper p-3.5"
        inputMode="tel"
        placeholder={PHONE_TEMPLATE}
        aria-invalid={Boolean(phoneError(phone))}
        aria-describedby="pp-help"
        value={formatPhone(phone)}
        onChange={(e) => setPhone(normalizePhone(e.target.value))}
      />
      <p id="pp-help" className="mt-1 text-[13px] text-muted">
        Template {PHONE_TEMPLATE} — 10 digits. +91 is fine, it is dropped automatically.
      </p>
      <label htmlFor="pnotes" className="mb-1 mt-3 block text-[15px] font-semibold text-muted">
        Notes (optional)
      </label>
      <textarea
        id="pnotes"
        rows={3}
        className="w-full rounded-xl border-2 border-rule bg-paper p-3.5"
        placeholder="Anything you want to remember about this party"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-2 min-h-5 text-[15px] text-dr" role="alert">
        {error}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="mt-4 w-full rounded-[14px] bg-accent p-4 text-xl font-extrabold text-white disabled:opacity-60 dark:text-[#0D1322] md:p-[18px]"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
      <button type="button" onClick={onClose} className="mt-2 w-full p-3 text-muted">
        Cancel
      </button>
    </BottomSheet>
  );
}
