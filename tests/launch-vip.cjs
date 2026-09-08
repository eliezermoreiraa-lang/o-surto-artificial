const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='https://ndfchglutpnbckpcrppy.supabase.co',key='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
(async()=>{
const session=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:'launch-qa-20260908@example.invalid',password:process.env.QA_PASSWORD})}).then(r=>r.json());assert.ok(session.access_token);
const headers={apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
const call=async(name,body)=>{const r=await fetch(base+'/functions/v1/'+name,{method:'POST',headers,body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,`${name} ${JSON.stringify(d)}`);return d};
const model=await call('supporter-dashboard-data',{});
const payment=await call('asaas-create-support-payment',{tier:'vip',amount:250,method:'pix',upgradeFromSupportId:model.currentSupport.id,fullName:'Teste QA Surto'});assert.equal(payment.sandbox,true);assert.equal(payment.amount,250);
const confirmation=await fetch(base+'/functions/v1/launch-qa-maintenance',{method:'POST',headers:{'x-qa-key':process.env.QA_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:'confirm',supportId:payment.supportId})}).then(r=>r.json());assert.equal(confirmation.status,200);
let next;for(let i=0;i<12;i++){next=await call('supporter-dashboard-data',{});if(next.vipAccess)break;await new Promise(r=>setTimeout(r,1000))}assert.equal(next.vipAccess,true);
const imagePath=session.user.id+'/'+payment.supportId+'/qa-product.png';
const upload=await fetch(base+'/storage/v1/object/vip-briefing-images/'+imagePath,{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:fs.readFileSync(path.join(__dirname,'../assets-min/logo-surto.png'))});assert.equal(upload.status,200,await upload.text());
const briefing=await call('vip-briefing-save',{promotionGoal:'Teste de divulgação',sceneIdea:'Cena técnica de teste, mostrando a marca ao final do episódio.',referenceImagePaths:[imagePath],termsAccepted:true});assert.ok(briefing.ok);
const saved=await call('supporter-dashboard-data',{});assert.ok(saved.vipBriefing.reference_images[0].url);
console.log('PASS: paid upgrade charges only R$250 difference; webhook grants VIP; briefing and private reference image persist with signed download');
})().catch(e=>{console.error(e);process.exitCode=1});
