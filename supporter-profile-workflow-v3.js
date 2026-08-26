(() => {
  'use strict';
  if (window.__surtoProfileWorkflowV3) return;
  window.__surtoProfileWorkflowV3 = true;

  const SB_URL = 'https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const FACE_EXAMPLE_B64 = '/assets-min/onboarding-foto-rosto-exemplo.webp.b64.txt';
  const BODY_EXAMPLE_B64 = '/assets-min/onboarding-foto-corpo-exemplo.webp.b64.txt';
  const NAV_LABELS = ['INÍCIO','MEUS APOIOS','MINHAS APARIÇÕES','PERFIL DE DIVULGAÇÃO','MINHA ASSINATURA','MEUS EPISÓDIOS','ÁREA VIP'];

  let sb = null;
  let model = null;
  let loading = false;
  let observerTimer = null;
  let exampleCache = {};
  let confirmOpen = false;

  const norm = v => String(v || '').replace(/\s+/g,' ').trim().toUpperCase();
  const esc = v => String(v == null ? '' : v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const netLabel = v => ({instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube',x:'X / Twitter',facebook:'Facebook',outro:'Outra'})[String(v||'').toLowerCase()] || v || '—';

  function client(){
    if (sb) return sb;
    if (!(window.supabase && window.supabase.createClient)) return null;
    sb = window.supabase.createClient(SB_URL, SB_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'surto-auth'}
    });
    return sb;
  }

  function ensureCss(){
    if (document.getElementById('surto-profile-v3-css')) return;
    const s=document.createElement('style');
    s.id='surto-profile-v3-css';
    s.textContent=`
      #surto-supporter-real-v2.sv3-transition{opacity:0!important;pointer-events:none!important}
      #surto-supporter-real-v2{transition:opacity .14s ease}
      .sv3{font-family:Inter,system-ui,sans-serif;color:#f5f5f5;padding:0 0 34px}
      .sv3 *{box-sizing:border-box}.sv3 h1,.sv3 h2,.sv3 h3,.sv3 p{margin-top:0}
      .sv3-title{font:400 clamp(38px,5vw,60px)/.95 'Bebas Neue',Inter,sans-serif;margin:22px 0 8px}
      .sv3-lead{max-width:790px;color:rgba(245,245,245,.58);font-size:13.5px;line-height:1.6;margin-bottom:22px}
      .sv3-step{background:#111418;border-radius:14px;padding:24px;margin-bottom:18px;box-shadow:0 0 0 1px rgba(245,245,245,.10)}
      .sv3-step.locked{opacity:.45;pointer-events:none}.sv3-kicker{font-size:9px;letter-spacing:.23em;color:#00e5ff;margin-bottom:9px}.sv3-step h2{font:400 34px/1 'Bebas Neue',Inter,sans-serif;margin-bottom:7px}.sv3-step>p{font-size:12.5px;line-height:1.55;color:rgba(245,245,245,.55)}
      .sv3-form{display:grid;gap:15px;max-width:760px;margin-top:18px}.sv3-field{display:grid;gap:7px}.sv3-field label,.sv3-check{font-size:11px;color:rgba(245,245,245,.58)}
      .sv3-field input,.sv3-field select{width:100%;height:46px;border:0;border-radius:8px;padding:0 13px;background:#0b0d13;color:#f5f5f5;box-shadow:inset 0 0 0 1px rgba(245,245,245,.16);font:13px Inter,sans-serif}
      .sv3-check{display:flex;gap:9px;align-items:flex-start;line-height:1.5}.sv3-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}.sv3-btn{border:0;border-radius:7px;min-height:44px;padding:0 18px;background:#e50914;color:#fff;font:600 10px Inter,sans-serif;letter-spacing:.11em;cursor:pointer}.sv3-btn.secondary{background:#00e5ff;color:#071015}.sv3-btn.ghost{background:transparent;box-shadow:inset 0 0 0 1px rgba(245,245,245,.2)}.sv3-btn:disabled{opacity:.38;cursor:not-allowed}.sv3-msg{font-size:11.5px;color:#ff7b82;min-height:17px}.sv3-msg.ok{color:#00e5ff}
      .sv3-photos{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.sv3-photo{padding:18px;border-radius:12px;background:#0b0d13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.10)}.sv3-photo h3{font-size:13px;margin-bottom:6px}.sv3-photo p{font-size:11px;line-height:1.55;color:rgba(245,245,245,.52)}
      .sv3-label{font-size:8px;letter-spacing:.18em;color:rgba(245,245,245,.42);margin-bottom:7px;text-transform:uppercase}.sv3-frame{width:min(100%,300px);aspect-ratio:9/16;margin:0 auto 15px;border-radius:11px;overflow:hidden;background:#080a0e;box-shadow:inset 0 0 0 1px rgba(245,245,245,.10);display:grid;place-items:center}.sv3-frame img{width:100%;height:100%;object-fit:contain;display:block}.sv3-frame.empty span{padding:18px;text-align:center;font-size:10.5px;line-height:1.5;color:rgba(245,245,245,.35)}
      .sv3-example{background:#f1f1f1}.sv3-example img{object-fit:contain}.sv3-file{display:none}.sv3-status{font-size:10.5px;color:rgba(245,245,245,.48);margin-top:10px}.sv3-status.ok{color:#00e5ff}.sv3-status.err{color:#ff7b82}
      .sv3-complete{margin-top:18px;padding-top:18px;border-top:1px solid rgba(245,245,245,.08)}.sv3-complete p{font-size:11.5px;color:rgba(245,245,245,.52);line-height:1.55;max-width:730px}
      .sv3-modalback{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:20px}.sv3-modal{width:min(520px,100%);background:#111418;border-radius:14px;padding:25px;box-shadow:0 0 0 1px rgba(245,245,245,.14),0 24px 80px rgba(0,0,0,.5)}.sv3-modal h3{font:400 34px/1 'Bebas Neue',Inter,sans-serif;margin-bottom:9px}.sv3-modal p{font-size:12.5px;line-height:1.6;color:rgba(245,245,245,.58)}
      .sv3-success{padding:26px;border-radius:14px;background:linear-gradient(120deg,rgba(0,229,255,.08),#111418 55%,rgba(229,9,20,.08));box-shadow:0 0 0 1px rgba(0,229,255,.25);margin-bottom:18px}.sv3-success h2{font:400 42px/1 'Bebas Neue',Inter,sans-serif;margin:8px 0}.sv3-success p{font-size:12.5px;color:rgba(245,245,245,.58);line-height:1.6}.sv3-badge{display:inline-flex;padding:6px 10px;border-radius:99px;background:rgba(0,229,255,.08);box-shadow:inset 0 0 0 1px rgba(0,229,255,.30);font-size:9px;letter-spacing:.15em;color:#00e5ff}
      .sv3-summary{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}.sv3-card{background:#111418;border-radius:12px;padding:21px;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sv3-card h3{font:400 28px/1 'Bebas Neue',Inter,sans-serif;margin-bottom:13px}.sv3-list{display:grid;gap:0;border-top:1px solid rgba(245,245,245,.08)}.sv3-list div{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid rgba(245,245,245,.08);font-size:11.5px}.sv3-list span{color:rgba(245,245,245,.42)}.sv3-list b{text-align:right;font-weight:500}.sv3-refgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sv3-refgrid .sv3-frame{width:100%;max-width:260px;margin-bottom:0}
      .sv3-avatar{display:grid;grid-template-columns:minmax(220px,.7fr) 1.3fr;gap:22px;align-items:center;background:#111418;border-radius:14px;padding:24px;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sv3-avatar .sv3-frame{margin:0;width:100%;max-width:300px}.sv3-avatar h2{font:400 42px/1 'Bebas Neue',Inter,sans-serif;margin:8px 0}.sv3-avatar p{font-size:12.5px;line-height:1.6;color:rgba(245,245,245,.58)}
      .sv3-progress{background:#111418;border-radius:13px;padding:21px;margin:16px 0;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sv3-progress h2{font:400 31px/1 'Bebas Neue',Inter,sans-serif;margin:0 0 7px}.sv3-progress>p{font-size:11.5px;color:rgba(245,245,245,.52);line-height:1.5}.sv3-track{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px}.sv3-trackitem{padding:14px;border-radius:9px;background:#0b0d13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.08);min-height:92px}.sv3-trackitem.done{box-shadow:inset 0 0 0 1px rgba(0,229,255,.32)}.sv3-trackitem.current{box-shadow:inset 0 0 0 1px rgba(229,9,20,.5)}.sv3-dot{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:rgba(245,245,245,.08);font-size:10px;margin-bottom:10px}.sv3-trackitem.done .sv3-dot{background:#00e5ff;color:#061014}.sv3-trackitem.current .sv3-dot{background:#e50914}.sv3-trackitem b{display:block;font-size:10.5px;margin-bottom:4px}.sv3-trackitem span{font-size:9.8px;color:rgba(245,245,245,.42);line-height:1.4}.sv3-next{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:13px;padding:14px 16px;border-radius:9px;background:rgba(229,9,20,.06);box-shadow:inset 0 0 0 1px rgba(229,9,20,.20)}.sv3-next p{margin:0;font-size:11.5px;line-height:1.5;color:rgba(245,245,245,.58)}
      @media(max-width:860px){.sv3-photos,.sv3-summary,.sv3-avatar{grid-template-columns:1fr}.sv3-track{grid-template-columns:1fr 1fr}.sv3-next{align-items:flex-start;flex-direction:column}}@media(max-width:540px){.sv3-track{grid-template-columns:1fr}.sv3-frame{max-width:260px}}
    `;
    document.head.appendChild(s);
  }

  async function loadModel(force=false){
    if (!force && model) return model;
    const c=client(); if(!c) return null;
    const {data,error}=await c.functions.invoke('supporter-dashboard-data',{body:{}});
    if(error||!data||!data.ok) return null;
    model=data; return model;
  }

  async function exampleData(kind){
    if(exampleCache[kind]) return exampleCache[kind];
    const url=kind==='face'?FACE_EXAMPLE_B64:BODY_EXAMPLE_B64;
    try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)return'';const b64=(await r.text()).trim();exampleCache[kind]=b64?`data:image/webp;base64,${b64}`:'';return exampleCache[kind];}catch{return'';}
  }

  async function signedPhoto(path){
    if(!path)return''; const c=client(); if(!c)return'';
    if(/^https?:\/\//i.test(path))return path;
    const {data}=await c.storage.from('supporter-photos').createSignedUrl(path,3600);
    return data?.signedUrl||'';
  }

  function avatarUrl(path){
    if(!path)return''; if(/^https?:\/\//i.test(path))return path;
    const c=client(); if(!c)return'';
    return c.storage.from('supporter-avatars').getPublicUrl(path).data.publicUrl||'';
  }

  function profileComplete(p){return !!(p&&p.display_name&&p.social_network&&p.social_handle&&p.social_url&&p.notification_email&&p.public_consent)}
  function photosComplete(p){return !!(p&&p.face_photo_path&&p.body_photo_path)}

  function findNav(){
    const all=Array.from(document.querySelectorAll('div'));
    const candidates=all.filter(el=>{const t=norm(el.textContent);return t.length<200&&NAV_LABELS.every(x=>t.includes(x))&&t.includes('SAIR')});
    candidates.sort((a,b)=>norm(a.textContent).length-norm(b.textContent).length); return candidates[0]||null;
  }

  function bindNoOldFlash(){
    const nav=findNav(); if(!nav)return;
    Array.from(nav.querySelectorAll('div')).forEach(el=>{
      const label=norm(el.textContent); if(!NAV_LABELS.includes(label)||el.dataset.sv3Stop==='1')return;
      el.dataset.sv3Stop='1';
      el.addEventListener('click',ev=>{
        const root=document.querySelector('#surto-supporter-real-v2');
        if(root)root.classList.add('sv3-transition');
        ev.stopImmediatePropagation();
        setTimeout(()=>{if(root)root.classList.remove('sv3-transition');scheduleEnhance(0)},120);
      },true);
    });
  }

  function goProfile(){
    const nav=findNav(); if(!nav)return;
    const t=Array.from(nav.querySelectorAll('div')).find(el=>norm(el.textContent)==='PERFIL DE DIVULGAÇÃO'); if(t)t.click();
  }

  function imageFrame(src,alt,extra=''){
    return `<div class="sv3-frame ${extra} ${src?'':'empty'}">${src?`<img src="${esc(src)}" alt="${esc(alt)}">`:'<span>Nenhuma imagem enviada.</span>'}</div>`;
  }

  async function renderEditableProfile(root,m){
    const p=m.publicityProfile||{};
    const pComplete=profileComplete(p); const photosOk=photosComplete(p);
    const face=await signedPhoto(p.face_photo_path); const body=await signedPhoto(p.body_photo_path);
    const faceEx=await exampleData('face'); const bodyEx=await exampleData('body');
    const net=String(p.social_network||'').toLowerCase();
    const opts=[['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube'],['x','X / Twitter'],['facebook','Facebook'],['outro','Outra']];
    root.innerHTML=`<div class="sv3"><h1 class="sv3-title">Perfil de Divulgação</h1><p class="sv3-lead">Preencha seus dados, salve a primeira etapa e depois envie as referências que a produção usará para criar seu avatar.</p>
      <section class="sv3-step"><div class="sv3-kicker">ETAPA 1 DE 2</div><h2>PERFIL DE DIVULGAÇÃO</h2><p>Essas informações serão usadas quando você aparecer nas produções do Surto.</p><div class="sv3-form">
        <div class="sv3-field"><label>Nome de divulgação</label><input id="sv3-name" value="${esc(p.display_name||m.user?.displayName||'')}" placeholder="Como você quer ser identificado"></div>
        <div class="sv3-field"><label>Rede social</label><select id="sv3-network"><option value="">Selecione</option>${opts.map(o=>`<option value="${o[0]}" ${net===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
        <div class="sv3-field"><label>@ / nome de usuário</label><input id="sv3-handle" value="${esc(p.social_handle?'@'+String(p.social_handle).replace(/^@/,''):'')}" placeholder="@seuperfil"></div>
        <div class="sv3-field"><label>E-mail para notificações</label><input id="sv3-email" type="email" value="${esc(p.notification_email||m.user?.email||'')}" placeholder="voce@email.com"></div>
        <div class="sv3-field"><label>Link do perfil</label><input id="sv3-url" value="${esc(p.social_url||'')}" placeholder="https://..."></div>
        <label class="sv3-check"><input id="sv3-consent" type="checkbox" ${p.public_consent?'checked':''}> Autorizo a exibição destes dados nas divulgações e no mural de apoiadores.</label>
        <div class="sv3-msg ${pComplete?'ok':''}" id="sv3-profile-msg">${pComplete?'Etapa salva ✓':''}</div><div class="sv3-actions"><button class="sv3-btn secondary" id="sv3-save-profile">SALVAR ETAPA</button></div>
      </div></section>
      <section class="sv3-step ${pComplete?'':'locked'}" id="sv3-photo-step"><div class="sv3-kicker">ETAPA 2 DE 2</div><h2>FOTOS PARA O SEU AVATAR</h2><p>Mostre como você gostaria de aparecer no Surto. As fotos ficam privadas e são usadas pela equipe para produzir seu avatar oficial.</p>
        <div class="sv3-photos">
          <article class="sv3-photo"><div class="sv3-label">EXEMPLO — FOTO DE ROSTO</div>${imageFrame(faceEx,'Exemplo de foto de rosto','sv3-example')}<h3>FOTO DE ROSTO</h3><p>Rosto próximo e bem visível, olhando para frente, boa iluminação e fundo simples. Evite filtro pesado e óculos escuros.</p><div class="sv3-label">SUA FOTO</div><div id="sv3-face-preview">${imageFrame(face,'Sua foto de rosto')}</div><input class="sv3-file" id="sv3-face" type="file" accept="image/jpeg,image/png,image/webp"><label class="sv3-btn secondary" for="sv3-face" id="sv3-face-btn">${p.face_photo_path?'TROCAR FOTO':'ENVIAR FOTO'}</label><div class="sv3-status ${p.face_photo_path?'ok':''}" id="sv3-face-status">${p.face_photo_path?'Foto salva ✓':'Pendente'}</div></article>
          <article class="sv3-photo"><div class="sv3-label">EXEMPLO — FOTO DE CORPO / LOOK</div>${imageFrame(bodyEx,'Exemplo de foto de corpo inteiro','sv3-example')}<h3>FOTO DE CORPO / LOOK</h3><p>Foto de corpo inteiro, dos pés à cabeça, pose natural e uma roupa que represente como você gostaria de aparecer na novelinha.</p><div class="sv3-label">SUA FOTO</div><div id="sv3-body-preview">${imageFrame(body,'Sua foto de corpo')}</div><input class="sv3-file" id="sv3-body" type="file" accept="image/jpeg,image/png,image/webp"><label class="sv3-btn" for="sv3-body" id="sv3-body-btn">${p.body_photo_path?'TROCAR FOTO':'ENVIAR FOTO'}</label><div class="sv3-status ${p.body_photo_path?'ok':''}" id="sv3-body-status">${p.body_photo_path?'Foto salva ✓':'Pendente'}</div></article>
        </div><div class="sv3-complete"><p>Revise os dados e as duas referências. Depois de concluir, o material será entregue à produção e ficará disponível somente para visualização.</p><button class="sv3-btn" id="sv3-finish" ${photosOk?'':'disabled'}>CONCLUIR ENVIO</button></div>
      </section></div>`;
    bindEditable(root);
  }

  async function renderCompletedProfile(root,m){
    const p=m.publicityProfile||{}; const face=await signedPhoto(p.face_photo_path); const body=await signedPhoto(p.body_photo_path); const av=avatarUrl(p.official_avatar_path);
    const status=p.official_avatar_path?'ready':(p.avatar_status||'awaiting');
    const avatarText=status==='ready'?['AVATAR PRONTO ✓','Esse é o seu avatar oficial para as produções do Surto.']:status==='in_production'?['SEU AVATAR ESTÁ EM PRODUÇÃO','A equipe do Surto está preparando a sua versão para entrar na novelinha.']:['AVATAR AGUARDANDO PRODUÇÃO','Recebemos suas informações e referências. Quando seu avatar estiver pronto, ele aparecerá aqui.'];
    root.innerHTML=`<div class="sv3"><h1 class="sv3-title">Perfil de Divulgação</h1><div class="sv3-success"><span class="sv3-badge">MATERIAL ENVIADO ✓</span><h2>TUDO CERTO DO SEU LADO.</h2><p>Suas informações e referências já foram entregues para a produção. A partir de agora esta área fica em modo de visualização.</p></div>
      <div class="sv3-summary"><section class="sv3-card"><h3>PERFIL DE DIVULGAÇÃO</h3><div class="sv3-list"><div><span>Nome</span><b>${esc(p.display_name||'—')}</b></div><div><span>Rede social</span><b>${esc(netLabel(p.social_network))}</b></div><div><span>@</span><b>${esc(p.social_handle?'@'+String(p.social_handle).replace(/^@/,''):'—')}</b></div><div><span>Link</span><b>${p.social_url?`<a href="${esc(p.social_url)}" target="_blank" rel="noopener" style="color:#00e5ff">abrir perfil</a>`:'—'}</b></div><div><span>Notificações</span><b>${esc(p.notification_email||m.user?.email||'—')}</b></div></div></section>
      <section class="sv3-card"><h3>REFERÊNCIAS ENVIADAS</h3><div class="sv3-refgrid"><div><div class="sv3-label">ROSTO</div>${imageFrame(face,'Foto de rosto enviada')}</div><div><div class="sv3-label">CORPO / LOOK</div>${imageFrame(body,'Foto de corpo enviada')}</div></div></section></div>
      <section class="sv3-avatar">${imageFrame(av,'Avatar oficial',av?'':'empty')}<div><div class="sv3-kicker">SEU AVATAR</div><h2>${avatarText[0]}</h2><p>${avatarText[1]}</p></div></section></div>`;
  }

  function localPreview(kind,file){
    const target=document.querySelector(`#sv3-${kind}-preview`); if(!target)return;
    const url=URL.createObjectURL(file); target.innerHTML=imageFrame(url,'Prévia da foto selecionada'); const img=target.querySelector('img'); if(img)img.onload=()=>URL.revokeObjectURL(url);
  }

  async function upload(kind,file){
    if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024)return;
    const c=client(); if(!c)return; const status=document.querySelector(`#sv3-${kind}-status`); const btn=document.querySelector(`#sv3-${kind}-btn`); localPreview(kind,file); if(status){status.className='sv3-status';status.textContent='Enviando e salvando…'}
    const {data:sd}=await c.auth.getSession(); const user=sd?.session?.user; if(!user){if(status){status.className='sv3-status err';status.textContent='Sua sessão expirou.'}return}
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,''); const path=`${user.id}/${kind}-${Date.now()}.${['jpg','jpeg','png','webp'].includes(ext)?ext:'jpg'}`; const field=kind==='face'?'face_photo_path':'body_photo_path'; const prev=model?.publicityProfile?.[field]||null;
    const up=await c.storage.from('supporter-photos').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type}); if(up.error){if(status){status.className='sv3-status err';status.textContent='Não conseguimos enviar essa foto.'}return}
    const patch={user_id:user.id,[field]:path,updated_at:new Date().toISOString()}; if(kind==='face')patch.source_photo_path=path;
    const db=await c.from('publicity_profiles').upsert(patch,{onConflict:'user_id'}).select('user_id').single(); if(db.error){await c.storage.from('supporter-photos').remove([path]);if(status){status.className='sv3-status err';status.textContent='Não conseguimos vincular a foto ao perfil.'}return}
    if(prev&&prev!==path)c.storage.from('supporter-photos').remove([prev]).catch(()=>{}); model=await loadModel(true); if(status){status.className='sv3-status ok';status.textContent='Foto salva ✓'} if(btn)btn.textContent='TROCAR FOTO'; const finish=document.querySelector('#sv3-finish'); if(finish)finish.disabled=!photosComplete(model?.publicityProfile||{});
  }

  function bindEditable(root){
    const save=root.querySelector('#sv3-save-profile'); if(save)save.addEventListener('click',async()=>{const msg=root.querySelector('#sv3-profile-msg');const body={displayName:root.querySelector('#sv3-name').value.trim(),socialNetwork:root.querySelector('#sv3-network').value, socialHandle:root.querySelector('#sv3-handle').value.trim(),notificationEmail:root.querySelector('#sv3-email').value.trim(),socialUrl:root.querySelector('#sv3-url').value.trim(),publicConsent:root.querySelector('#sv3-consent').checked};save.disabled=true;save.textContent='SALVANDO…';const c=client();const {data,error}=await c.functions.invoke('supporter-profile-save',{body});if(error||!data?.ok){msg.className='sv3-msg';msg.textContent=data?.error||'Não foi possível salvar agora.';save.disabled=false;save.textContent='SALVAR ETAPA';return}msg.className='sv3-msg ok';msg.textContent='Perfil salvo com sucesso ✓';save.textContent='SALVO ✓';model=await loadModel(true);setTimeout(()=>renderProfile(root,model),500)});
    const fi=root.querySelector('#sv3-face'); if(fi)fi.addEventListener('change',e=>upload('face',e.target.files?.[0])); const bi=root.querySelector('#sv3-body'); if(bi)bi.addEventListener('change',e=>upload('body',e.target.files?.[0]));
    const finish=root.querySelector('#sv3-finish'); if(finish)finish.addEventListener('click',()=>{confirmOpen=true;showConfirm(root)});
  }

  function showConfirm(root){
    if(!confirmOpen)return; const back=document.createElement('div');back.className='sv3-modalback';back.innerHTML=`<div class="sv3-modal"><h3>CONCLUIR SEU ENVIO?</h3><p>Seu material está completo. Depois de concluir, as informações serão enviadas para a produção e ficarão disponíveis apenas para visualização.</p><div class="sv3-actions"><button class="sv3-btn ghost" id="sv3-review">VOLTAR E REVISAR</button><button class="sv3-btn" id="sv3-confirm">SIM, CONCLUIR</button></div><div class="sv3-msg" id="sv3-complete-msg"></div></div>`;document.body.appendChild(back);back.querySelector('#sv3-review').addEventListener('click',()=>{confirmOpen=false;back.remove()});back.querySelector('#sv3-confirm').addEventListener('click',async()=>{const b=back.querySelector('#sv3-confirm');const msg=back.querySelector('#sv3-complete-msg');b.disabled=true;b.textContent='CONCLUINDO…';const c=client();const {data,error}=await c.functions.invoke('supporter-profile-complete',{body:{}});if(error||!data?.ok){msg.textContent=data?.error||'Não foi possível concluir agora.';b.disabled=false;b.textContent='SIM, CONCLUIR';return}confirmOpen=false;back.remove();model=await loadModel(true);await renderProfile(root,model)});
  }

  async function renderProfile(root,m){
    root.classList.add('sv3-transition'); if(m.publicityProfile?.submission_completed_at)await renderCompletedProfile(root,m);else await renderEditableProfile(root,m); requestAnimationFrame(()=>root.classList.remove('sv3-transition'));
  }

  function progressHtml(m){
    const p=m.publicityProfile||{}; const profileOk=profileComplete(p); const photosOk=photosComplete(p); const avatarOk=!!p.official_avatar_path; const appearanceOk=(m.appearances||[]).some(a=>a.status!=='cancelled'); const paymentOk=!!m.currentSupport;
    const steps=[['Pagamento',paymentOk,'Apoio confirmado'],['Perfil',profileOk,profileOk?'Dados salvos':'Preencha seus dados'],['Fotos',photosOk,photosOk?'Referências recebidas':'Envie rosto e corpo'],['Avatar',avatarOk,avatarOk?'Avatar pronto':p.submission_completed_at?(p.avatar_status==='in_production'?'Em produção':'Aguardando produção'):'Aguardando conclusão'],['Aparição',appearanceOk,appearanceOk?'Em andamento':'Aguardando produção']]; const first=steps.findIndex(x=>!x[1]);
    let next='';let button='';if(!profileOk){next='Complete seu Perfil de Divulgação para continuar.';button='PREENCHER PERFIL →'}else if(!photosOk){next='Seu perfil está pronto. Agora envie as referências para a criação do seu avatar.';button='ENVIAR FOTOS →'}else if(!p.submission_completed_at){next='Seu material está pronto para revisão. Entre no Perfil de Divulgação e conclua o envio.';button='CONCLUIR ENVIO →'}else if(!avatarOk){next=p.avatar_status==='in_production'?'Seu avatar está em produção. Agora é com a equipe do Surto.':'Tudo certo do seu lado. Agora é com a produção do Surto.'}else if(!appearanceOk){next='Seu avatar está pronto! Agora aguarde a programação da sua aparição.'}else next='Sua participação já tem andamento cadastrado. Acompanhe em Minhas Aparições.';
    return `<section class="sv3-progress" id="surto-progress-v3"><div class="sv3-kicker">CONFIGURAÇÃO DO SEU APOIO</div><h2>SEU CAMINHO ATÉ A APARIÇÃO</h2><p>Acompanhe o que já está pronto e o que ainda falta.</p><div class="sv3-track">${steps.map((x,i)=>`<div class="sv3-trackitem ${x[1]?'done':i===first?'current':''}"><div class="sv3-dot">${x[1]?'✓':i+1}</div><b>${x[0]}</b><span>${x[2]}</span></div>`).join('')}</div><div class="sv3-next"><p>${next}</p>${button?`<button class="sv3-btn secondary" data-sv3-profile>${button}</button>`:''}</div></section>`;
  }

  async function injectHome(root,m){
    const old=root.querySelector('#surto-progress-v3'); if(old)old.remove(); if(!m.currentSupport)return; const hero=root.querySelector('.sd-hero'); if(!hero)return; hero.insertAdjacentHTML('afterend',progressHtml(m)); const b=root.querySelector('[data-sv3-profile]'); if(b)b.addEventListener('click',goProfile);
  }

  async function enhance(){
    if(loading)return; loading=true; try{ensureCss();bindNoOldFlash();const root=document.querySelector('#surto-supporter-real-v2');if(!root)return;const m=await loadModel(false);if(!m)return;const title=norm(root.querySelector('h1')?.textContent);if(title==='PERFIL DE DIVULGAÇÃO'&&!root.querySelector('.sv3'))await renderProfile(root,m);else if(root.querySelector('.sd-hero'))await injectHome(root,m);}finally{loading=false}}
  function scheduleEnhance(ms=45){clearTimeout(observerTimer);observerTimer=setTimeout(enhance,ms)}
  const mo=new MutationObserver(()=>scheduleEnhance(30));mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scheduleEnhance(60),{once:true});else scheduleEnhance(60);
})();