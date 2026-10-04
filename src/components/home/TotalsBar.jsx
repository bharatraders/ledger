export default function TotalsBar({ toGet, toPay }) {
  return (
    <div className="mt-3.5 flex gap-2.5">
      <div className="flex-1 rounded-xl bg-white/10 px-3 py-2.5">
        <small className="block text-[13px] opacity-80">You will receive</small>
        <b className="num text-[19px] md:text-[21px]">★{toGet}</b>
      </div>
      <div className="flex-1 rounded-xl bg-white/10 px-3 py-2.5">
        <small className="block text-[13px] opacity-80">You will pay</small>
        <b className="num text-[19px] md:text-[21px]">★{toPay}</b>
      </div>
    </div>
  );
}
