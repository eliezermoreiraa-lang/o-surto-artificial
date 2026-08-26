(() => {
  'use strict';
  if (window.__surtoSupporterOnboardingV2) return;
  window.__surtoSupporterOnboardingV2 = true;

  const SB_URL = 'https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const FACE_EXAMPLE_B64 = '/assets-min/onboarding-foto-rosto-exemplo.webp.b64.txt';
  const BODY_EXAMPLE_B64 = '/assets-min/onboarding-foto-corpo-exemplo.webp.b64.txt';
  const NAV_LABELS = ['INÍCIO','MEUS APOIOS','MINHAS APARIÇÕES','PERFIL DE DIVULGAÇÃO','MINHA ASSINATURA','MEUS EPISÓDIOS','ÁREA VIP'];

  let sb = null;
  let modelCache = null;
  let modelAt = 0;
  let injecting = false;
  let exampleCache = {};

  const norm = v => String(v || '').replace(/\s+/g,' ').trim().toUpperCase();
  const esc = v => String(v == null ? '' : v)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');

  function client(){
    if (sb) return sb;
    if (!(window.supabase && window.supabase.createClient)) return null;
    sb = window.supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'surto-auth' }
    });
    return sb;
  }

  function ensureStyles(){
    if (document.getElementById('surto-onboarding-css-v2')) return;
    const s = document.createElement('style');
    s.id = 'surto-onboarding-css-v2';
    s.textContent = `
      .surto-real-shell > *:not(#surto-supporter-real-v2):not([data-surto-real-nav="1"]){display:none!important}
      .surto-real-shell > #surto-supporter-real-v2{display:block!important}
      .so-wrap{margin:16px 0 0;padding:22px;border-radius:12px;background:#111418;box-shadow:0 0 0 1px rgba(245,245,245,.10);font-family:Inter,system-ui,sans-serif;color:#f5f5f5}
      .so-kicker{font-size:9px;letter-spacing:.22em;color:#00e5ff;text-transform:uppercase;margin-bottom:10px}
      .so-title{font:400 30px/1 'Bebas Neue',Inter,sans-serif;margin:0 0 7px}
      .so-sub{font-size:12.5px;line-height:1.55;color:rgba(245,245,245,.56);margin:0 0 18px}
      .so-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
      .so-step{position:relative;padding:15px;border-radius:9px;background:#0b0d13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.09);min-height:105px}
      .so-step.done{box-shadow:inset 0 0 0 1px rgba(0,229,255,.34);background:rgba(0,229,255,.045)}
      .so-step.current{box-shadow:inset 0 0 0 1px rgba(229,9,20,.50)}
      .so-num{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:10px;margin-bottom:12px;background:rgba(245,245,245,.08);color:rgba(245,245,245,.55)}
      .so-step.done .so-num{background:#00e5ff;color:#071015}.so-step.current .so-num{background:#e50914;color:#fff}
      .so-step b{display:block;font-size:11px;margin-bottom:6px}.so-step span{font-size:10.5px;line-height:1.45;color:rgba(245,245,245,.45)}
      .so-alert{display:flex;gap:13px;align-items:flex-start;margin-top:14px;padding:14px 16px;border-radius:9px;background:rgba(229,9,20,.07);box-shadow:inset 0 0 0 1px rgba(229,9,20,.22)}
      .so-alert strong{display:block;font-size:12px;margin-bottom:3px}.so-alert p{margin:0;color:rgba(245,245,245,.56);font-size:11.5px;line-height:1.5}
      .so-photos{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}
      .so-photo{border-radius:11px;padding:18px;background:#0b0d13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.11)}
      .so-photo h3{font-size:13px;margin:0 0 6px}.so-photo p{font-size:11px;line-height:1.5;color:rgba(245,245,245,.52);margin:0 0 12px}
      .so-example-label,.so-preview-label{font-size:8px;letter-spacing:.18em;color:rgba(245,245,245,.45);margin:0 0 7px;text-transform:uppercase}
      .so-example{width:100%;height:270px;object-fit:contain;border-radius:9px;background:#f3f3f3;margin-bottom:15px;display:block}
      .so-preview-box{position:relative;height:210px;border-radius:9px;margin:0 0 14px;overflow:hidden;background:linear-gradient(145deg,rgba(0,229,255,.06),rgba(229,9,20,.05));box-shadow:inset 0 0 0 1px rgba(245,245,245,.10);display:grid;place-items:center}
      .so-preview-box.empty span{font-size:11px;color:rgba(245,245,245,.38);text-align:center;padding:20px}
      .so-preview{width:100%;height:100%;object-fit:contain;background:#080a0e;display:block}
      .so-file{display:none}
      .so-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 15px;border:0;border-radius:7px;background:#e50914;color:#fff;font:600 10px Inter,sans-serif;letter-spacing:.10em;cursor:pointer}
      .so-btn.secondary{background:#00e5ff;color:#071015}
      .so-status{margin-top:10px;font-size:10.5px;color:rgba(245,245,245,.50)}.so-status.ok{color:#00e5ff}.so-status.err{color:#ff7b82}
      @media(max-width:900px){.so-steps{grid-template-columns:1fr 1fr}.so-photos{grid-template-columns:1fr}}
      @media(max-width:560px){.so-steps{grid-template-columns:1fr}.so-example{height:230px}}
    `;
    document.head.appendChild(s);
  }

  async function exampleData(kind){
    if (exampleCache[kind]) return exampleCache[kind];
    const url = kind === 'face' ? FACE_EXAMPLE_B64 : BODY_EXAMPLE_B64;
    try {
      const r = await fetch(url,{cache:'force-cache'});
      if (!r.ok) return '';
      const b64 = (await r.text()).trim();
      exampleCache[kind] = b64 ? `data:image/webp;base64,${b64}` : '';
      return exampleCache[kind];
    } catch (_) { return ''; }
  }

  async function hydrateExamples(scope){
    const face = scope.querySelector('[data-example-face]');
    const body = scope.querySelector('[data-example-body]');
    if (face && !face.src) { const src = await exampleData('face'); if (src) face.src = src; }
    if (body && !body.src) { const src = await exampleData('body'); if (src) body.src = src; }
  }

  async function getModel(force=false){
    const c = client();
    if (!c) return null;
    if (!force && modelCache && Date.now()-modelAt < 10000) return modelCache;
    const { data, error } = await c.functions.invoke('supporter-dashboard-data',{body:{}});
    if (error || !data || !data.ok) return null;
    modelCache = data;
    modelAt = Date.now();
    return data;
  }

  function profileComplete(p){
    return !!(p && p.display_name && p.social_network && p.social_handle && p.social_url);
  }
  function photosComplete(p){ return !!(p && p.face_photo_path && p.body_photo_path); }

  function shieldOldPrototype(){
    const root = document.querySelector('#surto-supporter-real-v2');
    if (!root || !root.parentElement) return;
    const shell = root.parentElement;
    shell.classList.add('surto-real-shell');
    const children = Array.from(shell.children);
    const nav = children.find(el => {
      if (el === root) return false;
      const t = norm(el.textContent);
      return NAV_LABELS.every(label => t.includes(label)) && t.includes('SAIR');
    });
    if (nav) nav.dataset.surtoRealNav = '1';
  }

  function navTo(label){
    const wanted = norm(label);
    const nodes = Array.from(document.querySelectorAll('div'));
    const target = nodes.find(el => norm(el.textContent) === wanted);
    if (target) target.click();
  }

  async function injectHome(root){
    if (root.querySelector('#surto-onboarding-progress')) return;
    const text = norm(root.textContent);
    if (!text.includes('CLUBE DO SURTO') || !text.includes('MEU PLANO')) return;
    const m = await getModel(false);
    if (!m || !m.currentSupport) return;
    const p = m.publicityProfile || {};
    const steps = [
      {t:'Pagamento', d:'Apoio confirmado', ok:true},
      {t:'Perfil', d:profileComplete(p)?'Dados de divulgação completos':'Preencha nome, rede, @ e link', ok:profileComplete(p)},
      {t:'Fotos', d:photosComplete(p)?'Foto de rosto e corpo recebidas':'Envie rosto e corpo', ok:photosComplete(p)},
      {t:'Avatar', d:p.official_avatar_path?'Avatar oficial pronto':'Aguardando criação do avatar', ok:!!p.official_avatar_path},
      {t:'Aparição', d:(m.appearances||[]).length?'Aparição em andamento':'A produção ainda vai programar', ok:(m.appearances||[]).length>0}
    ];
    const firstPending = steps.findIndex(x=>!x.ok);
    const box = document.createElement('section');
    box.id = 'surto-onboarding-progress';
    box.className = 'so-wrap';
    let pendingText = '';
    if (firstPending === 1) pendingText = 'Complete seu Perfil de Divulgação. Precisamos do nome que será exibido, sua rede social, @ e link.';
    if (firstPending === 2) pendingText = 'Seu perfil está preenchido. Agora envie uma foto de rosto e uma foto de corpo/look para a criação do seu avatar.';
    if (firstPending === 3) pendingText = 'Recebemos suas informações e fotos. A equipe do Surto agora prepara seu avatar oficial.';
    if (firstPending === 4) pendingText = 'Seu avatar está pronto. Agora sua participação aguarda programação pela produção.';
    box.innerHTML = `<div class="so-kicker">CONFIGURAÇÃO DO SEU APOIO</div><h2 class="so-title">SEU CAMINHO ATÉ A APARIÇÃO</h2><p class="so-sub">Acompanhe o que já está pronto e o que ainda falta para sua participação entrar em produção.</p><div class="so-steps">${steps.map((x,i)=>`<div class="so-step ${x.ok?'done':i===firstPending?'current':''}"><div class="so-num">${x.ok?'✓':i+1}</div><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div>`).join('')}</div>${pendingText?`<div class="so-alert"><div>⚡</div><div><strong>Ainda falta uma etapa sua</strong><p>${esc(pendingText)}</p>${firstPending===1||firstPending===2?'<button class="so-btn secondary" data-go-profile style="margin-top:10px">CONFIGURAR AGORA →</button>':''}</div></div>`:''}`;
    const hero = root.querySelector('.sd-hero');
    if (hero) hero.insertAdjacentElement('afterend',box); else root.prepend(box);
    const go = box.querySelector('[data-go-profile]');
    if (go) go.addEventListener('click',()=>navTo('PERFIL DE DIVULGAÇÃO'));
  }

  async function signedUrl(path){
    if (!path) return null;
    const c = client();
    if (!c) return null;
    const {data,error} = await c.storage.from('supporter-photos').createSignedUrl(path,3600);
    if (error) return null;
    return data && data.signedUrl ? data.signedUrl : null;
  }

  function showLocalPreview(kind,file,sec){
    const box = sec.querySelector(`[data-${kind}-preview-box]`);
    if (!box) return;
    const old = box.querySelector('img');
    if (old && old.dataset.objectUrl) URL.revokeObjectURL(old.dataset.objectUrl);
    const url = URL.createObjectURL(file);
    box.classList.remove('empty');
    box.innerHTML = `<img class="so-preview" alt="Prévia da sua foto">`;
    const img = box.querySelector('img');
    img.src = url;
    img.dataset.objectUrl = url;
  }

  async function uploadPhoto(kind,file,statusEl,sec){
    const c = client();
    if (!c) return;
    statusEl.className='so-status';
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      statusEl.classList.add('err'); statusEl.textContent='Use uma imagem JPG, PNG ou WEBP.'; return;
    }
    if (file.size > 10*1024*1024) {
      statusEl.classList.add('err'); statusEl.textContent='A imagem deve ter no máximo 10 MB.'; return;
    }

    showLocalPreview(kind,file,sec);
    statusEl.textContent='Enviando e salvando…';

    const {data:sd} = await c.auth.getSession();
    const user = sd && sd.session && sd.session.user;
    if (!user) {
      statusEl.classList.add('err'); statusEl.textContent='Sua sessão expirou. Entre novamente.'; return;
    }

    const extRaw=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const ext = ['jpg','jpeg','png','webp'].includes(extRaw) ? extRaw : 'jpg';
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const field = kind === 'face' ? 'face_photo_path' : 'body_photo_path';
    const previous = modelCache && modelCache.publicityProfile ? modelCache.publicityProfile[field] : null;

    const up = await c.storage.from('supporter-photos').upload(path,file,{
      cacheControl:'3600',upsert:false,contentType:file.type
    });
    if (up.error) {
      console.error('[O Surto Artificial] upload photo',up.error);
      statusEl.classList.add('err'); statusEl.textContent='Não conseguimos enviar essa foto. Tente novamente.'; return;
    }

    const patch = { user_id:user.id, [field]:path, updated_at:new Date().toISOString() };
    if (kind === 'face') patch.source_photo_path = path;

    const db = await c.from('publicity_profiles').upsert(patch,{onConflict:'user_id'}).select('user_id').single();
    if (db.error) {
      console.error('[O Surto Artificial] save photo profile',db.error);
      await c.storage.from('supporter-photos').remove([path]);
      statusEl.classList.add('err');
      statusEl.textContent='Não conseguimos vincular a foto ao seu perfil. Nenhuma alteração foi perdida; tente novamente.';
      return;
    }

    if (previous && previous !== path) {
      c.storage.from('supporter-photos').remove([previous]).catch(()=>{});
    }

    if (!modelCache) modelCache = { publicityProfile:{} };
    if (!modelCache.publicityProfile) modelCache.publicityProfile = {};
    modelCache.publicityProfile[field] = path;
    if (kind === 'face') modelCache.publicityProfile.source_photo_path = path;
    modelAt = Date.now();

    statusEl.className='so-status ok';
    statusEl.textContent='Foto salva no seu perfil ✓';
  }

  async function injectPhotos(root){
    if (root.querySelector('#surto-photo-upload-v2')) return;
    const t = norm(root.textContent);
    if (!t.includes('PERFIL DE DIVULGAÇÃO')) return;
    const form = root.querySelector('.sd-form');
    if (!form) return;

    const m = await getModel(false);
    if (!m) return;
    const p = m.publicityProfile || {};
    const face = await signedUrl(p.face_photo_path);
    const body = await signedUrl(p.body_photo_path);

    const sec = document.createElement('section');
    sec.id='surto-photo-upload-v2';
    sec.className='so-wrap';
    sec.innerHTML = `
      <div class="so-kicker">FOTOS PARA O AVATAR</div>
      <h2 class="so-title">MOSTRE COMO VOCÊ QUER APARECER</h2>
      <p class="so-sub">Envie duas referências. As fotos ficam privadas e são usadas somente pela equipe do Surto para criar seu avatar oficial.</p>
      <div class="so-photos">
        <article class="so-photo">
          <div class="so-example-label">EXEMPLO DE FOTO DE ROSTO</div>
          <img class="so-example" data-example-face alt="Exemplo de como tirar a foto de rosto">
          <h3>1. FOTO DE ROSTO</h3>
          <p>Rosto próximo e centralizado, olhando para a câmera, boa iluminação e fundo simples. Evite filtro pesado, óculos escuros e outras pessoas na imagem.</p>
          <div class="so-preview-label">SUA FOTO</div>
          <div class="so-preview-box ${face?'':'empty'}" data-face-preview-box>${face?`<img class="so-preview" src="${esc(face)}" alt="Sua foto de rosto enviada">`:'<span>Depois que você escolher a imagem, a prévia aparecerá aqui.</span>'}</div>
          <input class="so-file" id="so-face-v2" type="file" accept="image/jpeg,image/png,image/webp">
          <label class="so-btn secondary" for="so-face-v2">${face?'TROCAR FOTO DE ROSTO':'ENVIAR FOTO DE ROSTO'}</label>
          <div class="so-status ${face?'ok':''}" data-face-status>${face?'Foto já salva no perfil ✓':'Pendente'}</div>
        </article>
        <article class="so-photo">
          <div class="so-example-label">EXEMPLO DE FOTO DE CORPO / LOOK</div>
          <img class="so-example" data-example-body alt="Exemplo de como tirar a foto de corpo inteiro">
          <h3>2. FOTO DE CORPO / LOOK</h3>
          <p>Foto de corpo inteiro, dos pés à cabeça, em pose natural e com uma roupa que represente o estilo que você gostaria de usar na novelinha.</p>
          <div class="so-preview-label">SUA FOTO</div>
          <div class="so-preview-box ${body?'':'empty'}" data-body-preview-box>${body?`<img class="so-preview" src="${esc(body)}" alt="Sua foto de corpo enviada">`:'<span>Depois que você escolher a imagem, a prévia aparecerá aqui.</span>'}</div>
          <input class="so-file" id="so-body-v2" type="file" accept="image/jpeg,image/png,image/webp">
          <label class="so-btn" for="so-body-v2">${body?'TROCAR FOTO DE CORPO':'ENVIAR FOTO DE CORPO'}</label>
          <div class="so-status ${body?'ok':''}" data-body-status>${body?'Foto já salva no perfil ✓':'Pendente'}</div>
        </article>
      </div>
      <div class="so-alert"><div>📸</div><div><strong>Quanto melhor a referência, melhor o avatar</strong><p>As fotos não precisam ser profissionais. Uma parede simples e luz natural já funcionam bem. Na foto de corpo, deixe o corpo inteiro visível e escolha uma roupa que combine com a forma como você gostaria de aparecer.</p></div></div>`;

    form.insertAdjacentElement('afterend',sec);
    hydrateExamples(sec);

    const faceInput = sec.querySelector('#so-face-v2');
    const bodyInput = sec.querySelector('#so-body-v2');
    faceInput.addEventListener('change',e=>uploadPhoto('face',e.target.files&&e.target.files[0],sec.querySelector('[data-face-status]'),sec));
    bodyInput.addEventListener('change',e=>uploadPhoto('body',e.target.files&&e.target.files[0],sec.querySelector('[data-body-status]'),sec));
  }

  async function enhance(){
    if (injecting) return;
    injecting=true;
    try {
      ensureStyles();
      shieldOldPrototype();
      const root = document.querySelector('#surto-supporter-real-v2');
      if (root) {
        await injectHome(root);
        await injectPhotos(root);
      }
    } finally { injecting=false; }
  }

  const mo = new MutationObserver(()=>{
    clearTimeout(mo._t);
    mo._t=setTimeout(()=>{ shieldOldPrototype(); enhance(); },45);
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,80),{once:true});
  } else setTimeout(enhance,80);
})();