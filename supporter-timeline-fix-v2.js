(() => {
  'use strict';
  if (window.__surtoTimelineFixV2) return;
  window.__surtoTimelineFixV2 = true;

  const SB_URL='https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  let sb=null, timer=null, checking=false, lastCheck=0, cachedDone=false, cachedActive=false;
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toUpperCase();

  function client(){
    if(sb)return sb;
    if(!(window.supabase&&window.supabase.createClient))return null;
    sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'surto-auth'}});
    return sb;
  }

  function openProfile(){
    const nav=document.querySelector('.surto-dashboard-nav');
    const pool=nav ? Array.from(nav.querySelectorAll('div,button,a')) : Array.from(document.querySelectorAll('div,button,a'));
    const target=pool.find(el=>norm(el.textContent)==='PERFIL DE DIVULGAÇÃO' && el.getBoundingClientRect().width>0 && el.getBoundingClientRect().height>0)
      || pool.find(el=>norm(el.textContent)==='PERFIL DE DIVULGAÇÃO');
    if(!target)return false;
    target.click();
    return true;
  }

  document.addEventListener('click',ev=>{
    const btn=ev.target?.closest?.('#sv4-go-profile');
    if(!btn)return;
    ev.preventDefault();
    setTimeout(openProfile,0);
  },true);

  function paint(done,active){
    const progress=document.querySelector('#sv4-progress');
    if(!progress)return;
    const items=Array.from(progress.querySelectorAll('.sv4-item'));
    const appearance=items.find(el=>norm(el.querySelector('b')?.textContent)==='APARIÇÃO') || items[items.length-1];
    if(!appearance)return;
    const dot=appearance.querySelector('.sv4-dot');
    const desc=appearance.querySelector('span');

    appearance.classList.remove('done','current');
    if(done){
      appearance.classList.add('done');
      appearance.style.boxShadow='inset 0 0 0 1px rgba(0,229,255,.32)';
      if(dot){dot.textContent='✓';dot.style.background='#00E5FF';dot.style.color='#061014'}
      if(desc)desc.textContent='Aparição concluída';
    }else{
      appearance.classList.add('current');
      appearance.style.boxShadow='inset 0 0 0 1px rgba(229,9,20,.55)';
      if(dot){dot.textContent='5';dot.style.background='#E50914';dot.style.color='#fff'}
      if(desc)desc.textContent=active?'Em andamento':'Aguardando produção';
    }
  }

  async function refresh(){
    const progress=document.querySelector('#sv4-progress');
    if(!progress)return;
    paint(cachedDone,cachedActive);
    const now=Date.now();
    if(checking || now-lastCheck<2500)return;
    const c=client();if(!c)return;
    checking=true;lastCheck=now;
    try{
      const {data,error}=await c.functions.invoke('supporter-dashboard-data',{body:{}});
      if(error||!data?.ok)return;
      const aps=Array.isArray(data.appearances)?data.appearances:[];
      cachedDone=aps.some(a=>a?.status==='published' || !!a?.published_at || !!a?.episodes?.published_at);
      cachedActive=aps.some(a=>a?.status && a.status!=='cancelled');
      paint(cachedDone,cachedActive);
    }finally{checking=false}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,60)}
  const mo=new MutationObserver(schedule);
  mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();