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
    const client = sharedClient(
      'https://ndfchglutpnbckpcrppy.supabase.co',
      'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C',
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit', storageKey: 'surto-auth' } }
    );

    const callbackUrl = new URL(window.location.href);
    const callbackHash = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
    const accessToken = callbackHash.get('access_token');
    const refreshToken = callbackHash.get('refresh_token');
    const callbackError = callbackHash.get('error') || callbackHash.get('error_code');
    if (!accessToken && !refreshToken && !callbackError) {
      window.__surtoOAuthReady = Promise.resolve({ ok: true, callback: false });
      return;
    }

    document.documentElement.dataset.surtoAuthCallback = 'processing';
    const finishUrl = (ok) => {
      callbackUrl.hash = '';
      callbackUrl.searchParams.delete('code');
      callbackUrl.searchParams.delete('state');
      callbackUrl.searchParams.delete('oauth_error');
      callbackUrl.searchParams.set(ok ? 'oauth' : 'oauth_error', ok ? 'success' : '1');
      window.history.replaceState({}, document.title, callbackUrl.pathname + callbackUrl.search);
    };
    if (callbackError || !accessToken || !refreshToken) {
      finishUrl(false);
      document.documentElement.dataset.surtoAuthCallback = 'error';
      window.__surtoOAuthReady = Promise.resolve({ ok: false, callback: true, error: new Error(callbackError || 'Credenciais incompletas') });
      return;
    }

    window.__surtoOAuthReady = client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
      if (error || !data || !data.session) {
        finishUrl(false);
        document.documentElement.dataset.surtoAuthCallback = 'error';
        return { ok: false, callback: true, error: error || new Error('Sessão não recebida') };
      }
      finishUrl(true);
      window.__surtoOAuthCompleted = true;
      document.documentElement.dataset.surtoAuthCallback = 'success';
      return { ok: true, callback: true, session: data.session };
    }).catch(error => {
      finishUrl(false);
      document.documentElement.dataset.surtoAuthCallback = 'error';
      return { ok: false, callback: true, error };
    });
  };
  install();
})();
