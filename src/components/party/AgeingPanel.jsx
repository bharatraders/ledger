import { BUCKET_LABELS } from '../../utils/ageing';
import { fmtAmount } from '../../utils/format';

export default function AgeingPanel({ ageing }) {
  if (!ageing.pend.length) return null;
  return (
    <div className="mx-4 mb-4 rounded-[14px] border border-rule bg-card p-3.5 shadow-sm">
      <div className="mb-2.5 font-bold">Ageing of pending debits</div>
      <div className="grid grid-cols-4 gap-2">
        {ageing.buckets.map((v, i) => (
          <div key={i} className={`rounded-[10px] bg-paper px-1.5 py-2 text-center ${i === 3 && v > 0 ? 'bg-drbg' : ''}`}>
            <small className="block text-xs text-muted">{BUCKET_LABELS[i]}</small>
            <b className={`num text-[15px] ${i === 3 && v > 0 ? 'text-dr' : ''}`}>★ {fmtAmount(v)}</b>
          </div>
        ))}
      </div>
      <div className="mt-2.5 text-[13px] text-muted">
        Oldest unpaid: <b>{ageing.oldest} days</b>. Credits are matched to the oldest debit first.
      </div>
    </div>
  );
}
