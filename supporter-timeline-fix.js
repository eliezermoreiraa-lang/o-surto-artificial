(() => {
  'use strict';
  if (window.__surtoTimelineFixV1) return;
  window.__surtoTimelineFixV1 = true;

  const SB_URL='https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const NAV_LABELS=['INÍCIO','MEUS APOIOS','MINHAS APARIÇÕES','PERFIL DE DIVULGAÇÃO','MINHA ASSINATURA','MEUS EPISÓDIOS','ÁREA VIP'];
  let sb=null, timer=null, refreshing=false;
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toUpperCase();

  function client(){
    if(sb)return sb;
    if(!(window.supabase&&window.supabase.createClient))return null;
    sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'surto-auth'}});
    return sb;
  }

  function findAppNav(){
    const candidates=Array.from(document.querySelectorAll('div')).filter(el=>{
      const t=norm(el.textContent);
      return t.length<230 && NAV_LABELS.every(x=>t.includes(x)) && t.includes('SAIR');
    });
    candidates.sort((a,b)=>norm(a.textContent).length-norm(b.textContent).length);
    return candidates[0]||null;
  }

  function openProfile(){
    const nav=findAppNav();
    if(!nav)return false;
    const items=Array.from(nav.querySelectorAll('div'));
    const target=items.find(el=>norm(el.textContent)==='PERFIL DE DIVULGAÇÃO' && el.getBoundingClientRect().width>0) || items.find(el=>norm(el.textContent)==='PERFIL DE DIVULGAÇÃO');
    if(!target)return false;
    target.click();
    return true;
  }

  document.addEventListener('click',ev=>{
    const btn=ev.target?.closest?.('#sv4-go-profile');
    if(!btn)return;
    ev.preventDefault();
    openProfile();
  },true);

  async function fixAppearanceState(){
    const progress=document.querySelector('#sv4-progress');
    if(!progress||refreshing)return;
    const items=Array.from(progress.querySelectorAll('.sv4-item'));
    const appearance=items.find(el=>norm(el.querySelector('b')?.textContent)==='APARIÇÃO');
    if(!appearance)return;

    refreshing=true;
    try{
      const c=client();
      if(!c)return;
      const {data,error}=await c.functions.invoke('supporter-dashboard-data',{body:{}});
      if(error||!data?.ok)return;
      const aps=Array.isArray(data.appearances)?data.appearances:[];
      const done=aps.some(a=>a?.status==='published' || !!a?.published_at || !!a?.episodes?.published_at);
      const active=aps.some(a=>a?.status!=='cancelled');

      appearance.classList.toggle('done',done);
      appearance.classList.toggle('current',!done);
      const dot=appearance.querySelector('.sv4-dot');
      const desc=appearance.querySelector('span');
      if(dot) dot.textContent=done?'✓':'5';
      if(desc){
        if(done) desc.textContent='Aparição concluída';
        else if(active) desc.textContent='Em andamento';
        else desc.textContent='Aguardando produção';
      }
    }finally{
      refreshing=false;
    }
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(fixAppearanceState,80)}
  const mo=new MutationObserver(schedule);
  mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
