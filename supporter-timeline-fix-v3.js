(() => {
  'use strict';
  if (window.__surtoTimelineFixV3) return;
  window.__surtoTimelineFixV3 = true;

  const SB_URL='https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  let sb=null, published=false, lastFetch=0, fetching=false;
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toUpperCase();

  function client(){
    if(sb)return sb;
    if(!(window.supabase&&window.supabase.createClient))return null;
    sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'surto-auth'}});
    return sb;
  }

  function getItems(){
    const p=document.querySelector('#sv4-progress');
    if(!p)return null;
    const items=Array.from(p.querySelectorAll('.sv4-item'));
    const avatar=items.find(x=>norm(x.querySelector('b')?.textContent)==='AVATAR') || items[3];
    const appearance=items.find(x=>norm(x.querySelector('b')?.textContent)==='APARIÇÃO') || items[4];
    return avatar&&appearance?{avatar,appearance}:null;
  }

  function setPending(el,label='Aguardando produção'){
    el.classList.remove('done');
    el.classList.add('current');
    el.style.setProperty('box-shadow','inset 0 0 0 1px rgba(229,9,20,.55)','important');
    const dot=el.querySelector('.sv4-dot');
    if(dot){
      dot.textContent='5';
      dot.style.setProperty('background','#E50914','important');
      dot.style.setProperty('color','#fff','important');
    }
    const span=el.querySelector('span');
    if(span)span.textContent=label;
  }

  function setDone(el){
    el.classList.remove('current');
    el.classList.add('done');
    el.style.setProperty('box-shadow','inset 0 0 0 1px rgba(0,229,255,.32)','important');
    const dot=el.querySelector('.sv4-dot');
    if(dot){
      dot.textContent='✓';
      dot.style.setProperty('background','#00E5FF','important');
      dot.style.setProperty('color','#061014','important');
    }
    const span=el.querySelector('span');
    if(span)span.textContent='Aparição concluída';
  }

  function enforce(){
    const pair=getItems();
    if(!pair)return;
    const avatarDone=pair.avatar.classList.contains('done');
    if(!avatarDone){
      setPending(pair.appearance,'Aguardando produção');
      return;
    }
    if(published)setDone(pair.appearance);
    else setPending(pair.appearance,'Aguardando aparição');
  }

  async function refreshData(){
    const now=Date.now();
    if(fetching || now-lastFetch<3000)return;
    const c=client();if(!c)return;
    fetching=true;lastFetch=now;
    try{
      const {data,error}=await c.functions.invoke('supporter-dashboard-data',{body:{}});
      if(error||!data?.ok)return;
      const aps=Array.isArray(data.appearances)?data.appearances:[];
      published=aps.some(a=>a?.status==='published'||!!a?.published_at||!!a?.published_url||!!a?.episodes?.published_at);
    }finally{fetching=false;enforce()}
  }

  function openProfile(){
    const candidates=Array.from(document.querySelectorAll('div,button,a'));
    const target=candidates.find(el=>norm(el.textContent)==='PERFIL DE DIVULGAÇÃO'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
    if(target){target.click();return true}
    return false;
  }

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#sv4-go-profile');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();
    setTimeout(openProfile,0);
  },true);

  const style=document.createElement('style');
  style.id='surto-timeline-v3-css';
  style.textContent=`
    #sv4-progress .sv4-track .sv4-item:nth-child(4):not(.done) + .sv4-item{
      box-shadow:inset 0 0 0 1px rgba(229,9,20,.55)!important;
    }
    #sv4-progress .sv4-track .sv4-item:nth-child(4):not(.done) + .sv4-item .sv4-dot{
      background:#E50914!important;color:#fff!important;
    }
  `;
  document.head.appendChild(style);

  const tick=()=>{enforce();refreshData()};
  const mo=new MutationObserver(()=>enforce());
  mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(tick,500);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
})();