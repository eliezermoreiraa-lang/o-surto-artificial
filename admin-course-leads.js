(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = { new: 'Novo', contacted: 'Contatado', coupon_sent: 'Cupom enviado', archived: 'Arquivado' };
  let generation = 0;
  const viewState = { page: 0, channel: 'all', status: 'all' };
  function mount(sb, root) {
    const token = ++generation;
    let page = viewState.page, rows = [], busy = false;
    root.innerHTML = `<div class="section-head"><div><h2>Acesso antecipado · Cursos</h2><p>Contatos autorizados para novidades e cupom. Nenhum envio é automático.</p></div><button class="btn secondary" id="leadsRefresh">ATUALIZAR</button></div><div class="panel" style="padding:20px;margin-bottom:20px"><div class="form-grid"><label>Canal<select id="leadsChannel"><option value="all">Todos</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></label><label>Status<select id="leadsStatus"><option value="all">Todos</option>${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label></div><p style="font-size:12px;color:#aaa">Marque “Cupom enviado” somente após realizar o envio. Para pedidos de saída, arquive o contato e não o inclua em novas campanhas. Para exclusão definitiva, siga o procedimento de privacidade.</p></div><p id="leadsMessage" role="status"></p><div class="panel table-wrap"><table class="table"><thead><tr><th>CONTATO</th><th>CANAL</th><th>CADASTRO</th><th>CONSENTIMENTO</th><th>STATUS</th></tr></thead><tbody id="leadsRows"></tbody></table></div><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;align-items:center"><button id="leadsPrev" class="btn secondary small">← ANTERIOR</button><span id="leadsPage"></span><button id="leadsNext" class="btn secondary small">PRÓXIMA →</button><button id="leadsCsv" class="btn secondary small">EXPORTAR ESTA PÁGINA (CSV)</button></div>`;
    const $ = q => root.querySelector(q);
    $('#leadsChannel').value = viewState.channel;
    $('#leadsStatus').value = viewState.status;
    const active = () => token === generation && root.querySelector('#leadsRows');
    async function load() {
      if (busy) return;
      busy = true; $('#leadsMessage').textContent = 'Carregando leads…';
      for (const id of ['#leadsChannel','#leadsStatus','#leadsRefresh','#leadsCsv']) $(id).disabled = true;
      try {
        let query = sb.from('course_leads').select('id,channel,contact,status,created_at,consent_version', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(page * 100, page * 100 + 99);
        if ($('#leadsChannel').value !== 'all') query = query.eq('channel', $('#leadsChannel').value);
        if ($('#leadsStatus').value !== 'all') query = query.eq('status', $('#leadsStatus').value);
        const result = await query;
        if (!active()) return;
        if (result.error) throw result.error;
        rows = result.data || [];
        $('#leadsRows').innerHTML = rows.length ? rows.map(row=>`<tr><td>${escape(row.contact)}</td><td>${row.channel === 'email' ? 'E-mail' : 'WhatsApp'}</td><td>${escape(new Date(row.created_at).toLocaleString('pt-BR'))}</td><td>Autorizado · ${escape(row.consent_version)}</td><td><select data-lead-id="${escape(row.id)}" aria-label="Status de ${escape(row.contact)}">${Object.entries(labels).map(([key,label])=>`<option value="${key}" ${row.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></td></tr>`).join('') : '<tr><td colspan="5">Nenhum contato neste filtro.</td></tr>';
        $('#leadsMessage').textContent = `${result.count || 0} contato(s) no filtro. O cadastro não representa compra ou matrícula.`;
        $('#leadsPage').textContent = `Página ${page + 1}`;
        $('#leadsPrev').disabled = page === 0;
        $('#leadsNext').disabled = (page + 1) * 100 >= (result.count || 0);
        $('#leadsCsv').disabled = !rows.length;
      } catch (_) { if (active()) { rows = []; $('#leadsRows').innerHTML = ''; $('#leadsMessage').textContent = 'Não foi possível carregar os leads. Atualize ou entre novamente no painel.'; $('#leadsCsv').disabled = true; } }
      finally { busy = false; if (active()) { for (const id of ['#leadsChannel','#leadsStatus','#leadsRefresh']) $(id).disabled = false; $('#leadsCsv').disabled = !rows.length; } }
    }
    $('#leadsRefresh').onclick = load;
    for (const id of ['#leadsChannel','#leadsStatus']) $(id).onchange = () => { page = viewState.page = 0; viewState.channel = $('#leadsChannel').value; viewState.status = $('#leadsStatus').value; load(); };
    $('#leadsPrev').onclick = () => { if (!busy && page > 0) { viewState.page = --page; load(); } };
    $('#leadsNext').onclick = () => { if (!busy) { viewState.page = ++page; load(); } };
    $('#leadsRows').onchange = async event => {
      const input = event.target, id = input.dataset.leadId, old = rows.find(row=>row.id === id);
      if (!old || !labels[input.value]) return;
      input.disabled = true;
      const result = await sb.from('course_leads').update({ status: input.value }).eq('id', id).select('id,status').single();
      if (!active()) return;
      if (result.error || !result.data) { input.value = old.status; $('#leadsMessage').textContent = 'Não foi possível salvar o status.'; }
      else { old.status = result.data.status; $('#leadsMessage').textContent = 'Status salvo. Nenhuma mensagem foi enviada.'; }
      input.disabled = false;
    };
    $('#leadsCsv').onclick = () => {
      // Protect spreadsheets against formula injection, including phone numbers beginning with +.
      const cell = v => '"' + (/^[=+\-@\t\r]/.test(String(v)) ? "'" : '') + String(v).replace(/"/g, '""') + '"';
      const csv = '\ufeff' + [['Contato','Canal','Status','Cadastro','Consentimento'], ...rows.map(row=>[row.contact,row.channel,labels[row.status],row.created_at,row.consent_version])].map(row=>row.map(cell).join(';')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `cursos-leads-pagina-${page + 1}.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
    };
    load();
  }
  window.SurtoCourseLeads = { mount };
})();
