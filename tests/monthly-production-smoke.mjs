// No financial writes: missing/invalid credentials must be rejected before action dispatch.
import assert from 'node:assert/strict';
const base='https://ndfchglutpnbckpcrppy.supabase.co/functions/v1';
const apikey='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
for(const [name,authorization] of [['asaas-monthly-support',null],['asaas-monthly-support','Bearer invalid'],['supporter-dashboard-data',null]]){
  const r=await fetch(`${base}/${name}`,{method:'POST',headers:{apikey,'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify({action:'create',tier:'supporter',method:'cartao',consent:true,consentVersion:'monthly-card-2026-09-08'})});
  assert.equal(r.status,401,`${name} must require verified auth`);console.log('PASS unauthorized '+name);
}
const webhook=await fetch(`${base}/asaas-webhook`,{method:'POST',headers:{apikey,'content-type':'application/json'},body:JSON.stringify({id:'invalid-monthly-smoke',event:'PAYMENT_RECEIVED'})});
assert.equal(webhook.status,401);console.log('PASS unsigned webhook rejected');
