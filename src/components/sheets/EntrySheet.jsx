import { useEffect, useRef, useState } from 'react';
import BottomSheet from './BottomSheet';
import { compressImage } from '../../utils/image';
import { fmtAmount, todayStr } from '../../utils/format';
import { entryPhotos } from '../../lib/api/entries';
import { getSignedPhotoUrl } from '../../lib/api/storage';

// One sheet for adding and editing entries: pass `entry` to edit it. In edit mode the
// type can be flipped too (a debit logged as a credit is the usual mistake).
// Photos: an entry holds 0..N images. Existing ones load as signed URLs (kept
// unless removed); new picks are compressed, previewed locally, and uploaded on
// save. `entryPhotos()` reads both the new photo_paths array and the legacy
// single photo_path column.
export default function EntrySheet({ type: initialType, entry, onSave, onClose, saving }) {
  const editing = Boolean(entry);
  const [type, setType] = useState(initialType || entry?.type || 'd');
  const [amount, setAmount] = useState(entry ? fmtAmount(entry.amount) : '');
  const [date, setDate] = useState(entry?.entry_date || todayStr());
  const [remark, setRemark] = useState(entry?.remark || '');
  const [photoBlobs, setPhotoBlobs] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [keepPaths, setKeepPaths] = useState(() => entryPhotos(entry));
  const [existingUrls, setExistingUrls] = useState({});
  const [error, setError] = useState('');
  const camRef = useRef(null);
  const galRef = useRef(null);

  useEffect(() => {
    const paths = entryPhotos(entry);
    if (!paths.length) return undefined;
    let live = true;
    Promise.all(
      paths.map((p) => getSignedPhotoUrl(p).then((u) => [p, u]).catch(() => null))
    ).then((pairs) => {
      if (!live) return;
      const map = {};
      (pairs || []).forEach((pair) => {
        if (pair) map[pair[0]] = pair[1];
      });
      setExistingUrls(map);
    });
    return () => {
      live = false;
    };
  }, [entry?.id]);

  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previews]);

  async function pickFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (keepPaths.length + photoBlobs.length + list.length > 5) {
      setError('Maximum 5 photos per entry.');
      return;
    }
    try {
      const blobs = await Promise.all(list.map((f) => compressImage(f, { maxDim: 1280, quality: 0.75 })));
      const urls = blobs.map((b) => URL.createObjectURL(b));
      setPhotoBlobs((prev) => [...prev, ...blobs]);
      setPreviews((prev) => [...prev, ...urls]);
    } catch {
      setError('Could not read those photos. Try others.');
    }
  }

  function removeNewPhoto(i) {
    URL.revokeObjectURL(previews[i]);
    setPhotoBlobs((prev) => prev.filter((_, j) => j !== i));
    setPreviews((prev) => prev.filter((_, j) => j !== i));
  }

  function removeExisting(path) {
    setKeepPaths((prev) => prev.filter((p) => p !== path));
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
      photoBlobs,
      keepPhotoPaths: keepPaths,
      // Legacy single-photo contract (kept for callers that still use it):
      photoBlob: photoBlobs[0] || null,
      removePhoto: Boolean(!photoBlobs.length && !keepPaths.length && entryPhotos(entry).length),
    });
  }

  const isDebit = type === 'd';
  const totalPhotos = keepPaths.length + previews.length;

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
        Amount (★)
      </label>
      <input
        id="amt"
        className="w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-[26px] font-extrabold md:text-[32px]"
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
        className="w-full min-w-0 max-w-full rounded-xl border-2 border-rule bg-paper p-2.5 md:p-3.5"
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
      <div className="mb-1 mt-3 text-[15px] font-semibold text-muted">
        Photos of challan or slip {totalPhotos ? `(${totalPhotos}/5)` : '(up to 5)'}
      </div>
      {totalPhotos ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {keepPaths.map((p) => (
            <div key={'k-' + p} className="relative">
              <img
                alt="Saved slip photo"
                src={existingUrls[p] || ''}
                className="h-24 w-full rounded-xl bg-rule object-cover"
              />
              <button
                type="button"
                onClick={() => removeExisting(p)}
                aria-label="Remove saved photo"
                className="absolute right-1 top-1 rounded-full bg-black/65 px-2 py-0.5 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {previews.map((u, i) => (
            <div key={'n-' + i} className="relative">
              <img alt="New slip photo preview" src={u} className="h-24 w-full rounded-xl bg-rule object-cover" />
              <button
                type="button"
                onClick={() => removeNewPhoto(i)}
                aria-label="Remove new photo"
                className="absolute right-1 top-1 rounded-full bg-black/65 px-2 py-0.5 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {totalPhotos < 5 ? (
        <div className="mt-2 grid grid-cols-2 gap-2.5">
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
      ) : null}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          pickFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          pickFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="mt-2 min-h-5 text-[15px] text-dr" id="err" role="alert">
        {error}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className={`mt-4 w-full rounded-[14px] p-4 text-xl font-extrabold text-white disabled:opacity-60 dark:text-[#0D1322] md:p-[18px] ${
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
