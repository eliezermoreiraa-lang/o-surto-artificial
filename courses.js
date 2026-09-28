(() => {
  'use strict';
  const form = document.querySelector('#courseLeadForm');
  if (!form) return;
  const contact = form.elements.contact;
  const status = document.querySelector('#courseLeadStatus');
  let busy = false;
  const drafts = { email: '', whatsapp: '' };
  let channel = 'email';
  form.addEventListener('change', event => {
    if (event.target.name !== 'channel') return;
    drafts[channel] = contact.value;
    channel = event.target.value;
    contact.value = drafts[channel];
    contact.type = channel === 'email' ? 'email' : 'tel';
    contact.autocomplete = channel === 'email' ? 'email' : 'tel';
    contact.placeholder = channel === 'email' ? 'voce@email.com' : '+55 (11) 99999-9999';
    contact.maxLength = channel === 'email' ? 254 : 30;
    contact.setCustomValidity('');
    document.querySelector('#leadContactLabel').textContent = channel === 'email' ? 'Seu e-mail' : 'Seu WhatsApp com código do país e DDD';
    document.querySelector('#contactHint').textContent = channel === 'email' ? 'Use um e-mail que você consulta com frequência.' : 'Brasil: +55, DDD e número. Para outros países, use o código internacional.';
    status.textContent = '';
  });
  contact.addEventListener('input', () => contact.setCustomValidity(''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const raw = contact.value.trim();
    const normalized = channel === 'email' ? raw.toLowerCase() : '+' + raw.replace(/\D/g, '');
    if (channel === 'whatsapp' && (!raw.startsWith('+') || !/^\+[1-9]\d{7,14}$/.test(normalized))) {
      contact.setCustomValidity('Informe +, código do país, DDD e número. Exemplo: +55 11 99999-9999.');
    }
    if (!form.reportValidity()) return;
    busy = true;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.dataset.state = 'pending';
    status.textContent = 'Registrando seu interesse…';
    const payload = { channel, contact: normalized, consent: form.elements.consent.checked, website: form.elements.website.value };
    const controls = [...form.querySelectorAll('input')];
    controls.forEach(input => { input.disabled = true; });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('https://ndfchglutpnbckpcrppy.supabase.co/rest/v1/course_leads', {
        method: 'POST', headers: { apikey: 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C', 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(payload), signal: controller.signal
      });
      const out = response.ok ? null : await response.json().catch(() => ({}));
      // Only the unique contact conflict is idempotent success. No lead is read or overwritten.
      if (!response.ok && !(response.status === 409 && out.code === '23505' && /course_leads_channel_contact_key/.test(out.message || ''))) throw new Error('Não foi possível registrar agora. Seus dados foram mantidos; tente novamente em instantes.');
      status.dataset.state = 'success';
      status.textContent = 'Pronto! Seu contato está na lista. O cupom exclusivo e as condições serão enviados pelo canal escolhido no lançamento. Nenhuma cobrança foi feita.';
      form.reset(); contact.value = ''; drafts.email = ''; drafts.whatsapp = '';
      channel = 'email'; form.querySelector('[name=channel]:checked').dispatchEvent(new Event('change', { bubbles: true }));
      // Channel reset updates labels; restore confirmation afterwards.
      status.textContent = 'Pronto! Seu contato está na lista. O cupom exclusivo e as condições serão enviados pelo canal escolhido no lançamento. Nenhuma cobrança foi feita.';
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = error.name === 'AbortError' ? 'A confirmação demorou. Tente novamente; o mesmo contato não será duplicado.' : error.message;
    } finally { clearTimeout(timer); busy = false; button.disabled = false; controls.forEach(input => { input.disabled = false; }); form.removeAttribute('aria-busy'); }
  });
})();
