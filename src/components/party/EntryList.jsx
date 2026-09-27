import { useEffect, useState } from 'react';
import { fmtAmount, fmtDate, balLabel } from '../../utils/format';
import { getSignedPhotoUrl } from '../../lib/api/storage';

export function EntryCard({ entry, pending, running, onDelete, onEdit, onView }) {
  const [thumb, setThumb] = useState('');
  useEffect(() => {
    let live = true;
    if (entry.photo_path) {
      getSignedPhotoUrl(entry.photo_path).then(
        (u) => {
          if (live) setThumb(u);
        },
        () => {}
      );
    }
    return () => {
      live = false;
    };
    // updated_at is in the deps on purpose: replacing a photo keeps the same storage
    // path, so without it the thumbnail would keep showing the stale signed URL.
  }, [entry.photo_path, entry.updated_at]);

  return (
    <div className={`flex gap-3 rounded-xl border border-l-[6px] border-rule bg-card p-3 shadow-sm ${entry.type === 'd' ? 'border-l-dr' : 'border-l-cr'}`}>
      <div className="min-w-0 flex-1">
        <div>
          <span className="num text-[20px] font-extrabold md:text-[22px]">₹{fmtAmount(entry.amount)}</span>
          <span
            className={`ml-1.5 rounded-md px-2 py-0.5 align-middle text-[13px] font-bold ${
              entry.type === 'd' ? 'bg-drbg text-dr' : 'bg-crbg text-cr'
            }`}
          >
            {entry.type === 'd' ? 'Debit' : 'Credit'}
          </span>
        </div>
        <div className="text-sm text-muted">{fmtDate(entry.entry_date)}</div>
        {entry.remark ? <div className="mt-1 break-words">{entry.remark}</div> : null}
        {entry.type === 'd' ? (
          !pending || pending.rem <= 0.005 ? (
            <div className="mt-1 text-sm font-bold text-cr">Cleared</div>
          ) : (
            <div className={`num mt-1 text-sm font-bold ${pending.days > 60 ? 'text-dr' : 'text-muted'}`}>
              Pending ₹{fmtAmount(pending.rem)}
              {pending.rem < pending.amt ? ` of ₹${fmtAmount(pending.amt)}` : ''} · {pending.days} days old
            </div>
          )
        ) : null}
        <div className="num mt-1 text-[13px] text-muted">
          Balance after: ₹{fmtAmount(running)} {balLabel(running)}
        </div>
      </div>
      <div className="flex flex-none flex-col items-end gap-2">
        {thumb ? (
          <button type="button" onClick={onView} aria-label="View slip photo">
            <img alt="Slip photo thumbnail" src={thumb} className="h-16 w-16 rounded-[10px] border border-rule bg-rule object-cover" />
          </button>
        ) : null}
        <button type="button" onClick={onEdit} className="p-1 text-sm font-semibold text-accent">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="p-1 text-sm text-muted">
          Delete
        </button>
      </div>
    </div>
  );
}

export default function EntryList({ entries, ageing, runningMap, onDelete, onEdit, onView }) {
  return (
    <div className="mx-4 mb-10 flex flex-col gap-2.5">
      {entries.map((e) => (
        <EntryCard
          key={e.id}
          entry={e}
          pending={e.type === 'd' ? ageing.map[e.id] : null}
          running={runningMap[e.id]}
          onDelete={() => onDelete(e)}
          onEdit={() => onEdit(e)}
          onView={() => onView(e)}
        />
      ))}
    </div>
  );
}
