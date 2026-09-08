const assert=require('node:assert/strict');
const base='https://ndfchglutpnbckpcrppy.supabase.co',key='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
(async()=>{
const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:'launch-qa-20260908@example.invalid',password:process.env.QA_PASSWORD})});
const session=await login.json();assert.ok(session.access_token,'QA login failed');
for(const method of ['pix','cartao']){
 const response=await fetch(base+'/functions/v1/asaas-create-support-payment',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({tier:'supporter',amount:50,method,fullName:'Teste QA Surto'})});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.sandbox,true);
 if(method==='pix')assert.ok(result.pix.encodedImage&&result.pix.payload);
 else assert.match(result.invoiceUrl,/sandbox\.asaas\.com/);
 console.log(JSON.stringify({test:method,status:'PASS',supportId:result.supportId,paymentId:result.paymentId}));
}
})().catch(e=>{console.error(e);process.exitCode=1});
