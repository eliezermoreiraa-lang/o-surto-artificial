const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../courses.js'),'utf8');
function fixture(response=async()=>({ok:true,status:201})){
 const listeners={},calls=[];
 const contact={value:' Person@Example.invalid ',type:'email',disabled:false,setCustomValidity(v){this.error=v;},addEventListener(){}};
 const consent={checked:true},website={value:''},button={disabled:false},status={textContent:'',dataset:{}},label={},hint={};
 const radio={value:'email',dispatchEvent(){listeners.change({target:{name:'channel',value:'email'}})}};
 const form={elements:{contact,consent,website},addEventListener:(n,f)=>listeners[n]=f,setAttribute(){},removeAttribute(){},querySelector:s=>s.includes('button')?button:radio,querySelectorAll:()=>[contact,consent,website],reportValidity:()=>!contact.error&&consent.checked&&(contact.type==='tel'||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value.trim())),reset(){contact.value='';consent.checked=false;}};
 const context={document:{querySelector:s=>({'#courseLeadForm':form,'#courseLeadStatus':status,'#leadContactLabel':label,'#contactHint':hint}[s])},AbortController,Event:class{},setTimeout,clearTimeout,fetch:async(url,opts)=>{calls.push({url,payload:JSON.parse(opts.body)});return response();}};
 vm.runInNewContext(source,context);
 return {contact,consent,button,status,calls,change:ch=>listeners.change({target:{name:'channel',value:ch}}),submit:()=>listeners.submit({preventDefault(){}})};
}
test('normalizes email, requires persisted response, resets contact',async()=>{const f=fixture();await f.submit();assert.equal(f.calls[0].payload.contact,'person@example.invalid');assert.match(f.status.textContent,/Pronto!/);assert.equal(f.contact.value,'');assert.equal(f.button.disabled,false);});
test('WhatsApp normalized with international code',async()=>{const f=fixture();f.change('whatsapp');f.contact.value='+55 (11) 99999-9999';await f.submit();assert.equal(f.calls[0].payload.contact,'+5511999999999');assert.equal(f.calls[0].payload.channel,'whatsapp');});
test('invalid contacts and no consent do not call API',async()=>{for(const mode of ['email','phone','consent']){const f=fixture();if(mode==='email')f.contact.value='bad';if(mode==='phone'){f.change('whatsapp');f.contact.value='11999999999';}if(mode==='consent')f.consent.checked=false;await f.submit();assert.equal(f.calls.length,0);}});
test('network and API errors retain entered values',async()=>{for(const response of [async()=>{throw Error('offline')},async()=>({ok:false,status:500,json:async()=>({})})]){const f=fixture(response);await f.submit();assert.equal(f.status.dataset.state,'error');assert.equal(f.contact.value,' Person@Example.invalid ');assert.equal(f.contact.disabled,false);}});
test('only expected duplicate conflict is accepted',async()=>{for(const code of ['23505','other']){const f=fixture(async()=>({ok:false,status:409,json:async()=>({code,message:'course_leads_channel_contact_key'})}));await f.submit();assert.equal(f.status.dataset.state,code==='23505'?'success':'error');}});
test('double click blocked and inputs locked during submission',async()=>{let release;const f=fixture(()=>new Promise(resolve=>release=resolve));const pending=f.submit();await f.submit();assert.equal(f.calls.length,1);assert.equal(f.contact.disabled,true);release({ok:true,status:201});await pending;assert.equal(f.contact.disabled,false);});
