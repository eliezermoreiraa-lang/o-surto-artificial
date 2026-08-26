(() => {
  'use strict';
  if (window.__surtoSupporterOnboarding) return;
  window.__surtoSupporterOnboarding = true;

  const SB_URL = 'https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const NAV_LABELS = new Set(['INÍCIO','MEUS APOIOS','MINHAS APARIÇÕES','PERFIL DE DIVULGAÇÃO','MINHA ASSINATURA','MEUS EPISÓDIOS','ÁREA VIP']);
  let sb = null;
  let modelCache = null;
  let modelAt = 0;
  let injecting = false;

  const norm = v => String(v || '').replace(/\s+/g,' ').trim().toUpperCase();
  const esc = v => String(v == null ? '' : v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  function client(){
    if (sb) return sb;
    if (!(window.supabase && window.supabase.createClient)) return null;
    sb = window.supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'surto-auth' }
    });
    return sb;
  }

  function ensureStyles(){
    if (document.getElementById('surto-onboarding-css')) return;
    const s = document.createElement('style');
    s.id = 'surto-onboarding-css';
    s.textContent = `
      .so-wrap{margin:16px 0 0;padding:22px;border-radius:12px;background:#111418;box-shadow:0 0 0 1px rgba(245,245,245,.1);font-family:Inter,system-ui,sans-serif;color:#f5f5f5}
      .so-kicker{font-size:9px;letter-spacing:.22em;color:#00e5ff;text-transform:uppercase;margin-bottom:10px}.so-title{font:400 30px/1 'Bebas Neue',Inter,sans-serif;margin:0 0 7px}.so-sub{font-size:12.5px;line-height:1.55;color:rgba(245,245,245,.56);margin:0 0 18px}
      .so-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.so-step{position:relative;padding:15px;border-radius:9px;background:#0b0d13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.09);min-height:105px}.so-step.done{box-shadow:inset 0 0 0 1px rgba(0,229,255,.34);background:rgba(0,229,255,.045)}.so-step.current{box-shadow:inset 0 0 0 1px rgba(229,9,20,.5)}
      .so-num{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:10px;margin-bottom:12px;background:rgba(245,245,245,.08);color:rgba(245,245,245,.55)}.so-step.done .so-num{background:#00e5ff;color:#071015}.so-step.current .so-num{background:#e50914;color:#fff}.so-step b{display:block;font-size:11px;margin-bottom:6px}.so-step span{font-size:10.5px;line-height:1.45;color:rgba(245,245,245,.45)}
      .so-alert{display:flex;gap:13px;align-items:flex-start;margin-top:14px;padding:14px 16px;border-radius:9px;background:rgba(229,9,20,.07);box-shadow:inset 0 0 0 1px rgba(229,9,20,.22)}.so-alert strong{display:block;font-size:12px;margin-bottom:3px}.so-alert p{margin:0;color:rgba(245,245,245,.56);font-size:11.5px;line-height:1.5}
      .so-photos{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.so-photo{border-radius:11px;padding:18px;background:#0b0d13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.11)}.so-guide{height:150px;border-radius:9px;margin-bottom:14px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(0,229,255,.07),rgba(229,9,20,.05));box-shadow:inset 0 0 0 1px rgba(245,245,245,.08);overflow:hidden}.so-silhouette{position:relative;width:70px;height:115px}.so-silhouette .head{position:absolute;width:40px;height:40px;border-radius:50%;left:15px;top:4px;background:rgba(245,245,245,.28)}.so-silhouette .body{position:absolute;width:66px;height:70px;border-radius:32px 32px 10px 10px;left:2px;top:48px;background:rgba(245,245,245,.2)}.so-silhouette.face{height:100px;transform:scale(1.25)}.so-silhouette.face .head{width:56px;height:56px;left:7px}.so-silhouette.face .body{width:70px;height:50px;left:0;top:64px}
      .so-photo h3{font-size:13px;margin:0 0 6px}.so-photo p{font-size:11px;line-height:1.5;color:rgba(245,245,245,.5);margin:0 0 12px}.so-file{display:none}.so-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 15px;border:0;border-radius:7px;background:#e50914;color:#fff;font:600 10px Inter,sans-serif;letter-spacing:.1em;cursor:pointer}.so-btn.secondary{background:#00e5ff;color:#071015}.so-status{margin-top:10px;font-size:10.5px;color:rgba(245,245,245,.5)}.so-status.ok{color:#00e5ff}.so-preview{width:100%;height:150px;object-fit:cover;border-radius:9px;margin-bottom:14px;background:#fff}
      @media(max-width:900px){.so-steps{grid-template-columns:1fr 1fr}.so-photos{grid-template-columns:1fr}}@media(max-width:560px){.so-steps{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  async function getModel(force=false){
    const c = client();
    if (!c) return null;
    if (!force && modelCache && Date.now()-modelAt < 12000) return modelCache;
    const { data, error } = await c.functions.invoke('supporter-dashboard-data',{body:{}});
    if (error || !data || !data.ok) return null;
    modelCache = data; modelAt = Date.now();
    return data;
  }

  function profileComplete(p){ return !!(p && p.display_name && p.social_network && p.social_handle && p.social_url); }
  function photosComplete(p){ return !!(p && p.face_photo_path && p.body_photo_path); }

  function bindSmoothNav(){
    const nodes = Array.from(document.querySelectorAll('div')).filter(el => NAV_LABELS.has(norm(el.textContent)));
    nodes.forEach(el => {
      if (el.dataset.soSmooth === '1') return;
      el.dataset.soSmooth = '1';
      el.addEventListener('click', ev => {
        // O painel real já recebeu o evento em capture. Aqui apenas impedimos a propagação
        // para o protótipo antigo, que era o responsável pelo flash visual.
        ev.stopPropagation();
      }, true);
    });
  }

  async function injectHome(root){
    if (root.querySelector('#surto-onboarding-progress')) return;
    const text = norm(root.textContent);
    if (!text.includes('CLUBE DO SURTO') || !text.includes('MEU PLANO')) return;
    const m = await getModel(false); if (!m || !m.currentSupport) return;
    const p = m.publicityProfile || {};
    const steps = [
      {t:'Pagamento', d:'Apoio confirmado', ok:true},
      {t:'Perfil', d:profileComplete(p)?'Dados de divulgação completos':'Complete nome, rede, @ e link', ok:profileComplete(p)},
      {t:'Fotos', d:photosComplete(p)?'Fotos recebidas':'Envie rosto e corpo', ok:photosComplete(p)},
      {t:'Avatar', d:p.official_avatar_path?'Avatar oficial pronto':'Aguardando criação do avatar', ok:!!p.official_avatar_path},
      {t:'Aparição', d:(m.appearances||[]).length?'Já existe andamento cadastrado':'A produção ainda vai programar', ok:(m.appearances||[]).length>0}
    ];
    const firstPending = steps.findIndex(x=>!x.ok);
    const box = document.createElement('section');
    box.id='surto-onboarding-progress'; box.className='so-wrap';
    box.innerHTML = `<div class="so-kicker">CONFIGURAÇÃO DO SEU APOIO</div><h2 class="so-title">SEU CAMINHO ATÉ A APARIÇÃO</h2><p class="so-sub">Acompanhe o que já está pronto e o que ainda precisamos de você para produzir seu avatar e preparar sua participação.</p><div class="so-steps">${steps.map((x,i)=>`<div class="so-step ${x.ok?'done':i===firstPending?'current':''}"><div class="so-num">${x.ok?'✓':i+1}</div><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div>`).join('')}</div>${firstPending>0 && firstPending<4?`<div class="so-alert"><div>⚡</div><div><strong>Seu apoio ainda precisa de configuração</strong><p>${firstPending===1?'Preencha o Perfil de Divulgação para sabermos como você quer aparecer e ser marcado.':firstPending===2?'Envie uma foto de rosto e uma foto de corpo para a equipe criar seu avatar oficial.':'Suas informações já chegaram. Agora a equipe do Surto prepara o avatar oficial.'}</p></div></div>`:''}`;
    const hero = root.querySelector('.sd-hero');
    if (hero) hero.insertAdjacentElement('afterend',box); else root.prepend(box);
  }

  async function signedUrl(path){
    if (!path) return null;
    const c=client(); if(!c) return null;
    const {data}=await c.storage.from('supporter-photos').createSignedUrl(path,3600);
    return data && data.signedUrl ? data.signedUrl : null;
  }

  async function uploadPhoto(kind,file,statusEl){
    const c=client(); if(!c) return;
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { statusEl.textContent='Use JPG, PNG ou WEBP.'; return; }
    if (file.size > 10*1024*1024) { statusEl.textContent='A imagem deve ter no máximo 10 MB.'; return; }
    statusEl.className='so-status'; statusEl.textContent='Enviando foto…';
    const {data:sd}=await c.auth.getSession(); const user=sd && sd.session && sd.session.user;
    if(!user){statusEl.textContent='Sua sessão expirou. Entre novamente.';return;}
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`${user.id}/${kind}-${Date.now()}.${ext}`;
    const up=await c.storage.from('supporter-photos').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(up.error){statusEl.textContent='Não conseguimos enviar essa foto. Tente novamente.';return;}
    const field=kind==='face'?'face_photo_path':'body_photo_path';
    const existing=modelCache && modelCache.publicityProfile;
    let db;
    if(existing){ db=await c.from('publicity_profiles').update({[field]:path,updated_at:new Date().toISOString()}).eq('user_id',user.id); }
    else { db=await c.from('publicity_profiles').insert({user_id:user.id,[field]:path,public_consent:false}); }
    if(db.error){ await c.storage.from('supporter-photos').remove([path]); statusEl.textContent='A foto foi enviada, mas não conseguimos salvar no perfil.';return; }
    statusEl.className='so-status ok'; statusEl.textContent='Foto enviada ✓';
    modelCache=null; modelAt=0;
    setTimeout(()=>enhance(),150);
  }

  async function injectPhotos(root){
    if (root.querySelector('#surto-photo-upload')) return;
    const t=norm(root.textContent);
    if(!t.includes('PERFIL DE DIVULGAÇÃO')) return;
    const form=root.querySelector('.sd-form'); if(!form) return;
    const m=await getModel(false); if(!m) return;
    const p=m.publicityProfile||{};
    const face=await signedUrl(p.face_photo_path); const body=await signedUrl(p.body_photo_path);
    const sec=document.createElement('section'); sec.id='surto-photo-upload'; sec.className='so-wrap';
    sec.innerHTML=`<div class="so-kicker">FOTOS PARA O AVATAR</div><h2 class="so-title">MOSTRE COMO VOCÊ QUER APARECER</h2><p class="so-sub">Envie duas referências. Elas ficam privadas e são usadas pela equipe do Surto para produzir seu avatar oficial.</p><div class="so-photos"><div class="so-photo">${face?`<img class="so-preview" src="${esc(face)}" alt="Foto de rosto enviada">`:`<div class="so-guide"><div class="so-silhouette face"><div class="head"></div><div class="body"></div></div></div>`}<h3>1. FOTO DE ROSTO</h3><p>Rosto próximo, de frente, com boa luz e sem filtro pesado. Evite óculos escuros e outras pessoas na imagem.</p><input class="so-file" id="so-face" type="file" accept="image/jpeg,image/png,image/webp"><label class="so-btn secondary" for="so-face">${face?'TROCAR FOTO':'ENVIAR FOTO DE ROSTO'}</label><div class="so-status ${face?'ok':''}" data-face-status>${face?'Foto recebida ✓':'Pendente'}</div></div><div class="so-photo">${body?`<img class="so-preview" src="${esc(body)}" alt="Foto de corpo enviada">`:`<div class="so-guide"><div class="so-silhouette"><div class="head"></div><div class="body"></div></div></div>`}<h3>2. FOTO DE CORPO / LOOK</h3><p>Foto de corpo inteiro ou quase inteiro, usando uma roupa que represente como você gostaria de aparecer na novelinha.</p><input class="so-file" id="so-body" type="file" accept="image/jpeg,image/png,image/webp"><label class="so-btn" for="so-body">${body?'TROCAR FOTO':'ENVIAR FOTO DE CORPO'}</label><div class="so-status ${body?'ok':''}" data-body-status>${body?'Foto recebida ✓':'Pendente'}</div></div></div><div class="so-alert"><div>📸</div><div><strong>Dica para um avatar melhor</strong><p>Use fotos nítidas, recentes e sem cortes no rosto. Não precisa ser foto profissional: luz natural e fundo simples já ajudam muito. A roupa da foto de corpo pode servir como referência para o figurino do avatar.</p></div></div>`;
    form.insertAdjacentElement('afterend',sec);
    sec.querySelector('#so-face').addEventListener('change',e=>uploadPhoto('face',e.target.files&&e.target.files[0],sec.querySelector('[data-face-status]')));
    sec.querySelector('#so-body').addEventListener('change',e=>uploadPhoto('body',e.target.files&&e.target.files[0],sec.querySelector('[data-body-status]')));
  }

  async function enhance(){
    if(injecting) return; injecting=true;
    try{
      ensureStyles(); bindSmoothNav();
      const root=document.querySelector('#surto-supporter-real-v2');
      if(root){ await injectHome(root); await injectPhotos(root); }
    } finally { injecting=false; }
  }

  const mo=new MutationObserver(()=>{ clearTimeout(mo._t); mo._t=setTimeout(enhance,35); });
  mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,80),{once:true}); else setTimeout(enhance,80);
})();
