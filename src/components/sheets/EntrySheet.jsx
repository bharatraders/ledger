import { useEffect, useRef, useState } from 'react';
import BottomSheet from './BottomSheet';
import { compressImage } from '../../utils/image';
import { fmtAmount, todayStr } from '../../utils/format';
import { getSignedPhotoUrl } from '../../lib/api/storage';

// One sheet for adding and editing entries: pass `entry` to edit it. In edit mode the
// type can be flipped too (a debit logged as a credit is the usual mistake) and the
// stored photo is previewed from a signed URL until Remove, or a new pick replaces it.
export default function EntrySheet({ type: initialType, entry, onSave, onClose, saving }) {
  const editing = Boolean(entry);
  const [type, setType] = useState(initialType || entry?.type || 'd');
  const [amount, setAmount] = useState(entry ? fmtAmount(entry.amount) : '');
  const [date, setDate] = useState(entry?.entry_date || todayStr());
  const [remark, setRemark] = useState(entry?.remark || '');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [keepExisting, setKeepExisting] = useState(Boolean(entry?.photo_path));
  const [existingUrl, setExistingUrl] = useState('');
  const [error, setError] = useState('');
  const camRef = useRef(null);
  const galRef = useRef(null);

  useEffect(() => {
    if (!entry?.photo_path) return undefined;
    let live = true;
    getSignedPhotoUrl(entry.photo_path).then(
      (u) => {
        if (live) setExistingUrl(u);
      },
      () => {}
    );
    return () => {
      live = false;
    };
  }, [entry?.photo_path]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function pick(file) {
    if (!file) return;
    try {
      const blob = await compressImage(file, { maxDim: 1280, quality: 0.75 });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPhotoBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setError('Could not read that photo. Try another.');
    }
  }

  function removePhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoBlob(null);
    setPreviewUrl('');
    setKeepExisting(false); // drops the stored photo when the entry is saved
  }

  async function save() {
    const amt = parseFloat(String(amount).replace(/,/g, ''));
    if (!(amt > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    setError('');
    await onSave({
      type,
      amount: amt,
      date,
      remark: remark.trim(),
      photoBlob,
      // Only meaningful in edit mode: the stored photo should be deleted, and the sheet
      // was neither given a replacement nor told to keep it.
      removePhoto: Boolean(!photoBlob && !keepExisting && entry?.photo_path),
    });
  }

  const isDebit = type === 'd';

  return (
    <BottomSheet title={editing ? 'Edit entry' : isDebit ? 'Add Debit entry' : 'Add Credit entry'} onClose={onClose}>
      {editing ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5" role="group" aria-label="Entry type">
          {['d', 'c'].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`rounded-xl border-2 p-3 font-bold ${
                type === t
                  ? t === 'd'
                    ? 'border-dr bg-drbg text-dr'
                    : 'border-cr bg-crbg text-cr'
                  : 'border-rule bg-paper text-muted'
              }`}
            >
              {t === 'd' ? 'Debit' : 'Credit'}
            </button>
          ))}
        </div>
      ) : null}
      <label htmlFor="amt" className="mb-1 mt-3 block text-[15px] font-semibold text-muted">
        Amount (₹)
      </label>
      <input
        id="amt"
        className="w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-[32px] font-extrabold"
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <label htmlFor="dt" className="mb-1 mt-3 block text-[15px] font-semibold text-muted">
        Date
      </label>
      <input
        id="dt"
        type="date"
        className="w-full rounded-xl border-2 border-rule bg-paper p-3.5"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <label htmlFor="rm" className="mb-1 mt-3 block text-[15px] font-semibold text-muted">
        Remark
      </label>
      <textarea
        id="rm"
        rows={2}
        className="w-full rounded-xl border-2 border-rule bg-paper p-3.5"
        placeholder="e.g. Challan no. 1042, 300 shirts"
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
      />
      <div className="mb-1 mt-3 text-[15px] font-semibold text-muted">Photo of challan or slip</div>
      {previewUrl || (keepExisting && existingUrl) ? (
        <div className="relative mt-2">
          <img alt="Slip preview" src={previewUrl || existingUrl} className="max-h-60 w-full rounded-xl bg-rule object-contain" />
          <button
            type="button"
            onClick={removePhoto}
            className="absolute right-2 top-2 rounded-full bg-black/65 px-3 py-1.5 text-sm text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => camRef.current?.click()}
            className="rounded-xl border border-rule bg-paper p-4 font-semibold"
          >
            📷 Take photo
          </button>
          <button
            type="button"
            onClick={() => galRef.current?.click()}
            className="rounded-xl border border-rule bg-paper p-4 font-semibold"
          >
            🖼 From gallery
          </button>
        </div>
      )}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div className="mt-2 min-h-5 text-[15px] text-dr" id="err" role="alert">
        {error}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className={`mt-4 w-full rounded-[14px] p-[18px] text-xl font-extrabold text-white disabled:opacity-60 dark:text-[#0D1322] ${
          isDebit ? 'bg-dr' : 'bg-cr'
        }`}
      >
        {saving ? 'Saving…' : editing ? 'Save changes' : `Save ${isDebit ? 'Debit' : 'Credit'}`}
      </button>
      <button type="button" onClick={onClose} className="mt-2 w-full p-3 text-muted">
        Cancel
      </button>
    </BottomSheet>
  );
}
