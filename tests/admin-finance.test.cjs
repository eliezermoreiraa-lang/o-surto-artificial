const { test } = require('node:test');
const assert = require('node:assert/strict');
const { report } = require('../admin-finance.js');
const now = new Date('2026-09-08T15:00:00Z');
const paid = (amount, paid_at, user_id = 'one', tier = 'supporter') => ({ amount, paid_at, user_id, tier, payment_status: 'paid' });

test('current month is the default reference and empty periods show zero', () => {
  const result = report([], now);
  assert.equal(result.currentMonth, '2026-09');
  assert.equal(result.months[0].total, 0);
  assert.equal(result.last30.count, 0);
  assert.equal(result.startDay, '2026-08-10');
});
test('groups by payment confirmation in Brasília, not creation date or UTC month', () => {
  const result = report([
    { ...paid(50, '2026-09-01T02:59:59Z'), created_at: '2026-07-01T00:00:00Z' },
    paid(100, '2026-09-01T03:00:00Z'),
  ], now);
  assert.equal(result.months.find(x => x.month === '2026-08').total, 50);
  assert.equal(result.months.find(x => x.month === '2026-09').total, 100);
  assert.equal(result.allTime.total, 150);
});
test('only confirmed payments count, unique people and categories aggregate accurately in cents', () => {
  const result = report([
    paid('0.10', '2026-09-02T10:00Z'), paid('0.20', '2026-09-02T10:00Z'),
    paid(300, '2026-09-03T10:00Z', 'two', 'vip'),
    ...['pending', 'checkout_created', 'refunded', 'failed', 'cancelled'].map(payment_status => ({ ...paid(999, '2026-09-01T10:00Z'), payment_status })),
  ], now);
  const month = result.months[0];
  assert.equal(month.total, 300.3);
  assert.equal(month.count, 3);
  assert.equal(month.supporters, 2);
  assert.equal(month.average, 100.1);
  assert.equal(month.tiers.find(x => x.tier === 'supporter').total, 0.3);
});
test('last 30 calendar days includes today and excludes the previous day and future payments', () => {
  const result = report([
    paid(10, '2026-08-10T02:59:59Z'), paid(20, '2026-08-10T03:00:00Z'),
    paid(30, now.toISOString()), paid(40, '2026-09-08T15:00:01Z'),
  ], now);
  assert.equal(result.last30.total, 50);
  assert.equal(result.last30.count, 2);
});
test('undated payments are flagged, never assigned to the creation month', () => {
  const result = report([{ ...paid(50, null), created_at: now.toISOString() }, paid(100, 'invalid')], now);
  assert.equal(result.undated.total, 150);
  assert.equal(result.allTime.total, 150);
  assert.equal(result.months[0].total, 0);
});
test('history includes zero months, handles year changes and UTC/local date boundaries', () => {
  const result = report([paid(50, '2025-11-01T15:00Z')], new Date('2026-01-01T02:00Z'));
  assert.equal(result.currentMonth, '2025-12');
  assert.deepEqual(result.months.map(x => x.month), ['2025-12', '2025-11']);
  assert.equal(result.months[0].total, 0);
});
test('pagination retrieves over 1000 rows even when server returns fewer than requested', async () => {
  const { supportHistory } = await import('../supabase/functions/admin-production/support-history.mjs');
  const rows = Array.from({ length: 1205 }, (_, i) => ({ id: String(i).padStart(5, '0'), created_at: String(i).padStart(5, '0') }));
  let calls = 0;
  const client = { from() {
    let cursor = null;
    const query = { select() { return this; }, order() { return this; }, range(from, to) { assert.equal(from, 0); assert.equal(to, 499); return this; }, gt(field, value) { assert.equal(field, 'id'); cursor = value; return this; }, then(resolve) { calls++; resolve({ data: rows.filter(x => cursor === null || x.id > cursor).slice(0, 300), error: null }); } };
    return query;
  } };
  const result = await supportHistory(client);
  assert.equal(result.data.length, 1205);
  assert.equal(new Set(result.data.map(x => x.id)).size, 1205);
  assert.equal(result.data[0].id, '01204');
  assert.equal(calls, 6);
});
test('pagination fails visibly instead of returning an incomplete financial total', async () => {
  const { supportHistory } = await import('../supabase/functions/admin-production/support-history.mjs');
  const error = new Error('database unavailable');
  const query = { select() { return this; }, order() { return this; }, range() { return Promise.resolve({ error }); } };
  await assert.rejects(supportHistory({ from: () => query }), error);
});
