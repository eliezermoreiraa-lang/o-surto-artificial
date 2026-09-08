(function (root) {
  'use strict';
  const zone = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  function localDay(value) {
    const date = new Date(value);
    if (!value || !Number.isFinite(date.getTime())) return null;
    const parts = Object.fromEntries(zone.formatToParts(date).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function summarize(rows) {
    const cents = rows.reduce((sum, row) => sum + Math.round(Number(row.amount || 0) * 100), 0);
    return { total: cents / 100, count: rows.length, supporters: new Set(rows.map(row => row.user_id).filter(Boolean)).size, average: rows.length ? Math.round(cents / rows.length) / 100 : 0 };
  }
  function report(supports, now = new Date()) {
    const today = localDay(now), currentMonth = today.slice(0, 7);
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 29);
    const startDay = start.toISOString().slice(0, 10);
    const paid = supports.filter(row => row.payment_status === 'paid');
    const dated = paid.map(row => ({ ...row, day: localDay(row.paid_at) })).filter(row => row.day && new Date(row.paid_at) <= now);
    const monthly = new Map();
    for (const row of dated) {
      const key = row.day.slice(0, 7);
      if (!monthly.has(key)) monthly.set(key, []);
      monthly.get(key).push(row);
    }
    const months = new Set([currentMonth, ...monthly.keys()]);
    // Show empty months too, so a gap cannot look like missing accounting data.
    const earliest = [...months].sort()[0];
    for (let month = currentMonth; month >= earliest;) {
      months.add(month);
      const [year, number] = month.split('-').map(Number);
      month = number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
    }
    const period = rows => ({ ...summarize(rows), tiers: ['free', 'supporter', 'highlight', 'vip', 'other'].map(tier => ({ tier, ...summarize(rows.filter(row => tier === 'other' ? !['free', 'supporter', 'highlight', 'vip'].includes(row.tier) : row.tier === tier)) })) });
    return {
      currentMonth, today, startDay,
      months: [...months].sort().reverse().map(month => ({ month, ...period(monthly.get(month) || []) })),
      last30: period(dated.filter(row => row.day >= startDay && row.day <= today)),
      allTime: summarize(paid),
      undated: summarize(paid.filter(row => !localDay(row.paid_at))),
    };
  }
  const api = { report, summarize, localDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SurtoFinance = api;
})(typeof window !== 'undefined' ? window : globalThis);
