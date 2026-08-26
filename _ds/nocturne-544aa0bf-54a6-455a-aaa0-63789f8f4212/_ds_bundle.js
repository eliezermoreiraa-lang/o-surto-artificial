/* @ds-bundle: {"format":4,"namespace":"Nocturne_noctur","components":[],"sourceHashes":{},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.Nocturne_noctur = window.Nocturne_noctur || {});
const __ds_scope = {};
(__ds_ns.__errors = __ds_ns.__errors || []);

/* O Surto Artificial — integração Asaas Sandbox.
   Patch de produção aplicado sobre a lógica do Design Component para preservar
   o deploy otimizado (assets-min) enquanto o Project Archive do Claude exporta
   a pasta deploy sem as alterações mais recentes do arquivo .dc.html. */
(function applySurtoAsaasPatch() {
  if (window.__surtoAsaasPatchApplied) return;

  const patch = () => {
    if (!window.__dcUpdate || !window.__dcRootName) {
      setTimeout(patch, 30);
      return;
    }

    const scriptEl = document.querySelector('script[data-dc-script]');
    if (!scriptEl || !scriptEl.textContent) return;

    let src = scriptEl.textContent;
    if (src.includes("asaas-create-support-payment")) {
      window.__surtoAsaasPatchApplied = true;
      return;
    }

    const stateOld = "    pay: 'idle', demo: 'fila', perfilOk: false,\n    cupom: '', cupomOk: false, admTab: 'todos', admSel: null, toast: null, vip: 'pendente',";
    const stateNew = "    pay: 'idle', demo: 'fila', perfilOk: false,\n    payBusy: false,\n    cupom: '', cupomOk: false, admTab: 'todos', admSel: null, toast: null, vip: 'pendente',";

    const method = `  /* ── Apoio avulso · Asaas Sandbox via Edge Function ────────── */
  async startAvulsoPayment() {
    if (this.state.payBusy) return;
    const s = this.state;
    const session = this._session || s.session;
    if (!session) {
      this.setState({ authMode: 'login', authErr: null,
        authMsg: 'Entre na sua conta para concluir seu apoio.' });
      this.nav('auth');
      return;
    }
    const TIER_MAP = { livre: 'free', apoiador: 'supporter', destaque: 'highlight', vip: 'vip' };
    const MIN = { free: 1, supporter: 50, highlight: 100, vip: 300 };
    const tier = TIER_MAP[s.tier] || 'supporter';
    const escolhido = Math.round(Number(s.valor || 0));
    const amount = Math.max(escolhido, MIN[tier]);

    this.setState({ payBusy: true, pay: 'idle' });
    try {
      const sb = await this.sb();
      if (!sb) throw new Error('client');
      const r = await sb.functions.invoke('asaas-create-support-payment', { body: { tier, amount } });
      const data = r.data, error = r.error;
      const url = data && data.invoiceUrl;
      if (error || !url) throw new Error('invoke');
      this.setState({ payBusy: false });
      let win = null;
      try { win = window.open(url, '_blank', 'noopener'); } catch (err) { win = null; }
      if (!win) { try { window.top.location.href = url; } catch (err) { window.location.href = url; } }
    } catch (e) {
      this.setState({ payBusy: false });
      this.flash('Não conseguimos abrir seu pagamento agora. Tente novamente em alguns instantes.');
    }
  }

`;

    const renderOld = "      pagarLabel: metodo === 'pix' ? 'GERAR PIX' : (s.modo === 'mensal' ? 'ASSINAR ' + brl(totalNum) + '/MÊS' : 'PAGAR ' + brl(totalNum)),\n      pagar: () => { if (metodo === 'pix') { this.setState({ pay:'aguardando' }); } else { this.setState({ pay:'aprovado' }); this.nav('pago'); } },";
    const renderNew = "      pagarLabel: s.payBusy ? 'PROCESSANDO…' : (metodo === 'pix' ? 'GERAR PIX' : (s.modo === 'mensal' ? 'ASSINAR ' + brl(totalNum) + '/MÊS' : 'PAGAR ' + brl(totalNum))),\n      pagar: () => {\n        if (s.modo === 'mensal') {\n          this.flash('A assinatura mensal ainda não está aberta. Escolha Apoio avulso para apoiar agora.');\n          return;\n        }\n        this.startAvulsoPayment();\n      },";

    if (!src.includes(stateOld) || !src.includes("  nav(route) {") || !src.includes(renderOld)) {
      console.error('[O Surto Artificial] Patch Asaas não aplicado: estrutura inesperada.');
      return;
    }

    src = src.replace(stateOld, stateNew);
    src = src.replace("  nav(route) {", method + "  nav(route) {");
    src = src.replace(renderOld, renderNew);

    window.__surtoAsaasPatchApplied = true;
    window.__dcUpdate(window.__dcRootName(), 'js', src, false);
  };

  patch();
})();

})();
