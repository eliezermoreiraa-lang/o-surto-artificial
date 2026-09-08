/* Explicit opt-in only. Card data is entered on Asaas, never on this site. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'Aguardando confirmação';
  const card=body=>`<section class="sd-card">${body}</section>`;
  const statuses={pending:'Aguardando contratação / pagamento',active:'Ativa',past_due:'Pagamento pendente ou assinatura pausada',cancelled:'Cancelada',expired:'Contratação expirada'};
  let busy=false;
  function choices(){return `<h1 class="sd-title">Apoio mensal no cartão</h1><p class="sd-lead">Escolha sua assinatura. A cobrança se repete a cada mês, com sua autorização, até você cancelar. Não é parcelamento.</p><div class="sd-grid cards">${window.SurtoClub.plans.filter(p=>p.tier!=='free').map(p=>card(`<img class="club-seal" src="${esc(p.seal)}" alt="Selo ${esc(p.label)}" width="72" height="72"><h3>${esc(p.label)}</h3><div class="sd-money">${money(p.amount)} / mês</div><p>${esc(p.text)}</p><p>Cada mensalidade confirmada gera um novo apoio e uma divulgação na fila de produção.</p><button class="sd-btn" data-monthly-tier="${esc(p.tier)}">ESCOLHER MENSAL →</button>`)).join('')}</div>`}
  function view(m,tier){
    if(m.subscription)return manage(m);
    const p=window.SurtoClub.plans.find(x=>x.tier===tier&&x.tier!=='free');
    if(!p)return choices();
    return `<h1 class="sd-title">Autorizar apoio mensal</h1><p class="sd-lead">Você já está conectado. Confira o valor e autorize antes de seguir para o Asaas.</p><div class="sd-grid two">${card(`<h3>${esc(p.label)}</h3><div class="sd-money">${money(p.amount)} / mês</div><p>${esc(p.text)}</p><ul class="sd-plan-list">${p.benefits.map(b=>`<li>${esc(b)}</li>`).join('')}</ul><p>Cada pagamento confirmado gera um novo apoio na fila. A data de divulgação depende da produção.</p>${m.currentSupport?'<p>Esta é uma nova assinatura. Seu apoio avulso permanece preservado e não será usado como desconto na mensalidade.</p>':''}<button class="sd-btn outline" data-monthly-tier="">ESCOLHER OUTRO PLANO</button>`)}${card(`<h3>RENOVAÇÃO AUTOMÁTICA</h3><p>Primeiro pagamento na contratação. Depois, <strong>${money(p.amount)} por mês</strong> no cartão cadastrado no Asaas.</p><p>Sem fidelidade. Cancele em <strong>Minha Assinatura</strong> para interromper as próximas cobranças. Apoios já pagos ficam no seu histórico.</p><form id="sd-monthly-form" class="sd-checkout-form"><label class="monthly-consent"><input id="sd-monthly-consent" type="checkbox" required><span>Autorizo a cobrança de <strong>${money(p.amount)} todos os meses</strong>, no cartão de crédito, até eu cancelar a assinatura. *</span></label><small class="sd-checkout-note">* Autorização obrigatória. Os dados do cartão serão informados apenas no ambiente seguro do Asaas.</small><div id="sd-monthly-message" class="sd-msg" role="alert"></div><button class="sd-btn" type="submit">ASSINAR ${money(p.amount)} / MÊS →</button></form>`)}</div>`;
  }
  function manage(m){
    const s=m.subscription||(m.subscriptions||[])[0];
    if(!s)return `<h1 class="sd-title">Minha Assinatura</h1>${card('<h3>VOCÊ NÃO POSSUI ASSINATURA ATIVA</h3><p>Seus apoios avulsos não se renovam automaticamente. Você pode optar por uma assinatura mensal no cartão.</p><button class="sd-btn" data-monthly-tier="">CONHECER APOIO MENSAL →</button>')}`;
    const ended=['cancelled','expired'].includes(s.status);
    return `<h1 class="sd-title">Minha Assinatura</h1>${card(`<h3>${esc(window.SurtoClub.plans.find(p=>p.tier===s.tier)?.label||s.tier)}</h3><div class="sd-money">${money(s.amount)} / mês</div><div class="sd-list"><div><span>Situação</span><b>${esc(statuses[s.status]||s.status)}</b></div><div><span>Início</span><b>${s.started_at?date(s.started_at):'Ainda não confirmado'}</b></div><div><span>Próxima cobrança</span><b>${ended?'Sem renovação':date(s.next_due_date)}</b></div></div><p>${ended?'As próximas cobranças foram interrompidas. Os apoios já pagos permanecem no histórico.':'A renovação é mensal no cartão. Os recursos de cada novo apoio são liberados somente após a confirmação do pagamento.'}</p><div class="sd-checkout-actions">${s.status==='pending'&&s.checkout_id&&s.checkout_state==='ACTIVE'?`<a class="sd-btn" href="https://asaas.com/checkoutSession/show?id=${encodeURIComponent(s.checkout_id)}">CONTINUAR NO ASAAS →</a>`:''}<button class="sd-btn secondary" data-monthly-refresh>ATUALIZAR SITUAÇÃO</button>${ended?'<button class="sd-btn" data-monthly-tier="">CONHECER APOIO MENSAL</button>':`<button class="sd-btn outline" data-monthly-cancel="${esc(s.id)}">CANCELAR RENOVAÇÃO</button>`}</div><div id="sd-monthly-message" class="sd-msg" role="status"></div>`)}`;
  }
  async function invoke(client,body){const {data,error}=await client.functions.invoke('asaas-monthly-support',{body});if(error||!data?.ok){let msg=data?.error;try{msg=msg||(await error?.context?.json())?.error}catch(_){}throw new Error(msg||'Não foi possível concluir. Consulte Minha Assinatura antes de tentar novamente.')}return data}
  function bind(root,{client,open,refresh,tier}){
    root.querySelectorAll('[data-monthly-tier]').forEach(b=>b.addEventListener('click',()=>{if(!busy)open(b.dataset.monthlyTier)}));
    root.querySelector('[data-monthly-refresh]')?.addEventListener('click',()=>refresh());
    root.querySelector('#sd-monthly-form')?.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||!root.querySelector('#sd-monthly-consent').checked)return;
      busy=true;const button=event.target.querySelector('button[type=submit]'),msg=root.querySelector('#sd-monthly-message');button.disabled=true;button.textContent='ABRINDO ASSINATURA SEGURA…';msg.textContent='';
      try{const out=await invoke(client(),{action:'create',tier,method:'cartao',consent:true,consentVersion:'monthly-card-2026-09-08'});const url=new URL(out.invoiceUrl);if(url.protocol!=='https:'||url.hostname!=='asaas.com')throw new Error('Endereço de pagamento inválido.');window.location.assign(url.href)}
      catch(error){msg.textContent=error.message;button.disabled=false;button.textContent='TENTAR NOVAMENTE';}finally{busy=false}
    });
    root.querySelector('[data-monthly-cancel]')?.addEventListener('click',async event=>{
      if(busy)return;
      if(!window.confirm('Cancelar a renovação mensal? As próximas cobranças serão interrompidas. Apoios já pagos permanecem no histórico.'))return;
      busy=true;event.target.disabled=true;const msg=root.querySelector('#sd-monthly-message');msg.textContent='Cancelando no Asaas…';
      try{await invoke(client(),{action:'cancel',subscriptionId:event.target.dataset.monthlyCancel});await refresh()}
      catch(error){msg.textContent=error.message;event.target.disabled=false}finally{busy=false}
    });
  }
  const style=document.createElement('style');style.textContent='.monthly-consent{display:flex;align-items:flex-start;gap:12px;padding:16px;border:1px solid #32414b;border-radius:10px;font-size:14px;line-height:1.6}.monthly-consent input{flex:0 0 20px;width:20px;height:20px;margin-top:3px;accent-color:#00d9ef}.club-monthly-options{display:grid;gap:12px}.club-monthly-options .club-button{width:100%;white-space:normal;text-align:center}.sd-card .sd-checkout-actions{margin-top:20px}';document.head.appendChild(style);
  window.SurtoMonthly=Object.freeze({view,manage,bind});
})();
