(() => {
  'use strict';
  if (window.__surtoMobileExperienceV2) return;
  window.__surtoMobileExperienceV2 = true;

  const style = document.createElement('style');
  style.id = 'surto-mobile-experience-v2-css';
  style.textContent = `
    .sa-mobile-public-nav{display:flex;align-items:center;gap:2px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:none;padding:3px 8px 9px;max-width:100%;background:rgba(11,13,19,.96)}
    .sa-mobile-public-nav::-webkit-scrollbar{display:none}.sa-mobile-public-nav>div{flex:0 0 auto;min-height:42px;padding:0 10px;display:grid;place-items:center;scroll-snap-align:start;border-radius:8px;font-size:10.5px;letter-spacing:.02em;white-space:nowrap;cursor:pointer}.sa-mobile-public-nav>div[style*="#F5F5F5"]{background:rgba(229,9,20,.13);box-shadow:inset 0 0 0 1px rgba(229,9,20,.48)}
    .sa-reveal-block{transition:opacity .72s ease,transform .72s cubic-bezier(.2,.7,.2,1);transition-delay:var(--sa-delay,0ms)}.sa-reveal-block:not(.sa-reveal-in){opacity:0;transform:translateY(28px)}.sa-reveal-in{opacity:1;transform:none}
    @media(max-width:1079px){
      .sa-site-header{backdrop-filter:blur(18px)!important}.sa-header-main{padding:9px 16px 6px!important}.sa-header-main img{height:40px!important}.sa-account-button{min-width:103px;min-height:44px}
      .sa-home-hero-grid{grid-template-columns:minmax(0,1fr) 116px!important;gap:16px 14px!important;padding:38px 18px 60px!important;align-items:start!important;align-self:flex-start!important}.sa-hero-copy{display:contents}.sa-hero-label{grid-column:1/-1;margin-bottom:2px!important}.sa-hero-title{grid-column:1/-1;font-size:clamp(48px,15vw,64px)!important}.sa-hero-copytext{grid-column:1;align-self:start;margin:0!important;font-size:14px!important;line-height:1.55!important}.sa-hero-cta{grid-column:1;width:100%;min-height:56px!important;height:auto!important;padding:12px 16px!important;justify-content:space-between;line-height:1.35;box-sizing:border-box}.sa-hero-benefits{grid-column:1/-1;margin-top:4px!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important}.sa-hero-benefits>div>span:nth-child(2){display:none}.sa-hero-poster{grid-column:2;grid-row:3 / span 2;align-self:start}.sa-hero-poster>div:last-child{max-width:116px!important;animation-duration:8s!important}.sa-hero-poster>div:first-child{inset:-10%!important;filter:blur(24px)!important}.sa-hero-poster img{border-radius:9px!important}.sa-hero-poster span{font-size:6.5px!important;padding:5px 6px!important}.sa-hero-poster span+span{display:none!important}
      .sd-mobile-nav{top:105px!important}.sd-mobile-nav>div{min-height:44px!important;height:44px!important}.sd-mobile-nav>div:last-child{margin-right:8px}.sd-mobile-nav+*{margin-top:4px}
    }
    @media(max-width:370px){.sa-home-hero-grid{grid-template-columns:minmax(0,1fr) 104px!important;gap:14px 12px!important;padding-inline:14px!important}.sa-hero-poster>div:last-child{max-width:104px!important}.sa-hero-title{font-size:46px!important}.sa-mobile-public-nav>div{padding-inline:12px}}
    @media(prefers-reduced-motion:reduce){.sa-reveal-block{opacity:1!important;transform:none!important;transition:none!important}.sa-hero-poster>div,.sa-home-hero-grid *{animation:none!important;scroll-behavior:auto!important}}
  `;
  document.head.appendChild(style);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = reduce ? null : new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('sa-reveal-in'); io.unobserve(entry.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });

  function eligible(el) {
    if (!el || el.dataset.saRevealBound === '1' || el.closest('.sa-site-header,#surto-supporter-real-v2,.modal')) return false;
    const text = (el.textContent || '').replace(/\s+/g,' ').trim().toUpperCase();
    if (!text || text.includes('SUA IDEIA TAMBÉM PODE VIRAR UM SURTO')) return false;
    return true;
  }

  function enhance() {
    if (reduce) return;
    const candidates = Array.from(document.querySelectorAll('[data-reveal], h2')).map(el => el.matches('h2') ? el.parentElement : el).filter(eligible);
    candidates.forEach((el,index) => {
      el.dataset.saRevealBound='1';
      el.classList.add('sa-reveal-block');
      el.style.setProperty('--sa-delay',`${Math.min(index%4,3)*70}ms`);
      const box=el.getBoundingClientRect();
      if (box.top < innerHeight*.88) el.classList.add('sa-reveal-in'); else io.observe(el);
    });
  }

  let timer;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(enhance,80)};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});

  let hasPaidSupport=false;
  async function refreshSupportState(){
    if(!(window.supabase&&window.supabase.createClient))return setTimeout(refreshSupportState,100);
    const sb=window.supabase.createClient('https://ndfchglutpnbckpcrppy.supabase.co','sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'surto-auth'}});
    const check=async()=>{try{const {data:s}=await sb.auth.getSession();if(!s?.session){hasPaidSupport=false;document.documentElement.dataset.surtoPaidGuard='signed-out';return}const {data}=await sb.functions.invoke('supporter-dashboard-data',{body:{}});hasPaidSupport=!!data?.currentSupport;document.documentElement.dataset.surtoPaidGuard=hasPaidSupport?'paid':'no-support'}catch{hasPaidSupport=false;document.documentElement.dataset.surtoPaidGuard='error'}};
    await check();sb.auth.onAuthStateChange(()=>setTimeout(check,0));
  }
  const upgradeTexts=['CLUBE','CLUBE DO SURTO','ESCOLHER MEU APOIO','ENTRAR PARA O CLUBE','ENTRAR PARA O CLUBE DO SURTO','QUERO ENTRAR PARA O CLUBE','ESCOLHER APOIADOR','ESCOLHER DESTAQUE','QUERO SER VIP'];
  document.addEventListener('click',event=>{
    if(!hasPaidSupport)return;
    const el=event.target?.closest?.('a,button,div');if(!el||el.closest('#surto-supporter-real-v2'))return;
    const text=(el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
    if(!upgradeTexts.includes(text))return;
    event.preventDefault();event.stopImmediatePropagation();
    const account=document.querySelector('.sa-account-button');
    if(account)account.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    setTimeout(()=>window.__surtoOpenUpgrade&&window.__surtoOpenUpgrade(),420);
  },true);
  refreshSupportState();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
