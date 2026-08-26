(() => {
  "use strict";
  if (window.__surtoRealSupporterDashboardV1) return;
  window.__surtoRealSupporterDashboardV1 = true;

  const SB_URL = "https://ndfchglutpnbckpcrppy.supabase.co";
  const SB_KEY = "sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C";
  const AUTH_KEY = "sb-ndfchglutpnbckpcrppy-auth-token";
  const TIER_RANK = { free: 0, supporter: 1, highlight: 2, vip: 3 };
  const TIER_MIN = { free: 1, supporter: 50, highlight: 100, vip: 300 };
  const TIER_LABEL = { free: "APOIO LIVRE", supporter: "APOIADOR", highlight: "APOIADOR DESTAQUE", vip: "APOIADOR VIP" };
  const STATUS_LABEL = {
    waiting_profile: "aguardando perfil",
    waiting_avatar: "aguardando avatar",
    queued: "na fila",
    estimated: "previsão definida",
    confirmed: "confirmada",
    in_production: "em produção",
    published: "publicada",
    reprogrammed: "reprogramada",
    cancelled: "cancelada"
  };

  let model = null;
  let modelUserId = null;
  let loading = false;
  let route = null;
  let upgradePix = null;
  let renderTimer = null;
  let observer = null;
  let rendering = false;

  const esc = (v) => String(v == null ? "" : v)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
  const dateBR = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
  };
  const monthYearBR = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
  };

  function storedSession() {
    try {
      let raw = localStorage.getItem(AUTH_KEY);
      if (!raw) {
        const k = Object.keys(localStorage).find(x => x.startsWith("sb-ndfchglutpnbckpcrppy") && x.includes("auth-token"));
        if (k) raw = localStorage.getItem(k);
      }
      if (!raw) return null;
      const x = JSON.parse(raw);
      if (x && x.access_token && x.user) return x;
      if (x && x.currentSession && x.currentSession.access_token) return x.currentSession;
      return null;
    } catch (_) { return null; }
  }

  async function request(path, options = {}) {
    const session = storedSession();
    if (!session || !session.access_token) throw new Error("not_authenticated");
    const headers = {
      apikey: SB_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    const res = await fetch(SB_URL + path, { ...options, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`request_${res.status}:${text}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function loadModel(force = false) {
    const session = storedSession();
    const user = session && session.user;
    if (!user) { model = null; modelUserId = null; return null; }
    if (!force && model && modelUserId === user.id) return model;
    if (loading) return model;
    loading = true;
    try {
      const uid = encodeURIComponent(user.id);
      const [supports, profiles, publicity, subscriptions] = await Promise.all([
        request(`/rest/v1/supports?user_id=eq.${uid}&select=id,user_id,production_id,tier,billing_mode,amount,minimum_amount,payment_status,payment_provider,provider_payment_id,paid_at,created_at,updated_at&order=created_at.desc`),
        request(`/rest/v1/profiles?id=eq.${uid}&select=*`),
        request(`/rest/v1/publicity_profiles?user_id=eq.${uid}&select=*`),
        request(`/rest/v1/subscriptions?user_id=eq.${uid}&select=*&order=created_at.desc`)
      ]);

      const allSupports = Array.isArray(supports) ? supports : [];
      const paid = allSupports.filter(s => s.payment_status === "paid");
      const history = allSupports.filter(s => s.payment_status === "paid" || s.payment_status === "pending");
      const ranked = [...paid].sort((a, b) => {
        const rd = (TIER_RANK[b.tier] ?? -1) - (TIER_RANK[a.tier] ?? -1);
        return rd || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
      const active = ranked[0] || null;
      const paidIds = paid.map(x => x.id);

      let appearances = [];
      if (paidIds.length) {
        const f = encodeURIComponent(`in.(${paidIds.join(",")})`);
        appearances = await request(`/rest/v1/appearances?support_id=${f}&select=*&order=created_at.desc`);
        if (!Array.isArray(appearances)) appearances = [];
      }

      const episodeIds = [...new Set(appearances.map(a => a.episode_id).filter(Boolean))];
      let episodes = [];
      if (episodeIds.length) {
        const f = encodeURIComponent(`in.(${episodeIds.join(",")})`);
        episodes = await request(`/rest/v1/episodes?id=${f}&select=id,production_id,episode_number,scheduled_date,published_at,instagram_url,tiktok_url,youtube_url&order=episode_number.desc`);
        if (!Array.isArray(episodes)) episodes = [];
      }

      const productionIds = [...new Set(allSupports.map(s => s.production_id).filter(Boolean))];
      let productions = [];
      if (productionIds.length) {
        const f = encodeURIComponent(`in.(${productionIds.join(",")})`);
        productions = await request(`/rest/v1/productions?id=${f}&select=id,title,status,is_current`);
        if (!Array.isArray(productions)) productions = [];
      }

      const profile = Array.isArray(profiles) ? profiles[0] || null : null;
      const pub = Array.isArray(publicity) ? publicity[0] || null : null;
      const subRows = Array.isArray(subscriptions) ? subscriptions : [];
      const activeSubscription = subRows.find(s => s.status === "active") || null;
      const prodMap = Object.fromEntries(productions.map(p => [p.id, p]));
      const epMap = Object.fromEntries(episodes.map(e => [e.id, e]));
      const supportMap = Object.fromEntries(allSupports.map(s => [s.id, s]));

      appearances = appearances.map(a => ({ ...a, episode: a.episode_id ? epMap[a.episode_id] || null : null, support: supportMap[a.support_id] || null }));
      history.forEach(s => { s.production = s.production_id ? prodMap[s.production_id] || null : null; });

      const earliestPaid = [...paid].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0] || null;
      const recognizedCredit = active ? Math.max(Number(active.amount || 0), Number(TIER_MIN[active.tier] || 0)) : 0;

      model = {
        user,
        profile,
        publicity: pub,
        subscriptions: subRows,
        activeSubscription,
        supports: history,
        paidSupports: paid,
        active,
        appearances,
        episodes,
        productions,
        memberSince: earliestPaid ? earliestPaid.created_at : profile?.created_at || user.created_at,
        vipAccess: !!active && active.tier === "vip",
        recognizedCredit,
        vipUpgradeDue: active && active.tier !== "vip" ? Math.max(0, 300 - recognizedCredit) : 0
      };
      modelUserId = user.id;
      return model;
    } finally { loading = false; }
  }

  function findAppNav() {
    const all = Array.from(document.querySelectorAll("div"));
    const node = all.find(el => el.children.length === 0 && (el.textContent || "").trim().toUpperCase() === "MEUS APOIOS");
    if (!node) return null;
    let p = node.parentElement;
    while (p && p !== document.body) {
      const t = (p.textContent || "").toUpperCase();
      if (t.includes("INÍCIO") && t.includes("MEUS APOIOS") && t.includes("ÁREA VIP") && t.includes("SAIR")) return p;
      p = p.parentElement;
    }
    return null;
  }

  const ROUTES = {
    "INÍCIO": "home", "MEUS APOIOS": "apoios", "MINHAS APARIÇÕES": "aparicoes",
    "PERFIL DE DIVULGAÇÃO": "perfil", "MINHA ASSINATURA": "assinatura",
    "MEUS EPISÓDIOS": "episodios", "ÁREA VIP": "vip"
  };

  function inferRoute(shell) {
    const h = Array.from(shell.querySelectorAll("h1")).find(x => x.closest("#surto-real-supporter") == null);
    const txt = h ? (h.textContent || "").trim().toLowerCase() : "";
    if (txt.includes("meus apoios")) return "apoios";
    if (txt.includes("minhas aparições")) return "aparicoes";
    if (txt.includes("perfil de divulgação")) return "perfil";
    if (txt.includes("minha assinatura")) return "assinatura";
    if (txt.includes("meus episódios")) return "episodios";
    if (txt.includes("área vip")) return "vip";
    return route || "home";
  }

  function bindNav(nav) {
    Array.from(nav.querySelectorAll("div")).forEach(el => {
      const label = (el.textContent || "").trim().toUpperCase();
      const r = ROUTES[label];
      if (!r || el.dataset.surtoRealBound) return;
      el.dataset.surtoRealBound = "1";
      el.addEventListener("click", () => {
        route = r;
        upgradePix = null;
        setTimeout(() => schedule(true), 70);
      }, true);
    });
  }

  function gotoApp(label) {
    const nav = findAppNav();
    if (!nav) return;
    const target = Array.from(nav.querySelectorAll("div")).find(el => (el.textContent || "").trim().toUpperCase() === label);
    if (target) target.click();
  }

  function card(title, body, extra = "") {
    return `<section class="sr-card ${extra}"><div class="sr-kicker">${esc(title)}</div>${body}</section>`;
  }

  function empty(title, text, action = "") {
    return `<div class="sr-empty"><div class="sr-empty-title">${esc(title)}</div><p>${esc(text)}</p>${action}</div>`;
  }

  function activeAppearance(m) {
    const list = (m.appearances || []).filter(a => a.status !== "cancelled");
    const order = { published: 99, in_production: 8, confirmed: 7, estimated: 6, queued: 5, waiting_avatar: 4, waiting_profile: 3, reprogrammed: 2 };
    return [...list].sort((a,b) => (order[b.status]||0)-(order[a.status]||0))[0] || null;
  }

  function homeHtml(m) {
    if (!m.active) return empty("Você ainda não possui nenhum apoio pago", "Escolha uma forma de apoio para liberar os recursos da sua Área do Apoiador.", `<button class="sr-btn" data-public-club>CONHECER AS FORMAS DE APOIO →</button>`);
    const a = m.active;
    const ap = activeAppearance(m);
    const name = m.publicity?.display_name || m.profile?.display_name || (m.user.email ? m.user.email.split("@")[0] : "APOIADOR");
    const planValue = TIER_MIN[a.tier] || Number(a.amount || 0);
    const profileMissing = !m.publicity || !m.publicity.display_name || !m.publicity.social_network || !m.publicity.social_handle || !m.publicity.social_url;

    let appearanceBody;
    if (!ap) {
      appearanceBody = `<h2>AINDA NÃO HÁ APARIÇÃO AGENDADA</h2><p>Seu apoio está confirmado. Quando a produção criar sua entrada na fila, ela aparecerá aqui.</p>`;
    } else if (ap.status === "waiting_profile") {
      appearanceBody = `<span class="sr-status cyan">AGUARDANDO PERFIL</span><h2>COMPLETE SEU PERFIL DE DIVULGAÇÃO</h2><p>Seu apoio já está confirmado. Precisamos dos seus dados de divulgação antes de avançar para avatar e fila.</p><button class="sr-btn secondary" data-goto="PERFIL DE DIVULGAÇÃO">PREENCHER PERFIL →</button>`;
    } else {
      const ep = ap.episode ? `EPISÓDIO ${ap.episode.episode_number}` : (ap.estimated_episode_number ? `EPISÓDIO ${ap.estimated_episode_number}` : "EPISÓDIO A DEFINIR");
      const when = ap.episode?.scheduled_date || ap.estimated_date;
      appearanceBody = `<span class="sr-status cyan">${esc(STATUS_LABEL[ap.status] || ap.status)}</span><h2>${esc(ep)}</h2><p>${when ? dateBR(when) : "A produção ainda não definiu uma data."}</p>`;
    }

    const hero = `<section class="sr-hero"><div class="sr-kicker red">CLUBE DO SURTO</div><div class="sr-muted">Bem-vindo de volta,</div><h1>${esc(name)}</h1><div class="sr-badges"><span>${esc(TIER_LABEL[a.tier] || a.tier)}</span><span>${a.billing_mode === "recurring" ? "ASSINATURA MENSAL" : "APOIO AVULSO"}</span><span class="cyan">● CONTA ATIVA</span></div><p>Aqui você acompanha somente os dados reais do seu apoio, perfil e aparição.</p></section>`;

    const plan = card("MEU PLANO", `<h3>${esc(TIER_LABEL[a.tier] || a.tier)}</h3><div class="sr-money">${brl(planValue)}</div><div class="sr-list"><div><span>Situação</span><b>apoio confirmado</b></div><div><span>Modalidade</span><b>${a.billing_mode === "recurring" ? "mensal" : "apoio avulso"}</b></div><div><span>Membro desde</span><b>${esc(monthYearBR(m.memberSince))}</b></div></div>${a.tier !== "vip" ? `<button class="sr-btn outline" data-goto="ÁREA VIP">FAZER UPGRADE</button>` : ""}`);
    const next = card("SUA PRÓXIMA APARIÇÃO", appearanceBody, "accent");
    const profileCall = profileMissing ? card("PRÓXIMO PASSO", `<h3>Perfil de divulgação incompleto</h3><p>Preencha nome, rede social, @ e link para a produção conseguir avançar sua participação.</p><button class="sr-btn secondary" data-goto="PERFIL DE DIVULGAÇÃO">COMPLETAR PERFIL →</button>`) : "";
    return hero + `<div class="sr-grid two">${next}${plan}</div>${profileCall}`;
  }

  function apoiosHtml(m) {
    const rows = m.supports || [];
    if (!rows.length) return `<h1 class="sr-title">Meus Apoios</h1>` + empty("Nenhum apoio encontrado", "Quando você iniciar ou concluir um apoio, ele aparecerá aqui.");
    const body = rows.map(s => {
      const ap = (m.appearances || []).find(a => a.support_id === s.id && a.status !== "cancelled");
      const ep = ap?.episode ? `EP ${ap.episode.episode_number}` : ap?.estimated_episode_number ? `EP ${ap.estimated_episode_number}` : "—";
      const status = s.payment_status === "paid" ? "pago" : "aguardando pagamento";
      return `<tr><td>${dateBR(s.created_at)}</td><td>${esc(TIER_LABEL[s.tier] || s.tier)}</td><td>${s.billing_mode === "recurring" ? "mensal" : "avulso"}</td><td>${brl(s.amount)}</td><td><span class="sr-status ${s.payment_status === "paid" ? "cyan" : ""}">${status}</span></td><td>${esc(ep)}</td></tr>`;
    }).join("");
    return `<h1 class="sr-title">Meus Apoios</h1><p class="sr-lead">Aqui aparecem apenas cobranças reais pagas ou ainda aguardando pagamento. Tentativas que falharam não entram no seu histórico.</p><div class="sr-table-wrap"><table class="sr-table"><thead><tr><th>Data</th><th>Categoria</th><th>Modalidade</th><th>Valor pago</th><th>Status</th><th>Aparição</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function aparicoesHtml(m) {
    const rows = (m.appearances || []).filter(a => a.status !== "cancelled");
    if (!rows.length) return `<h1 class="sr-title">Minhas Aparições</h1>` + empty("Nenhuma aparição vinculada", "Nenhum episódio ou data foi programado para você ainda.");
    return `<h1 class="sr-title">Minhas Aparições</h1><p class="sr-lead">Só mostramos aqui etapas e episódios realmente registrados pela produção.</p><div class="sr-grid cards">${rows.map(a => {
      const cat = a.support ? TIER_LABEL[a.support.tier] || a.support.tier : "Apoio";
      const ep = a.episode ? `EPISÓDIO ${a.episode.episode_number}` : a.estimated_episode_number ? `EPISÓDIO ${a.estimated_episode_number}` : "EPISÓDIO A DEFINIR";
      const dt = a.episode?.scheduled_date || a.estimated_date;
      return card(cat, `<span class="sr-status cyan">${esc(STATUS_LABEL[a.status] || a.status)}</span><h3>${esc(ep)}</h3><p>${dt ? dateBR(dt) : "Sem data definida."}</p>${a.published_url ? `<a class="sr-link" href="${esc(a.published_url)}" target="_blank" rel="noopener">VER PUBLICAÇÃO →</a>` : ""}`);
    }).join("")}</div>`;
  }

  function perfilHtml(m) {
    const p = m.publicity || {};
    const fallbackName = m.profile?.display_name || (m.user.email ? m.user.email.split("@")[0] : "");
    return `<h1 class="sr-title">Meu Perfil de Divulgação</h1><p class="sr-lead">Você pode alterar todos os dados abaixo. Eles serão usados nas suas futuras aparições.</p><div class="sr-form sr-card"><div class="sr-field"><label>Nome de divulgação</label><input id="sr-display-name" value="${esc(p.display_name || fallbackName)}" placeholder="Como você quer ser identificado"></div><div class="sr-field"><label>Rede social</label><select id="sr-network"><option value="">Selecione</option>${["Instagram","TikTok","YouTube","X / Twitter","Facebook","Outra"].map(x => `<option ${p.social_network === x ? "selected" : ""}>${x}</option>`).join("")}</select></div><div class="sr-field"><label>@ na divulgação</label><input id="sr-handle" value="${esc(p.social_handle || "")}" placeholder="@seuperfil"></div><div class="sr-field"><label>Link do perfil</label><input id="sr-url" value="${esc(p.social_url || "")}" placeholder="https://..."></div><label class="sr-check"><input id="sr-consent" type="checkbox" ${p.public_consent ? "checked" : ""}> Autorizo a exibição destes dados nas divulgações e no mural de apoiadores.</label><div id="sr-profile-msg" class="sr-msg"></div><button id="sr-save-profile" class="sr-btn">SALVAR PERFIL</button></div>`;
  }

  function assinaturaHtml(m) {
    const s = m.activeSubscription;
    if (!s) return `<h1 class="sr-title">Minha Assinatura</h1>` + empty("Você não possui assinatura ativa", "Seu apoio atual é avulso. Nenhuma data de renovação ou cobrança mensal será exibida até existir uma assinatura real.");
    return `<h1 class="sr-title">Minha Assinatura</h1>${card("ASSINATURA ATIVA", `<h3>${esc(TIER_LABEL[s.tier] || s.tier)}</h3><div class="sr-money">${brl(s.amount)} / mês</div><div class="sr-list"><div><span>Status</span><b>${esc(s.status)}</b></div><div><span>Início</span><b>${dateBR(s.started_at || s.created_at)}</b></div><div><span>Próxima cobrança</span><b>${dateBR(s.next_due_date)}</b></div></div>`)}`;
  }

  function episodiosHtml(m) {
    const rows = (m.appearances || []).filter(a => a.episode && a.status === "published");
    if (!rows.length) return `<h1 class="sr-title">Meus Episódios</h1>` + empty("Nenhum episódio publicado com sua participação", "Quando uma aparição sua for publicada e vinculada a um episódio real, ela aparecerá aqui.");
    return `<h1 class="sr-title">Meus Episódios</h1><div class="sr-grid cards">${rows.map(a => {
      const e = a.episode;
      const links = [e.instagram_url && `<a class="sr-link" href="${esc(e.instagram_url)}" target="_blank">Instagram</a>`,e.tiktok_url && `<a class="sr-link" href="${esc(e.tiktok_url)}" target="_blank">TikTok</a>`,e.youtube_url && `<a class="sr-link" href="${esc(e.youtube_url)}" target="_blank">YouTube</a>`].filter(Boolean).join(" · ");
      return card("PUBLICADO", `<h3>EPISÓDIO ${esc(e.episode_number)}</h3><p>${dateBR(e.published_at || e.scheduled_date)}</p><div>${links || "Sem link cadastrado."}</div>`);
    }).join("")}</div>`;
  }

  function vipHtml(m) {
    if (m.vipAccess) return `<h1 class="sr-title">Área VIP</h1>${card("ACESSO VIP LIBERADO", `<h2>VOCÊ É APOIADOR VIP</h2><p>Sua área exclusiva está ativa. O briefing da cena e o acompanhamento da produção aparecerão aqui quando forem cadastrados pela equipe.</p><div class="sr-list"><div><span>Aparição</span><b>individual</b></div><div><span>Cena</span><b>personalizada</b></div><div><span>Prioridade</span><b>máxima</b></div></div>`, "vip")}`;
    const a = m.active;
    const credit = a ? Math.min(300, m.recognizedCredit || 0) : 0;
    const due = Math.max(0, 300 - credit);
    if (upgradePix && upgradePix.pix) {
      return `<h1 class="sr-title">Upgrade para Apoiador VIP</h1><div class="sr-grid two">${card("RESUMO DO UPGRADE", `<div class="sr-list"><div><span>Plano VIP</span><b>${brl(300)}</b></div><div><span>Crédito do seu apoio atual</span><b>− ${brl(credit)}</b></div><div><span>Total do upgrade</span><b class="cyan-text">${brl(upgradePix.amount || due)}</b></div></div>`)}${card("PAGAMENTO PIX", `<div class="sr-pix"><img src="data:image/png;base64,${esc(upgradePix.pix.encodedImage)}" alt="QR Code Pix"><div><p>Escaneie o QR Code ou copie o código Pix.</p><button class="sr-btn secondary" id="sr-copy-upgrade">COPIAR PIX</button><button class="sr-btn outline" id="sr-refresh-upgrade">JÁ PAGUEI · ATUALIZAR STATUS</button></div></div>`)}</div>`;
    }
    return `<h1 class="sr-title">Área VIP</h1>${card("ACESSO RESTRITO", `<h2>VOCÊ NÃO TEM ACESSO À ÁREA VIP</h2><p>Para se tornar um apoiador VIP, ter sua aparição sozinho e ainda o apoio da equipe do Surto para sua cena, faça o upgrade.</p>${a ? `<div class="sr-credit"><span>Plano VIP</span><b>${brl(300)}</b><span>Crédito do seu apoio atual</span><b>− ${brl(credit)}</b><span>Você paga agora</span><strong>${brl(due)}</strong></div><button class="sr-btn vipbtn" id="sr-upgrade-vip">FAZER UPGRADE PARA VIP · ${brl(due)}</button>` : `<button class="sr-btn vipbtn" data-public-club>CONHECER O APOIADOR VIP →</button>`}`, "vip")}`;
  }

  function renderContent(r, m) {
    if (!m) return empty("Carregando sua área", "Buscando seus dados reais no Clube do Surto...");
    if (r === "apoios") return apoiosHtml(m);
    if (r === "aparicoes") return aparicoesHtml(m);
    if (r === "perfil") return perfilHtml(m);
    if (r === "assinatura") return assinaturaHtml(m);
    if (r === "episodios") return episodiosHtml(m);
    if (r === "vip") return vipHtml(m);
    return homeHtml(m);
  }

  async function saveProfile(root) {
    const btn = root.querySelector("#sr-save-profile");
    const msg = root.querySelector("#sr-profile-msg");
    if (!btn) return;
    const display_name = root.querySelector("#sr-display-name")?.value.trim() || "";
    const social_network = root.querySelector("#sr-network")?.value.trim() || "";
    const social_handle = root.querySelector("#sr-handle")?.value.trim() || "";
    const social_url = root.querySelector("#sr-url")?.value.trim() || "";
    const public_consent = !!root.querySelector("#sr-consent")?.checked;
    if (!display_name || !social_network || !social_handle || !social_url) {
      if (msg) msg.textContent = "Preencha nome, rede social, @ e link antes de salvar.";
      return;
    }
    btn.disabled = true; btn.textContent = "SALVANDO…";
    try {
      const uid = model.user.id;
      const payload = { user_id: uid, display_name, social_network, social_handle, social_url, public_consent, information_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const saved = await request(`/rest/v1/publicity_profiles?on_conflict=user_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) });
      model.publicity = Array.isArray(saved) ? saved[0] || payload : payload;
      if (msg) { msg.textContent = "Perfil salvo com sucesso."; msg.classList.add("ok"); }
      btn.textContent = "SALVO ✓";
      setTimeout(() => { btn.disabled = false; btn.textContent = "SALVAR PERFIL"; }, 1600);
    } catch (_) {
      if (msg) msg.textContent = "Não foi possível salvar agora. Tente novamente.";
      btn.disabled = false; btn.textContent = "SALVAR PERFIL";
    }
  }

  async function startVipUpgrade(root) {
    if (!model?.active || model.active.tier === "vip") return;
    const btn = root.querySelector("#sr-upgrade-vip");
    if (btn) { btn.disabled = true; btn.textContent = "GERANDO PIX…"; }
    try {
      const session = storedSession();
      const res = await fetch(`${SB_URL}/functions/v1/asaas-create-support-payment`, {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "vip", method: "pix", upgradeFromSupportId: model.active.id })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.pix) throw new Error("upgrade_failed");
      upgradePix = data;
      schedule(true);
    } catch (_) {
      if (btn) { btn.disabled = false; btn.textContent = `TENTAR NOVAMENTE · ${brl(model.vipUpgradeDue)}`; }
      const note = document.createElement("div");
      note.className = "sr-msg"; note.textContent = "Não conseguimos gerar o Pix do upgrade agora.";
      btn?.parentElement?.appendChild(note);
    }
  }

  function bindRoot(root) {
    root.querySelectorAll("[data-goto]").forEach(el => el.addEventListener("click", () => gotoApp(el.dataset.goto), { once: true }));
    root.querySelectorAll("[data-public-club]").forEach(el => el.addEventListener("click", () => {
      const link = Array.from(document.querySelectorAll("div")).find(x => x.children.length === 0 && (x.textContent || "").trim().toUpperCase() === "CLUBE DO SURTO");
      if (link) link.click();
    }, { once: true }));
    root.querySelector("#sr-save-profile")?.addEventListener("click", () => saveProfile(root));
    root.querySelector("#sr-upgrade-vip")?.addEventListener("click", () => startVipUpgrade(root));
    root.querySelector("#sr-copy-upgrade")?.addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(upgradePix.pix.payload); e.currentTarget.textContent = "PIX COPIADO ✓"; } catch (_) {}
    });
    root.querySelector("#sr-refresh-upgrade")?.addEventListener("click", async (e) => {
      e.currentTarget.textContent = "ATUALIZANDO…";
      await loadModel(true);
      if (model?.vipAccess) { upgradePix = null; route = "vip"; }
      schedule(true);
    });
  }

  function ensureCss() {
    if (document.getElementById("surto-real-dashboard-css")) return;
    const s = document.createElement("style");
    s.id = "surto-real-dashboard-css";
    s.textContent = `
      #surto-real-supporter{padding:0 0 30px;color:#F5F5F5;font-family:Inter,system-ui,sans-serif}
      #surto-real-supporter *{box-sizing:border-box} .sr-title{font:400 clamp(34px,5vw,56px)/.95 'Bebas Neue',Inter,sans-serif;letter-spacing:.01em;margin:22px 0 8px}.sr-lead{margin:0 0 22px;color:rgba(245,245,245,.58);font-size:14px;line-height:1.6;max-width:760px}.sr-hero{position:relative;overflow:hidden;border-radius:14px;margin-bottom:16px;padding:clamp(28px,4vw,44px);background:linear-gradient(115deg,rgba(0,229,255,.08),#10131a 48%,rgba(229,9,20,.13));box-shadow:0 0 0 1px rgba(245,245,245,.09)}.sr-hero h1{font:400 clamp(48px,7vw,78px)/.88 'Bebas Neue',Inter,sans-serif;margin:5px 0 18px}.sr-hero p,.sr-card p{color:rgba(245,245,245,.58);font-size:13px;line-height:1.55}.sr-muted{color:rgba(245,245,245,.55);font-size:13px}.sr-kicker{font-size:9.5px;letter-spacing:.24em;color:#00E5FF;margin-bottom:15px}.sr-kicker.red{color:#E50914}.sr-card{background:#111418;border-radius:12px;padding:22px;box-shadow:0 0 0 1px rgba(245,245,245,.10);min-width:0}.sr-card.accent{background:linear-gradient(120deg,rgba(0,229,255,.09),#111418);box-shadow:0 0 0 1px rgba(0,229,255,.38)}.sr-card.vip{background:linear-gradient(125deg,rgba(181,171,252,.12),#111418 55%,rgba(229,9,20,.09));box-shadow:0 0 0 1px rgba(181,171,252,.35)}.sr-card h2{font:400 clamp(34px,5vw,58px)/.95 'Bebas Neue',Inter,sans-serif;margin:12px 0}.sr-card h3{font:400 30px/1 'Bebas Neue',Inter,sans-serif;margin:8px 0}.sr-grid{display:grid;gap:16px;margin-bottom:16px}.sr-grid.two{grid-template-columns:minmax(0,1.7fr) minmax(280px,.9fr)}.sr-grid.cards{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}.sr-badges{display:flex;gap:9px;flex-wrap:wrap}.sr-badges span,.sr-status{display:inline-flex;border-radius:999px;padding:6px 11px;box-shadow:0 0 0 1px rgba(245,245,245,.14);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:rgba(245,245,245,.65)}.sr-badges .cyan,.sr-status.cyan{color:#00E5FF;box-shadow:0 0 0 1px rgba(0,229,255,.35);background:rgba(0,229,255,.07)}.sr-money{font:400 31px/1 'Bebas Neue',Inter,sans-serif;color:#00E5FF;margin:7px 0 18px}.sr-list{display:grid;gap:0;margin:12px 0 18px;border-top:1px solid rgba(245,245,245,.08)}.sr-list>div{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid rgba(245,245,245,.08);font-size:12px}.sr-list span{color:rgba(245,245,245,.45)}.sr-list b{font-weight:500;text-align:right}.cyan-text{color:#00E5FF}.sr-btn{border:0;border-radius:7px;background:#E50914;color:#fff;min-height:46px;padding:0 19px;font:600 11px Inter,sans-serif;letter-spacing:.12em;cursor:pointer}.sr-btn:disabled{opacity:.55;cursor:wait}.sr-btn.secondary{background:#00E5FF;color:#071015}.sr-btn.outline{background:transparent;box-shadow:inset 0 0 0 1px #E50914}.sr-btn.vipbtn{background:linear-gradient(90deg,#E50914,#a90f82);width:100%;margin-top:12px}.sr-empty{border-radius:12px;padding:34px;background:#111418;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sr-empty-title{font:400 32px/1 'Bebas Neue',Inter,sans-serif;margin-bottom:8px}.sr-empty p{color:rgba(245,245,245,.55);line-height:1.6;margin:0 0 18px}.sr-table-wrap{overflow:auto;border-radius:10px;box-shadow:0 0 0 1px rgba(245,245,245,.10)}.sr-table{width:100%;border-collapse:collapse;min-width:760px;background:#111418;font-size:12px}.sr-table th,.sr-table td{padding:14px 15px;text-align:left;border-bottom:1px solid rgba(245,245,245,.07)}.sr-table th{color:rgba(245,245,245,.45);font-size:9px;letter-spacing:.14em;text-transform:uppercase}.sr-form{max-width:720px;display:grid;gap:15px}.sr-field{display:grid;gap:7px}.sr-field label,.sr-check{font-size:11px;color:rgba(245,245,245,.58)}.sr-field input,.sr-field select{width:100%;height:44px;border:0;border-radius:7px;padding:0 12px;background:#0B0D13;color:#F5F5F5;box-shadow:inset 0 0 0 1px rgba(245,245,245,.16);font:13px Inter,sans-serif}.sr-check{display:flex;align-items:flex-start;gap:9px;line-height:1.45}.sr-msg{color:#ff7b82;font-size:12px}.sr-msg.ok{color:#00E5FF}.sr-link{color:#00E5FF;text-decoration:none;font-size:11px;letter-spacing:.08em}.sr-credit{display:grid;grid-template-columns:1fr auto;gap:10px 18px;margin:20px 0;padding:16px;border-radius:9px;background:#0B0D13;box-shadow:inset 0 0 0 1px rgba(245,245,245,.10);font-size:12px}.sr-credit span{color:rgba(245,245,245,.5)}.sr-credit strong{font:400 27px/1 'Bebas Neue';color:#00E5FF}.sr-pix{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:center}.sr-pix img{width:150px;height:150px;object-fit:contain;background:white;padding:7px;border-radius:8px}.sr-pix .sr-btn{display:block;width:100%;margin-top:9px}
      @media(max-width:820px){.sr-grid.two{grid-template-columns:1fr}.sr-pix{grid-template-columns:1fr}.sr-pix img{width:180px;height:180px}.sr-hero{padding:26px}.sr-table{min-width:680px}}
    `;
    document.head.appendChild(s);
  }

  async function render(forceLoad = false) {
    if (rendering) return;
    const nav = findAppNav();
    if (!nav) return;
    const shell = nav.parentElement;
    if (!shell) return;
    bindNav(nav);
    if (!route) route = inferRoute(shell);
    ensureCss();

    rendering = true;
    try {
      let root = shell.querySelector("#surto-real-supporter");
      if (!root) { root = document.createElement("div"); root.id = "surto-real-supporter"; shell.appendChild(root); }
      Array.from(shell.children).forEach(ch => { if (ch !== nav && ch !== root) ch.style.display = "none"; });
      root.style.display = "block";
      if (!model || forceLoad) root.innerHTML = empty("Carregando sua área", "Buscando seus dados reais no Clube do Surto...");
      await loadModel(forceLoad);
      root.innerHTML = renderContent(route, model);
      bindRoot(root);
    } catch (e) {
      const root = shell.querySelector("#surto-real-supporter");
      if (root) root.innerHTML = empty("Não conseguimos carregar sua área", "Atualize a página. Se continuar, o suporte consegue verificar o acesso sem perder seu pagamento.");
      console.error("[O Surto Artificial] dashboard real", e);
    } finally { rendering = false; }
  }

  function schedule(force = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => render(force), 45);
  }

  function boot() {
    ensureCss();
    if (!observer) {
      observer = new MutationObserver(() => schedule(false));
      observer.observe(document.documentElement, { subtree: true, childList: true });
    }
    setInterval(() => {
      const session = storedSession();
      if (!session?.user) { model = null; modelUserId = null; route = null; return; }
      if (findAppNav()) schedule(false);
    }, 700);
    schedule(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
