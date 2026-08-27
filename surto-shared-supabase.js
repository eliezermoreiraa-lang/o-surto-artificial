(() => {
  'use strict';
  if (window.__surtoSharedSupabaseShim) return;
  const install = () => {
    if (!(window.supabase && window.supabase.createClient)) {
      setTimeout(install, 20);
      return;
    }
    if (window.__surtoSharedSupabaseShim) return;
    window.__surtoSharedSupabaseShim = true;
    const original = window.supabase.createClient.bind(window.supabase);
    window.__surtoOriginalCreateClient = original;
    const sharedClient = function(url, key, options) {
      const storageKey = options && options.auth && options.auth.storageKey;
      const isSurto = url === 'https://ndfchglutpnbckpcrppy.supabase.co' && storageKey === 'surto-auth';
      if (!isSurto) return original(url, key, options);
      if (window.__surtoSharedSupabaseClient) return window.__surtoSharedSupabaseClient;
      const client = original(url, key, options);
      window.__surtoSharedSupabaseClient = client;
      return client;
    };
    window.getSurtoSupabaseClient = sharedClient;
    window.supabase.createClient = sharedClient;
    sharedClient(
      'https://ndfchglutpnbckpcrppy.supabase.co',
      'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C',
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'surto-auth' } }
    );
  };
  install();
})();
