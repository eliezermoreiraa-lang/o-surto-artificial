(() => {
  'use strict';
  if (window.__surtoSupporterDashboardV2) return;
  window.__surtoSupporterDashboardV2 = true;

  const SB_URL = 'https://ndfchglutpnbckpcrppy.supabase.co';
  const SB_KEY = 'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
  const LABELS = {
    free: 'APOIO LIVRE',
    supporter: 'APOIADOR',
    highlight: 'APOIADOR DESTAQUE',
    vip: 'APOIADOR VIP'
  };
  const ROUTES = {
    'INÍCIO': 'home',
    'MEUS APOIOS': 'apoios',
    'MINHAS APARIÇÕES': 'aparicoes',
    'PERFIL DE DIVULGAÇÃO': 'perfil',
    'MINHA ASSINATURA': 'assinatura',
    'MEUS EPISÓDIOS': 'episodios',
    'ÁREA VIP': 'vip'
  };
  const AP_STATUS = {
    waiting_profile: 'aguardando perfil',
    waiting_avatar: 'aguardando avatar',
    queued: 'na fila',
    estimated: 'previsão definida',
    confirmed: 'confirmada',
    in_production: 'em produção',
    published: 'publicada',
    reprogrammed: 'reprogramada',
    cancelled: 'cancelada'
  };

  let client = null;
  let dataModel = null;
  let currentUserId = null;
  let currentRoute = 'home';
  let rendering = false;
  let timer = null;
  let upgradeData = null;
  let lastNav = null;

  const norm = v => String(v || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const esc = v => String(v == null ? '' : v)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const brl = v => Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateBR = v => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(d);
  };
  const monthYear = v => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(d);
  };

  function ensureClient(){
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'surto-auth' }
    });
    return client;
  }

  function findNav(){
    const all = Array.from(document.querySelectorAll('div'));
    const candidates = all.filter(el => {
      const t = norm(el.textContent);
      if (t.length > 190) return false;
      return t.includes('INÍCIO') && t.includes('MEUS APOIOS') && t.includes('MINHAS APARIÇÕES') && t.includes('PERFIL DE DIVULGAÇÃO') && t.includes('MINHA ASSINATURA') && t.includes('MEUS EPISÓDIOS') && t.includes('ÁREA VIP') && t.includes('SAIR');
    });
    if (!candidates.length) return null;
    candidates.sort((a,b) => norm(a.textContent).length - norm(b.textContent).length);
    return candidates[0];
  }

  function shellFor(nav){
    if (!nav) return null;
    let p = nav.parentElement;
    while (p && p !== document.body) {
      const t = norm(p.textContent);
      if (t.includes('CLUBE DO SURTO') || t.includes('MEUS APOIOS') || p.children.length > 1) return p;
      p = p.parentElement;
    }
    return nav.parentElement;
  }

  function bindNav(nav){
    Array.from(nav.querySelectorAll('div')).forEach(el => {
      const label = norm(el.textContent);
      if (!ROUTES[label] || el.dataset.realDashBound === '1') return;
      el.dataset.realDashBound = '1';
      el.addEventListener('click', () => {
        currentRoute = ROUTES[label];
        upgradeData = null;
        setTimeout(() => schedule(false), 90);
      }, true);
    });
  }

  function inferRoute(shell){
    const h = Array.from(shell.querySelectorAll('h1')).find(x => !x.closest('#surto-supporter-real-v2'));
    const t = norm(h && h.textContent);
    if (t.includes('MEUS APOIOS')) return 'apoios';
    if (t.includes('MINHAS APARIÇÕES')) return 'aparicoes';
    if (t.includes('PERFIL DE DIVULGAÇÃO')) return 'perfil';
    if (t.includes('MINHA ASSINATURA')) return 'assinatura';
    if (t.includes('MEUS EPISÓDIOS')) return 'episodios';
    if (t.includes('ÁREA VIP') || t.includes('BRIEFING EXCLUSIVO')) return 'vip';
    return currentRoute || 'home';
  }

  async function loadData(force=false){
    const sb = ensureClient();
    if (!sb) throw new Error('supabase_not_ready');
    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session || !session.user) throw new Error('not_authenticated');
    if (!force && dataModel && currentUserId === session.user.id) return dataModel;
    const { data, error } = await sb.functions.invoke('supporter-dashboard-data', { body: {} });
    if (error || !data || !data.ok) throw new Error('dashboard_data_failed');
    dataModel = data;
    currentUserId = session.user.id;
    return dataModel;
  }

  function ensureCss(){
    if (document.getElementById('surto-supporter-real-v2-css')) return;
    const style = document.createElement('style');
    style.id = 'surto-supporter-real-v2-css';
    style.textContent = `
      #surto-supporter-real-v2{color:#F5F5F5;font-family:Inter,system-ui,sans-serif;padding:0 0 34px}
      #surto-supporter-real-v2 *{box-sizing:border-box}
      .sd-title{font:400 clamp(35px,5vw,58px)/.94 'Bebas Neue',Inter,sans-serif;margin:22px 0 8px;letter-spacing:.01em}
      .sd-lead{margin:0 0 22px;max-width:760px;color:rgba(245,245,245,.58);font-size:14px;line-height:1.6}
      .sd-hero{position:relative;overflow:hidden;border-radius:14px;padding:clamp(28px,4vw,44px);margin:0 0 16px;background:linear-gradient(115deg,rgba(0,229,255,.08),#10131a 48%,rgba(229,9,20,.13));box-shadow:0 0 0 1px rgba(245,245,245,.09)}
      .sd-hero h1{font:400 clamp(46px,7vw,78px)/.88 'Bebas Neue',Inter,sans-serif;margin:5px 0 18px}
      .sd-hero p,.sd-card p{color:rgba(245,245,245,.58);font-size:13px;line-height:1.55}
      .sd-muted{color:rgba(245,245,245,.52);font-size:13px}.sd-kicker{font-size:9.5px;letter-spacing:.24em;color:#00E5FF;margin-bottom:15px}.sd-kicker.red{color:#E50914}
      .sd-badges{display:flex;gap:9px;flex-wrap:wrap}.sd-badges span,.sd-status{display:inline-flex;border-radius:999px;padding:6px 11px;box-shadow:0 0 0 1px rgba(245,245,245,.14);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:rgba(245,245,245,.66)}
      .sd-badges .cyan,.sd-status.cyan{color:#00E5FF;box-shadow:0 0 0 1px rgba(0,229,255,.35);background:rgba(0,229,255,.07)}
      .sd-grid{display:grid;gap:16px;margin-bottom:16px}.sd-grid.two{grid-template-columns:minmax(0,1.7fr) minmax(280px,.9fr)}.sd-grid.cards{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
      .sd-card{background:#111418;border-radius:12px;padding:22px;box-shadow:0 0 0 1px rgba(245,245,245,.10);min-width:0}.sd-card.accent{background:linear-gradient(125deg,rgba(0,229,255,.09),#111418);box-shadow:0 0 0 1px rgba(0,229,255,.38)}.sd-card.vip{background:linear-gradient(125deg,rgba(181,171,252,.12),#111418 55%,rgba(229,9,20,.09));box-shadow:0 0 0 1px rgba(181,171,252,.35)}
      .sd-card h2{font:400 clamp(34px,5vw,58px)/.95 'Bebas Neue',Inter,sans-serif;margin:12px 0}.sd-card h3{font:400 30px/1 'Bebas Neue',Inter,sans-serif;margin:8px 0}.sd-money{font:400 31px/1 'Bebas Neue',Inter,sans-serif;color:#00E5FF;margin:7px 0 18px}
      .sd-list{display:grid;gap:0;margin:12px 0 18px;border-top:1px solid rgba(245,245,245,.08)}.sd-list>div{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid rgba(245,245,245,.08);font-size:12px}.sd-list span{color:rgba(245,245,245,.45)}.sd-list b{font-weight:500;text-align:right}
      .sd-btn{border:0;border-radius:7px;background:#E50914;color:#fff;min-height:46px;padding:0 19px;font:600 11px Inter,sans-serif;letter-spacing:.12em;cursor:pointer}.sd-btn:disabled{opacity:.55;cursor:wait}.sd-btn.secondary{background:#00E5FF;color:#071015}.sd-btn.outline{background:transparent;box-shadow:inset 0 0 0 1px #E50914}.sd-btn.vipbtn{width:100%;margin-top:12px;background:linear-gradient(90deg,#E50914,#a90f82)}
      .sd-empty{border-radius:12px;padding:34px;background:#111418;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sd-empty-title{font:400 32px/1 'Bebas Neue',Inter,sans-serif;margin-bottom:8px}.sd-empty p{color:rgba(245,245,245,.55);line-height:1.6;margin:0 0 18px}
      .sd-table-wrap{overflow:auto;border-radius:10px;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sd-table{width:100%;border-collapse:collapse;min-width:730px;background:#111418;font-size:12px}.sd-table th,.sd-table td{padding:14px 15px;text-align:left;border-bottom:1px solid rgba(245,245,245,.07)}.sd-table th{color:rgba(245,245,245,.45);font-size:9px;letter-spacing:.14em;text-transform:uppercase}
      .sd-form{max-width:720px;display:grid;gap:15px}.sd-field{display:grid;gap:7px}.sd-field label,.sd-check{font-size:11px;color:rgba(245,245,245,.58)}.sd-field input,.sd-field select{width:100%;height:44px;border:0;border-radius:7px;padding:0 12px;background:#0B0D13;color:#F5F5F5;box-shadow:inset 0 0 0 1px rgba(245,245,245,.16);font:13px Inter,sans-serif}.sd-check{display:flex;align-items:flex-start;gap:9px;line-height:1.45}.sd-msg{font-size:12px;color:#ff7b82}.sd-msg.ok{color:#00E5FF}
      .sd-credit{display:grid;grid-template-columns:1fr auto;gap:10px 18px;margin:20px 0;padding:16px;border-radius:9px;background:#0B0D13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.10);font-size:12px}.sd-credit span{color:rgba(245,245,245,.5)}.sd-credit strong{font:400 27px/1 'Bebas Neue';color:#00E5FF}
      .sd-pix{display:grid;grid-template-columns:160px 1fr;gap:18px;align-items:center}.sd-pix img{width:160px;height:160px;object-fit:contain;background:#fff;padding:7px;border-radius:8px}.sd-pix .sd-btn{display:block;width:100%;margin-top:9px}.sd-link{color:#00E5FF;text-decoration:none;font-size:11px;letter-spacing:.08em}
      @media(max-width:820px){.sd-grid.two{grid-template-columns:1fr}.sd-pix{grid-template-columns:1fr}.sd-pix img{width:180px;height:180px}.sd-table{min-width:680px}}
    `;
    document.head.appendChild(style);
  }

  const empty = (title,text,action='') => `<div class="sd-empty"><div class="sd-empty-title">${esc(title)}</div><p>${esc(text)}</p>${action}</div>`;
  const card = (title,body,extra='') => `<section class="sd-card ${extra}"><div class="sd-kicker">${esc(title)}</div>${body}</section>`;

  function homeHtml(m){
    const s = m.currentSupport;
    if (!s) return empty('Você ainda não possui nenhum apoio pago','Escolha uma forma de apoio para liberar os recursos da sua Área do Apoiador.','<button class="sd-btn" data-clube>CONHECER AS FORMAS DE APOIO →</button>');
    const p = m.publicityProfile;
    const name = (p && p.display_name) || (m.user && m.user.displayName) || 'APOIADOR';
    const ap = (m.appearances || []).find(x => x.status !== 'cancelled');
    const profileMissing = !p || !p.display_name || !p.social_network || !p.social_handle || !p.social_url;
    let appearance;
    if (!ap) appearance = '<h2>AINDA NÃO HÁ APARIÇÃO AGENDADA</h2><p>Seu apoio está confirmado. Quando a produção colocar sua participação na fila, ela aparecerá aqui. Nenhum episódio é inventado ou estimado sem cadastro da produção.</p>';
    else {
      const ep = ap.episodes && ap.episodes.episode_number ? `EPISÓDIO ${ap.episodes.episode_number}` : ap.estimated_episode_number ? `EPISÓDIO ${ap.estimated_episode_number}` : 'EPISÓDIO A DEFINIR';
      const when = (ap.episodes && ap.episodes.scheduled_date) || ap.estimated_date;
      appearance = `<span class="sd-status cyan">${esc(AP_STATUS[ap.status] || ap.status)}</span><h2>${esc(ep)}</h2><p>${when ? dateBR(when) : 'A produção ainda não definiu uma data.'}</p>`;
    }
    const hero = `<section class="sd-hero"><div class="sd-kicker red">CLUBE DO SURTO</div><div class="sd-muted">Bem-vindo de volta,</div><h1>${esc(name)}</h1><div class="sd-badges"><span>${esc(LABELS[s.tier] || s.label || s.tier)}</span><span>${s.billing_mode === 'recurring' ? 'ASSINATURA MENSAL' : 'APOIO AVULSO'}</span><span class="cyan">● CONTA ATIVA</span></div><p>Aqui aparecem somente informações reais vinculadas à sua conta.</p></section>`;
    const plan = card('MEU PLANO',`<h3>${esc(LABELS[s.tier] || s.label || s.tier)}</h3><div class="sd-money">${brl(s.amount)}</div><div class="sd-list"><div><span>Situação</span><b>apoio confirmado</b></div><div><span>Modalidade</span><b>${s.billing_mode === 'recurring' ? 'mensal' : 'apoio avulso'}</b></div><div><span>Membro desde</span><b>${esc(monthYear(m.user && m.user.memberSince))}</b></div></div>${s.tier !== 'vip' ? '<button class="sd-btn outline" data-route="vip">FAZER UPGRADE</button>' : ''}`);
    const next = card('SUA PRÓXIMA APARIÇÃO',appearance,'accent');
    const profile = profileMissing ? card('PRÓXIMO PASSO','<h3>Complete seu perfil de divulgação</h3><p>Informe nome, rede social, @ e link. Depois disso a produção consegue avançar sua participação.</p><button class="sd-btn secondary" data-route="perfil">COMPLETAR PERFIL →</button>') : '';
    return hero + `<div class="sd-grid two">${next}${plan}</div>${profile}`;
  }

  function apoiosHtml(m){
    const rows = m.supports || [];
    if (!rows.length) return `<h1 class="sd-title">Meus Apoios</h1>${empty('Nenhum apoio pago encontrado','Quando um pagamento for confirmado, ele aparecerá aqui.')}`;
    const body = rows.map(s => {
      const ap = (m.appearances || []).find(a => a.support_id === s.id && a.status !== 'cancelled');
      const ep = ap && ap.episodes && ap.episodes.episode_number ? `EP ${ap.episodes.episode_number}` : ap && ap.estimated_episode_number ? `EP ${ap.estimated_episode_number}` : '—';
      return `<tr><td>${dateBR(s.paid_at || s.created_at)}</td><td>${esc(LABELS[s.tier] || s.label || s.tier)}</td><td>${s.billing_mode === 'recurring' ? 'mensal' : 'avulso'}</td><td>${brl(s.amount)}</td><td><span class="sd-status cyan">pago</span></td><td>${esc(ep)}</td></tr>`;
    }).join('');
    return `<h1 class="sd-title">Meus Apoios</h1><p class="sd-lead">Somente apoios realmente pagos. Tentativas com erro não aparecem aqui.</p><div class="sd-table-wrap"><table class="sd-table"><thead><tr><th>Data</th><th>Categoria</th><th>Modalidade</th><th>Valor pago</th><th>Status</th><th>Aparição</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function aparicoesHtml(m){
    const rows = (m.appearances || []).filter(a => a.status !== 'cancelled');
    if (!rows.length) return `<h1 class="sd-title">Minhas Aparições</h1>${empty('Nenhuma aparição cadastrada','Você ainda não foi vinculado a nenhum episódio ou data. Quando a produção cadastrar sua aparição, ela aparecerá aqui.')}`;
    return `<h1 class="sd-title">Minhas Aparições</h1><p class="sd-lead">Só aparecem etapas e episódios cadastrados de verdade pela produção.</p><div class="sd-grid cards">${rows.map(a => {
      const support = (m.supports || []).find(s => s.id === a.support_id);
      const ep = a.episodes && a.episodes.episode_number ? `EPISÓDIO ${a.episodes.episode_number}` : a.estimated_episode_number ? `EPISÓDIO ${a.estimated_episode_number}` : 'EPISÓDIO A DEFINIR';
      const dt = (a.episodes && a.episodes.scheduled_date) || a.estimated_date;
      return card(support ? (LABELS[support.tier] || support.label) : 'APARIÇÃO',`<span class="sd-status cyan">${esc(AP_STATUS[a.status] || a.status)}</span><h3>${esc(ep)}</h3><p>${dt ? dateBR(dt) : 'Sem data definida.'}</p>${a.published_url ? `<a class="sd-link" target="_blank" rel="noopener" href="${esc(a.published_url)}">VER PUBLICAÇÃO →</a>` : ''}`);
    }).join('')}</div>`;
  }

  function profileHtml(m){
    const p = m.publicityProfile || {};
    const net = String(p.social_network || '').toLowerCase();
    const opts = [['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube'],['x','X / Twitter'],['facebook','Facebook'],['outro','Outra']];
    return `<h1 class="sd-title">Perfil de Divulgação</h1><p class="sd-lead">Você pode alterar nome, rede social, @ e link. Esses dados serão reutilizados nas suas futuras aparições.</p><div class="sd-card sd-form"><div class="sd-field"><label>Nome de divulgação</label><input id="sd-name" value="${esc(p.display_name || (m.user && m.user.displayName) || '')}" placeholder="Como você quer ser identificado"></div><div class="sd-field"><label>Rede social</label><select id="sd-network"><option value="">Selecione</option>${opts.map(o => `<option value="${o[0]}" ${net===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div><div class="sd-field"><label>@ na divulgação</label><input id="sd-handle" value="${esc(p.social_handle ? '@'+String(p.social_handle).replace(/^@/,'') : '')}" placeholder="@seuperfil"></div><div class="sd-field"><label>Link do perfil</label><input id="sd-url" value="${esc(p.social_url || '')}" placeholder="https://..."></div><label class="sd-check"><input id="sd-consent" type="checkbox" ${p.public_consent ? 'checked' : ''}> Autorizo a exibição destes dados nas divulgações e no mural de apoiadores.</label><div class="sd-msg" id="sd-profile-msg"></div><button class="sd-btn" id="sd-save-profile">SALVAR PERFIL</button></div>`;
  }

  function assinaturaHtml(m){
    const s = m.subscription;
    if (!s) return `<h1 class="sd-title">Minha Assinatura</h1>${empty('Você não possui assinatura ativa','Seu apoio atual é avulso. Não existe renovação automática nem próxima cobrança mensal para esta conta.')}`;
    return `<h1 class="sd-title">Minha Assinatura</h1>${card('ASSINATURA ATIVA',`<h3>${esc(LABELS[s.tier] || s.tier)}</h3><div class="sd-money">${brl(s.amount)} / mês</div><div class="sd-list"><div><span>Status</span><b>${esc(s.status)}</b></div><div><span>Início</span><b>${dateBR(s.started_at || s.created_at)}</b></div><div><span>Próxima cobrança</span><b>${dateBR(s.next_due_date)}</b></div></div>`)}`;
  }

  function episodiosHtml(m){
    const rows = m.episodes || [];
    if (!rows.length) return `<h1 class="sd-title">Meus Episódios</h1>${empty('Nenhum episódio publicado com sua participação','Quando uma aparição sua for publicada e vinculada a um episódio real, ela aparecerá aqui.')}`;
    return `<h1 class="sd-title">Meus Episódios</h1><div class="sd-grid cards">${rows.map(e => {
      const links = [e.instagramUrl && `<a class="sd-link" target="_blank" href="${esc(e.instagramUrl)}">Instagram</a>`,e.tiktokUrl && `<a class="sd-link" target="_blank" href="${esc(e.tiktokUrl)}">TikTok</a>`,e.youtubeUrl && `<a class="sd-link" target="_blank" href="${esc(e.youtubeUrl)}">YouTube</a>`].filter(Boolean).join(' · ');
      return card('PUBLICADO',`<h3>EPISÓDIO ${esc(e.episodeNumber || '—')}</h3><p>${dateBR(e.date)}</p><div>${links || 'Sem link cadastrado.'}</div>`);
    }).join('')}</div>`;
  }

  function vipHtml(m){
    if (m.vipAccess) return `<h1 class="sd-title">Área VIP</h1>${card('ACESSO VIP LIBERADO','<h2>VOCÊ É APOIADOR VIP</h2><p>Sua área exclusiva está ativa. O briefing da cena e o acompanhamento da produção aparecerão aqui conforme a equipe avançar.</p><div class="sd-list"><div><span>Aparição</span><b>individual</b></div><div><span>Cena</span><b>personalizada</b></div><div><span>Prioridade</span><b>máxima</b></div></div>','vip')}`;
    const u = (m.upgrades || []).find(x => x.tier === 'vip');
    const due = u ? Number(u.amountDue || 0) : 300;
    const credit = Math.max(0,300-due);
    if (upgradeData && upgradeData.pix) {
      return `<h1 class="sd-title">Upgrade para Apoiador VIP</h1><div class="sd-grid two">${card('RESUMO DO UPGRADE',`<div class="sd-list"><div><span>Plano VIP</span><b>${brl(300)}</b></div><div><span>Crédito do seu apoio atual</span><b>− ${brl(credit)}</b></div><div><span>Total do upgrade</span><b style="color:#00E5FF">${brl(upgradeData.amount || due)}</b></div></div>`)}${card('PAGAMENTO PIX',`<div class="sd-pix"><img src="data:image/png;base64,${esc(upgradeData.pix.encodedImage)}" alt="QR Code Pix"><div><p>Escaneie ou copie o código Pix.</p><button class="sd-btn secondary" id="sd-copy-pix">COPIAR PIX</button><button class="sd-btn outline" id="sd-refresh-vip">JÁ PAGUEI · ATUALIZAR STATUS</button></div></div>`)}</div>`;
    }
    return `<h1 class="sd-title">Área VIP</h1>${card('ACESSO RESTRITO',`<h2>VOCÊ NÃO TEM ACESSO À ÁREA VIP</h2><p>Para se tornar um apoiador VIP, ter sua aparição sozinho e ainda o apoio da equipe do Surto para sua cena, faça o upgrade.</p>${m.currentSupport ? `<div class="sd-credit"><span>Plano VIP</span><b>${brl(300)}</b><span>Crédito do seu apoio atual</span><b>− ${brl(credit)}</b><span>Você paga agora</span><strong>${brl(due)}</strong></div><button class="sd-btn vipbtn" id="sd-upgrade-vip">FAZER UPGRADE PARA VIP · ${brl(due)}</button>` : '<button class="sd-btn vipbtn" data-clube>CONHECER O APOIADOR VIP →</button>'}`,'vip')}`;
  }

  function htmlFor(route,m){
    if (route === 'apoios') return apoiosHtml(m);
    if (route === 'aparicoes') return aparicoesHtml(m);
    if (route === 'perfil') return profileHtml(m);
    if (route === 'assinatura') return assinaturaHtml(m);
    if (route === 'episodios') return episodiosHtml(m);
    if (route === 'vip') return vipHtml(m);
    return homeHtml(m);
  }

  function gotoOriginalRoute(key){
    const nav = findNav();
    if (!nav) return;
    const label = Object.keys(ROUTES).find(k => ROUTES[k] === key);
    if (!label) return;
    const target = Array.from(nav.querySelectorAll('div')).find(el => norm(el.textContent) === label);
    if (target) target.click();
  }

  function bindRoot(root){
    root.querySelectorAll('[data-route]').forEach(el => el.addEventListener('click',()=>gotoOriginalRoute(el.dataset.route),{once:true}));
    root.querySelectorAll('[data-clube]').forEach(el => el.addEventListener('click',()=>{
      const link = Array.from(document.querySelectorAll('div')).find(x => norm(x.textContent)==='CLUBE DO SURTO');
      if (link) link.click();
    },{once:true}));

    const save = root.querySelector('#sd-save-profile');
    if (save) save.addEventListener('click',async()=>{
      const msg = root.querySelector('#sd-profile-msg');
      const displayName = root.querySelector('#sd-name').value.trim();
      const socialNetwork = root.querySelector('#sd-network').value.trim();
      const socialHandle = root.querySelector('#sd-handle').value.trim();
      const socialUrl = root.querySelector('#sd-url').value.trim();
      const consent = !!root.querySelector('#sd-consent').checked;
      if (!displayName || !socialNetwork || !socialHandle || !socialUrl) { msg.textContent='Preencha nome, rede social, @ e link.'; return; }
      if (!consent) { msg.textContent='Marque a autorização de exibição para salvar.'; return; }
      save.disabled=true; save.textContent='SALVANDO…'; msg.textContent='';
      try {
        const sb = ensureClient();
        const { data,error } = await sb.functions.invoke('supporter-profile-save',{body:{displayName,socialNetwork,socialHandle,socialUrl}});
        if (error || !data || !data.ok) throw new Error('save_failed');
        await loadData(true);
        msg.classList.add('ok'); msg.textContent='Perfil salvo com sucesso.';
        save.textContent='SALVO ✓';
        setTimeout(()=>{save.disabled=false;save.textContent='SALVAR PERFIL';},1500);
      } catch(e) { msg.textContent='Não foi possível salvar agora. Tente novamente.'; save.disabled=false; save.textContent='SALVAR PERFIL'; }
    });

    const up = root.querySelector('#sd-upgrade-vip');
    if (up) up.addEventListener('click',async()=>{
      up.disabled=true; up.textContent='GERANDO PIX…';
      try {
        const sb=ensureClient();
        const { data,error } = await sb.functions.invoke('asaas-create-support-payment',{body:{tier:'vip',method:'pix',upgradeFromSupportId:dataModel.currentSupport.id}});
        if (error || !data || !data.ok || !data.pix) throw new Error('upgrade_failed');
        upgradeData=data; schedule(false);
      } catch(e) { up.disabled=false; up.textContent='TENTAR NOVAMENTE'; }
    });
    const copy = root.querySelector('#sd-copy-pix');
    if (copy) copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(upgradeData.pix.payload);copy.textContent='PIX COPIADO ✓';}catch(e){}});
    const refresh = root.querySelector('#sd-refresh-vip');
    if (refresh) refresh.addEventListener('click',async()=>{refresh.textContent='ATUALIZANDO…';await loadData(true);if(dataModel.vipAccess)upgradeData=null;schedule(false);});
  }

  async function render(force=false){
    if (rendering) return;
    const nav = findNav();
    if (!nav) return;
    const shell = shellFor(nav);
    if (!shell) return;
    rendering=true;
    try {
      bindNav(nav);
      if (!currentRoute) currentRoute=inferRoute(shell);
      ensureCss();
      let root=shell.querySelector('#surto-supporter-real-v2');
      if (!root){
        root=document.createElement('div');
        root.id='surto-supporter-real-v2';
        shell.appendChild(root);
      }
      Array.from(shell.children).forEach(ch=>{if(ch!==nav&&ch!==root)ch.style.display='none';});
      root.style.display='block';

      const alreadyHasRealContent = !!dataModel && root.childElementCount > 0;
      if (!alreadyHasRealContent) {
        root.innerHTML=empty('Carregando sua área','Buscando seus dados reais no Clube do Surto...');
      }

      const m=await loadData(force);
      root.innerHTML=htmlFor(currentRoute,m);
      bindRoot(root);
      document.documentElement.dataset.surtoDashboard='v2-real';
    } catch(e) {
      const root=shell.querySelector('#surto-supporter-real-v2');
      if(root && !dataModel)root.innerHTML=empty('Não conseguimos carregar sua área','Atualize a página. Seu pagamento não foi perdido.');
      console.error('[O Surto Artificial] supporter dashboard v2',e);
    } finally { rendering=false; }
  }

  function schedule(force=false){
    clearTimeout(timer);
    timer=setTimeout(()=>render(force),45);
  }

  function boot(){
    ensureCss();

    const checkStructure = () => {
      const nav = findNav();
      if (!nav) {
        lastNav = null;
        return;
      }
      if (nav !== lastNav) {
        lastNav = nav;
        schedule(false);
      }
    };

    const obs=new MutationObserver(mutations=>{
      if (rendering) return;
      const root=document.getElementById('surto-supporter-real-v2');
      const relevant=mutations.some(m=>!root || !root.contains(m.target));
      if (relevant) checkStructure();
    });
    obs.observe(document.documentElement,{subtree:true,childList:true});

    checkStructure();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
