(() => {
  'use strict';
  const SB_URL = 'https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'surto-auth' } });
  const $ = (q, root = document) => root.querySelector(q);
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = v => Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const date = v => v ? new Date(v).toLocaleDateString('pt-BR', { timeZone:'America/Sao_Paulo' }) : '—';
  const dateTime = v => v ? new Date(v).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo' }) : '—';
  const labels = { free:'Apoio livre',supporter:'Apoiador',highlight:'Destaque',vip:'VIP',one_time:'Avulso',monthly:'Mensal',paid:'Pago',pending:'Pendente',checkout_created:'Aguardando pagamento',failed:'Falhou',refunded:'Estornado',cancelled:'Cancelado',waiting_profile:'Aguardando perfil',waiting_avatar:'Aguardando avatar',queued:'Na fila',estimated:'Programado',confirmed:'Confirmado',in_production:'Em produção',published:'Publicado',reprogrammed:'Reprogramado',ready:'Pronto',awaiting:'Aguardando',sent:'Enviado',sending:'Enviando'};
  const titleByView = {overview:'Visão geral',supporters:'Apoiadores',payments:'Pagamentos',queue:'Fila e avatares',episodes:'Episódios',emails:'E-mails'};
  let currentView = 'overview';
  let data = null;
  let session = null;
  let search = '';
  let paymentFilter = 'all';

  function toast(message, type = '') {
    const el = $('#toast'); el.textContent = message; el.className = `toast show ${type}`;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.className = 'toast', 3500);
  }
  function show(name) {
    $('#loginView').classList.toggle('hidden', name !== 'login');
    $('#loadingView').classList.toggle('hidden', name !== 'loading');
    $('#appView').classList.toggle('hidden', name !== 'app');
  }
  async function invoke(action, payload = {}) {
    const { data: out, error } = await sb.functions.invoke('admin-production', { body: { action, ...payload } });
    if (error) {
      let message = error.message || 'Não foi possível concluir a ação';
      try { const body = await error.context?.json(); if (body?.error) message = body.error; } catch (_) {}
      throw new Error(message);
    }
    if (!out?.ok) throw new Error(out?.error || 'Não foi possível concluir a ação');
    return out;
  }
  async function load() {
    show('loading');
    try {
      data = await invoke('dashboard');
      $('#adminEmail').textContent = session?.user?.email || '';
      show('app'); render();
    } catch (err) {
      console.error(err); await sb.auth.signOut(); show('login'); toast(err.message === 'Acesso exclusivo da produção' ? 'Esta conta não tem acesso ao painel da produção.' : err.message, 'error');
    }
  }
  function maps() {
    return {
      users: Object.fromEntries((data.users || []).map(x => [x.id, x])),
      profiles: Object.fromEntries((data.profiles || []).map(x => [x.id, x])),
      publicity: Object.fromEntries((data.publicity || []).map(x => [x.user_id, x])),
      appearances: Object.fromEntries((data.appearances || []).map(x => [x.support_id, x])),
    };
  }
  function person(s, m) {
    const u = m.users[s.user_id] || {}, p = m.publicity[s.user_id] || {}, profile = m.profiles[s.user_id] || {};
    const name = p.display_name || profile.display_name || u.email?.split('@')[0] || 'Apoiador';
    return { name, email:p.notification_email || u.email || 'Sem e-mail', initial:name.slice(0,1).toUpperCase() };
  }
  const badge = value => `<span class="badge ${e(value)}">${e(labels[value] || value || '—')}</span>`;
  const manageButton = s => s.user_id ? `<button class="btn secondary small" data-manage="${e(s.user_id)}" data-support="${e(s.id)}">GERENCIAR</button>` : '';
  function stats() {
    const paid = data.supports.filter(s => s.payment_status === 'paid');
    const total = paid.reduce((sum,s) => sum + Number(s.amount || 0), 0);
    const pending = data.supports.filter(s => ['pending','checkout_created'].includes(s.payment_status)).length;
    const queue = data.appearances.filter(a => !['published','cancelled'].includes(a.status)).length;
    const avatar = data.publicity.filter(p => p.submission_completed_at && p.avatar_status !== 'ready').length;
    return { paid,total,pending,queue,avatar };
  }
  function statCards(s) { return `<div class="stats"><div class="stat green"><strong>${money(s.total)}</strong><span>Total arrecadado e confirmado</span></div><div class="stat cyan"><strong>${s.paid.length}</strong><span>Apoios pagos</span></div><div class="stat red"><strong>${s.pending}</strong><span>Pagamentos pendentes</span></div><div class="stat"><strong>${s.queue}</strong><span>Apoiadores na fila</span></div></div>`; }
  function overview() {
    const s = stats(), m = maps();
    const queue = data.appearances.filter(a => !['published','cancelled'].includes(a.status)).slice(0,6);
    const emails = data.emails.slice(0,6);
    return `${statCards(s)}<div class="grid-2"><div class="panel panel-pad"><div class="section-head"><div><h2>Próximos da fila</h2><p>Ordem real da produção</p></div><div class="actions"><button class="btn secondary small" data-go="queue">VER TODA A FILA</button></div></div><div class="queue-list">${queue.length ? queue.map((a,i) => { const support=data.supports.find(s=>s.id===a.support_id)||{}; const p=person(support,m); return `<div class="queue-card"><div class="queue-num">${i+1}</div><div><strong>${e(p.name)}</strong><p>${e(labels[support.tier]||support.tier)} · ${e(labels[a.status]||a.status)}</p></div>${manageButton(support)}</div>`; }).join('') : '<div class="empty">Nenhum apoiador aguardando produção.</div>'}</div></div><div class="panel panel-pad"><div class="section-head"><div><h2>Lembrete automático</h2><p>Renovação depois do período definido</p></div></div><div class="toggle-row"><button id="reminderToggle" class="switch ${data.reminders?.enabled ? 'on':''}" aria-label="Ativar lembretes"></button><div><strong>${data.reminders?.enabled ? 'Ativado':'Desativado'}</strong><div style="color:var(--muted);font-size:11px;margin-top:4px">Envia após ${Number(data.reminders?.days||30)} dias sem novo apoio.</div></div></div><div class="section-head" style="margin-top:26px"><div><h2>Últimos e-mails</h2></div></div><div class="activity">${emails.length ? emails.map(x=>`<div class="activity-item"><i></i><div><strong>${e(x.subject)}</strong><small>${e(x.recipient_email)} · ${dateTime(x.sent_at||x.created_at)} · ${e(labels[x.status]||x.status)}</small></div></div>`).join(''):'<div class="empty">Nenhum e-mail registrado ainda.</div>'}</div></div></div>`;
  }
  function tableRows(items, mode) {
    const m = maps();
    return items.map(s => { const p=person(s,m), a=m.appearances[s.id], profile=m.publicity[s.user_id]||{}; return `<tr><td><div class="person"><div class="avatar">${e(p.initial)}</div><div><strong>${e(p.name)}</strong><small>${e(p.email)}</small></div></div></td><td>${badge(s.tier)}</td><td>${mode==='payments' ? badge(s.payment_status) : badge(a?.status || (s.payment_status==='paid'?'waiting_profile':s.payment_status))}</td><td>${money(s.amount)}</td><td>${mode==='supporters' ? badge(profile.avatar_status||'awaiting') : e(labels[s.billing_mode]||s.billing_mode)}</td><td>${date(s.paid_at||s.created_at)}</td><td>${manageButton(s)}</td></tr>`; }).join('');
  }
  function listView(mode) {
    const isPayments = mode === 'payments';
    let items = data.supports.filter(s => { const m=maps(), p=person(s,m), hay=`${p.name} ${p.email} ${s.tier}`.toLowerCase(); return (!search || hay.includes(search.toLowerCase())) && (paymentFilter==='all'||s.payment_status===paymentFilter); });
    if (!isPayments) items = items.filter(s => s.payment_status === 'paid');
    return `<div class="section-head"><div><h2>${isPayments?'Todos os pagamentos':'Apoiadores confirmados'}</h2><p>${items.length} registro(s) encontrado(s)</p></div></div><div class="toolbar"><input id="search" value="${e(search)}" placeholder="Buscar por nome ou e-mail">${isPayments?`<select id="paymentFilter"><option value="all">Todos os status</option><option value="paid">Pagos</option><option value="pending">Pendentes</option><option value="checkout_created">Aguardando pagamento</option><option value="failed">Falharam</option><option value="cancelled">Cancelados</option></select>`:''}</div><div class="panel table-wrap"><table class="table"><thead><tr><th>APOIADOR</th><th>PLANO</th><th>STATUS</th><th>VALOR</th><th>${isPayments?'TIPO':'AVATAR'}</th><th>DATA</th><th></th></tr></thead><tbody>${items.length?tableRows(items,mode):'<tr><td colspan="7" class="empty">Nenhum registro encontrado.</td></tr>'}</tbody></table></div>`;
  }
  function queueView() {
    const m=maps(); const items=data.supports.filter(s=>s.payment_status==='paid'&&['supporter','highlight','vip'].includes(s.tier)).sort((a,b)=>(m.appearances[b.id]?.queue_priority||0)-(m.appearances[a.id]?.queue_priority||0));
    return `<div class="section-head"><div><h2>Fila de produção</h2><p>Avatar, programação e publicação de cada apoiador</p></div></div><div class="panel table-wrap"><table class="table"><thead><tr><th>APOIADOR</th><th>PLANO</th><th>PERFIL</th><th>AVATAR</th><th>APARIÇÃO</th><th>EPISÓDIO</th><th></th></tr></thead><tbody>${items.length?items.map(s=>{const p=person(s,m),profile=m.publicity[s.user_id]||{},a=m.appearances[s.id]||{};return `<tr><td><div class="person"><div class="avatar">${e(p.initial)}</div><div><strong>${e(p.name)}</strong><small>${e(p.email)}</small></div></div></td><td>${badge(s.tier)}</td><td>${profile.submission_completed_at?badge('ready'):badge('awaiting')}</td><td>${badge(profile.avatar_status||'awaiting')}</td><td>${badge(a.status||'waiting_profile')}</td><td>${e(a.estimated_episode_number||a.episodes?.episode_number||'—')}</td><td>${manageButton(s)}</td></tr>`}).join(''):'<tr><td colspan="7" class="empty">A fila está vazia.</td></tr>'}</tbody></table></div>`;
  }
  function episodeView() {
    return `<div class="section-head"><div><h2>Episódios</h2><p>Episódios criados ao programar as aparições</p></div></div><div class="panel table-wrap"><table class="table"><thead><tr><th>PRODUÇÃO</th><th>EPISÓDIO</th><th>DATA PREVISTA</th><th>PUBLICAÇÃO</th><th>LINKS</th></tr></thead><tbody>${data.episodes.length?data.episodes.map(x=>`<tr><td>${e(x.productions?.title||'Produção')}</td><td><strong>EP ${e(x.episode_number)}</strong></td><td>${date(x.scheduled_date)}</td><td>${x.published_at?badge('published'):badge('pending')}</td><td>${[x.instagram_url,x.tiktok_url,x.youtube_url].filter(Boolean).map((u,i)=>`<a href="${e(u)}" target="_blank" rel="noopener" style="color:var(--cyan)">link ${i+1}</a>`).join(' · ')||'—'}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Nenhum episódio cadastrado ainda. Ele será criado quando você programar uma aparição.</td></tr>'}</tbody></table></div>`;
  }
  function emailsView() {
    return `<div class="section-head"><div><h2>Histórico de e-mails</h2><p>Agradecimentos, pedidos de informação e lembretes</p></div></div><div class="panel table-wrap"><table class="table"><thead><tr><th>DESTINATÁRIO</th><th>ASSUNTO</th><th>TIPO</th><th>STATUS</th><th>TENTATIVAS</th><th>DATA</th></tr></thead><tbody>${data.emails.length?data.emails.map(x=>`<tr><td>${e(x.recipient_email)}</td><td>${e(x.subject)}</td><td>${e(labels[x.event_type]||x.event_type)}</td><td>${badge(x.status)}</td><td>${e(x.attempts)}</td><td>${dateTime(x.sent_at||x.created_at)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhum e-mail registrado.</td></tr>'}</tbody></table></div>`;
  }
  function render() {
    $('#pageTitle').textContent = titleByView[currentView];
    document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
    const content = currentView==='overview'?overview():currentView==='supporters'?listView('supporters'):currentView==='payments'?listView('payments'):currentView==='queue'?queueView():currentView==='episodes'?episodeView():emailsView();
    $('#content').innerHTML = content; bindContent();
  }
  function bindContent() {
    document.querySelectorAll('[data-manage]').forEach(b=>b.addEventListener('click',()=>openSupporter(b.dataset.manage,b.dataset.support)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{currentView=b.dataset.go;render()}));
    $('#search')?.addEventListener('input',ev=>{search=ev.target.value;render()});
    if ($('#paymentFilter')) { $('#paymentFilter').value=paymentFilter; $('#paymentFilter').addEventListener('change',ev=>{paymentFilter=ev.target.value;render()}); }
    $('#reminderToggle')?.addEventListener('click', async ev=>{const btn=ev.currentTarget;btn.disabled=true;try{const enabled=!data.reminders.enabled;const out=await invoke('set_reminders',{enabled,days:Number(data.reminders.days||30)});data.reminders=out.reminders;toast(enabled?'Lembretes automáticos ativados.':'Lembretes automáticos desativados.','success');render()}catch(err){toast(err.message,'error')}finally{btn.disabled=false}});
  }
  async function openSupporter(userId, supportId) {
    $('#modal').classList.remove('hidden'); $('#modalContent').innerHTML='<div class="loading-view" style="min-height:320px"><div class="spinner"></div><p>Carregando apoiador…</p></div>';
    try {
      const d=await invoke('supporter_detail',{user_id:userId}); const support=d.supports.find(x=>x.id===supportId)||d.supports[0]||{}; const p=d.publicity||{}; const a=d.appearances.find(x=>x.support_id===support.id)||{}; const name=p.display_name||d.profile?.display_name||d.user.email?.split('@')[0]||'Apoiador';
      $('#modalContent').innerHTML=`<span class="eyebrow">GERENCIAR APOIADOR</span><h2>${e(name)}</h2><p class="modal-sub">${e(d.user.email||'')} · ${e(labels[support.tier]||support.tier||'Sem apoio')}</p><div class="detail-grid"><section class="detail-section"><h3>PAGAMENTO E PERFIL</h3><div class="kv"><span>Status</span><strong>${badge(support.payment_status)}</strong></div><div class="kv"><span>Valor</span><strong>${money(support.amount)}</strong></div><div class="kv"><span>Perfil enviado</span><strong>${p.submission_completed_at?'Sim':'Não'}</strong></div><div class="kv"><span>Rede social</span><strong>${e(p.social_handle||'—')}</strong></div><div class="email-actions" style="margin-top:16px"><button class="btn secondary small" data-email="thank_you">AGRADECER</button><button class="btn secondary small" data-email="info_request">PEDIR INFORMAÇÕES</button><button class="btn secondary small" data-email="renewal_reminder">LEMBRAR NOVO APOIO</button></div></section><section class="detail-section"><h3>IMAGENS E AVATAR</h3><div class="photo-actions"><a class="btn secondary small" style="display:grid;place-items:center;text-decoration:none" href="${e(d.signed.face||'#')}" ${d.signed.face?'target="_blank"':'aria-disabled="true"'}>BAIXAR ROSTO</a><a class="btn secondary small" style="display:grid;place-items:center;text-decoration:none" href="${e(d.signed.body||'#')}" ${d.signed.body?'target="_blank"':'aria-disabled="true"'}>BAIXAR CORPO</a></div><label style="margin-top:18px">Subir avatar oficial<input id="avatarFile" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="uploadAvatar" class="btn primary small" style="margin-top:10px">ENVIAR AVATAR PRONTO</button>${p.official_avatar_path?`<p style="font-size:11px;color:var(--green)">✓ Avatar já disponível na Área do Apoiador</p>`:''}</section><section class="detail-section full"><h3>PROGRAMAÇÃO DA APARIÇÃO</h3><div class="form-grid"><label>Status<select id="appearanceStatus">${['waiting_profile','waiting_avatar','queued','estimated','confirmed','in_production','published','reprogrammed','cancelled'].map(x=>`<option value="${x}" ${a.status===x?'selected':''}>${e(labels[x]||x)}</option>`).join('')}</select></label><label>Número do episódio<input id="episodeNumber" type="number" min="1" value="${e(a.estimated_episode_number||a.episodes?.episode_number||'')}"></label><label>Data prevista<input id="estimatedDate" type="date" value="${e(a.estimated_date||a.episodes?.scheduled_date||'')}"></label><label>Link para assistir<input id="publishedUrl" type="url" value="${e(a.published_url||'')}" placeholder="https://instagram.com/..."></label><label class="full">Anotações internas<textarea id="adminNotes" placeholder="Informações visíveis somente para a produção">${e(a.admin_notes||'')}</textarea></label></div><button id="saveAppearance" class="btn primary" style="margin-top:14px">SALVAR ATUALIZAÇÃO</button><p style="font-size:11px;color:var(--muted)">Quando o status for “Publicado”, a aparição recebe o check e o episódio aparece automaticamente na Área do Apoiador.</p></section></div>`;
      document.querySelectorAll('[data-email]').forEach(b=>b.addEventListener('click',()=>sendEmail(b,userId,support.id,b.dataset.email)));
      $('#uploadAvatar').addEventListener('click',()=>uploadAvatar(userId));
      $('#saveAppearance').addEventListener('click',()=>saveAppearance(support.id));
    } catch(err){$('#modalContent').innerHTML=`<div class="empty">${e(err.message)}</div>`}
  }
  async function uploadAvatar(userId) {
    const file=$('#avatarFile').files[0]; if(!file)return toast('Escolha a imagem do avatar primeiro.','error'); const btn=$('#uploadAvatar');btn.disabled=true;
    try{const ext=(file.name.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${userId}/avatar-${Date.now()}.${ext}`;const {error}=await sb.storage.from('supporter-avatars').upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;await invoke('register_avatar',{user_id:userId,path});toast('Avatar publicado na Área do Apoiador.','success');await refreshAndClose()}catch(err){toast(err.message,'error')}finally{btn.disabled=false}
  }
  async function saveAppearance(supportId) {
    const btn=$('#saveAppearance');btn.disabled=true;try{await invoke('save_appearance',{support_id:supportId,status:$('#appearanceStatus').value,episode_number:$('#episodeNumber').value,estimated_date:$('#estimatedDate').value||null,published_url:$('#publishedUrl').value,admin_notes:$('#adminNotes').value});toast('Jornada do apoiador atualizada.','success');await refreshAndClose()}catch(err){toast(err.message,'error')}finally{btn.disabled=false}
  }
  async function sendEmail(btn,userId,supportId,type) {btn.disabled=true;try{await invoke('send_email',{user_id:userId,support_id:supportId,event_type:type});toast('E-mail enviado com sucesso.','success');data=await invoke('dashboard');render()}catch(err){toast(err.message,'error')}finally{btn.disabled=false}}
  async function refreshAndClose(){data=await invoke('dashboard');$('#modal').classList.add('hidden');render()}

  $('#loginForm').addEventListener('submit',async ev=>{ev.preventDefault();const btn=ev.submitter;btn.disabled=true;try{const {error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});if(error)throw error}catch(err){toast('Não foi possível entrar. Confira o e-mail e a senha.','error')}finally{btn.disabled=false}});
  $('#googleLogin').addEventListener('click',async()=>{const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${location.origin}/admin`}});if(error)toast(error.message,'error')});
  $('#resetPassword').addEventListener('click',async()=>{const email=$('#loginEmail').value.trim();if(!email)return toast('Digite seu e-mail primeiro.','error');const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/admin`});toast(error?error.message:'Enviamos o link para criar ou recuperar sua senha.',error?'error':'success')});
  $('#logout').addEventListener('click',()=>sb.auth.signOut()); $('#closeModal').addEventListener('click',()=>$('#modal').classList.add('hidden')); $('#modal').addEventListener('click',ev=>{if(ev.target.id==='modal')ev.currentTarget.classList.add('hidden')});
  $('#nav').addEventListener('click',ev=>{const b=ev.target.closest('[data-view]');if(!b)return;currentView=b.dataset.view;$('#nav').closest('.sidebar').classList.remove('open');render()}); $('#mobileMenu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
  sb.auth.onAuthStateChange((event,newSession)=>{session=newSession;if(event==='PASSWORD_RECOVERY'){const password=prompt('Crie uma nova senha com pelo menos 8 caracteres:');if(password&&password.length>=8)sb.auth.updateUser({password}).then(({error})=>toast(error?error.message:'Senha criada com sucesso.',error?'error':'success'));return} if(newSession)load();else show('login')});
  sb.auth.getSession().then(({data:{session:s}})=>{session=s;if(s)load();else show('login')});
})();
