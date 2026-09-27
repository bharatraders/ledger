export default function ActionButtons({ onAdd }) {
  return (
    <div className="m-4 grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onAdd('d')}
        className="rounded-2xl bg-dr px-2.5 py-5 text-[19px] font-extrabold text-white dark:text-[#0D1322] md:text-[21px]"
      >
        Debit<small className="block text-sm font-medium opacity-90">Party owes more</small>
      </button>
      <button
        type="button"
        onClick={() => onAdd('c')}
        className="rounded-2xl bg-cr px-2.5 py-5 text-[19px] font-extrabold text-white dark:text-[#0D1322] md:text-[21px]"
      >
        Credit<small className="block text-sm font-medium opacity-90">Party paid</small>
      </button>
    </div>
  );
}
