import { computeAgeing, computeBalance, sortEntries } from './ageing';
import { balLabel, balWords, esc, fmtAmount, fmtDate, todayStr } from './format';
import { BUCKET_LABELS } from './ageing';

export function statement(party, entries) {
  const b = computeBalance(entries);
  const L = [];
  L.push('*Account Statement*');
  L.push('Party: *' + party.name + '*');
  L.push('As on: ' + fmtDate(todayStr()));
  L.push('');
  sortEntries(entries, true).forEach((e) => {
    L.push(
      fmtDate(e.entry_date) +
        '  ' +
        (e.type === 'd' ? 'Debit ' : 'Credit') +
        '  \u20B9' +
        fmtAmount(e.amount) +
        (e.remark ? '  (' + e.remark + ')' : '')
    );
  });
  L.push('');
  L.push('*Closing balance: \u20B9' + fmtAmount(b) + ' ' + balLabel(b) + '* (' + balWords(b) + ')');
  const ag = computeAgeing(entries);
  if (ag.pend.length) {
    L.push('');
    L.push('*Ageing of pending amount*');
    ag.buckets.forEach((v, i) => {
      if (v > 0) L.push(BUCKET_LABELS[i] + ': \u20B9' + fmtAmount(v));
    });
    L.push('Oldest unpaid: ' + ag.oldest + ' days');
  }
  return L.join('\n');
}

export function printHTML(party, entries) {
  const b = computeBalance(entries);
  let run = 0;
  const rows = sortEntries(entries, true)
    .map((e) => {
      run += e.type === 'd' ? e.amount : -e.amount;
      return (
        '<tr><td>' +
        fmtDate(e.entry_date) +
        '</td><td>' +
        esc(e.remark) +
        '</td><td class="n">' +
        (e.type === 'd' ? fmtAmount(e.amount) : '') +
        '</td><td class="n">' +
        (e.type === 'c' ? fmtAmount(e.amount) : '') +
        '</td><td class="n">' +
        fmtAmount(run) +
        ' ' +
        balLabel(run) +
        '</td></tr>'
      );
    })
    .join('');
  const ag = computeAgeing(entries);
  const ageTable = ag.pend.length
    ? '<h3>Ageing of pending amount</h3><table><thead><tr>' +
      BUCKET_LABELS.map((x) => '<th class="n">' + x + '</th>').join('') +
      '</tr></thead><tbody><tr>' +
      ag.buckets.map((v) => '<td class="n">' + fmtAmount(v) + '</td>').join('') +
      '</tr></tbody></table><p>Oldest unpaid: ' +
      ag.oldest +
      ' days</p>'
    : '';
  return (
    '<h2>Account Statement: ' +
    esc(party.name) +
    '</h2><p>As on ' +
    fmtDate(todayStr()) +
    '</p><table><thead><tr><th>Date</th><th>Remark</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead><tbody>' +
    rows +
    '</tbody></table><h3>Closing balance: \u20B9' +
    fmtAmount(b) +
    ' ' +
    balLabel(b) +
    '</h3>' +
    ageTable
  );
}
