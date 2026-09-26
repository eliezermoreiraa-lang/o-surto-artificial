// A publication consumes the whole support/upgrade chain, not the user's account.
export function supportLifecycle(supports = [], appearances = []) {
  const paid = supports.filter(s => s.payment_status === 'paid');
  const consumed = new Set(appearances.filter(a => a.status === 'published' || a.published_at).map(a => a.support_id));
  const superseded = new Set(paid.map(s => s.upgrade_from_support_id).filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of paid) {
      const parent = s.upgrade_from_support_id;
      if (parent && (consumed.has(s.id) || consumed.has(parent))) {
        for (const id of [s.id, parent]) if (!consumed.has(id)) { consumed.add(id); changed = true; }
      }
    }
  }
  const ranks = { supporter: 1, highlight: 2, vip: 3 };
  const available = paid.filter(s => ranks[s.tier] && !consumed.has(s.id) && !superseded.has(s.id))
    .sort((a, b) => ranks[b.tier] - ranks[a.tier] || new Date(b.created_at) - new Date(a.created_at));
  return { available, consumed, canPurchaseAgain: !available.length && paid.some(s => ranks[s.tier] && consumed.has(s.id)) };
}
