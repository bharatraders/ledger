export default function ConfirmDialog({ title, description, confirmLabel = 'Delete', onConfirm, onCancel, busy }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-anim w-full max-w-[640px] rounded-t-[22px] bg-card p-5 pb-[calc(22px+env(safe-area-inset-bottom))] md:max-w-md md:rounded-[22px] md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold">{title}</h2>
        {description ? <p className="mt-2 text-muted">{description}</p> : null}
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="w-full rounded-[14px] bg-dr px-4 py-4 text-lg font-extrabold text-white disabled:opacity-60 dark:text-[#0D1322]"
            autoFocus
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className="w-full rounded-[14px] px-4 py-3 text-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
