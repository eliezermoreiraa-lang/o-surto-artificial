(() => {
  'use strict';
  const SB_URL = 'https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'surto-auth' } });
  const $ = (q, root = document) => root.querySelector(q);
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = v => Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const date = v => { if(!v)return '—';const raw=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const [y,m,d]=raw.split('-');return `${d}/${m}/${y}`}return new Date(v).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}) };
  const dateTime = v => v ? new Date(v).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo' }) : '—';
  const labels = { free:'Apoio livre',supporter:'Apoiador',highlight:'Destaque',vip:'VIP',one_time:'Avulso',monthly:'Mensal',paid:'Pago',pending:'Pendente',checkout_created:'Aguardando pagamento',failed:'Falhou',refunded:'Estornado',cancelled:'Cancelado',waiting_profile:'Aguardando perfil',waiting_avatar:'Aguardando avatar',queued:'Na fila',estimated:'Programado',confirmed:'Confirmado',in_production:'Em produção',published:'Publicado',reprogrammed:'Reprogramado',ready:'Pronto',awaiting:'Aguardando',sent:'Enviado',sending:'Enviando',submitted:'Enviado',in_review:'Em análise',approved:'Aprovado',change_requested:'Ajuste solicitado'};
  const titleByView = {overview:'Visão geral',supporters:'Apoiadores',payments:'Pagamentos',queue:'Fila e avatares',episodes:'Episódios',emails:'E-mails'};
  let currentView = 'overview';
  let data = null;
  let session = null;
  let search = '';
  let paymentFilter = 'all';
  let loadPromise = null;
  let episodeDraft = null;

  const vipStyle=document.createElement('style');
  vipStyle.id='admin-vip-briefing-css';
  vipStyle.textContent='.briefing-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.briefing-head h3{margin-bottom:4px}.briefing-head small{color:var(--muted);font-size:10px}.briefing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.briefing-item{padding:14px;border:1px solid #252a35;border-radius:9px;background:#090c12}.briefing-item span{display:block;margin-bottom:7px;color:var(--cyan);font-size:9px;letter-spacing:.1em;text-transform:uppercase}.briefing-item div{white-space:pre-wrap;color:#d9dce3;font-size:12px;line-height:1.6}.briefing-confirm{margin:13px 0 0;color:var(--green);font-size:10.5px}.briefing-empty{padding:18px;border-radius:9px;background:#090c12;color:var(--muted);font-size:12px}.briefing-images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.briefing-image{display:grid;gap:8px;padding:9px;border:1px solid #252a35;border-radius:9px;background:#090c12}.briefing-image img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;background:#05070a}.briefing-image a{text-decoration:none;text-align:center}@media(max-width:760px){.briefing-grid{grid-template-columns:1fr}.briefing-images{grid-template-columns:1fr 1fr}}';
  document.head.appendChild(vipStyle);

  function toast(message, type = '') {
    const el = $('#toast'); el.textContent = message; el.className = `toast show ${type}`;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.className = 'toast', 3500);
  }
  function show(name) {
    $('#loginView').classList.toggle('hidden', name !== 'login');
    $('#loadingView').classList.toggle('hidden', name !== 'loading');
    $('#appView').classList.toggle('hidden', name !== 'app');
  }
  async function invoke(action, payload = {}, attempt = 0) {
    const { data: out, error } = await sb.functions.invoke('admin-production', { body: { action, ...payload } });
    if (error) {
      let message = error.message || 'Não foi possível concluir a ação';
      try { const body = await error.context?.json(); if (body?.error) message = body.error; } catch (_) {}
      if (attempt < 2 && /Failed to send|fetch|network/i.test(message)) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        return invoke(action, payload, attempt + 1);
      }
      throw new Error(message);
    }
    if (!out?.ok) throw new Error(out?.error || 'Não foi possível concluir a ação');
    return out;
  }
  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      show('loading');
      try {
        data = await invoke('dashboard');
        $('#adminEmail').textContent = session?.user?.email || '';
        show('app'); render();
      } catch (err) {
        console.error(err);
        if (/Acesso exclusivo/.test(err.message)) await sb.auth.signOut();
        show('login'); toast(/Acesso exclusivo/.test(err.message) ? 'Esta conta não tem acesso ao painel da produção.' : err.message, 'error');
      }
    })();
    try { await loadPromise; } finally { loadPromise = null; }
  }
  function maps() {
    return {
      users: Object.fromEntries((data.users || []).map(x => [x.id, x])),
      profiles: Object.fromEntries((data.profiles || []).map(x => [x.id, x])),
      publicity: Object.fromEntries((data.publicity || []).map(x => [x.user_id, x])),
      vipBriefings: Object.fromEntries((data.vipBriefings || []).map(x => [x.support_id, x])),
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
  function vipBriefingSection(support, briefing, references=[]) {
    if(support.tier!=='vip')return '';
    if(!briefing?.id)return `<section class="detail-section full"><h3>BRIEFING VIP DA CENA</h3><div class="briefing-empty">O apoiador VIP ainda não enviou o briefing da cena personalizada.</div></section>`;
    const item=(title,value)=>`<div class="briefing-item"><span>${e(title)}</span><div>${e(value||'Não informado')}</div></div>`;
    const images=references.length?`<div class="briefing-images">${references.map((image,index)=>`<div class="briefing-image"><img src="${e(image.url)}" alt="Referência VIP ${index+1}"><a class="btn secondary small" href="${e(image.downloadUrl||image.url)}" target="_blank" rel="noopener">BAIXAR IMAGEM ${index+1}</a></div>`).join('')}</div>`:'<div class="briefing-empty" style="margin-top:12px">O apoiador não enviou imagens de referência.</div>';
    return `<section class="detail-section full"><div class="briefing-head"><div><h3>BRIEFING VIP DA CENA</h3><small>Enviado em ${dateTime(briefing.submitted_at||briefing.updated_at)}</small></div>${badge(briefing.status||'submitted')}</div><div class="briefing-grid">${item('O que deseja divulgar',briefing.promotion_goal)}${item('Como imagina a cena',briefing.scene_idea)}</div><h3 style="margin-top:18px">IMAGENS DE REFERÊNCIA</h3>${images}<p class="briefing-confirm">✓ O apoiador confirmou que entendeu o formato promocional ao final do episódio.</p></section>`;
  }
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
    return `<div class="section-head"><div><h2>Fila de produção</h2><p>Avatar, briefing VIP, programação e publicação de cada apoiador</p></div></div><div class="panel table-wrap"><table class="table"><thead><tr><th>APOIADOR</th><th>PLANO</th><th>PERFIL</th><th>BRIEFING VIP</th><th>AVATAR</th><th>APARIÇÃO</th><th>EPISÓDIO</th><th></th></tr></thead><tbody>${items.length?items.map(s=>{const p=person(s,m),profile=m.publicity[s.user_id]||{},briefing=m.vipBriefings[s.id]||{},a=m.appearances[s.id]||{};return `<tr><td><div class="person"><div class="avatar">${e(p.initial)}</div><div><strong>${e(p.name)}</strong><small>${e(p.email)}</small></div></div></td><td>${badge(s.tier)}</td><td>${profile.submission_completed_at?badge('ready'):badge('awaiting')}</td><td>${s.tier==='vip'?badge(briefing.status||'awaiting'):'—'}</td><td>${badge(profile.avatar_status||'awaiting')}</td><td>${badge(a.status||'waiting_profile')}</td><td>${e(a.estimated_episode_number||a.episodes?.episode_number||'—')}</td><td>${manageButton(s)}</td></tr>`}).join(''):'<tr><td colspan="8" class="empty">A fila está vazia.</td></tr>'}</tbody></table></div>`;
  }
  function episodeView() {
    const rank={supporter:1,highlight:2,vip:3};
    const currentByUser=new Map();
    data.supports.filter(s=>s.payment_status==='paid'&&rank[s.tier]).forEach(s=>{const old=currentByUser.get(s.user_id);if(!old||rank[s.tier]>rank[old.tier]||new Date(s.created_at)>new Date(old.created_at))currentByUser.set(s.user_id,s)});
    const candidates=[...currentByUser.values()];
    const editing=episodeDraft&&data.episodes.find(x=>x.id===episodeDraft.id);
    const selected=new Set(editing?data.appearances.filter(a=>a.episode_id===editing.id).map(a=>a.support_id):[]);
    const form={production_id:editing?.production_id||data.productions.find(p=>p.is_current)?.id||data.productions[0]?.id||'',episode_number:editing?.episode_number||'',scheduled_date:editing?.scheduled_date||'',status:editing?.published_at?'published':'confirmed',published_url:editing?.instagram_url||'',cover_image_url:editing?.cover_image_url||''};
    const m=maps();
    const group=(tier,title,limit)=>{const rows=candidates.filter(s=>s.tier===tier);return `<section class="episode-group"><div class="episode-group-head"><div><span>${e(title)}</span><small>máximo ${limit}</small></div><strong data-count="${tier}">0/${limit}</strong></div><div class="episode-people">${rows.length?rows.map(s=>{const p=person(s,m);return `<label class="episode-person"><input type="checkbox" data-episode-support="${e(s.id)}" data-tier="${e(tier)}" ${selected.has(s.id)?'checked':''}><span class="avatar">${e(p.initial)}</span><span><b>${e(p.name)}</b><small>${e(p.email)}</small></span><i></i></label>`}).join(''):'<div class="episode-none">Nenhum apoiador disponível nesta categoria.</div>'}</div></section>`};
    return `<div class="section-head"><div><h2>Montar episódio</h2><p>Preencha uma vez e atualize todos os apoiadores escolhidos.</p></div>${editing?'<button class="btn secondary small" id="newEpisode">NOVO EPISÓDIO</button>':''}</div><div class="episode-builder"><section class="panel panel-pad episode-form"><span class="eyebrow">DADOS DO EPISÓDIO</span><div class="form-grid" style="margin-top:16px"><label>Produção<select id="batchProduction">${data.productions.map(p=>`<option value="${e(p.id)}" ${p.id===form.production_id?'selected':''}>${e(p.title)}</option>`).join('')}</select></label><label>Número do episódio<input id="batchNumber" type="number" min="1" value="${e(form.episode_number)}" placeholder="Ex.: 2"></label><label>Data prevista<input id="batchDate" type="date" value="${e(form.scheduled_date)}"></label><label>Etapa<select id="batchStatus"><option value="estimated" ${form.status==='estimated'?'selected':''}>Programado</option><option value="confirmed" ${form.status==='confirmed'?'selected':''}>Confirmado</option><option value="in_production" ${form.status==='in_production'?'selected':''}>Em produção</option><option value="published" ${form.status==='published'?'selected':''}>Publicado</option></select></label><label class="full">Link para assistir<input id="batchUrl" type="url" value="${e(form.published_url)}" placeholder="https://instagram.com/..."></label><label class="full">Capa do episódio<input id="batchCover" type="file" accept="image/jpeg,image/png,image/webp"><input id="batchCoverUrl" type="hidden" value="${e(form.cover_image_url)}"></label>${form.cover_image_url?`<img class="episode-cover-preview" src="${e(form.cover_image_url)}" alt="Capa atual do episódio">`:''}</div><div id="episodeCapacity" class="capacity-ok">Selecione os participantes dentro dos limites.</div><button id="saveEpisodeBatch" class="btn primary">${editing?'ATUALIZAR EPISÓDIO E APOIADORES':'CRIAR EPISÓDIO E ATUALIZAR APOIADORES'}</button></section><div class="episode-groups">${group('supporter','APOIADORES',6)}${group('highlight','APOIADORES DESTAQUE',3)}${group('vip','APOIADOR VIP',1)}</div></div><div class="section-head" style="margin-top:34px"><div><h2>Episódios cadastrados</h2><p>${data.episodes.length} episódio(s)</p></div></div><div class="panel table-wrap"><table class="table"><thead><tr><th>PRODUÇÃO</th><th>EPISÓDIO</th><th>DATA</th><th>STATUS</th><th>PARTICIPANTES</th><th></th></tr></thead><tbody>${data.episodes.length?data.episodes.map(x=>`<tr><td>${e(x.productions?.title||'Produção')}</td><td><strong>EP ${e(x.episode_number)}</strong></td><td>${date(x.scheduled_date)}</td><td>${x.published_at?badge('published'):badge('confirmed')}</td><td>${data.appearances.filter(a=>a.episode_id===x.id).length}</td><td><button class="btn secondary small" data-edit-episode="${e(x.id)}">ABRIR</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhum episódio cadastrado ainda.</td></tr>'}</tbody></table></div>`;
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
    document.querySelectorAll('[data-edit-episode]').forEach(b=>b.addEventListener('click',()=>{episodeDraft={id:b.dataset.editEpisode};render();scrollTo({top:0,behavior:'smooth'})}));
    $('#newEpisode')?.addEventListener('click',()=>{episodeDraft=null;render()});
    document.querySelectorAll('[data-episode-support]').forEach(x=>x.addEventListener('change',updateEpisodeCapacity));
    $('#saveEpisodeBatch')?.addEventListener('click',saveEpisodeBatch);
    updateEpisodeCapacity();
  }

  function updateEpisodeCapacity(){
    const limits={supporter:6,highlight:3,vip:1};let valid=true,total=0;
    Object.entries(limits).forEach(([tier,limit])=>{const count=document.querySelectorAll(`[data-episode-support][data-tier="${tier}"]:checked`).length;total+=count;const el=document.querySelector(`[data-count="${tier}"]`);if(el){el.textContent=`${count}/${limit}`;el.classList.toggle('over',count>limit)}if(count>limit)valid=false});
    const msg=$('#episodeCapacity');if(msg){msg.className=valid&&total?'capacity-ok':'capacity-warn';msg.textContent=!valid?'Reduza a seleção para respeitar os limites de cada categoria.':total?`${total} participante(s) selecionado(s).`:'Escolha pelo menos um apoiador.'}
    const save=$('#saveEpisodeBatch');if(save)save.disabled=!valid||!total;
  }

  async function saveEpisodeBatch(){
    const btn=$('#saveEpisodeBatch');if(!btn)return;btn.disabled=true;btn.textContent='SALVANDO…';
    try{
      let coverUrl=$('#batchCoverUrl')?.value||'';const file=$('#batchCover')?.files?.[0];
      if(file){if(file.size>10*1024*1024)throw new Error('A capa deve ter no máximo 10 MB.');const ext=(file.name.split('.').pop()||'webp').replace(/[^a-z0-9]/gi,'').toLowerCase();const path=`episode-${$('#batchNumber').value}-${Date.now()}.${ext}`;const uploaded=await sb.storage.from('episode-covers').upload(path,file,{upsert:true,contentType:file.type});if(uploaded.error)throw uploaded.error;coverUrl=sb.storage.from('episode-covers').getPublicUrl(path).data.publicUrl}
      const supportIds=Array.from(document.querySelectorAll('[data-episode-support]:checked')).map(x=>x.dataset.episodeSupport);
      const out=await invoke('save_episode_batch',{production_id:$('#batchProduction').value,episode_number:$('#batchNumber').value,scheduled_date:$('#batchDate').value||null,status:$('#batchStatus').value,published_url:$('#batchUrl').value.trim(),cover_image_url:coverUrl,support_ids:supportIds});
      toast(`Episódio salvo para ${out.assigned} apoiador(es).`,'success');data=await invoke('dashboard');episodeDraft={id:out.episode.id};render();
    }catch(err){toast(err.message,'error');btn.disabled=false;btn.textContent='TENTAR NOVAMENTE'}
  }
  async function openSupporter(userId, supportId) {
    $('#modal').classList.remove('hidden'); $('#modalContent').innerHTML='<div class="loading-view" style="min-height:320px"><div class="spinner"></div><p>Carregando apoiador…</p></div>';
    try {
      const m=maps(); const supports=data.supports.filter(x=>x.user_id===userId); const support=supports.find(x=>x.id===supportId)||supports[0]||{}; const p=m.publicity[userId]||{}; const briefing=m.vipBriefings[support.id]||{}; const a=data.appearances.find(x=>x.support_id===support.id)||{}; const profile=m.profiles[userId]||{}; const user=m.users[userId]||{}; const signed={face:null,body:null};
      for(const [key,path] of [['face',p.face_photo_path],['body',p.body_photo_path]]){if(path){const {data:urlData}=await sb.storage.from('supporter-photos').createSignedUrl(path,600,{download:true});signed[key]=urlData?.signedUrl||null}}
      const d={supports,publicity:p,appearances:data.appearances.filter(x=>supports.some(s=>s.id===x.support_id)),profile,user,signed}; const name=p.display_name||profile.display_name||user.email?.split('@')[0]||'Apoiador';
      $('#modalContent').innerHTML=`<span class="eyebrow">GERENCIAR APOIADOR</span><h2>${e(name)}</h2><p class="modal-sub">${e(d.user.email||'')} · ${e(labels[support.tier]||support.tier||'Sem apoio')}</p><div class="detail-grid"><section class="detail-section"><h3>PAGAMENTO E PERFIL</h3><div class="kv"><span>Status</span><strong>${badge(support.payment_status)}</strong></div><div class="kv"><span>Valor</span><strong>${money(support.amount)}</strong></div><div class="kv"><span>Perfil enviado</span><strong>${p.submission_completed_at?'Sim':'Não'}</strong></div><div class="kv"><span>Rede social</span><strong>${e(p.social_handle||'—')}</strong></div><div class="email-actions" style="margin-top:16px"><button class="btn secondary small" data-email="thank_you">AGRADECER</button><button class="btn secondary small" data-email="info_request">PEDIR INFORMAÇÕES</button><button class="btn secondary small" data-email="renewal_reminder">LEMBRAR NOVO APOIO</button></div></section><section class="detail-section"><h3>IMAGENS E AVATAR</h3><div class="photo-actions"><a class="btn secondary small" style="display:grid;place-items:center;text-decoration:none" href="${e(d.signed.face||'#')}" ${d.signed.face?'target="_blank"':'aria-disabled="true"'}>BAIXAR ROSTO</a><a class="btn secondary small" style="display:grid;place-items:center;text-decoration:none" href="${e(d.signed.body||'#')}" ${d.signed.body?'target="_blank"':'aria-disabled="true"'}>BAIXAR CORPO</a></div><label style="margin-top:18px">Subir avatar oficial<input id="avatarFile" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="uploadAvatar" class="btn primary small" style="margin-top:10px">ENVIAR AVATAR PRONTO</button>${p.official_avatar_path?`<p style="font-size:11px;color:var(--green)">✓ Avatar já disponível na Área do Apoiador</p>`:''}</section>${vipBriefingSection(support,briefing,d.signed.vipReferences||[])}<section class="detail-section full"><h3>PROGRAMAÇÃO DA APARIÇÃO</h3><div class="form-grid"><label>Status<select id="appearanceStatus">${['waiting_profile','waiting_avatar','queued','estimated','confirmed','in_production','published','reprogrammed','cancelled'].map(x=>`<option value="${x}" ${a.status===x?'selected':''}>${e(labels[x]||x)}</option>`).join('')}</select></label><label>Número do episódio<input id="episodeNumber" type="number" min="1" value="${e(a.estimated_episode_number||a.episodes?.episode_number||'')}"></label><label>Data prevista<input id="estimatedDate" type="date" value="${e(a.estimated_date||a.episodes?.scheduled_date||'')}"></label><label>Link para assistir<input id="publishedUrl" type="url" value="${e(a.published_url||'')}" placeholder="https://instagram.com/..."></label><label class="full">Anotações internas<textarea id="adminNotes" placeholder="Informações visíveis somente para a produção">${e(a.admin_notes||'')}</textarea></label></div><button id="saveAppearance" class="btn primary" style="margin-top:14px">SALVAR ATUALIZAÇÃO</button><p style="font-size:11px;color:var(--muted)">Quando o status for “Publicado”, a aparição recebe o check e o episódio aparece automaticamente na Área do Apoiador.</p></section></div>`;
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
  $('#resetPassword').addEventListener('click',async()=>{const email=$('#loginEmail').value.trim();if(!email)return toast('Digite seu e-mail primeiro.','error');const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/admin`});toast(error?error.message:'Enviamos o link para criar ou recuperar sua senha.',error?'error':'success')});
  $('#logout').addEventListener('click',()=>sb.auth.signOut()); $('#closeModal').addEventListener('click',()=>$('#modal').classList.add('hidden')); $('#modal').addEventListener('click',ev=>{if(ev.target.id==='modal')ev.currentTarget.classList.add('hidden')});
  $('#nav').addEventListener('click',ev=>{const b=ev.target.closest('[data-view]');if(!b)return;currentView=b.dataset.view;$('#nav').closest('.sidebar').classList.remove('open');render()}); $('#mobileMenu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
  sb.auth.onAuthStateChange((event,newSession)=>{session=newSession;if(event==='PASSWORD_RECOVERY'){const password=prompt('Crie uma nova senha com pelo menos 8 caracteres:');if(password&&password.length>=8)sb.auth.updateUser({password}).then(({error})=>toast(error?error.message:'Senha criada com sucesso.',error?'error':'success'));return} if(newSession)load();else show('login')});
  sb.auth.getSession().then(({data:{session:s}})=>{session=s;if(s)load();else show('login')});
})();
