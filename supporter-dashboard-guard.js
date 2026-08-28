(() => {
  'use strict';
  if (window.__surtoDashboardGuardV1) return;
  window.__surtoDashboardGuardV1 = true;

  const SB_URL = 'https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const APP_LABELS = ['INÍCIO','MEUS APOIOS','MINHAS APARIÇÕES','PERFIL DE DIVULGAÇÃO','MINHA ASSINATURA','MEUS EPISÓDIOS','ÁREA VIP'];
  let sb = null;
  let hasPaidSupport = null;
  let checking = false;

  async function sharedDashboardData(){
    for(let attempt=0;attempt<20;attempt+=1){
      if(typeof window.__surtoGetSupporterDashboardData==='function'){
        return window.__surtoGetSupporterDashboardData();
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const c=client();
    if(!c)return null;
    const {data,error}=await c.functions.invoke('supporter-dashboard-data',{body:{}});
    return error?null:data;
  }

  const norm = v => String(v || '').replace(/\s+/g,' ').trim().toUpperCase();

  function ensureCss(){
    if (document.getElementById('surto-dashboard-guard-css')) return;
    const s = document.createElement('style');
    s.id = 'surto-dashboard-guard-css';
    s.textContent = `
      .surto-dashboard-shell > *:not(.surto-dashboard-nav):not(#surto-supporter-real-v2):not(#surto-dashboard-loading){display:none!important}
      #surto-dashboard-loading{padding:38px 2px 50px;color:rgba(245,245,245,.52);font:12px Inter,system-ui,sans-serif;letter-spacing:.03em}
      #surto-supporter-real-v2{display:block!important}
    `;
    document.head.appendChild(s);
  }

  function client(){
    if (sb) return sb;
    if (!(window.supabase && window.supabase.createClient)) return null;
    sb = window.getSurtoSupabaseClient(SB_URL, SB_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'implicit',storageKey:'surto-auth'}
    });
    return sb;
  }

  function findAppNav(){
    const all = Array.from(document.querySelectorAll('div'));
    const candidates = all.filter(el => {
      const t = norm(el.textContent);
      if (t.length > 220) return false;
      return APP_LABELS.every(label => t.includes(label)) && t.includes('SAIR');
    });
    candidates.sort((a,b)=>norm(a.textContent).length-norm(b.textContent).length);
    return candidates[0] || null;
  }

  function findShell(nav){
    if (!nav) return null;
    let p = nav.parentElement;
    while (p && p !== document.body) {
      const t = norm(p.textContent);
      if (t.includes('CLUBE DO SURTO') || t.includes('MEUS APOIOS') || p.children.length > 1) return p;
      p = p.parentElement;
    }
    return nav.parentElement;
  }

  function protectDashboard(){
    ensureCss();
    const nav = findAppNav();
    if (!nav) return;
    const shell = findShell(nav);
    if (!shell) return;
    shell.classList.add('surto-dashboard-shell');
    nav.classList.add('surto-dashboard-nav');

    let loading = shell.querySelector('#surto-dashboard-loading');
    const real = shell.querySelector('#surto-supporter-real-v2');
    if (!real) {
      if (!loading) {
        loading = document.createElement('div');
        loading.id = 'surto-dashboard-loading';
        loading.textContent = 'Carregando sua Área do Apoiador…';
        nav.insertAdjacentElement('afterend', loading);
      }
    } else if (loading) {
      loading.remove();
    }
  }

  async function refreshSupport(){
    if (checking) return;
    const c = client();
    if (!c) return;
    checking = true;
    try {
      const {data:sess} = await c.auth.getSession();
      if (!sess?.session?.user) { hasPaidSupport = false; return; }
      const data = await sharedDashboardData();
      if (data?.ok) hasPaidSupport = !!data.currentSupport;
    } catch (_) {
      hasPaidSupport = null;
    } finally {
      checking = false;
    }
  }

  function clickAccountEntry(){
    const nodes = Array.from(document.querySelectorAll('div,button,a'));
    const exact = nodes.filter(el => norm(el.textContent) === 'ENTRAR' && !el.closest('.surto-dashboard-shell'));
    const target = exact.find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || exact[0];
    if (target) target.click();
  }

  document.addEventListener('click', ev => {
    if (!hasPaidSupport) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('div,button,a') : null;
    if (!el || el.closest('.surto-dashboard-shell')) return;
    const t = norm(el.textContent);
    if (t !== 'ENTRAR PARA O CLUBE' && t !== 'QUERO ENTRAR PARA O CLUBE' && !t.startsWith('ENTRAR PARA O CLUBE ')) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    clickAccountEntry();
  }, true);

  const mo = new MutationObserver(()=>protectDashboard());
  mo.observe(document.documentElement,{childList:true,subtree:true});

  const boot = () => {
    ensureCss();
    protectDashboard();
    refreshSupport();
    const c = client();
    if (c) c.auth.onAuthStateChange(()=>setTimeout(refreshSupport,50));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
