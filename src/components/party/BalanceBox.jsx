import { balLabel, balWords, fmtAmount } from '../../utils/format';

export default function BalanceBox({ balance }) {
  return (
    <div className="mt-3.5 rounded-[14px] bg-white/10 px-3.5 py-3">
      <small className="text-sm opacity-80">{balWords(balance)}</small>
      <b className="num block text-[32px] leading-tight">
        ₹{fmtAmount(balance)} {balLabel(balance)}
      </b>
    </div>
  );
}
