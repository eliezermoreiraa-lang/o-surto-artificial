/* O Surto Artificial — production loader */
(() => {
  if (window.__surtoProductionLoaderStarted) return;
  window.__surtoProductionLoaderStarted = true;
  const load = (src) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  };

  load('/surto-payment-patch.js?v=20260827-2');
  load('/mobile-experience-v2.js?v=20260827-6');
  load('/supporter-dashboard-guard.js?v=20260827-2');

  const startDashboard = () => {
    if (window.supabase && window.supabase.createClient) {
      load('/supporter-dashboard-real-v2.js?v=20260827-6');
      load('/supporter-profile-workflow-v4.js?v=20260827-4');
      return;
    }
    setTimeout(startDashboard, 50);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDashboard, { once: true });
  } else {
    startDashboard();
  }
})();
