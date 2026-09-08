const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='https://ndfchglutpnbckpcrppy.supabase.co',key='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
(async()=>{
 const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:'launch-qa-20260908@example.invalid',password:process.env.QA_PASSWORD})});
 const session=await login.json();assert.ok(session.access_token);const uid=session.user.id;
 const headers={apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
 const call=async(name,body)=>{const r=await fetch(base+'/functions/v1/'+name,{method:'POST',headers,body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,`${name}: ${JSON.stringify(data)}`);return data};
 const model=await call('supporter-dashboard-data',{});assert.equal(model.currentSupport.tier,'supporter');
 const profile=await call('supporter-profile-save',{displayName:'Teste técnico temporário',socialNetwork:'instagram',socialHandle:'osurtoartificial',socialUrl:'',notificationEmail:session.user.email,publicConsent:true});assert.ok(profile.ok);
 const image=fs.readFileSync(path.join(__dirname,'../assets-min/logo-surto.png'));
 for(const kind of ['face','body']){
   const file=uid+'/qa-'+kind+'.png';
   const upload=await fetch(base+'/storage/v1/object/supporter-photos/'+file,{method:'POST',headers:{...headers,'Content-Type':'image/png','x-upsert':'true'},body:image});assert.equal(upload.status,200,await upload.text());
   const r=await fetch(base+'/rest/v1/publicity_profiles?on_conflict=user_id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:uid,[kind+'_photo_path']:file,...(kind==='face'?{source_photo_path:file}:{}),updated_at:new Date().toISOString()})});assert.ok(r.ok,await r.text());
 }
 const complete=await call('supporter-profile-complete',{});assert.ok(complete.profile.submission_completed_at);
 const reload=await call('supporter-dashboard-data',{});assert.ok(reload.publicityProfile.submission_completed_at);
 const duplicate=await fetch(base+'/functions/v1/supporter-profile-save',{method:'POST',headers,body:JSON.stringify({displayName:'Teste técnico temporário',socialNetwork:'instagram',socialHandle:'osurtoartificial',publicConsent:true})});assert.equal(duplicate.status,409);
 console.log('PASS: real paid dashboard, optional social link, two private uploads, profile completion, read-only after submission');
})().catch(e=>{console.error(e);process.exitCode=1});
