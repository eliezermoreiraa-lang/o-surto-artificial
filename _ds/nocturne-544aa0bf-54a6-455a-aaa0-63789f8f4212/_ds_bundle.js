/* O Surto Artificial — production loader */
(() => {
  const load = (src) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  };

  const ORIGINAL_AUTH_KEY = 'surto-auth';
  const DASH_AUTH_KEY = 'sb-ndfchglutpnbckpcrppy-auth-token';

  const syncAuth = () => {
    try {
      const raw = localStorage.getItem(ORIGINAL_AUTH_KEY);
      if (raw) {
        if (localStorage.getItem(DASH_AUTH_KEY) !== raw) {
          localStorage.setItem(DASH_AUTH_KEY, raw);
        }
      } else if (localStorage.getItem(DASH_AUTH_KEY)) {
        localStorage.removeItem(DASH_AUTH_KEY);
      }
    } catch (_) {}
  };

  syncAuth();
  setInterval(syncAuth, 500);

  load('/surto-payment-patch.js?v=20260826-1');

  const startDashboard = () => {
    syncAuth();
    if (window.supabase && window.supabase.createClient) {
      load('/supporter-dashboard-real-v2.js?v=20260826-3');
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
