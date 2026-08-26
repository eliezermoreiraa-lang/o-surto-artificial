/* O Surto Artificial — production loader */
(() => {
  const load = (src) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  };

  load('/surto-payment-patch.js?v=20260826-1');
  load('/supporter-dashboard-guard.js?v=20260826-1');
  load('/surto-shared-supabase.js?v=20260826-1');

  let dashboardStarted = false;
  const startDashboard = () => {
    if (dashboardStarted) return;
    if (window.supabase && window.supabase.createClient && window.__surtoSharedSupabaseShim) {
      dashboardStarted = true;
      load('/supporter-dashboard-real-v2.js?v=20260826-4');
      load('/supporter-profile-workflow-v4.js?v=20260826-1');
      load('/supporter-timeline-fix-v3.js?v=20260826-1');
      return;
    }
    setTimeout(startDashboard, 25);
  };

  startDashboard();
})();