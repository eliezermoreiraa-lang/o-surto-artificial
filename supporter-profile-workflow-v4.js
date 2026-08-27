(() => {
  'use strict';
  if (window.__surtoProfileWorkflowV4) return;
  window.__surtoProfileWorkflowV4 = true;

  const SB_URL='https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const FACE_REF='/assets-min/onboarding-foto-rosto-exemplo.webp.b64.txt';
  const BODY_REF='/assets-min/onboarding-foto-corpo-exemplo.webp.b64.txt';
  let sb=null, model=null, busy=false, timer=null, examples={};

  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toUpperCase();
  const esc=v=>String(v==null?'':v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const netLabel=v=>({instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube',x:'X / Twitter',facebook:'Facebook',outro:'Outra'})[String(v||'').toLowerCase()]||v||'—';

  function client(){
    if(sb)return sb;
    if(!(window.supabase&&window.supabase.createClient))return null;
    sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'surto-auth'}});
    return sb;
  }

  function css(){
    if(document.getElementById('sv4-css'))return;
    const s=document.createElement('style');s.id='sv4-css';s.textContent=`
      .sv4{color:#F5F5F5;font-family:Inter,system-ui,sans-serif;padding:0 0 34px}.sv4 *{box-sizing:border-box}
      .sv4-title{font:400 clamp(38px,5vw,60px)/.95 'Bebas Neue',Inter,sans-serif;margin:22px 0 8px}.sv4-lead{max-width:800px;color:rgba(245,245,245,.58);font-size:13.5px;line-height:1.6;margin:0 0 22px}
      .sv4-step,.sv4-card{background:#111418;border-radius:14px;padding:24px;margin-bottom:18px;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sv4-step.locked{opacity:.42;pointer-events:none}
      .sv4-kicker{font-size:9px;letter-spacing:.23em;color:#00E5FF;margin-bottom:9px}.sv4-step h2,.sv4-card h2{font:400 34px/1 'Bebas Neue',Inter,sans-serif;margin:0 0 7px}.sv4-step>p,.sv4-card>p{font-size:12.5px;line-height:1.55;color:rgba(245,245,245,.55)}
      .sv4-form{display:grid;gap:15px;max-width:760px;margin-top:18px}.sv4-field{display:grid;gap:7px}.sv4-field label,.sv4-check{font-size:11px;color:rgba(245,245,245,.58)}.sv4-field input,.sv4-field select{width:100%;height:46px;border:0;border-radius:8px;padding:0 13px;background:#0B0D13;color:#F5F5F5;box-shadow:inset 0 0 0 1px rgba(245,245,245,.16);font:13px Inter,sans-serif}.sv4-check{display:flex;gap:9px;align-items:flex-start;line-height:1.5}
      .sv4-btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:7px;min-height:44px;padding:0 18px;background:#E50914;color:#fff;font:600 10px Inter,sans-serif;letter-spacing:.11em;cursor:pointer}.sv4-btn.cyan{background:#00E5FF;color:#071015}.sv4-btn.ghost{background:transparent;box-shadow:inset 0 0 0 1px rgba(245,245,245,.2)}.sv4-btn:disabled{opacity:.35;cursor:not-allowed}.sv4-msg{font-size:11.5px;min-height:17px;color:#ff7b82}.sv4-msg.ok{color:#00E5FF}
      .sv4-photos{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.sv4-photo{padding:18px;border-radius:12px;background:#0B0D13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.10)}.sv4-photo h3{font-size:13px;margin:0 0 6px}.sv4-photo p{font-size:11px;line-height:1.55;color:rgba(245,245,245,.52)}.sv4-label{font-size:8px;letter-spacing:.18em;color:rgba(245,245,245,.42);margin-bottom:7px;text-transform:uppercase}
      .sv4-frame{width:min(100%,300px);aspect-ratio:9/16;margin:0 auto 15px;border-radius:11px;overflow:hidden;background:#080A0E;box-shadow:inset 0 0 0 1px rgba(245,245,245,.10);display:grid;place-items:center}.sv4-frame img{width:100%;height:100%;object-fit:contain;display:block}.sv4-frame.ref{background:#F1F1F1}.sv4-frame.empty span{padding:18px;text-align:center;font-size:10.5px;line-height:1.5;color:rgba(245,245,245,.35)}.sv4-file{display:none}.sv4-status{margin-top:10px;font-size:10.5px;color:rgba(245,245,245,.48)}.sv4-status.ok{color:#00E5FF}.sv4-status.err{color:#ff7b82}
      .sv4-finish{margin-top:18px;padding-top:18px;border-top:1px solid rgba(245,245,245,.08)}.sv4-finish p{max-width:730px;color:rgba(245,245,245,.52);font-size:11.5px;line-height:1.55}
      .sv4-modalback{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:grid;place-items:center;padding:20px}.sv4-modal{width:min(520px,100%);background:#111418;border-radius:14px;padding:25px;box-shadow:0 0 0 1px rgba(245,245,245,.14),0 25px 80px rgba(0,0,0,.55)}.sv4-modal h3{font:400 34px/1 'Bebas Neue',Inter,sans-serif;margin:0 0 9px}.sv4-modal p{font-size:12.5px;line-height:1.6;color:rgba(245,245,245,.58)}.sv4-actions{display:flex;gap:10px;flex-wrap:wrap}
      .sv4-success{padding:26px;border-radius:14px;background:linear-gradient(120deg,rgba(0,229,255,.08),#111418 55%,rgba(229,9,20,.08));box-shadow:0 0 0 1px rgba(0,229,255,.25);margin-bottom:18px}.sv4-success h2{font:400 42px/1 'Bebas Neue',Inter,sans-serif;margin:8px 0}.sv4-success p{font-size:12.5px;color:rgba(245,245,245,.58);line-height:1.6}.sv4-badge{display:inline-flex;padding:6px 10px;border-radius:99px;background:rgba(0,229,255,.08);box-shadow:inset 0 0 0 1px rgba(0,229,255,.30);font-size:9px;letter-spacing:.15em;color:#00E5FF}
      .sv4-summary{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}.sv4-list{display:grid;border-top:1px solid rgba(245,245,245,.08);margin-top:13px}.sv4-list div{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid rgba(245,245,245,.08);font-size:11.5px}.sv4-list span{color:rgba(245,245,245,.42)}.sv4-list b{text-align:right;font-weight:500}.sv4-refgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sv4-refgrid .sv4-frame{width:100%;max-width:260px;margin-bottom:0}
      .sv4-avatar{display:grid;grid-template-columns:minmax(220px,.7fr) 1.3fr;gap:22px;align-items:center}.sv4-avatar .sv4-frame{margin:0;width:100%;max-width:300px}.sv4-avatar h2{font:400 42px/1 'Bebas Neue',Inter,sans-serif;margin:8px 0}.sv4-avatar p{font-size:12.5px;line-height:1.6;color:rgba(245,245,245,.58)}
      .sv4-progress{background:#111418;border-radius:13px;padding:21px;margin:16px 0;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sv4-progress h2{font:400 31px/1 'Bebas Neue',Inter,sans-serif;margin:0 0 7px}.sv4-progress>p{font-size:11.5px;color:rgba(245,245,245,.52);line-height:1.5}.sv4-track{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px}.sv4-item{padding:14px;border-radius:9px;background:#0B0D13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.08);min-height:92px}.sv4-item.done{box-shadow:inset 0 0 0 1px rgba(0,229,255,.32)}.sv4-item.current{box-shadow:inset 0 0 0 1px rgba(229,9,20,.5)}.sv4-dot{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:rgba(245,245,245,.08);font-size:10px;margin-bottom:10px}.sv4-item.done .sv4-dot{background:#00E5FF;color:#061014}.sv4-item.current .sv4-dot{background:#E50914}.sv4-item b{display:block;font-size:10.5px;margin-bottom:4px}.sv4-item span{font-size:9.8px;color:rgba(245,245,245,.42);line-height:1.4}.sv4-next{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:13px;padding:14px 16px;border-radius:9px;background:rgba(229,9,20,.06);box-shadow:inset 0 0 0 1px rgba(229,9,20,.20)}.sv4-next p{margin:0;font-size:11.5px;line-height:1.5;color:rgba(245,245,245,.58)}
      @media(max-width:860px){.sv4-photos,.sv4-summary,.sv4-avatar{grid-template-columns:1fr}.sv4-track{grid-template-columns:1fr 1fr}.sv4-next{align-items:flex-start;flex-direction:column}}@media(max-width:540px){.sv4-track{grid-template-columns:1fr}.sv4-frame{max-width:260px}}
    `;document.head.appendChild(s);
  }

  async function load(force=false){
    if(model&&!force)return model;const c=client();if(!c)return null;
    const {data,error}=await c.functions.invoke('supporter-dashboard-data',{body:{}});if(error||!data?.ok)return null;model=data;return model;
  }
  async function refImage(kind){
    if(examples[kind])return examples[kind];const url=kind==='face'?FACE_REF:BODY_REF;
    try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)return'';const b=(await r.text()).trim();examples[kind]=b?`data:image/webp;base64,${b}`:'';return examples[kind]}catch{return''}
  }
  async function signed(path){if(!path)return'';if(/^https?:\/\//i.test(path))return path;const c=client();const {data}=await c.storage.from('supporter-photos').createSignedUrl(path,3600);return data?.signedUrl||''}
  function avatar(path){if(!path)return'';if(/^https?:\/\//i.test(path))return path;const c=client();return c.storage.from('supporter-avatars').getPublicUrl(path).data.publicUrl||''}
  function profileOk(p){return !!(p?.display_name&&p?.social_network&&p?.social_handle&&p?.social_url&&p?.notification_email&&p?.public_consent)}
  function photosOk(p){return !!(p?.face_photo_path&&p?.body_photo_path)}
  function frame(src,alt,extra=''){return `<div class="sv4-frame ${extra} ${src?'':'empty'}">${src?`<img src="${esc(src)}" alt="${esc(alt)}">`:'<span>Nenhuma imagem enviada.</span>'}</div>`}

  function findProfileNav(){
    return Array.from(document.querySelectorAll('div')).find(el=>norm(el.textContent)==='PERFIL DE DIVULGAÇÃO'&&el.getBoundingClientRect().width>0);
  }
  function goProfile(){const t=findProfileNav();if(t)t.click()}

  async function renderEditable(root,m){
    const p=m.publicityProfile||{}, ok=profileOk(p), pics=photosOk(p);
    const [face,body,faceRef,bodyRef]=await Promise.all([signed(p.face_photo_path),signed(p.body_photo_path),refImage('face'),refImage('body')]);
    const opts=[['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube'],['x','X / Twitter'],['facebook','Facebook'],['outro','Outra']];const net=String(p.social_network||'').toLowerCase();
    root.innerHTML=`<div class="sv4"><h1 class="sv4-title">Perfil de Divulgação</h1><p class="sv4-lead">Preencha seus dados, salve a primeira etapa e depois envie as referências que a produção usará para criar seu avatar.</p>
      <section class="sv4-step"><div class="sv4-kicker">ETAPA 1 DE 2</div><h2>PERFIL DE DIVULGAÇÃO</h2><p>Essas informações serão usadas quando você aparecer nas produções do Surto.</p><div class="sv4-form">
        <div class="sv4-field"><label>Nome de divulgação</label><input id="sv4-name" value="${esc(p.display_name||m.user?.displayName||'')}"></div>
        <div class="sv4-field"><label>Rede social</label><select id="sv4-network"><option value="">Selecione</option>${opts.map(o=>`<option value="${o[0]}" ${net===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
        <div class="sv4-field"><label>@ / nome de usuário</label><input id="sv4-handle" value="${esc(p.social_handle?'@'+String(p.social_handle).replace(/^@/,''):'')}" placeholder="@seuperfil"></div>
        <div class="sv4-field"><label>E-mail para notificações</label><input id="sv4-email" type="email" value="${esc(p.notification_email||m.user?.email||'')}"></div>
        <div class="sv4-field"><label>Link do perfil</label><input id="sv4-url" value="${esc(p.social_url||'')}" placeholder="https://..."></div>
        <label class="sv4-check"><input id="sv4-consent" type="checkbox" ${p.public_consent?'checked':''}> Autorizo a exibição destes dados nas divulgações e no mural de apoiadores.</label>
        <div class="sv4-msg ${ok?'ok':''}" id="sv4-profile-msg">${ok?'Etapa salva ✓':''}</div><div><button class="sv4-btn cyan" id="sv4-save">SALVAR ETAPA</button></div>
      </div></section>
      <section class="sv4-step ${ok?'':'locked'}"><div class="sv4-kicker">ETAPA 2 DE 2</div><h2>FOTOS PARA O SEU AVATAR</h2><p>Mostre como você gostaria de aparecer no Surto. As fotos ficam privadas e são usadas pela produção para criar seu avatar oficial.</p><div class="sv4-photos">
        <article class="sv4-photo"><div class="sv4-label">EXEMPLO — FOTO DE ROSTO</div>${frame(faceRef,'Exemplo de foto de rosto','ref')}<h3>FOTO DE ROSTO</h3><p>Rosto próximo e bem visível, olhando para frente, boa iluminação e fundo simples.</p><div class="sv4-label">SUA FOTO</div><div id="sv4-face-preview">${frame(face,'Sua foto de rosto')}</div><input class="sv4-file" id="sv4-face" type="file" accept="image/jpeg,image/png,image/webp"><label class="sv4-btn cyan" for="sv4-face" id="sv4-face-btn">${p.face_photo_path?'TROCAR FOTO':'ENVIAR FOTO'}</label><div class="sv4-status ${p.face_photo_path?'ok':''}" id="sv4-face-status">${p.face_photo_path?'Foto salva ✓':'Pendente'}</div></article>
        <article class="sv4-photo"><div class="sv4-label">EXEMPLO — FOTO DE CORPO / LOOK</div>${frame(bodyRef,'Exemplo de foto de corpo inteiro','ref')}<h3>FOTO DE CORPO / LOOK</h3><p>Foto de corpo inteiro, dos pés à cabeça, em pose natural e com uma roupa que represente como você gostaria de aparecer.</p><div class="sv4-label">SUA FOTO</div><div id="sv4-body-preview">${frame(body,'Sua foto de corpo')}</div><input class="sv4-file" id="sv4-body" type="file" accept="image/jpeg,image/png,image/webp"><label class="sv4-btn" for="sv4-body" id="sv4-body-btn">${p.body_photo_path?'TROCAR FOTO':'ENVIAR FOTO'}</label><div class="sv4-status ${p.body_photo_path?'ok':''}" id="sv4-body-status">${p.body_photo_path?'Foto salva ✓':'Pendente'}</div></article>
      </div><div class="sv4-finish"><p>Revise tudo antes de concluir. Depois disso o material será entregue à produção e ficará somente para visualização.</p><button class="sv4-btn" id="sv4-finish" ${pics?'':'disabled'}>CONCLUIR ENVIO</button></div></section></div>`;
    bindEditable(root);
  }

  async function renderCompleted(root,m){
    const p=m.publicityProfile||{};const [face,body]=await Promise.all([signed(p.face_photo_path),signed(p.body_photo_path)]);const av=avatar(p.official_avatar_path);const st=p.official_avatar_path?'ready':(p.avatar_status||'awaiting');
    const title=st==='ready'?'AVATAR PRONTO ✓':st==='in_production'?'SEU AVATAR ESTÁ EM PRODUÇÃO':'AVATAR AGUARDANDO PRODUÇÃO';const text=st==='ready'?'Esse é o seu avatar oficial para as produções do Surto.':st==='in_production'?'A equipe do Surto está preparando a sua versão para entrar na novelinha.':'Recebemos suas referências. Quando seu avatar estiver pronto, ele aparecerá aqui.';
    root.innerHTML=`<div class="sv4"><h1 class="sv4-title">Perfil de Divulgação</h1><div class="sv4-success"><span class="sv4-badge">MATERIAL ENVIADO ✓</span><h2>TUDO CERTO DO SEU LADO.</h2><p>Suas informações e referências já foram entregues para a produção. Esta área agora fica somente para visualização.</p></div>
      <div class="sv4-summary"><section class="sv4-card"><h2>PERFIL DE DIVULGAÇÃO</h2><div class="sv4-list"><div><span>Nome</span><b>${esc(p.display_name||'—')}</b></div><div><span>Rede social</span><b>${esc(netLabel(p.social_network))}</b></div><div><span>@</span><b>${esc(p.social_handle?'@'+String(p.social_handle).replace(/^@/,''):'—')}</b></div><div><span>Link</span><b>${p.social_url?`<a href="${esc(p.social_url)}" target="_blank" rel="noopener" style="color:#00E5FF">abrir perfil</a>`:'—'}</b></div><div><span>Notificações</span><b>${esc(p.notification_email||m.user?.email||'—')}</b></div></div></section>
      <section class="sv4-card"><h2>REFERÊNCIAS ENVIADAS</h2><div class="sv4-refgrid"><div><div class="sv4-label">ROSTO</div>${frame(face,'Foto de rosto')}</div><div><div class="sv4-label">CORPO / LOOK</div>${frame(body,'Foto de corpo')}</div></div></section></div>
      <section class="sv4-card sv4-avatar">${frame(av,'Avatar oficial')}<div><div class="sv4-kicker">SEU AVATAR</div><h2>${title}</h2><p>${text}</p></div></section></div>`;
  }

  function preview(kind,file){const box=document.querySelector(`#sv4-${kind}-preview`);if(!box)return;const u=URL.createObjectURL(file);box.innerHTML=frame(u,'Prévia da foto');const img=box.querySelector('img');if(img)img.onload=()=>URL.revokeObjectURL(u)}

  async function upload(kind,file){
    if(!file)return;const status=document.querySelector(`#sv4-${kind}-status`),btn=document.querySelector(`#sv4-${kind}-btn`);if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024){if(status){status.className='sv4-status err';status.textContent='Use JPG, PNG ou WEBP com até 10 MB.'}return}
    preview(kind,file);if(status){status.className='sv4-status';status.textContent='Enviando e salvando…'};const c=client();const {data:sess}=await c.auth.getSession();const user=sess?.session?.user;if(!user){if(status){status.className='sv4-status err';status.textContent='Sua sessão expirou.'}return}
    const ext0=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const ext=['jpg','jpeg','png','webp'].includes(ext0)?ext0:'jpg';const path=`${user.id}/${kind}-${Date.now()}.${ext}`;const field=kind==='face'?'face_photo_path':'body_photo_path';const prev=model?.publicityProfile?.[field]||null;
    const up=await c.storage.from('supporter-photos').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(up.error){if(status){status.className='sv4-status err';status.textContent='Não conseguimos enviar a foto.'}return}
    const patch={user_id:user.id,[field]:path,updated_at:new Date().toISOString()};if(kind==='face')patch.source_photo_path=path;const db=await c.from('publicity_profiles').upsert(patch,{onConflict:'user_id'}).select('user_id').single();if(db.error){await c.storage.from('supporter-photos').remove([path]);if(status){status.className='sv4-status err';status.textContent='Não conseguimos salvar a foto no perfil.'}return}
    if(prev&&prev!==path)c.storage.from('supporter-photos').remove([prev]).catch(()=>{});model=await load(true);if(status){status.className='sv4-status ok';status.textContent='Foto salva ✓'}if(btn)btn.textContent='TROCAR FOTO';const finish=document.querySelector('#sv4-finish');if(finish)finish.disabled=!photosOk(model?.publicityProfile||{});
  }

  function bindEditable(root){
    const save=root.querySelector('#sv4-save');if(save)save.addEventListener('click',async()=>{const msg=root.querySelector('#sv4-profile-msg');const body={displayName:root.querySelector('#sv4-name').value.trim(),socialNetwork:root.querySelector('#sv4-network').value,socialHandle:root.querySelector('#sv4-handle').value.trim(),notificationEmail:root.querySelector('#sv4-email').value.trim(),socialUrl:root.querySelector('#sv4-url').value.trim(),publicConsent:root.querySelector('#sv4-consent').checked};save.disabled=true;save.textContent='SALVANDO…';const c=client();const {data,error}=await c.functions.invoke('supporter-profile-save',{body});if(error||!data?.ok){msg.className='sv4-msg';msg.textContent=data?.error||'Não foi possível salvar agora.';save.disabled=false;save.textContent='SALVAR ETAPA';return}msg.className='sv4-msg ok';msg.textContent='Perfil salvo com sucesso ✓';model=await load(true);setTimeout(()=>renderProfile(root,model),350)});
    const f=root.querySelector('#sv4-face');if(f)f.addEventListener('change',e=>upload('face',e.target.files?.[0]));const b=root.querySelector('#sv4-body');if(b)b.addEventListener('change',e=>upload('body',e.target.files?.[0]));const finish=root.querySelector('#sv4-finish');if(finish)finish.addEventListener('click',()=>confirmFinish(root));
  }

  function confirmFinish(root){
    const back=document.createElement('div');back.className='sv4-modalback';back.innerHTML=`<div class="sv4-modal"><h3>CONCLUIR SEU ENVIO?</h3><p>Depois de concluir, as informações serão enviadas para a produção e ficarão disponíveis apenas para visualização.</p><div class="sv4-actions"><button class="sv4-btn ghost" id="sv4-review">VOLTAR E REVISAR</button><button class="sv4-btn" id="sv4-confirm">SIM, CONCLUIR</button></div><div class="sv4-msg" id="sv4-complete-msg"></div></div>`;document.body.appendChild(back);back.querySelector('#sv4-review').onclick=()=>back.remove();back.querySelector('#sv4-confirm').onclick=async()=>{const btn=back.querySelector('#sv4-confirm'),msg=back.querySelector('#sv4-complete-msg');btn.disabled=true;btn.textContent='CONCLUINDO…';const c=client();const {data,error}=await c.functions.invoke('supporter-profile-complete',{body:{}});if(error||!data?.ok){msg.textContent=data?.error||'Não foi possível concluir agora.';btn.disabled=false;btn.textContent='SIM, CONCLUIR';return}back.remove();model=await load(true);renderProfile(root,model)};
  }

  async function renderProfile(root,m){if(!root||!m?.currentSupport||root.dataset.sv4Busy==='1')return;root.dataset.sv4Busy='1';try{if(m.publicityProfile?.submission_completed_at)await renderCompleted(root,m);else await renderEditable(root,m)}finally{root.dataset.sv4Busy='0'}}

  function progress(m){
    const p=m.publicityProfile||{},pay=!!m.currentSupport,prof=profileOk(p),pics=photosOk(p),av=!!p.official_avatar_path;
    const activeAppearances=(m.appearances||[]).filter(a=>String(a.status||'').toLowerCase()!=='cancelled');
    const appeared=activeAppearances.some(a=>String(a.status||'').toLowerCase()==='published'||!!a.published_at);
    const hasAppearance=activeAppearances.length>0;
    const steps=[
      ['Pagamento',pay,'Apoio confirmado'],
      ['Perfil',prof,prof?'Dados salvos':'Preencha seus dados'],
      ['Fotos',pics,pics?'Referências recebidas':'Envie rosto e corpo'],
      ['Avatar',av,av?'Avatar pronto':p.submission_completed_at?(p.avatar_status==='in_production'?'Em produção':'Aguardando produção'):'Aguardando conclusão'],
      ['Aparição',appeared,appeared?'Aparição publicada':hasAppearance?'Ainda não apareceu':'Aguardando produção']
    ];
    let text='',button='';if(!prof){text='Complete seu Perfil de Divulgação para continuar.';button='PREENCHER PERFIL →'}else if(!pics){text='Seu perfil está pronto. Agora envie as referências para a criação do seu avatar.';button='ENVIAR FOTOS →'}else if(!p.submission_completed_at){text='Seu material está pronto para revisão. Conclua o envio para entregar à produção.';button='CONCLUIR ENVIO →'}else if(!av){text=p.avatar_status==='in_production'?'Seu avatar está em produção. Agora é com a equipe do Surto.':'Tudo certo do seu lado. Agora é com a produção do Surto.'}else if(!appeared)text=hasAppearance?'Sua participação está em andamento. A etapa será concluída quando a aparição for publicada.':'Seu avatar está pronto. Agora aguarde a programação da sua aparição.';else text='Sua aparição já foi publicada.';
    return `<section class="sv4-progress" id="sv4-progress"><div class="sv4-kicker">CONFIGURAÇÃO DO SEU APOIO</div><h2>SEU CAMINHO ATÉ A APARIÇÃO</h2><p>Acompanhe o que já está pronto e o que ainda falta.</p><div class="sv4-track">${steps.map((x,i)=>`<div class="sv4-item ${x[1]?'done':'current'}"><div class="sv4-dot">${x[1]?'✓':i+1}</div><b>${x[0]}</b><span>${x[2]}</span></div>`).join('')}</div><div class="sv4-next"><p>${text}</p>${button?`<button class="sv4-btn cyan" id="sv4-go-profile">${button}</button>`:''}</div></section>`
  }

  async function enhance(){
    if(busy)return;busy=true;try{css();const root=document.querySelector('#surto-supporter-real-v2');if(!root)return;const m=await load(false);if(!m||!m.currentSupport)return;const h=norm(root.querySelector('h1')?.textContent);
      if(h==='PERFIL DE DIVULGAÇÃO'&&!root.querySelector('.sv4')){await renderProfile(root,m);return}
      if(root.querySelector('.sd-hero')){const old=root.querySelector('#sv4-progress');if(old)old.remove();const hero=root.querySelector('.sd-hero');hero.insertAdjacentHTML('afterend',progress(m));const go=root.querySelector('#sv4-go-profile');if(go)go.onclick=goProfile;if(profileOk(m.publicityProfile||{})){Array.from(root.querySelectorAll('.sd-card')).forEach(c=>{if(norm(c.textContent).includes('COMPLETE SEU PERFIL DE DIVULGAÇÃO'))c.remove()})}}
    }finally{busy=false}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,0)}
  const mo=new MutationObserver(()=>schedule());mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
