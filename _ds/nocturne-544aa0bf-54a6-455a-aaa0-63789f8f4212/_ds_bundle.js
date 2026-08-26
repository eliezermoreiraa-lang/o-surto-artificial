/* O Surto Artificial — production loader */
(() => {
  const load = (src) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  };
  load('/surto-payment-patch.js?v=20260826-1');
  load('/supporter-dashboard-real-v2.js?v=20260826-2');
})();
