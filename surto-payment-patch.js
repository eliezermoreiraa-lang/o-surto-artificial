/* @ds-bundle: {"format":4,"namespace":"Nocturne_noctur","components":[],"sourceHashes":{},"inlinedExternals":[],"unexposedExports":[]} */

(() => {
const __ds_ns = (window.Nocturne_noctur = window.Nocturne_noctur || {});
const __ds_scope = {};
(__ds_ns.__errors = __ds_ns.__errors || []);

(function applySurtoProductionPatchV4() {
  if (window.__surtoProductionPatchV4) return;

  const patch = () => {
    if (!window.__dcUpdate || !window.__dcRootName) {
      setTimeout(patch, 30);
      return;
    }

    const scriptEl = document.querySelector('script[data-dc-script]');
    if (!scriptEl || !scriptEl.textContent) return;

    let src = scriptEl.textContent;
    let changed = false;

    /* Asaas Sandbox: cobrança real + QR Code Pix dentro do site */
    if (!src.includes("asaas-create-support-payment")) {
      const stateOld = "    pay: 'idle', demo: 'fila', perfilOk: false,\n    cupom: '', cupomOk: false, admTab: 'todos', admSel: null, toast: null, vip: 'pendente',";
      const stateNew = "    pay: 'idle', demo: 'fila', perfilOk: false,\n    payBusy: false, payErrMsg: null, payReal: false, payUrl: null, pixImage: null, pixPayload: null, pixExpires: null,\n    cupom: '', cupomOk: false, admTab: 'todos', admSel: null, toast: null, vip: 'pendente',";

      const method = `  renderPixDom() {
    const image = this.state.pixImage;
    const payload = this.state.pixPayload;
    if (!image || !payload || typeof document === 'undefined') return;
    setTimeout(() => {
      const titles = Array.from(document.querySelectorAll('div')).filter(el =>
        el.children.length === 0 && (el.textContent || '').trim() === 'QR Code Pix'
      );
      const title = titles[0];
      if (!title || !title.parentElement || !title.parentElement.parentElement) return;
      const info = title.parentElement;
      const card = info.parentElement;
      const visual = card.children && card.children[0];
      if (visual) {
        visual.innerHTML = '';
        visual.style.background = '#fff';
        visual.style.opacity = '1';
        visual.style.padding = '6px';
        visual.style.boxSizing = 'border-box';
        visual.style.display = 'grid';
        visual.style.placeItems = 'center';
        const img = document.createElement('img');
        img.alt = 'QR Code Pix';
        img.src = image.startsWith('data:') ? image : 'data:image/png;base64,' + image;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        visual.appendChild(img);
      }
      info.innerHTML = '';
      const h = document.createElement('div');
      h.textContent = 'QR Code Pix';
      h.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:5px;color:#F5F5F5';
      const p = document.createElement('div');
      p.textContent = 'QR Code gerado pelo Asaas. Escaneie ou use o Pix Copia e Cola.';
      p.style.cssText = 'font-size:11.5px;line-height:1.45;color:rgba(245,245,245,.58);margin-bottom:10px';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'COPIAR PIX';
      btn.style.cssText = 'border:0;border-radius:6px;padding:9px 12px;background:#00E5FF;color:#071015;font:600 10px Inter,sans-serif;letter-spacing:.12em;cursor:pointer';
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(payload);
          btn.textContent = 'PIX COPIADO ✓';
          setTimeout(() => { btn.textContent = 'COPIAR PIX'; }, 2200);
        } catch (e) {
          const ta = document.createElement('textarea');
          ta.value = payload;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          btn.textContent = 'PIX COPIADO ✓';
        }
      };
      info.appendChild(h);
      info.appendChild(p);
      info.appendChild(btn);
    }, 80);
  }

  async startAvulsoPayment() {
    if (this.state.payBusy || this.state.pixPayload) return;
    const s = this.state;
    const session = this._session || s.session;
    if (!session) {
      try {
        window.sessionStorage.setItem('surto-support-intent', JSON.stringify({
          tier: s.tier, caminho: s.caminho, valor: s.valor, returnRoute: 'checkout'
        }));
      } catch (e) {}
      this.setState({ authMode: 'login', authReturn: 'checkout', authErr: null, payErrMsg: null,
        authMsg: 'Entre na sua conta para concluir seu apoio.' });
      this.nav('auth');
      return;
    }
    const TIER_MAP = { livre: 'free', apoiador: 'supporter', destaque: 'highlight', vip: 'vip' };
    const MIN = { free: 1, supporter: 50, highlight: 100, vip: 300 };
    const tier = TIER_MAP[s.tier] || 'supporter';
    const escolhido = Math.round(Number(s.valor || 0));
    const amount = Math.max(escolhido, MIN[tier]);
    const method = s.metodo || 'pix';

    this.setState({ payBusy: true, payErrMsg: null, pay: 'idle', payReal: false, payUrl: null });
    try {
      const sb = await this.sb();
      if (!sb) throw new Error('client');
      const r = await sb.functions.invoke('asaas-create-support-payment', {
        body: { tier, amount, method }
      });
      const data = r.data, error = r.error;
      if (error || !data || !data.ok) throw new Error('invoke');

      if (method === 'pix') {
        const pix = data.pix;
        if (!pix || !pix.payload || !pix.encodedImage) throw new Error('pix');
        this.setState({
          payBusy: false, payErrMsg: null, payReal: false,
          payUrl: data.invoiceUrl || null,
          pixImage: pix.encodedImage, pixPayload: pix.payload, pixExpires: pix.expirationDate || null
        }, () => this.renderPixDom());
        return;
      }

      const url = data.invoiceUrl;
      if (!url) throw new Error('url');
      this.setState({ payBusy: false, payReal: true, payUrl: url, payErrMsg: null });
      let win = null;
      try { win = window.open(url, '_blank', 'noopener'); } catch (err) { win = null; }
      if (!win) { try { window.top.location.href = url; } catch (err) { window.location.href = url; } }
    } catch (e) {
      this.setState({ payBusy: false,
        payErrMsg: 'Não conseguimos gerar o Pix agora. Tente novamente em alguns instantes.' });
    }
  }

`;

      const renderOld = "      pagarLabel: metodo === 'pix' ? 'GERAR PIX' : (s.modo === 'mensal' ? 'ASSINAR ' + brl(totalNum) + '/MÊS' : 'PAGAR ' + brl(totalNum)),\n      pagar: () => { if (metodo === 'pix') { this.setState({ pay:'aguardando' }); } else { this.setState({ pay:'aprovado' }); this.nav('pago'); } },";
      const renderNew = "      pagarLabel: s.payBusy ? 'PROCESSANDO…' : (s.pixPayload ? 'PIX GERADO ✓' : (metodo === 'pix' ? 'GERAR PIX' : (s.modo === 'mensal' ? 'ASSINAR ' + brl(totalNum) + '/MÊS' : 'PAGAR ' + brl(totalNum)))),\n      pagarOpacity: (s.payBusy || !!s.pixPayload) ? .68 : 1,\n      pagarPE: (s.payBusy || !!s.pixPayload) ? 'none' : 'auto',\n      payErrMsg: s.payErrMsg,\n      payReal: !!s.payReal, payUrl: s.payUrl || '#',\n      pagar: () => {\n        if (s.modo === 'mensal') {\n          this.setState({ payErrMsg: 'A assinatura mensal ainda não está aberta. Escolha Apoio avulso para apoiar agora.' });\n          return;\n        }\n        this.startAvulsoPayment();\n      },";

      if (src.includes(stateOld)) { src = src.replace(stateOld, stateNew); changed = true; }
      if (src.includes("  nav(route) {")) { src = src.replace("  nav(route) {", method + "  nav(route) {"); changed = true; }
      if (src.includes(renderOld)) { src = src.replace(renderOld, renderNew); changed = true; }

      const methodsOld = "      ...m, pick: () => this.setState({ metodo: m.id, pay:'idle' }),";
      const methodsNew = "      ...m, pick: () => this.setState({ metodo: m.id, pay:'idle', payErrMsg:null, payReal:false, payUrl:null, pixImage:null, pixPayload:null, pixExpires:null }),";
      if (src.includes(methodsOld)) { src = src.replace(methodsOld, methodsNew); changed = true; }
    }

    const planOld = "          go: () => { this.setState({ tier: sel, caminho: sel === 'livre' ? 'livre' : 'aparecer', valor: sel === 'vip' ? 300 : sel === 'destaque' ? 100 : sel === 'apoiador' ? 50 : 25, authMode: 'cadastro', valorExtra: false }); this.nav('auth'); } };";
    const planNew = `          go: () => {
            const next = {
              tier: sel,
              caminho: sel === 'livre' ? 'livre' : 'aparecer',
              valor: sel === 'vip' ? 300 : sel === 'destaque' ? 100 : sel === 'apoiador' ? 50 : 25,
              authMode: 'cadastro', valorExtra: false, authReturn: 'modalidade',
              payErrMsg: null, payReal: false, payUrl: null, pixImage: null, pixPayload: null, pixExpires: null
            };
            this.setState(next);
            if (this._session || s.session) {
              this.setState({ authReturn: null });
              this.nav('modalidade');
              return;
            }
            try {
              window.sessionStorage.setItem('surto-support-intent', JSON.stringify({
                tier: next.tier, caminho: next.caminho, valor: next.valor, returnRoute: 'modalidade'
              }));
            } catch (e) {}
            this.nav('auth');
          } };`;
    if (src.includes(planOld)) { src = src.replace(planOld, planNew); changed = true; }

    const sessionOld = `      const r = this.state.route;
      if (oauthBack || r === 'confirmaEmail' || r === 'auth') {
        this.setState({ authErr: null, authMsg: null, pendingEmail: '' });
        this.nav('appHome');
      }`;
    const sessionNew = `      const r = this.state.route;
      if (oauthBack || r === 'confirmaEmail' || r === 'auth') {
        let supportIntent = null;
        try {
          const rawIntent = window.sessionStorage.getItem('surto-support-intent');
          if (rawIntent) supportIntent = JSON.parse(rawIntent);
          window.sessionStorage.removeItem('surto-support-intent');
        } catch (e) {}
        const returnRoute = (supportIntent && supportIntent.returnRoute) || this.state.authReturn;
        if (returnRoute === 'modalidade' || returnRoute === 'checkout') {
          const restore = supportIntent ? {
            tier: supportIntent.tier, caminho: supportIntent.caminho, valor: supportIntent.valor
          } : {};
          this.setState({ ...restore, authReturn: null, authErr: null, authMsg: null, pendingEmail: '' });
          this.nav(returnRoute);
        } else {
          this.setState({ authReturn: null, authErr: null, authMsg: null, pendingEmail: '' });
          this.nav('appHome');
        }
      }`;
    if (src.includes(sessionOld)) { src = src.replace(sessionOld, sessionNew); changed = true; }

    const signupOld = `    if (data && data.session) {
      this._session = data.session;
      this.setState({ authBusy: false, fSenha: '', fSenha2: '', authErr: null, authMsg: null });
      this.nav('appHome');
      return;
    }`;
    const signupNew = `    if (data && data.session) {
      this._session = data.session;
      const returnRoute = this.state.authReturn;
      this.setState({ authBusy: false, fSenha: '', fSenha2: '', authErr: null, authMsg: null, authReturn: null });
      this.nav(returnRoute === 'modalidade' || returnRoute === 'checkout' ? returnRoute : 'appHome');
      return;
    }`;
    if (src.includes(signupOld)) { src = src.replace(signupOld, signupNew); changed = true; }

    const loginOld = `    this.setState({ authBusy: false, fSenha: '', fSenha2: '', authErr: null, authMsg: null });
    if (data && data.session) this.nav('appHome');`;
    const loginNew = `    const returnRoute = this.state.authReturn;
    this.setState({ authBusy: false, fSenha: '', fSenha2: '', authErr: null, authMsg: null, authReturn: null });
    if (data && data.session) this.nav(returnRoute === 'modalidade' || returnRoute === 'checkout' ? returnRoute : 'appHome');`;
    if (src.includes(loginOld)) { src = src.replace(loginOld, loginNew); changed = true; }

    const entrarOld = `    const goEntrar = () => {
      if (this._session || s.session) { this.nav('appHome'); return; }
      this.setState({ authMode: 'login', authErr: null, authMsg: null });
      this.nav('auth');
    };`;
    const entrarNew = `    const goEntrar = () => {
      try { window.sessionStorage.removeItem('surto-support-intent'); } catch (e) {}
      if (this._session || s.session) { this.setState({ authReturn: null }); this.nav('appHome'); return; }
      this.setState({ authMode: 'login', authReturn: null, authErr: null, authMsg: null });
      this.nav('auth');
    };`;
    if (src.includes(entrarOld)) { src = src.replace(entrarOld, entrarNew); changed = true; }

    const flowMarker = "    const isFlow = ['caminho','planos','modalidade','previsao','auth','confirmaEmail','checkout','pago','perfil','confirmar'].includes(r);";
    const flowReplacement = `    if (r === 'appHome') {
      go.clube = () => {
        this.nav('clube');
        setTimeout(() => {
          const alvo = document.getElementById('planos-clube');
          if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 140);
      };
    }
    const isFlow = ['caminho','planos','modalidade','previsao','auth','confirmaEmail','checkout','pago','perfil','confirmar'].includes(r);`;
    if (src.includes(flowMarker)) { src = src.replace(flowMarker, flowReplacement); changed = true; }

    if (!changed) {
      console.error('[O Surto Artificial] Nenhum patch foi aplicado; estrutura inesperada.');
      return;
    }

    window.__surtoProductionPatchV4 = true;
    window.__dcUpdate(window.__dcRootName(), 'js', src, false);
  };

  patch();
})();

})();
