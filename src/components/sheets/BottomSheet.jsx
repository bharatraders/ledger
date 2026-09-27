import { useEffect } from 'react';

export default function BottomSheet({ title, onClose, children, wide }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/55 md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet-anim max-h-[92vh] w-full overflow-auto rounded-t-[22px] bg-card px-5 pb-[calc(22px+env(safe-area-inset-bottom))] pt-5 md:max-w-lg md:rounded-[22px] md:pb-6 ${
          wide ? 'md:max-w-2xl' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h2 className="mb-3 text-[20px] font-bold md:text-[22px]">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
