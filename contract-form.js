(() => {
  'use strict';
  const endpoint = 'https://ndfchglutpnbckpcrppy.supabase.co/rest/v1/rpc/submit_contract_request';
  const key = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const fields = [
    ['name', 'seu nome', 120, 2],
    ['email', 'voce@email.com', 254, 1],
    ['company', 'marca, artista, canal…', 200, 0],
    ['idea', 'o surto que você quer ver no ar', 5000, 10],
    ['deadline', 'ex: 3 semanas', 120, 0],
    ['budget', 'ex: R$ 5.000', 120, 0]
  ];
  let busy = false;
  let retry = null;
  try { retry = JSON.parse(sessionStorage.getItem('surto-contract-retry') || 'null'); } catch (_) {}

  function elements(root) {
    return fields.map(([name, placeholder, max, min]) => {
      const el = root.querySelector(`[placeholder="${placeholder}"]`);
      if (!el) throw new Error('Formulário indisponível. Atualize a página.');
      el.name = name;
      el.maxLength = max;
      el.minLength = min;
      el.required = min > 0;
      if (name === 'email') { el.type = 'email'; el.autocomplete = 'email'; }
      if (name === 'name') el.autocomplete = 'name';
      return el;
    });
  }

  function setup(root) {
    const button = root.querySelector('[data-contract-submit]');
    if (!button) return;
    elements(root);
    if (!root.querySelector('[data-contract-status]')) {
      const status = document.createElement('p');
      status.dataset.contractStatus = '';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.style.cssText = 'margin:0;font-size:14px;line-height:1.6;overflow-wrap:anywhere;';
      button.after(status);
      const trap = document.createElement('input');
      trap.name = 'website';
      trap.dataset.contractTrap = '';
      trap.tabIndex = -1;
      trap.autocomplete = 'off';
      trap.setAttribute('aria-hidden', 'true');
      trap.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;';
      button.before(trap);
    }
  }

  async function submit() {
    const root = document.querySelector('#orcamento');
    if (!root || busy) return;
    setup(root);
    const inputs = elements(root);
    const button = root.querySelector('[data-contract-submit]');
    const status = root.querySelector('[data-contract-status]');
    status.textContent = '';
    for (const input of inputs) {
      input.value = input.value.trim();
      input.setCustomValidity(input.required && input.value.length < input.minLength
        ? `Preencha este campo com pelo menos ${input.minLength} caracteres.` : '');
      if (!input.reportValidity()) return;
    }
    const payload = Object.fromEntries(inputs.map(el => [el.name, el.value]));
    payload.website = root.querySelector('[data-contract-trap]').value;
    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    inputs.forEach(el => el.readOnly = true);
    const original = button.innerHTML;
    button.textContent = 'ENVIANDO PEDIDO…';
    status.style.color = '#b9bdc9';
    status.textContent = 'Registrando sua solicitação…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
      const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (!retry || retry.fingerprint !== fingerprint) retry = { fingerprint, id: crypto.randomUUID() };
      // Persist only a digest and random ID, never the applicant's personal data.
      try { sessionStorage.setItem('surto-contract-retry', JSON.stringify(retry)); } catch (_) {}
      const response = await fetch(endpoint, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_id: retry.id, p_payload: payload }), signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true || result.id !== retry.id) {
        const message = ['PT400', 'PT409', 'PT429', 'PT503'].includes(result.code) ? result.message : null;
        throw new Error(message || 'Não foi possível confirmar o envio. Seus dados foram mantidos; tente novamente.');
      }
      status.style.color = '#4ade80';
      status.textContent = `Pedido registrado! Protocolo: ${result.id}. A equipe responderá pelo e-mail informado em até 2 dias úteis.`;
      inputs.forEach(el => { el.value = ''; });
      retry = null;
      try { sessionStorage.removeItem('surto-contract-retry'); } catch (_) {}
    } catch (error) {
      status.style.color = '#fda4af';
      status.textContent = error.name === 'AbortError'
        ? 'A confirmação demorou. Seus dados foram mantidos; tente novamente para confirmar o mesmo pedido.'
        : (error instanceof TypeError ? 'Sem conexão com o envio. Seus dados foram mantidos; tente novamente.' : error.message);
      const fallback = document.createElement('a');
      fallback.href = 'mailto:osurtoartificial@gmail.com';
      fallback.textContent = ' Ou fale com osurtoartificial@gmail.com.';
      fallback.style.color = 'inherit';
      status.append(fallback);
    } finally {
      clearTimeout(timer);
      busy = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = original;
      inputs.forEach(el => el.readOnly = false);
    }
  }
  window.SurtoContractForm = { submit };
  document.addEventListener('input', event => {
    if (event.target.closest('#orcamento') && event.target.setCustomValidity) event.target.setCustomValidity('');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('#orcamento input:not([data-contract-trap])')) {
      event.preventDefault();
      submit();
    }
  });
  const enhance = () => {
    const root = document.querySelector('#orcamento');
    if (root && !root.querySelector('[data-contract-status]')) setup(root);
  };
  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
