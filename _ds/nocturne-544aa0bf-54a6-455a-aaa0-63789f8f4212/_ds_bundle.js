/* O Surto Artificial — production loader */
(() => {
  const load = (src) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  };

  load('/surto-payment-patch.js?v=20260827-2');
  load('/mobile-experience-v2.js?v=20260827-5');
  load('/supporter-dashboard-guard.js?v=20260826-1');

  const startDashboard = () => {
    if (window.supabase && window.supabase.createClient) {
      load('/supporter-dashboard-real-v2.js?v=20260827-3');
      load('/supporter-profile-workflow-v4.js?v=20260827-2');
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
