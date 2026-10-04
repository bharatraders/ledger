import { computeAgeing, computeBalance } from '../../utils/ageing';
import { balLabel, balWords, fmtAmount } from '../../utils/format';
import Avatar from '../common/Avatar';

export default function PartyListItem({ party, entries, onOpen, action }) {
  const list = entries || [];
  const b = computeBalance(list);
  const ag = computeAgeing(list);
  const showBadge = ag.oldest > 0 && b > 0;

  return (
    <div className="flex w-full items-center gap-3 rounded-[14px] border border-rule bg-card p-3.5 text-left shadow-sm">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar name={party.name} />
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold md:text-[19px]">{party.name}</div>
          <div className="text-sm text-muted">
            {list.length} entries
            {showBadge ? (
              <>
                {' · '}
                <span className={`font-semibold ${ag.oldest > 60 ? 'text-dr' : ''}`}>
                  Oldest due {ag.oldest} days
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex-none text-right">
          <b className={`num block text-[17px] md:text-[19px] ${b > 0 ? 'text-dr' : b < 0 ? 'text-cr' : ''}`}>
            ★ {fmtAmount(b)} {balLabel(b)}
          </b>
          <small className="text-[13px] text-muted">{balWords(b)}</small>
        </div>
      </button>
      {action}
    </div>
  );
}
