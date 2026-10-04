export function fmtAmount(n) {
  return Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
// Points unit shown before every amount (replaces the old ₹ rupee symbol).
export const POINTS_SYMBOL = '★';
export function fmtPoints(n) {
  return `${POINTS_SYMBOL}${fmtAmount(n)}`;
}
export function fmtDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}
export function balLabel(b) { return b > 0 ? 'Dr' : b < 0 ? 'Cr' : ''; }
export function balWords(b) { return b > 0 ? 'Party owes you' : b < 0 ? 'You owe party' : 'Settled'; }
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
