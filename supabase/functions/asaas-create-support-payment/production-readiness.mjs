export const requiredPaymentEvents = [
  'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_DELETED',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
];

export function isProductionWebhookReady(result, expectedUrl) {
  return Array.isArray(result?.data) && result.data.some(hook =>
    hook.url === expectedUrl && hook.enabled === true && hook.interrupted === false &&
    Number(hook.apiVersion) === 3 && hook.sendType === 'SEQUENTIALLY' &&
    Array.isArray(hook.events) && requiredPaymentEvents.every(event => hook.events.includes(event))
  );
}
