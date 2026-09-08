export const monthlyEvents = ['CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED','PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_OVERDUE','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL'];
export const consentVersion = 'monthly-card-2026-09-08';
export const prices = Object.freeze({supporter:50,highlight:100,vip:300});
export function checkoutLink(id) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id || '')) throw new Error('Invalid checkout identifier');
  return `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(id)}`;
}
export function monthlyCheckout(contract, customer, today) {
  return {
    customer, externalReference:`monthly:${contract.id}`, billingTypes:['CREDIT_CARD'], chargeTypes:['RECURRENT'], minutesToExpire:60,
    callback:{successUrl:'https://osurtoartificial.com.br/?monthly=return',cancelUrl:'https://osurtoartificial.com.br/?monthly=cancel',expiredUrl:'https://osurtoartificial.com.br/?monthly=expired'},
    items:[{name:({supporter:'Apoiador mensal',highlight:'Destaque mensal',vip:'VIP mensal'})[contract.tier],description:'O Surto Artificial — divulgação como apoiador, sem participação como personagem.',quantity:1,value:contract.amount}],
    subscription:{cycle:'MONTHLY',nextDueDate:today}
  };
}
export async function provider(path, init={}) {
  const result=await fetch(`https://api.asaas.com/v3${path}`,{...init,signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json','User-Agent':'O-Surto-Artificial/Monthly-1',access_token:Deno.env.get('ASAAS_PRODUCTION_API_KEY')||''}});
  const data=await result.json().catch(()=>({}));
  if(!result.ok){const error=new Error('Não foi possível comunicar com o Asaas. Tente novamente.');error.status=result.status;throw error}
  return data;
}
export async function resolveMonthlyEvent(admin,payload,api=provider) {
  const event=String(payload.event||'');
  let remote=null,payment=null,checkout=payload.checkout||null;
  if(payload.payment?.subscription){
    payment=await api(`/payments/${encodeURIComponent(payload.payment.id)}`);
    try {remote=await api(`/subscriptions/${encodeURIComponent(payment.subscription)}`)}
    catch(error){if(error.status!==404)throw error;remote={id:payment.subscription,deleted:true,value:payment.value,cycle:'MONTHLY',billingType:payment.billingType}}
  }else if(payload.subscription?.id){
    if(event==='SUBSCRIPTION_DELETED')remote={...payload.subscription,deleted:true};
    else remote=await api(`/subscriptions/${encodeURIComponent(payload.subscription.id)}`);
  }else if(!checkout)return null;
  let contract=null;
  async function lookup(column,value){if(!value)return null;const {data,error}=await admin.from('subscriptions').select('*').eq(column,value).maybeSingle();if(error)throw error;return data}
  if(remote?.id)contract=await lookup('provider_subscription_id',remote.id);
  if(!contract)contract=await lookup('checkout_id',remote?.checkoutSession||payment?.checkoutSession||checkout?.id);
  const ref=remote?.externalReference||payment?.externalReference||checkout?.externalReference;
  if(!contract&&/^monthly:[0-9a-f-]{36}$/i.test(ref||''))contract=await lookup('id',ref.slice(8));
  // A checkout-backed subscription may arrive before CHECKOUT_CREATED. Retry instead of losing it.
  if(!contract){if(remote?.checkoutSession||payment?.checkoutSession||String(ref||'').startsWith('monthly:'))throw new Error('Monthly contract not yet linked');return null}
  if(remote?.id&&contract.provider_subscription_id&&contract.provider_subscription_id!==remote.id)throw new Error('Monthly subscription mismatch');
  // nextDueDate can refer to a not-yet-generated bill. Show the nearest outstanding bill instead.
  if(remote&&!remote.deleted){
    const bills=await api(`/subscriptions/${encodeURIComponent(remote.id)}/payments?limit=100`);
    const due=(bills.data||[]).filter(x=>!x.deleted&&['PENDING','OVERDUE'].includes(x.status)).map(x=>x.dueDate).filter(Boolean).sort()[0];
    if(due)remote={...remote,nextDueDate:due};
  }
  return {contract,remote,payment};
}
