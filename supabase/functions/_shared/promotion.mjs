// Campaign closes at midnight after 5 October, America/Sao_Paulo.
// Only NEW contracts use this clock. Renewals always use subscriptions.amount.
export const promotion = Object.freeze({
  id: 'clube-50-outubro-2026',
  startsAt: '2026-09-25T00:00:00-03:00',
  endsAt: '2026-10-06T00:00:00-03:00'
});
export const regularPrices = Object.freeze({ supporter:50, highlight:100, vip:300 });
export function promotionActive(now=Date.now()) {
  const time = new Date(now).getTime();
  return time >= Date.parse(promotion.startsAt) && time < Date.parse(promotion.endsAt);
}
export function supportPrice(tier, now=Date.now()) {
  if (!Object.hasOwn(regularPrices,tier)) throw new Error('Invalid paid tier');
  return regularPrices[tier] * (promotionActive(now) ? 0.5 : 1);
}
