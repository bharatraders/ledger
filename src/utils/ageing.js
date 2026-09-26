export const BUCKET_LABELS = ['0-30 days', '31-60 days', '61-90 days', '90+ days'];

function daysSince(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - date) / 86400000));
}

export function sortEntries(entries, asc = true) {
  const sorted = [...entries].sort((a, b) =>
    a.entry_date === b.entry_date
      ? new Date(a.created_at) - new Date(b.created_at)
      : a.entry_date < b.entry_date
      ? -1
      : 1
  );
  return asc ? sorted : sorted.reverse();
}

export function computeBalance(entries) {
  return entries.reduce((s, e) => s + (e.type === 'd' ? e.amount : -e.amount), 0);
}

// Credits are matched to the oldest debit first.
export function computeAgeing(entries) {
  const open = [];
  const map = {};
  sortEntries(entries, true).forEach((e) => {
    if (e.type === 'd') {
      const o = { rem: e.amount, amt: e.amount, days: daysSince(e.entry_date) };
      open.push(o);
      map[e.id] = o;
    } else {
      let c = e.amount;
      for (let i = 0; i < open.length && c > 0; i++) {
        const o = open[i];
        if (o.rem > 0) {
          const t = Math.min(o.rem, c);
          o.rem -= t;
          c -= t;
        }
      }
    }
  });
  const pend = open.filter((o) => o.rem > 0.005);
  const buckets = [0, 0, 0, 0];
  pend.forEach((o) => {
    const i = o.days <= 30 ? 0 : o.days <= 60 ? 1 : o.days <= 90 ? 2 : 3;
    buckets[i] += o.rem;
  });
  return { map, pend, buckets, oldest: pend.length ? pend[0].days : 0 };
}

export function runningBalances(entries) {
  const runMap = {};
  let run = 0;
  sortEntries(entries, true).forEach((e) => {
    run += e.type === 'd' ? e.amount : -e.amount;
    runMap[e.id] = run;
  });
  return runMap;
}
