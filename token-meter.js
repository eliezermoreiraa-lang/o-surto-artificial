(() => {
  'use strict';
  if (window.__surtoTokenMeter) return;
  window.__surtoTokenMeter = true;
  const endpoint = 'https://ndfchglutpnbckpcrppy.supabase.co/rest/v1/token_meter_public?select=progress_percent,level&limit=1';
  const key = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const labels = { low: 'Precisamos de mais combustível', building: 'O Surto está ganhando força', ready: 'Estamos perto da meta!' };
  let latest = null, failed = false, inFlight = null, current = null;
  function paint(root) {
    if (!root) return;
    const status = root.querySelector('[data-token-status]');
    const track = root.querySelector('[data-token-track]');
    root.querySelector('[data-token-retry]').hidden = !failed;
    if (!latest) {
      status.textContent = failed ? 'Meta indisponível no momento' : 'Consultando a meta…';
      track.setAttribute('aria-busy', String(!failed));
      return;
    }
    const percent = latest.progress_percent;
    root.dataset.level = latest.level;
    root.style.setProperty('--token-progress', `${percent}%`);
    root.querySelector('[data-token-percent]').textContent = `${percent}%`;
    status.textContent = failed ? 'Última leitura · atualização pendente' : percent === 100 ? 'Meta abastecida. Vamos produzir!' : labels[latest.level];
    track.setAttribute('aria-busy', 'false');
    track.setAttribute('aria-valuenow', String(percent));
    track.setAttribute('aria-valuetext', `${percent}% da meta de apoio à produção`);
  }
  async function refresh() {
    if (inFlight || document.hidden || !document.querySelector('[data-token-meter]')) return inFlight;
    inFlight = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(endpoint, { headers: { apikey: key }, signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('unavailable');
        const rows = await response.json(), row = rows?.[0];
        if (!row || !Number.isInteger(row.progress_percent) || row.progress_percent < 0 || row.progress_percent > 100 || !Object.hasOwn(labels, row.level)) throw new Error('invalid');
        latest = row; failed = false;
      } catch (_) { failed = true; }
      finally { clearTimeout(timer); paint(document.querySelector('[data-token-meter]')); }
    })();
    try { await inFlight; } finally { inFlight = null; }
  }
  function mount() {
    const root = document.querySelector('[data-token-meter]');
    if (!root || root === current) return;
    current = root;
    root.querySelector('[data-token-retry]').addEventListener('click', refresh);
    paint(root); refresh();
  }
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  setInterval(refresh, 30000);
  mount();
})();
