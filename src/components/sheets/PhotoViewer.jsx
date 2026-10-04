export default function PhotoViewer({ src, photos, index = 0, onClose, onIndex }) {
  const list = Array.isArray(photos) && photos.length ? photos : src ? [src] : [];
  const pos = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0));
  const current = list[pos] || '';
  const multi = list.length > 1;

  function step(d) {
    if (!multi) return;
    const next = (pos + d + list.length) % list.length;
    if (onIndex) onIndex(next);
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/90 p-3.5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={multi ? `Slip photo ${pos + 1} of ${list.length}` : 'Slip photo'}
    >
      <img alt={multi ? `Slip photo ${pos + 1} of ${list.length}` : 'Slip photo'} src={current} className="max-h-full max-w-full rounded-lg" />
      {multi ? (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous photo"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 rounded-full bg-white px-4 py-2.5 font-bold text-black"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next photo"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-white px-4 py-2.5 font-bold text-black"
          >
            ›
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-black">
            {pos + 1} / {list.length}
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3.5 top-3.5 rounded-full bg-white px-4 py-2.5 font-bold text-black"
        autoFocus
      >
        Close
      </button>
    </div>
  );
}
