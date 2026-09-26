export default function PhotoViewer({ src, onClose }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/90 p-3.5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Slip photo"
    >
      <img alt="Slip photo" src={src} className="max-h-full max-w-full rounded-lg" />
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
