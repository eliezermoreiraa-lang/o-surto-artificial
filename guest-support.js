/* Guest donation only. Member tiers continue through the existing authenticated checkout. */
(() => {
 'use strict';
 const endpoint='https://ndfchglutpnbckpcrppy.supabase.co/functions/v1/asaas-guest-support';
 const key='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
 const storageKey='surto-guest-payment';
 let token=null,busy=false;
 const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeInvoice=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='asaas.com'||u.hostname.endsWith('.asaas.com'))?u.href:null}catch(_){return null}};
 async function invoke(body){
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
  const data=await response.json();if(!response.ok){const error=new Error(data.error||'Não foi possível iniciar o pagamento.');error.status=response.status;throw error}return data;
 }
 function remember(value){token=value;try{if(value)sessionStorage.setItem(storageKey,value);else sessionStorage.removeItem(storageKey)}catch(_){}}
 function requireAccount(label){
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');dialog.className='guest-account-dialog';
   dialog.innerHTML='<div class="club-eyebrow">APOIO COM DIVULGAÇÃO</div><h2>UMA CONTA PARA ACOMPANHAR SEU APOIO</h2><p>Para '+esc(label)+', é necessário criar uma conta ou entrar na sua conta existente. Assim podemos enviar suas notificações corretamente e você acompanha seu avatar e sua divulgação.</p><p>Você pode continuar com Google ou usar e-mail e senha, como no botão Entrar.</p><div class="guest-dialog-actions"><button class="club-button" id="guest-account-continue">ENTRAR OU CRIAR CONTA →</button><button class="club-button guest-secondary" id="guest-account-back">VOLTAR</button></div>';
   document.body.appendChild(dialog);const done=value=>{dialog.close();dialog.remove();resolve(value)};
   dialog.querySelector('#guest-account-continue').onclick=()=>done(true);
   dialog.querySelector('#guest-account-back').onclick=()=>done(false);
   dialog.addEventListener('cancel',event=>{event.preventDefault();done(false)});
   dialog.showModal();
  });
 }
 function openGuest(onAccount){
  const root=document.querySelector('#guest-club-checkout');if(!root)return;
  root.hidden=false;
  root.innerHTML='<div class="club-eyebrow">APOIO LIVRE · CONTA OPCIONAL</div><h2>APOIE SEM PRECISAR SE CADASTRAR</h2><p>Você pode concluir seu Apoio Livre aqui, sem login e sem criar conta. Este apoio ajuda a produção e não inclui divulgação, avatar ou aparição.</p><div class="guest-layout"><div><img class="club-seal" src="/assets-min/seal-free.svg" alt="Selo Apoio Livre"><h3>SEU CARINHO VIRA PRODUÇÃO.</h3><p>Nome e CPF são usados para processar o pagamento pelo Asaas. Isso não cria uma conta no site e seus dados não aparecem no mural público.</p><button class="club-button guest-secondary" id="guest-account-optional">PREFIRO ENTRAR OU CRIAR CONTA (OPCIONAL)</button></div><div id="guest-payment-content"><form id="guest-support-form"><small>* Campos obrigatórios</small><label for="guest-name">Nome completo *</label><input id="guest-name" autocomplete="name" required minlength="3" maxlength="120"><label for="guest-cpf">CPF *</label><input id="guest-cpf" autocomplete="off" inputmode="numeric" maxlength="14" required placeholder="000.000.000-00"><label for="guest-email">E-mail para o pagamento (opcional)</label><input id="guest-email" type="email" autocomplete="email" maxlength="254" placeholder="voce@email.com"><label for="guest-amount">Valor do apoio *</label><div class="club-money"><span aria-hidden="true">R$</span><input id="guest-amount" inputmode="numeric" type="text" value="10,00" required aria-describedby="guest-money-help"></div><small id="guest-money-help">A vírgula é automática: digite 1025 para R$ 10,25. De R$ 1,00 a R$ 10.000,00.</small><fieldset><legend>Forma de pagamento</legend><label><input type="radio" name="guest-method" value="pix" checked> PIX</label><label><input type="radio" name="guest-method" value="cartao"> CARTÃO DE CRÉDITO</label></fieldset><p id="guest-method-note">O QR Code aparece aqui para você pagar no seu banco.</p><p id="guest-error" role="alert"></p><button class="club-button" id="guest-submit" type="submit">GERAR PIX SEM CRIAR CONTA →</button><p class="guest-privacy">Ao continuar, seus dados de pagamento serão enviados ao Asaas. Nenhum dado de cartão é digitado ou armazenado neste site.</p></form></div></div>';
  root.querySelector('#guest-account-optional').onclick=()=>{if(!busy)onAccount()};
  const form=root.querySelector('form'),button=root.querySelector('#guest-submit'),msg=root.querySelector('#guest-error');
  window.SurtoClub.bindMoney(root.querySelector('#guest-amount'));
  form.addEventListener('change',()=>{const card=form.elements['guest-method'].value==='cartao';button.textContent=card?'PAGAR COM CARTÃO SEM CRIAR CONTA →':'GERAR PIX SEM CRIAR CONTA →';root.querySelector('#guest-method-note').textContent=card?'Você informará os dados do cartão somente no ambiente seguro do Asaas.':'O QR Code aparece aqui para você pagar no seu banco.'});
  const resultView=data=>{
   root.querySelector('#guest-account-optional').hidden=true;
   const content=root.querySelector('#guest-payment-content');if(!content)return;
   const invoice=safeInvoice(data.invoiceUrl),paid=data.paymentStatus==='paid';
   content.innerHTML='<h3>'+(paid?'APOIO CONFIRMADO. MUITO OBRIGADO!':'ACOMPANHE SEU APOIO LIVRE')+'</h3><p>'+(paid?'Seu carinho já está ajudando as próximas produções. Nenhuma conta foi criada.':data.state==='failed'?'Não foi possível concluir a solicitação. Se já pagou, não pague novamente; fale com a equipe.':'O pagamento ainda não foi confirmado. Você não precisa criar conta para concluí-lo.')+'</p>'+(data.amount?'<div class="club-price">R$ '+window.SurtoClub.format(data.amount)+'</div>':'')+(!paid&&data.pix?'<img class="guest-qr" src="data:image/png;base64,'+esc(data.pix.encodedImage)+'" alt="QR Code Pix"><button class="club-button guest-secondary" id="guest-copy">COPIAR PIX</button>':'')+(!paid&&invoice?'<a class="club-button guest-secondary" href="'+esc(invoice)+'" rel="noopener">ABRIR PAGAMENTO SEGURO NO ASAAS →</a>':'')+'<button class="club-button" id="guest-check">VERIFICAR PAGAMENTO</button><p id="guest-status" role="status"></p><a href="mailto:osurtoartificial@gmail.com">Falar com a equipe</a>';
   content.querySelector('#guest-copy')?.addEventListener('click',async event=>{try{await navigator.clipboard.writeText(data.pix.payload);event.target.textContent='PIX COPIADO ✓'}catch(_){content.querySelector('#guest-status').textContent='Não foi possível copiar. Use o QR Code ou abra o pagamento no Asaas.'}});
   content.querySelector('#guest-check').onclick=async event=>{event.target.disabled=true;try{resultView(await invoke({action:'status',requestToken:token}))}catch(error){content.querySelector('#guest-status').textContent=error.message;event.target.disabled=false}};
   if(paid){const check=content.querySelector('#guest-check');check.textContent='FAZER OUTRO APOIO LIVRE';check.onclick=()=>{remember(null);openGuest(onAccount)}}
  };
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   const amount=window.SurtoClub.parse(root.querySelector('#guest-amount').value);
   if(amount<1||amount>10000){msg.textContent='Informe um valor entre R$ 1,00 e R$ 10.000,00.';return}
   const body={action:'create',tier:'free',amount,method:form.elements['guest-method'].value,fullName:root.querySelector('#guest-name').value.trim(),cpfCnpj:root.querySelector('#guest-cpf').value.replace(/\D/g,''),email:root.querySelector('#guest-email').value.trim()};
   if(body.cpfCnpj.length!==11){msg.textContent='Confira seu CPF.';return}
   if(!token)remember(Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join(''));
   busy=true;button.disabled=true;button.textContent='PREPARANDO PAGAMENTO…';msg.textContent='';
   try{const data=await invoke({...body,requestToken:token});resultView(data);if(body.method==='cartao'&&data.state==='ready'&&safeInvoice(data.invoiceUrl))location.assign(data.invoiceUrl)}
   catch(error){msg.textContent=error.message;if([400,403,429].includes(error.status)){remember(null);button.disabled=false;button.textContent='CONFERIR DADOS E TENTAR NOVAMENTE'}else{resultView({state:'processing'});root.querySelector('#guest-status').textContent=error.message}}
   finally{busy=false}
  };
  try{token=token||sessionStorage.getItem(storageKey)}catch(_){}
  if(token){button.disabled=true;invoke({action:'status',requestToken:token}).then(resultView).catch(error=>{if(error.status===404||error.status===410){remember(null);button.disabled=false}else{msg.textContent=error.message;button.disabled=false}})}
  root.scrollIntoView({behavior:'instant',block:'start'});
 }
 window.SurtoGuest={open:openGuest,requireAccount};
})();
