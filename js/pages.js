// ================================================================
// pages.js — Funcionários, Presença, OC, Lançamentos
// ================================================================

// ── FUNCIONÁRIOS ─────────────────────────────────────────────
async function renderFuncionarios() {
  const { funcionarios, alocacoes, obras, lancamentos } = await loadAll();
  const main = document.getElementById('main-content');
  const { mes: m, ano: a } = mes();

  const semFolha = funcionarios.filter(f => f.ativo && f.tipo_contrato==='mensalista').filter(f => {
    const aloc = alocacoes.find(al => al.funcionario_id===f.id && !al.data_fim);
    if (!aloc) return false;
    return !lancamentos.some(l =>
      l.origem==='funcionarios' && l.origem_ref_id===f.id &&
      l.competencia_mes===m && l.competencia_ano===a && l.status==='ativo');
  });

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">👷</div>Funcionários</h1>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="App.navigate('presenca')">📅 Presença</button>
        <button class="btn btn-primary" onclick="showNovoFuncionario()">+ Novo</button>
      </div>
    </div>

    ${semFolha.length>0 ? `
    <div class="alert warning" onclick="showFolhaSugerida()">
      <span class="alert-icon">📋</span>
      <span><strong>Folha sugerida para ${String(m).padStart(2,'0')}/${a}</strong> — ${semFolha.length} mensalista${semFolha.length>1?'s':''} aguardando confirmação. Clique para processar.</span>
    </div>` : ''}

    <div class="dash-grid">
      <div class="card">
        <div class="card-header"><span class="card-title-lg">Equipe Ativa (${funcionarios.filter(f=>f.ativo).length})</span></div>
        <div class="card-body">
          ${funcionarios.filter(f=>f.ativo).length===0 ? '<div class="empty">Nenhum funcionário ativo</div>' :
            funcionarios.filter(f=>f.ativo).map(f => {
              const aloc = alocacoes.find(al=>al.funcionario_id===f.id && !al.data_fim);
              const obra = obras.find(o=>o.id===aloc?.obra_id);
              const ini  = f.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
              return `
              <div class="func-row">
                <div class="func-avatar">${ini}</div>
                <div class="func-info">
                  <div class="func-name">${f.nome}</div>
                  <div class="func-meta">${f.funcao||''} · ${obra?.nome||'<span style="color:var(--warning)">⚠ Sem alocação</span>'}</div>
                  <span class="badge ${f.tipo_contrato}">${f.tipo_contrato}</span>
                </div>
                <div>
                  <div class="func-value">${fmt(f.valor_base)}${f.tipo_contrato==='diarista'?'/dia':'/mês'}</div>
                  <div style="text-align:right;margin-top:6px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
                    <button class="btn-link" onclick="showPagamento('${f.id}')">Pagar</button>
                    <span style="color:var(--border2)">|</span>
                    <button class="btn-link" onclick="showHistoricoPagamentos('${f.id}')">Histórico</button>
                    <span style="color:var(--border2)">|</span>
                    <button class="btn-link" onclick="showEditarAloc('${f.id}')">Alocar</button>
                    <span style="color:var(--border2)">|</span>
                    <button class="btn-link" onclick="showEditarFuncionario('${f.id}')">Editar</button>
                    <span style="color:var(--border2)">|</span>
                    <button class="btn-link danger" onclick="inativarFuncionario('${f.id}','${f.nome.replace(/'/g,"\\'")}')">Inativar</button>
                  </div>
                </div>
              </div>`;
            }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-lg">Inativos (${funcionarios.filter(f=>!f.ativo).length})</span></div>
        <div class="card-body">
          ${funcionarios.filter(f=>!f.ativo).length===0 ? '<div class="empty">Nenhum</div>' :
            funcionarios.filter(f=>!f.ativo).map(f => `
            <div class="func-row inactive">
              <div class="func-avatar">${f.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div>
              <div class="func-info">
                <div class="func-name">${f.nome}</div>
                <div class="func-meta">${f.funcao||''}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-secondary btn-sm" onclick="reativarFunc('${f.id}')">Reativar</button>
                <button class="btn btn-danger btn-sm" onclick="excluirFuncionario('${f.id}','${f.nome.replace(/'/g,"\\'")}')">Excluir</button>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

async function showNovoFuncionario() {
  const { obras } = await loadAll();
  showModal({
    title: 'Novo Funcionário',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nome Completo *</label>
          <input id="fn-nome" class="form-input" placeholder="Nome do funcionário">
        </div>
        <div class="form-group">
          <label class="form-label">Função</label>
          <input id="fn-func" class="form-input" placeholder="Ex: Pedreiro, Encarregado">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo de Contrato</label>
          <select id="fn-tipo" class="form-input" onchange="atualizarLabelValor()">
            <option value="mensalista">Mensalista</option>
            <option value="diarista">Diarista</option>
            <option value="empreita">Empreita</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" id="fn-valor-lbl">Salário Mensal (R$)</label>
          <input id="fn-valor" class="form-input" type="number" step="0.01" placeholder="0,00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Alocar na Obra</label>
        <select id="fn-obra" class="form-input">
          <option value="">— Sem alocação inicial —</option>
          ${obras.filter(o=>o.status==='ativa').map(o=>`<option value="${o.id}">${o.nome}</option>`).join('')}
        </select>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarFuncionario()">Cadastrar</button>`
  });
}

function atualizarLabelValor() {
  const t = document.getElementById('fn-tipo')?.value;
  const lbl = document.getElementById('fn-valor-lbl');
  if (lbl) lbl.textContent = t==='diarista' ? 'Valor por Dia (R$)' : t==='empreita' ? 'Valor Padrão (R$)' : 'Salário Mensal (R$)';
}

async function salvarFuncionario() {
  const nome  = document.getElementById('fn-nome').value.trim();
  const func  = document.getElementById('fn-func').value.trim();
  const tipo  = document.getElementById('fn-tipo').value;
  const valor = parseFloat(document.getElementById('fn-valor').value) || 0;
  const obraId= document.getElementById('fn-obra').value;
  if (!nome) return App.toast('Informe o nome', 'error');
  App.loading(true);
  try {
    const fnId = await addDoc2('funcionarios', { nome, funcao: func, tipo_contrato: tipo, valor_base: valor, ativo: true });
    if (obraId) {
      await addDoc2('alocacoes', { funcionario_id: fnId, obra_id: obraId, data_inicio: today(), data_fim: null });
    }
    closeModal();
    App.toast(`${nome} cadastrado!`);
    App.navigate('funcionarios');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function showEditarFuncionario(funcId) {
  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  if (!func) return;
  showModal({
    title: `Editar Funcionário`,
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nome Completo *</label>
          <input id="ef-nome" class="form-input" value="${func.nome}">
        </div>
        <div class="form-group">
          <label class="form-label">Função</label>
          <input id="ef-func" class="form-input" value="${func.funcao||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo de Contrato</label>
          <select id="ef-tipo" class="form-input" onchange="atualizarLabelValorEd()">
            <option value="mensalista" ${func.tipo_contrato==='mensalista'?'selected':''}>Mensalista</option>
            <option value="diarista"   ${func.tipo_contrato==='diarista'?'selected':''}>Diarista</option>
            <option value="empreita"   ${func.tipo_contrato==='empreita'?'selected':''}>Empreita</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" id="ef-valor-lbl">${func.tipo_contrato==='diarista'?'Valor por Dia':'Salário Mensal'} (R$)</label>
          <input id="ef-valor" class="form-input" type="number" step="0.01" value="${func.valor_base||0}">
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicaoFuncionario('${funcId}')">Salvar</button>`
  });
}

function atualizarLabelValorEd() {
  const t = document.getElementById('ef-tipo')?.value;
  const lbl = document.getElementById('ef-valor-lbl');
  if (lbl) lbl.textContent = t==='diarista' ? 'Valor por Dia (R$)' : t==='empreita' ? 'Valor Padrão (R$)' : 'Salário Mensal (R$)';
}

async function salvarEdicaoFuncionario(funcId) {
  const nome  = document.getElementById('ef-nome').value.trim();
  const func  = document.getElementById('ef-func').value.trim();
  const tipo  = document.getElementById('ef-tipo').value;
  const valor = parseFloat(document.getElementById('ef-valor').value) || 0;
  if (!nome) return App.toast('Informe o nome', 'error');
  App.loading(true);
  try {
    await updateDoc2('funcionarios', funcId, { nome, funcao: func, tipo_contrato: tipo, valor_base: valor });
    closeModal();
    App.toast('Funcionário atualizado!');
    App.navigate('funcionarios');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function inativarFuncionario(funcId, nome) {
  if (!confirm(`Inativar "${nome}"? Ele aparecerá na lista de inativos e poderá ser reativado.`)) return;
  App.loading(true);
  try {
    await updateDoc2('funcionarios', funcId, { ativo: false });
    // Encerrar alocações ativas
    const alocs = App.cache.alocacoes.filter(a=>a.funcionario_id===funcId && !a.data_fim);
    for (const a of alocs) await updateDoc2('alocacoes', a.id, { data_fim: today() });
    App.toast(`${nome} inativado.`);
    App.navigate('funcionarios');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function excluirFuncionario(funcId, nome) {
  if (!confirm(`Excluir permanentemente "${nome}"?\n\nATENÇÃO: Esta ação não pode ser desfeita. Os lançamentos de pagamento anteriores serão mantidos.`)) return;
  App.loading(true);
  try {
    await deleteDoc2('funcionarios', funcId);
    App.toast(`${nome} excluído.`);
    App.navigate('funcionarios');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function showEditarAloc(funcId) {
  const { obras, alocacoes } = await loadAll();
  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  const alocAtual = alocacoes.find(a=>a.funcionario_id===funcId && !a.data_fim);
  showModal({
    title: `Alocação · ${func?.nome||''}`,
    body: `
      <div class="form-group">
        <label class="form-label">Obra Atual</label>
        <select id="aloc-obra" class="form-input">
          <option value="">— Sem alocação —</option>
          ${obras.filter(o=>o.status==='ativa').map(o=>`<option value="${o.id}" ${o.id===alocAtual?.obra_id?'selected':''}>${o.nome}</option>`).join('')}
        </select>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarAloc('${funcId}','${alocAtual?.id||''}')">Salvar</button>`
  });
}

async function salvarAloc(funcId, alocAtualId) {
  const obraId = document.getElementById('aloc-obra').value;
  App.loading(true);
  try {
    if (alocAtualId) await updateDoc2('alocacoes', alocAtualId, { data_fim: today() });
    if (obraId) await addDoc2('alocacoes', { funcionario_id: funcId, obra_id: obraId, data_inicio: today(), data_fim: null });
    closeModal();
    App.toast('Alocação atualizada!');
    App.navigate('funcionarios');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function showPagamento(funcId) {
  const { obras, alocacoes } = await loadAll();
  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  if (!func) return App.toast('Funcionário não encontrado','error');

  const aloc = alocacoes.find(a => a.funcionario_id===funcId && !a.data_fim);
  const obra = obras.find(o=>o.id===aloc?.obra_id);
  const { mes: m, ano: a } = mes();

  showModal({
    title: `Pagamento · ${func.nome}`,
    body: `
      ${!aloc ? '<div class="alert danger no-click"><span>⚠ Funcionário sem alocação ativa. Aloque-o em uma obra antes de registrar pagamento.</span></div>' : ''}
      ${obra ? `<div class="info-box">🏗 Obra: <strong>${obra.nome}</strong></div>` : ''}
      ${func.tipo_contrato==='diarista' ? `
      <div class="form-group">
        <label class="form-label">Número de Dias Trabalhados</label>
        <input id="pg-dias" class="form-input" type="number" min="1" placeholder="0" oninput="calcDiaria(${func.valor_base})">
        <div id="pg-calc" class="form-hint"></div>
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">${func.tipo_contrato==='diarista'?'Valor Total (R$)':func.tipo_contrato==='empreita'?'Valor da Empreita (R$)':'Valor (R$)'}</label>
        <input id="pg-valor" class="form-input" type="number" step="0.01" value="${func.tipo_contrato==='mensalista'?func.valor_base:''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select id="pg-tipo" class="form-input">
            <option value="salario">Salário</option>
            <option value="adiantamento">Adiantamento</option>
            <option value="va">Vale Alimentação</option>
            <option value="vt">Vale Transporte</option>
            <option value="bonus">Bônus/Extra</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Forma</label>
          <select id="pg-forma" class="form-input">
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>
      </div>
      <input type="hidden" id="pg-obra-id" value="${aloc?.obra_id||''}">
      <input type="hidden" id="pg-func-id" value="${funcId}">`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarPagamento()" ${!aloc?'disabled':''}>✓ Confirmar</button>`
  });
}

function calcDiaria(valorDia) {
  const dias = parseInt(document.getElementById('pg-dias')?.value)||0;
  const total = dias * valorDia;
  const el = document.getElementById('pg-valor');
  if (el) el.value = total;
  const calc = document.getElementById('pg-calc');
  if (calc) calc.textContent = `${dias} dias × ${fmt(valorDia)} = ${fmt(total)}`;
}

async function confirmarPagamento() {
  const valor  = parseFloat(document.getElementById('pg-valor')?.value)||0;
  const tipo   = document.getElementById('pg-tipo')?.value;
  const forma  = document.getElementById('pg-forma')?.value;
  const obraId = document.getElementById('pg-obra-id')?.value;
  const funcId = document.getElementById('pg-func-id')?.value;

  if (!valor || valor <= 0) return App.toast('Informe um valor válido', 'error');
  if (!obraId) return App.toast('Funcionário sem alocação ativa', 'error');

  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  const { mes: m, ano: a } = mes();

  App.loading(true);
  try {
    await addDoc2('lancamentos', {
      obra_id: obraId, planilha_id: null,
      tipo: 'despesa', categoria: 'Folha', valor,
      descricao: `${tipo==='salario'?'Salário':tipo==='adiantamento'?'Adiantamento':tipo==='va'?'Vale Alimentação':tipo==='vt'?'Vale Transporte':'Bônus'} — ${func?.nome||''}`,
      origem: 'funcionarios', origem_ref_id: funcId,
      competencia_mes: m, competencia_ano: a,
      forma_pagamento: forma, status: 'ativo',
    });
    closeModal();
    App.toast(`Pagamento de ${fmt(valor)} lançado!`);
    App.navigate('funcionarios');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function showFolhaSugerida() {
  const { funcionarios, alocacoes, obras, lancamentos } = await loadAll();
  const { mes: m, ano: a } = mes();

  const lista = funcionarios.filter(f=>f.ativo&&f.tipo_contrato==='mensalista').map(f => {
    const aloc = alocacoes.find(al=>al.funcionario_id===f.id && !al.data_fim);
    if (!aloc) return null;
    const jaLancado = lancamentos.some(l=>l.origem==='funcionarios'&&l.origem_ref_id===f.id&&l.competencia_mes===m&&l.competencia_ano===a&&l.status==='ativo');
    if (jaLancado) return null;
    const obra = obras.find(o=>o.id===aloc.obra_id);
    return {...f, alocacao:aloc, obra};
  }).filter(Boolean);

  if (lista.length===0) return App.toast('Todos os mensalistas já têm folha deste mês!','info');

  showModal({
    title: `Folha ${String(m).padStart(2,'0')}/${a}`,
    body: `
      <div class="alert success no-click"><span>Confirme os pagamentos de salário abaixo</span></div>
      ${lista.map(f=>`
      <div class="folha-item">
        <div class="folha-check">
          <input type="checkbox" id="fc-${f.id}" class="checkbox" checked>
          <div>
            <div style="font-size:14px;font-weight:600">${f.nome}</div>
            <div style="font-size:11px;color:var(--text3)">${f.obra?.nome||'—'}</div>
          </div>
        </div>
        <div style="font-size:14px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--blue-600)">${fmt(f.valor_base)}</div>
      </div>`).join('')}
      <div class="divider"></div>
      <div class="folha-total">
        <span>Total</span>
        <span style="font-family:'JetBrains Mono',monospace;color:var(--blue-700)">${fmt(lista.reduce((s,f)=>s+f.valor_base,0))}</span>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Ignorar por agora</button>
      <button class="btn btn-primary" onclick="confirmarFolha(${JSON.stringify(lista.map(f=>({id:f.id,valor:f.valor_base,obraId:f.alocacao.obra_id,nome:f.nome})))})">✓ Confirmar Selecionados</button>`
  });
}

async function confirmarFolha(lista) {
  const { mes: m, ano: a } = mes();
  const selecionados = lista.filter(f => document.getElementById('fc-'+f.id)?.checked);
  if (selecionados.length===0) return App.toast('Selecione ao menos um funcionário','warning');
  App.loading(true);
  try {
    for (const f of selecionados) {
      await addDoc2('lancamentos', {
        obra_id: f.obraId, planilha_id: null,
        tipo: 'despesa', categoria: 'Folha', valor: f.valor,
        descricao: `Salário ${String(m).padStart(2,'0')}/${a} — ${f.nome}`,
        origem: 'funcionarios', origem_ref_id: f.id,
        competencia_mes: m, competencia_ano: a, status: 'ativo',
      });
    }
    closeModal();
    App.toast(`Folha de ${selecionados.length} funcionário(s) lançada!`);
    App.navigate('funcionarios');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function reativarFunc(id) {
  await updateDoc2('funcionarios', id, { ativo: true });
  App.toast('Funcionário reativado!');
  App.navigate('funcionarios');
}

async function showHistoricoPagamentos(funcId) {
  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  if (!func) return;

  App.loading(true);
  try {
    let snap;
    try {
      snap = await empresaCol('lancamentos')
        .where('origem','==','funcionarios')
        .where('status','==','ativo')
        .get();
    } catch(e) {
      const allL = await empresaCol('lancamentos').get();
      snap = { docs: allL.docs.filter(d => d.data().origem === 'funcionarios' && d.data().status === 'ativo') };
    }

    const pagamentos = snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(l => l.descricao && l.descricao.includes(func.nome))
      .sort((a,b)=>(b.created_at?.toDate?.()||0)-(a.created_at?.toDate?.()||0));

    const total = pagamentos.reduce((s,l)=>s+(l.valor||0),0);
    const obras = App.cache.obras;

    showModal({
      title: `Histórico — ${func.nome}`,
      wide: true,
      body: `
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
          <div class="stat-card" style="flex:1;min-width:120px;padding:12px">
            <div class="stat-label">Total Pago</div>
            <div class="stat-value sm green">${fmt(total)}</div>
          </div>
          <div class="stat-card" style="flex:1;min-width:120px;padding:12px">
            <div class="stat-label">Pagamentos</div>
            <div class="stat-value">${pagamentos.length}</div>
          </div>
          <div class="stat-card" style="flex:1;min-width:120px;padding:12px">
            <div class="stat-label">Contrato</div>
            <div class="stat-value" style="font-size:14px">${func.tipo_contrato}</div>
          </div>
        </div>
        ${pagamentos.length===0
          ? '<div class="empty">Nenhum pagamento registrado</div>'
          : `<div style="max-height:380px;overflow-y:auto">
              ${pagamentos.map(l=>{
                const obra = obras.find(o=>o.id===l.obra_id);
                return `<div class="lanc-row">
                  <div class="lanc-icon func">👷</div>
                  <div class="lanc-info">
                    <div class="lanc-desc">${l.descricao||''}</div>
                    <div class="lanc-meta">${obra?.nome||''} · ${fmtDate(l.created_at)}</div>
                    <div class="lanc-tags"><span class="tag">${l.categoria||''}</span>${l.forma_pagamento?`<span class="tag">${l.forma_pagamento}</span>`:''}</div>
                  </div>
                  <div class="lanc-right">
                    <div class="lanc-value despesa">-${fmt(l.valor)}</div>
                  </div>
                </div>`;
              }).join('')}
            </div>`}`,
      footer: `
        <button class="btn btn-secondary" onclick="exportarHistoricoFunc('${funcId}')">⬇ Exportar CSV</button>
        <button class="btn btn-primary" onclick="closeModal()">Fechar</button>`
    });
  } finally {
    App.loading(false);
  }
}

function exportarHistoricoFunc(funcId) {
  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  if (!func) return;
  const pagamentos = App.cache.lancamentos
    .filter(l=>l.origem==='funcionarios'&&l.status==='ativo'&&l.descricao?.includes(func.nome))
    .sort((a,b)=>(b.created_at?.toDate?.()||0)-(a.created_at?.toDate?.()||0));
  const obras = App.cache.obras;
  const total = pagamentos.reduce((s,l)=>s+(l.valor||0),0);
  let csv = `Historico de Pagamentos - ${func.nome}\n`;
  csv += `Contrato: ${func.tipo_contrato} | Valor Base: ${func.valor_base}\n\n`;
  csv += `Data,Descricao,Obra,Categoria,Forma Pagamento,Valor\n`;
  pagamentos.forEach(l => {
    const obra = obras.find(o=>o.id===l.obra_id);
    csv += `"${fmtDate(l.created_at)}","${l.descricao||''}","${obra?.nome||''}","${l.categoria||''}","${l.forma_pagamento||''}","${(l.valor||0).toFixed(2)}"\n`;
  });
  csv += `\nTOTAL PAGO,,,,,"${total.toFixed(2)}"\n`;
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`historico-${func.nome.replace(/\s+/g,'-').toLowerCase()}.csv`; a.click();
  URL.revokeObjectURL(url);
  App.toast('Exportado!');
}


// ── CONTROLE DE PRESENÇA ──────────────────────────────────────
async function renderPresenca() {
  const { funcionarios } = await loadAll();
  const main = document.getElementById('main-content');

  const hoje = today();
  // Semana atual: segunda a domingo
  const diasSemana = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    diasSemana.push(d.toISOString().split('T')[0]);
  }

  const initDate = diasSemana[0];
  let presencas = [];
  try {
    const snapP = await empresaCol('presencas').get();
    presencas = snapP.docs.map(d=>({id:d.id,...d.data()})).filter(p => p.data >= initDate);
  } catch(e) { console.warn('[presencas]', e.message); presencas = []; }

  const ativos = funcionarios.filter(f=>f.ativo);

  function getStatus(funcId, dia) {
    return presencas.find(p=>p.funcionario_id===funcId&&p.data===dia)?.status || null;
  }

  const statusCfg = {
    presente: { icon:'✓', cls:'presente', cor:'var(--success)' },
    ausente:  { icon:'✕', cls:'ausente',  cor:'var(--danger)'  },
    atestado: { icon:'🏥', cls:'atestado', cor:'var(--info)'    },
    folga:    { icon:'🌙', cls:'folga',    cor:'var(--text3)'   },
  };
  const diasShort = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const diasNomes = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  // Totais do período
  const totalPresentes = ativos.reduce((s,f)=>s+diasSemana.filter(d=>getStatus(f.id,d)==='presente').length,0);
  const totalFaltas    = ativos.reduce((s,f)=>s+diasSemana.filter(d=>getStatus(f.id,d)==='ausente').length,0);

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">📅</div>Presença</h1>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('horas_extras')">⏱ Horas Extras</button>
      </div>
    </div>

    <!-- Resumo semana -->
    <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Presenças</div><div class="stat-value green">${totalPresentes}</div></div><div class="stat-icon green">✓</div></div>
        <div class="stat-label">esta semana</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Faltas</div><div class="stat-value red">${totalFaltas}</div></div><div class="stat-icon red">✕</div></div>
        <div class="stat-label">esta semana</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Funcionários</div><div class="stat-value">${ativos.length}</div></div><div class="stat-icon blue">👷</div></div>
        <div class="stat-label">ativos</div>
      </div>
    </div>

    <!-- Legenda rápida -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      ${Object.entries(statusCfg).map(([k,v])=>`
        <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:var(--surface2);border:1px solid var(--border)">
          ${v.icon} ${k.charAt(0).toUpperCase()+k.slice(1)}
        </span>`).join('')}
      <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:var(--surface2);border:1px solid var(--border)">— Não registrado</span>
    </div>

    <!-- Cards por funcionário (mobile-first) -->
    ${ativos.length===0 ? '<div class="empty-state"><span class="empty-icon">👷</span><p>Nenhum funcionário ativo.</p></div>' :
      ativos.map(f => {
        const diasP = diasSemana.filter(d=>getStatus(f.id,d)==='presente').length;
        const diasF = diasSemana.filter(d=>getStatus(f.id,d)==='ausente').length;
        return `
        <div class="card" style="margin-bottom:12px">
          <div class="card-header" style="padding:12px 14px 8px">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
              <div class="func-avatar" style="width:36px;height:36px;font-size:13px;flex-shrink:0">${f.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div>
              <div style="min-width:0">
                <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.nome}</div>
                <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap">
                  <span class="badge ${f.tipo_contrato}" style="font-size:10px">${f.tipo_contrato}</span>
                  <span style="font-size:11px;color:var(--success);font-weight:600">${diasP}P</span>
                  ${diasF>0?`<span style="font-size:11px;color:var(--danger);font-weight:600">${diasF}F</span>`:''}
                </div>
              </div>
            </div>
            ${f.tipo_contrato==='diarista'&&diasP>0?`
            <button class="btn btn-primary btn-sm" onclick="pagarDiasPresenca('${f.id}',${diasP},${f.valor_base})">
              💰 ${diasP}d
            </button>`:''}
          </div>
          <div class="card-body" style="padding:8px 14px 12px">
            <!-- Grid de dias: 7 colunas -->
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
              ${diasSemana.map(d => {
                const dt  = new Date(d+'T12:00:00');
                const s   = getStatus(f.id, d);
                const cfg = s ? statusCfg[s] : null;
                const isHoje = d === hoje;
                return `
                <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                  <span style="font-size:9px;color:${isHoje?'var(--blue-500)':'var(--text3)'};font-weight:${isHoje?'700':'400'}">${diasShort[dt.getDay()]}</span>
                  <span style="font-size:9px;color:var(--text3)">${dt.getDate()}/${dt.getMonth()+1}</span>
                  <button class="presence-btn ${s||''}"
                    onclick="togglePresenca('${f.id}','${d}',this)"
                    style="width:38px;height:38px;font-size:16px;${isHoje?'box-shadow:0 0 0 2px var(--blue-400)':''}"
                    title="${diasNomes[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}">
                    ${cfg ? cfg.icon : '<span style=\'font-size:10px;color:var(--text3)\'>—</span>'}
                  </button>
                </div>`;
              }).join('')}
            </div>
            ${f.tipo_contrato==='diarista'?`
            <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11px;color:var(--text2)">${diasP} dias × ${fmt(f.valor_base)}</span>
              <span style="font-size:13px;font-weight:700;color:var(--success)">${fmt(diasP*f.valor_base)}</span>
            </div>`:''}
          </div>
        </div>`;
      }).join('')}
  </div>`;
}

async function togglePresenca(funcId, data, btn) {
  const statusCycle = [null, 'presente', 'ausente', 'atestado', 'folga'];
  const icons = { presente:'✓', ausente:'✕', atestado:'🏥', folga:'🌙', null:'—' };

  // Buscar status atual
  let snap;
  try {
    snap = await empresaCol('presencas')
      .where('funcionario_id','==',funcId).where('data','==',data).get();
  } catch(e) {
    const allP = await empresaCol('presencas').get();
    const filtered = allP.docs.filter(d => d.data().funcionario_id === funcId && d.data().data === data);
    snap = { docs: filtered };
  }

  const atual = snap?.docs[0];
  const statusAtual = atual?.data()?.status || null;
  const idx = statusCycle.indexOf(statusAtual);
  const proximo = statusCycle[(idx+1) % statusCycle.length];

  try {
    if (atual) {
      if (proximo === null) {
        await empresaCol('presencas').doc(atual.id).delete();
      } else {
        await empresaCol('presencas').doc(atual.id).update({ status: proximo });
      }
    } else if (proximo !== null) {
      await addDoc2('presencas', { funcionario_id: funcId, data, status: proximo });
    }

    // Atualizar botão visualmente
    const cfgs = { presente:'presente', ausente:'ausente', atestado:'atestado', folga:'folga' };
    btn.className = `presence-btn ${proximo||''}`;
    btn.textContent = icons[proximo] || '—';
    btn.title = proximo || 'Não registrado';
  } catch(e) {
    App.toast('Erro ao salvar presença: '+e.message,'error');
  }
}

async function pagarDiasPresenca(funcId, dias, valorDia) {
  if (dias===0) return App.toast('Nenhum dia presente registrado','warning');
  const { obras, alocacoes } = await loadAll();
  const aloc = alocacoes.find(a=>a.funcionario_id===funcId && !a.data_fim);
  if (!aloc) return App.toast('Funcionário sem alocação ativa','error');
  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  const total = dias * valorDia;
  const { mes: m, ano: a } = mes();

  if (!confirm(`Lançar pagamento de ${dias} dia(s) × ${fmt(valorDia)} = ${fmt(total)} para ${func?.nome}?`)) return;
  App.loading(true);
  try {
    await addDoc2('lancamentos', {
      obra_id: aloc.obra_id, planilha_id: null,
      tipo: 'despesa', categoria: 'Folha', valor: total,
      descricao: `Diárias (${dias} dias) — ${func?.nome||''}`,
      origem: 'funcionarios', origem_ref_id: funcId,
      competencia_mes: m, competencia_ano: a, status: 'ativo',
    });
    App.toast(`Pagamento de ${fmt(total)} lançado!`);
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}


// ── ORDENS DE COMPRA ──────────────────────────────────────────
// Parser baseado nos modelos reais Ferreira Santos / ENGIX
function parsearOC(texto) {
  const r = {};
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const txt    = linhas.join('\n');

  // 1. Nº OC
  let m = txt.match(/N[º°o][\s:\.]+(\d{4,6})/);
  if (m) r.numero_oc = m[1];
  if (!r.numero_oc) { m = txt.match(/NR DA OC[\s:]+(\d{4,6})/i); if (m) r.numero_oc = m[1]; }

  // 2. Nº Obra + Nome + Data (linha única)
  m = txt.match(/^(\d{3,6})\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]{10,}?)\s+(\d{2}\/\d{2}\/\d{4})/m);
  if (m) {
    r.numero_acao = m[1]; r.nome_obra = m[2].trim();
    const [dd,mm2,aaaa] = m[3].split('/'); r.data_emissao = `${aaaa}-${mm2}-${dd}`;
  }
  if (!r.numero_acao) { m = txt.match(/A[ÇC][ÃA]O[\s:]+(\d{3,6})/i); if (m) r.numero_acao = m[1]; }

  // 3. Fornecedor
  m = txt.match(/Fornec\.?[\s:]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n\r]{3,60})/i);
  if (m) { const c = m[1].replace(/\s*CNPJ.*/i,'').trim(); if (c.length > 3) r.fornecedor = c; }
  if (!r.fornecedor) {
    const IGNORAR = ['End:','Cidade:','Bairro:','DADOS DO FORNECEDOR','DEPARTAMENTO',
                     'SISTEMA','ENGIX','Nº Obra','Vendedor:','Item'];
    const idx = txt.indexOf('Fornec.:');
    if (idx > 0) {
      const antes = txt.substring(0, idx).trim().split('\n');
      for (let i = antes.length-1; i >= 0; i--) {
        const l = antes[i].trim();
        if (!l || IGNORAR.some(ig => l.includes(ig))) continue;
        if (/^(AV|RUA|R\.|ROD)\b/i.test(l)) continue;
        if (/UF:|CEP:|Bairro:/i.test(l)) continue;
        if (l.length > 4 && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3}/.test(l)) { r.fornecedor = l; break; }
      }
    }
  }

  // 4. CNPJ — busca o padrão XX.XXX.XXX/XXXX-XX após a seção do fornecedor
  // Ignora o CNPJ da empresa (03.422.281/0001-69) que aparece antes de "Fornec.:"
  const idxF = txt.toLowerCase().indexOf('fornec');
  const txtF = idxF >= 0 ? txt.substring(idxF) : txt;
  // Captura diretamente pelo formato numérico — tolerante a variações OCR
  const mCnpj = txtF.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (mCnpj) r.cnpj_fornecedor = mCnpj[1].trim();

  // 5. Data fallback
  if (!r.data_emissao) {
    m = txt.match(/Entrega[\s:]+(\d{2}\/\d{2}\/\d{4})/i) || txt.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (m) { const [dd,mm2,aaaa] = m[1].split('/'); r.data_emissao = `${aaaa}-${mm2}-${dd}`; }
  }

  // 6. Valor Total — padrão R$ com vírgula (não confunde com CNPJ)
  m = txt.match(/\bTotal[\s:,]*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i);
  if (m) { r.valor_total = parseFloat(m[1].replace(/\./g,'').replace(',','.')); }
  else {
    const iTot = txt.toLowerCase().lastIndexOf('total');
    if (iTot >= 0) {
      const trecho = txt.substring(iTot, iTot+60);
      const m2 = trecho.match(/([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/);
      if (m2) r.valor_total = parseFloat(m2[1].replace(/\./g,'').replace(',','.'));
    }
  }

  return r;
}
async function renderOC() {
  const { ordens_compra, obras, planilhas } = await loadAll();
  const main = document.getElementById('main-content');
  const ativas    = ordens_compra.filter(o=>o.status==='ativa');
  const canceladas= ordens_compra.filter(o=>o.status==='cancelada');

  const hoje      = new Date();
  const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
  const hojeStr   = hoje.toISOString().split('T')[0];

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">📄</div>Ordens de Compra</h1>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="showImportarOC()">+ Importar OC</button>
      </div>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">OCs Ativas</div><div class="stat-value">${ativas.length}</div></div><div class="stat-icon blue">📄</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Total Comprometido</div><div class="stat-value sm">${fmt(ativas.reduce((s,o)=>s+(o.valor_total||0),0))}</div></div><div class="stat-icon red">💸</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Canceladas</div><div class="stat-value">${canceladas.length}</div></div><div class="stat-icon yellow">🚫</div></div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card" style="margin-bottom:12px">
      <div class="card-body" style="padding:14px">
        <div class="filter-row" style="flex-wrap:wrap;gap:8px">
          <select id="oc-fl-obra" class="form-input" style="flex:1;min-width:140px" onchange="filtrarOCs()">
            <option value="">Todas as obras</option>
            ${obras.map(o=>`<option value="${o.id}">${o.nome}</option>`).join('')}
          </select>
          <select id="oc-fl-status" class="form-input" style="flex:1;min-width:120px" onchange="filtrarOCs()">
            <option value="">Todos os status</option>
            <option value="ativa">Ativas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </div>
        <div class="filter-row" style="flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center">
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:200px">
            <label style="font-size:12px;color:var(--text2);white-space:nowrap">De:</label>
            <input id="oc-fl-ini" class="form-input" type="date" value="${inicioMes}" onchange="filtrarOCs()" style="flex:1">
            <label style="font-size:12px;color:var(--text2);white-space:nowrap">Até:</label>
            <input id="oc-fl-fim" class="form-input" type="date" value="${hojeStr}" onchange="filtrarOCs()" style="flex:1">
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="filtrarOCsPeriodo('mes')">Este mês</button>
            <button class="btn btn-secondary btn-sm" onclick="filtrarOCsPeriodo('trimestre')">Trimestre</button>
            <button class="btn btn-secondary btn-sm" onclick="filtrarOCsPeriodo('tudo')">Tudo</button>
          </div>
        </div>
        <div id="oc-fl-resumo" style="font-size:11px;color:var(--text3);margin-top:8px;text-align:right"></div>
      </div>
    </div>

    <div id="oc-container"></div>
  </div>`;

  window._ocData = { ordens_compra, obras, planilhas };
  filtrarOCs();
}

function filtrarOCsPeriodo(tipo) {
  const hoje = new Date();
  let ini, fim = hoje.toISOString().split('T')[0];
  if (tipo === 'mes') {
    ini = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
  } else if (tipo === 'trimestre') {
    const d = new Date(hoje); d.setMonth(d.getMonth()-3);
    ini = d.toISOString().split('T')[0];
  } else {
    ini = '2020-01-01';
  }
  document.getElementById('oc-fl-ini').value = ini;
  document.getElementById('oc-fl-fim').value = fim;
  filtrarOCs();
}

function filtrarOCs() {
  const obraF   = document.getElementById('oc-fl-obra')?.value;
  const statusF = document.getElementById('oc-fl-status')?.value;
  const dataIni = document.getElementById('oc-fl-ini')?.value;
  const dataFim = document.getElementById('oc-fl-fim')?.value;
  const { ordens_compra, obras, planilhas } = window._ocData;

  const filtradas = ordens_compra.filter(oc => {
    if (obraF   && oc.obra_id !== obraF)   return false;
    if (statusF && oc.status  !== statusF)  return false;
    if ((dataIni || dataFim) && oc.data_emissao) {
      if (dataIni && oc.data_emissao < dataIni) return false;
      if (dataFim && oc.data_emissao > dataFim) return false;
    }
    return true;
  });

  const fAtivas    = filtradas.filter(oc=>oc.status==='ativa');
  const fCanceladas= filtradas.filter(oc=>oc.status==='cancelada');
  const totalFilt  = fAtivas.reduce((s,oc)=>s+(oc.valor_total||0),0);

  const resumoEl = document.getElementById('oc-fl-resumo');
  if (resumoEl) resumoEl.innerHTML =
    `${filtradas.length} OC${filtradas.length!==1?'s':''} · <strong style="color:var(--blue-600)">${fmt(totalFilt)}</strong> comprometidos`;

  const container = document.getElementById('oc-container');
  if (!container) return;

  container.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-header"><span class="card-title-lg">OCs Ativas (${fAtivas.length})</span></div>
      <div class="card-body">
        ${fAtivas.length===0 ? '<div class="empty">Nenhuma OC encontrada</div>' :
          fAtivas.map(oc=>ocRow(oc,obras,planilhas,true)).join('')}
      </div>
    </div>
    ${fCanceladas.length>0 ? `
    <div class="card">
      <div class="card-header"><span class="card-title-lg">OCs Canceladas (${fCanceladas.length})</span></div>
      <div class="card-body">
        ${fCanceladas.map(oc=>ocRow(oc,obras,planilhas,false)).join('')}
      </div>
    </div>` : ''}`;
}

function ocRow(oc, obras, planilhas, canCancel) {
  const obra = obras.find(o=>o.id===oc.obra_id);
  const pl   = planilhas.find(p=>p.id===oc.planilha_id);
  return `
  <div class="oc-row ${oc.status==='cancelada'?'cancelada':''}">
    <div class="oc-header">
      <span class="oc-num">OC ${oc.numero_oc||'—'} · Ação ${oc.numero_acao||'—'}</span>
      <span class="oc-date">${fmtDate(oc.data_emissao)}</span>
    </div>
    <div class="oc-forn">${oc.fornecedor||'—'}</div>
    <div class="oc-footer">
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <span class="tag blue">${obra?.nome||'—'}</span>
        <span class="tag">${pl?.nome||'Sem planilha'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="oc-value">${fmt(oc.valor_total)}</span>
        ${canCancel
          ? `<button class="btn btn-secondary btn-sm" onclick="showEditarOC('${oc.id}')">✏️ Editar</button>
             <button class="btn btn-danger btn-sm" onclick="cancelarOCGlobal('${oc.id}')">Cancelar</button>`
          : `<span class="badge cancelada">cancelada</span>`}
      </div>
    </div>
  </div>`;
}

async function showEditarOC(ocId) {
  const { obras, planilhas } = await loadAll();
  let snap;
  try {
    snap = await empresaCol('ordens_compra').doc(ocId).get();
  } catch(e) {
    return App.toast('Erro ao carregar OC: '+e.message, 'error');
  }
  const oc = {id: snap.id, ...snap.data()};
  const obraPlans = planilhas.filter(p => p.obra_id === oc.obra_id);

  showModal({
    title: `Editar OC ${oc.numero_oc||'—'}`,
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nº OC *</label>
          <input id="eoc-num" class="form-input" value="${oc.numero_oc||''}" style="font-family:'JetBrains Mono',monospace">
        </div>
        <div class="form-group">
          <label class="form-label">Nº Ação</label>
          <input id="eoc-acao" class="form-input" value="${oc.numero_acao||''}" style="font-family:'JetBrains Mono',monospace">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Fornecedor *</label>
        <input id="eoc-forn" class="form-input" value="${oc.fornecedor||''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">CNPJ Fornecedor</label>
          <input id="eoc-cnpj" class="form-input" value="${oc.cnpj_fornecedor||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Valor Total (R$) *</label>
          <input id="eoc-valor" class="form-input" type="number" step="0.01" value="${oc.valor_total||''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Data de Emissão</label>
        <input id="eoc-data" class="form-input" type="date" value="${oc.data_emissao||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Obra</label>
        <select id="eoc-obra" class="form-input" onchange="carregarPlanilhasEOC('${ocId}')">
          <option value="">— Selecione —</option>
          ${obras.filter(o=>o.status==='ativa').map(o=>`<option value="${o.id}" ${o.id===oc.obra_id?'selected':''}>${o.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Planilha</label>
        <select id="eoc-plan" class="form-input">
          ${obraPlans.length===0
            ? '<option value="">— Sem planilhas nesta obra —</option>'
            : '<option value="">— Sem planilha específica —</option>'+obraPlans.map(p=>`<option value="${p.id}" ${p.id===oc.planilha_id?'selected':''}>${p.nome}</option>`).join('')}
        </select>
      </div>
      <div class="alert info no-click" style="margin-top:8px"><span class="alert-icon">ℹ</span><span>Se o valor for alterado, o lançamento original será ajustado automaticamente.</span></div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicaoOC('${ocId}',${oc.valor_total})">✓ Salvar Alterações</button>`
  });
}

async function carregarPlanilhasEOC(ocId) {
  const obraId = document.getElementById('eoc-obra')?.value;
  const sel = document.getElementById('eoc-plan');
  if (!sel) return;
  if (!obraId) { sel.innerHTML='<option value="">— Selecione a obra primeiro —</option>'; return; }
  let snap;
  try {
    snap = await empresaCol('planilhas').where('obra_id','==',obraId).get();
  } catch(e) {
    const all = await empresaCol('planilhas').get();
    snap = { docs: all.docs.filter(d=>d.data().obra_id===obraId) };
  }
  const pls = snap.docs.map(d=>({id:d.id,...d.data()}));
  sel.innerHTML = '<option value="">— Sem planilha específica —</option>'
    + pls.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
}

async function salvarEdicaoOC(ocId, valorOriginal) {
  const num   = document.getElementById('eoc-num')?.value.trim();
  const acao  = document.getElementById('eoc-acao')?.value.trim();
  const forn  = document.getElementById('eoc-forn')?.value.trim();
  const cnpj  = document.getElementById('eoc-cnpj')?.value.trim();
  const valor = parseFloat(document.getElementById('eoc-valor')?.value)||0;
  const data  = document.getElementById('eoc-data')?.value;
  const obraId= document.getElementById('eoc-obra')?.value;
  const planId= document.getElementById('eoc-plan')?.value;

  if (!num)    return App.toast('Informe o número da OC','error');
  if (!forn)   return App.toast('Informe o fornecedor','error');
  if (!obraId) return App.toast('Selecione a obra','error');
  if (!valor)  return App.toast('Informe o valor','error');

  App.loading(true);
  try {
    // Atualiza a OC
    await updateDoc2('ordens_compra', ocId, {
      numero_oc: num, numero_acao: acao, fornecedor: forn,
      cnpj_fornecedor: cnpj, valor_total: valor,
      data_emissao: data, obra_id: obraId, planilha_id: planId||null
    });

    // Se o valor mudou, ajusta o lançamento vinculado
    if (valor !== valorOriginal) {
      let lancSnap;
      try {
        lancSnap = await empresaCol('lancamentos')
          .where('origem_ref_id','==',ocId).where('status','==','ativo').get();
      } catch(e) {
        const all = await empresaCol('lancamentos').get();
        lancSnap = { docs: all.docs.filter(d=>d.data().origem_ref_id===ocId&&d.data().status==='ativo') };
      }
      for (const d of lancSnap.docs) {
        await updateDoc2('lancamentos', d.id, {
          valor, obra_id: obraId, planilha_id: planId||null,
          descricao: `OC ${num} — ${forn}`
        });
      }
    }

    closeModal();
    App.toast(`OC ${num} atualizada!`);
    App.navigate('ordens_compra');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function cancelarOCGlobal(ocId) {
  const snap = await empresaCol('ordens_compra').doc(ocId).get();
  const oc = snap.data();
  await cancelarOC(ocId, oc.obra_id);
  App.navigate('ordens_compra');
}

async function showImportarOC(obraIdPre = '') {
  const { obras } = await loadAll();
  showModal({
    title: 'Importar Ordem de Compra',
    body: `
      <div id="oc-step1">
        <div class="upload-area" id="oc-drop" onclick="document.getElementById('oc-file-pdf').click()"
          ondragover="event.preventDefault();this.classList.add('drag')"
          ondragleave="this.classList.remove('drag')"
          ondrop="event.preventDefault();this.classList.remove('drag');processarArquivoOC(event.dataTransfer.files[0])">
          <div class="upload-icon">🔍</div>
          <div class="upload-text">Enviar PDF da OC</div>
          <div class="upload-sub">Clique para selecionar o arquivo</div>
          <input type="file" id="oc-file-pdf" accept=".pdf,image/*" style="display:none" onchange="processarArquivoOC(this.files[0])">
        </div>
        <div style="margin-top:12px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap">
          <button class="btn-link" onclick="document.getElementById('oc-file-camera').click()">📷 Tirar foto</button>
          <input type="file" id="oc-file-camera" accept="image/*" capture="environment" style="display:none" onchange="processarArquivoOC(this.files[0])">
          <span style="color:var(--border2)">·</span>
          <button class="btn-link" onclick="mostrarFormOCManual('${obraIdPre}')">Preencher manualmente →</button>
        </div>
      </div>
      <div id="oc-debug" style="margin-top:8px;font-size:11px"></div>
      <div id="oc-step2" style="display:none"></div>`
  });
}

async function processarArquivoOC(file) {
  if (!file) return;
  const dropEl = document.getElementById('oc-drop');
  if (!dropEl) return;
  dropEl.innerHTML = '<div class="upload-icon">🔍</div><div class="upload-text">Extraindo texto...</div><div class="upload-sub">Aguarde alguns segundos</div>';

  try {
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = file.type.startsWith('image/');
    if (!isPDF && !isImg) {
      App.toast('Use PDF ou imagem (JPG, PNG).', 'error');
      dropEl.innerHTML = '<div class="upload-icon">🔍</div><div class="upload-text">Enviar PDF ou foto da OC</div><div class="upload-sub">PDF, JPG ou PNG</div>';
      return;
    }

    const OCR_KEY = window.OCRSPACE_API_KEY || 'helloworld';

    // Converte PDF para imagem antes de enviar (mais rápido que enviar PDF direto)
    // Engine 1 = ~3-5s, Engine 2 = ~15-40s mas mais preciso
    let fileEnvio = file;
    if (isPDF) {
      fileEnvio = await pdfParaImagem(file);
    } else {
      fileEnvio = await redimensionarImagem(file, 1800);
    }

    const formData = new FormData();
    formData.append('apikey',            OCR_KEY);
    formData.append('language',          'por');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale',             'true');
    formData.append('OCREngine',         '2');
    formData.append('file', fileEnvio, 'oc.png');

    const resp = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
    if (!resp.ok) throw new Error(`OCR.space HTTP ${resp.status}`);

    const data = await resp.json();
    if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] || 'Erro OCR');

    const texto = (data.ParsedResults || []).map(p => p.ParsedText || '').join('\n').trim();
    if (!texto || texto.length < 20) throw new Error('OCR não extraiu texto. Arquivo legível?');

    console.log('[OCR] Texto bruto:\n', texto);
    window._ocrTexto = texto;  // salva ANTES do parse
    const dados = parsearOC(texto);
    console.log('[OCR] Dados parseados:', dados);
    await exibirPreviewOC(dados, file.name);

  } catch(err) {
    console.error('Erro OCR:', err);
    if (dropEl) dropEl.innerHTML = '<div class="upload-icon">🔍</div><div class="upload-text">Enviar PDF ou foto da OC</div><div class="upload-sub">PDF, JPG ou PNG</div>';
    App.toast((err.message||'Erro na leitura') + ' — abrindo formulário manual', 'warning');
    setTimeout(() => mostrarFormOCManual(''), 1500);
  }
}

function redimensionarImagem(file, maxDim) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio  = Math.min(maxDim/img.width, maxDim/img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.88);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}
// Converte a primeira página do PDF em PNG para envio ao OCR
async function pdfParaImagem(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (typeof pdfjsLib === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve();
        };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const pdf      = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const page     = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return await new Promise(resolve => {
      canvas.toBlob(blob => resolve(new File([blob], 'oc.png', { type: 'image/png' })), 'image/png');
    });
  } catch(e) {
    console.warn('pdf.js falhou, enviando PDF direto:', e);
    return file; // fallback: envia PDF original
  }
}

async function exibirPreviewOC(input, filename) {
  const { obras, planilhas } = await loadAll();
  // Aceita tanto texto bruto (string) quanto objeto já parseado
  const dados = (typeof input === 'string') ? parsearOC(input + '\n' + filename) : input;

  let obraEncontrada = null;
  if (dados.numero_acao) {
    obraEncontrada = obras.find(o => o.numero_acao === dados.numero_acao);
  }

  const pls = obraEncontrada ? planilhas.filter(p=>p.obra_id===obraEncontrada.id) : [];

  document.getElementById('oc-step1').style.display = 'none';
  document.getElementById('oc-step2').innerHTML = `
    <div class="alert success no-click"><span>✓ OCR concluído</span></div>
    <details style="margin:8px 0;font-size:11px"><summary style="cursor:pointer;color:var(--primary)">Ver texto bruto do OCR (debug)</summary><pre style="background:#f5f5f5;padding:8px;border-radius:4px;max-height:200px;overflow:auto;white-space:pre-wrap;font-size:10px">${(window._ocrTexto||JSON.stringify(dados,null,2)).substring(0,1500)}</pre></details>

    <div class="oc-preview">
      <div class="oc-preview-header">Dados Extraídos da OC</div>
      ${[
        ['Nº OC', dados.numero_oc||''],
        ['Nº Ação', dados.numero_acao||''],
        ['Fornecedor', dados.fornecedor||''],
        ['CNPJ Fornecedor', dados.cnpj_fornecedor||''],
        ['Data Emissão', dados.data_emissao ? fmtDate(new Date(dados.data_emissao+'T12:00')) : ''],
        ['Total', dados.valor_total ? fmt(dados.valor_total) : ''],
      ].map(([k,v])=>`
      <div class="oc-preview-row">
        <span class="oc-preview-key">${k}</span>
        <span class="oc-preview-val">${v||'<span style="color:var(--text3)">não identificado</span>'}</span>
      </div>`).join('')}
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nº OC *</label>
        <input id="oi-num" class="form-input" value="${dados.numero_oc||''}" style="font-family:'JetBrains Mono',monospace">
      </div>
      <div class="form-group">
        <label class="form-label">Nº Ação</label>
        <input id="oi-acao" class="form-input" value="${dados.numero_acao||''}" style="font-family:'JetBrains Mono',monospace" oninput="buscarObraPorAcao()">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Fornecedor *</label>
      <input id="oi-forn" class="form-input" value="${dados.fornecedor||''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">CNPJ Fornecedor</label>
        <input id="oi-cnpj" class="form-input" value="${dados.cnpj_fornecedor||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Valor Total (R$) *</label>
        <input id="oi-valor" class="form-input" type="number" step="0.01" value="${dados.valor_total||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data de Emissão</label>
        <input id="oi-data" class="form-input" type="date" value="${dados.data_emissao||today()}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Obra</label>
      <select id="oi-obra" class="form-input" onchange="carregarPlanilhasOI()">
        <option value="">— Selecione —</option>
        ${obras.filter(o=>o.status==='ativa').map(o=>`<option value="${o.id}" data-acao="${o.numero_acao||''}" ${obraEncontrada?.id===o.id?'selected':''}>${o.nome} (${o.numero_acao||'—'})</option>`).join('')}
      </select>
      ${obraEncontrada ? '<div class="form-hint" style="color:var(--success)">✓ Obra identificada automaticamente pelo número de ação</div>' : ''}
    </div>
    <div class="form-group" id="oi-plan-grp">
      <label class="form-label">Planilha (centro de custo) *</label>
      <select id="oi-plan" class="form-input">
        ${pls.length===0
          ? '<option value="">— Selecione a obra primeiro —</option>'
          : '<option value="">— Selecione —</option>'+pls.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('')}
      </select>
    </div>`;

  if (pls.length===1) {
    setTimeout(()=>{ const s=document.getElementById('oi-plan'); if(s) s.value=pls[0].id; },50);
  }

  document.getElementById('oc-step2').style.display = 'block';

  const footer = document.querySelector('.modal-footer');
  if (footer) footer.innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarImportacaoOC()">✓ Confirmar e Lançar</button>`;
  else {
    // Adicionar footer se não existir
    const modal = document.querySelector('.modal');
    if (modal) {
      const f = document.createElement('div');
      f.className = 'modal-footer';
      f.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmarImportacaoOC()">✓ Confirmar e Lançar</button>`;
      modal.appendChild(f);
    }
  }
}

function buscarObraPorAcao() {
  const acao = document.getElementById('oi-acao')?.value.trim();
  if (!acao) return;
  const sel = document.getElementById('oi-obra');
  if (!sel) return;
  const opt = Array.from(sel.options).find(o=>o.dataset.acao===acao);
  if (opt) { sel.value = opt.value; carregarPlanilhasOI(); App.toast('Obra identificada pelo número de ação!','info'); }
}

async function carregarPlanilhasOI() {
  const obraId = document.getElementById('oi-obra')?.value;
  const sel    = document.getElementById('oi-plan');
  if (!sel) return;
  if (!obraId) { sel.innerHTML='<option value="">— Selecione a obra primeiro —</option>'; return; }
  let plSnap;
  try {
    plSnap = await empresaCol('planilhas').where('obra_id','==',obraId).get();
  } catch(e) {
    const allPl = await empresaCol('planilhas').get();
    plSnap = { docs: allPl.docs.filter(d => d.data().obra_id === obraId) };
  }
  const pls  = plSnap.docs.map(d=>({id:d.id,...d.data()}));
  sel.innerHTML = pls.length===0
    ? '<option value="">Sem planilhas nesta obra</option>'
    : '<option value="">— Selecione —</option>'+pls.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  if (pls.length===1) sel.value = pls[0].id;
}

async function mostrarFormOCManual(obraIdPre='') {
  const { obras, planilhas } = await loadAll();
  document.getElementById('oc-step1').style.display = 'none';
  document.getElementById('oc-step2').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nº OC *</label>
        <input id="oi-num" class="form-input" style="font-family:'JetBrains Mono',monospace" placeholder="12257">
      </div>
      <div class="form-group">
        <label class="form-label">Nº Ação</label>
        <input id="oi-acao" class="form-input" style="font-family:'JetBrains Mono',monospace" placeholder="1671" oninput="buscarObraPorAcao()">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Fornecedor *</label>
      <input id="oi-forn" class="form-input" placeholder="Nome do fornecedor">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">CNPJ Fornecedor</label>
        <input id="oi-cnpj" class="form-input" placeholder="00.000.000/0000-00">
      </div>
      <div class="form-group">
        <label class="form-label">Valor Total (R$) *</label>
        <input id="oi-valor" class="form-input" type="number" step="0.01" placeholder="0,00">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Data de Emissão</label>
      <input id="oi-data" class="form-input" type="date" value="${today()}">
    </div>
    <div class="form-group">
      <label class="form-label">Obra *</label>
      <select id="oi-obra" class="form-input" onchange="carregarPlanilhasOI()">
        <option value="">— Selecione —</option>
        ${obras.filter(o=>o.status==='ativa').map(o=>`<option value="${o.id}" data-acao="${o.numero_acao||''}" ${o.id===obraIdPre?'selected':''}>${o.nome} (${o.numero_acao||'—'})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Planilha *</label>
      <select id="oi-plan" class="form-input">
        <option value="">— Selecione a obra primeiro —</option>
      </select>
    </div>`;
  document.getElementById('oc-step2').style.display = 'block';
  if (obraIdPre) carregarPlanilhasOI();

  const footer = document.querySelector('.modal-footer');
  if (footer) footer.innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarImportacaoOC()">✓ Confirmar e Lançar</button>`;
}

async function confirmarImportacaoOC() {
  const num    = document.getElementById('oi-num')?.value.trim();
  const acao   = document.getElementById('oi-acao')?.value.trim();
  const forn   = document.getElementById('oi-forn')?.value.trim();
  const cnpj   = document.getElementById('oi-cnpj')?.value.trim();
  const valor  = parseFloat(document.getElementById('oi-valor')?.value)||0;
  const data   = document.getElementById('oi-data')?.value||today();
  const obraId = document.getElementById('oi-obra')?.value;
  const planId = document.getElementById('oi-plan')?.value;

  if (!num)    return App.toast('Informe o número da OC', 'error');
  if (!forn)   return App.toast('Informe o fornecedor', 'error');
  if (!obraId) return App.toast('Selecione a obra', 'error');
  if (!planId) return App.toast('Selecione a planilha', 'error');
  if (!valor)  return App.toast('Informe o valor total', 'error');

  App.loading(true);
  try {
    let dup;
    try {
      const dupSnap = await empresaCol('ordens_compra')
        .where('numero_oc','==',num).where('obra_id','==',obraId).get();
      dup = dupSnap;
    } catch(e) {
      const all = await empresaCol('ordens_compra').get();
      dup = { docs: all.docs.filter(d => d.data().numero_oc === num && d.data().obra_id === obraId) };
    }

    if (!dup.empty) {
      App.loading(false);
      const ocExist = dup.docs[0].data();
      showModal({
        title: '⚠ OC Duplicada Detectada',
        body: `
          <div class="alert warning no-click">
            <span>A OC <strong>${num}</strong> já existe nesta obra com valor <strong>${fmt(ocExist.valor_total)}</strong> — ${fmtDate(ocExist.data_emissao)}.</span>
          </div>
          <p style="font-size:14px;color:var(--text2);margin-bottom:16px">O que deseja fazer?</p>`,
        footer: `
          <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-danger btn-sm" onclick="closeModal()">Manter a original</button>
          <button class="btn btn-primary" onclick="forcarImportacaoOC('${num}','${acao}','${forn}','${cnpj}',${valor},'${data}','${obraId}','${planId}')">Substituir</button>`
      });
      return;
    }

    await gravarOC(num, acao, forn, cnpj, valor, data, obraId, planId);
  } catch(e) { App.toast('Erro: '+e.message,'error'); App.loading(false); }
}

async function forcarImportacaoOC(num,acao,forn,cnpj,valor,data,obraId,planId) {
  closeModal();
  App.loading(true);
  try {
    let dupOC;
    try {
      dupOC = await empresaCol('ordens_compra').where('numero_oc','==',num).where('obra_id','==',obraId).get();
    } catch(e) {
      const allOC = await empresaCol('ordens_compra').get();
      dupOC = { docs: allOC.docs.filter(d => d.data().numero_oc === num && d.data().obra_id === obraId) };
    }
    const dup = dupOC;
    for (const d of dup.docs) {
      await updateDoc2('ordens_compra', d.id, { status: 'cancelada' });
      let ls;
      try {
        ls = await empresaCol('lancamentos').where('origem_ref_id','==',d.id).where('status','==','ativo').get();
      } catch(e) {
        const allL = await empresaCol('lancamentos').get();
        ls = { docs: allL.docs.filter(doc => doc.data().origem_ref_id === d.id && doc.data().status === 'ativo') };
      }
      for (const l of ls.docs) await estornarLancamento(l.id);
    }
    await gravarOC(num,acao,forn,cnpj,parseFloat(valor),data,obraId,planId);
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function gravarOC(num,acao,forn,cnpj,valor,data,obraId,planId) {
  const ocId = await addDoc2('ordens_compra', {
    numero_oc:num, numero_acao:acao, fornecedor:forn, cnpj_fornecedor:cnpj,
    valor_total:valor, data_emissao:data, obra_id:obraId, planilha_id:planId, status:'ativa'
  });
  await addDoc2('lancamentos', {
    obra_id:obraId, planilha_id:planId,
    tipo:'despesa', categoria:'Material/OC',
    valor, descricao:`OC ${num} — ${forn}`,
    origem:'ordem_compra', origem_ref_id:ocId, status:'ativo'
  });
  App.loading(false);
  closeModal();
  App.toast(`OC ${num} importada! ${fmt(valor)} debitado imediatamente.`);
  App.navigate('ordens_compra');
}


// ── LANÇAMENTOS ───────────────────────────────────────────────
async function renderLancamentos() {
  const { lancamentos, obras, planilhas } = await loadAll();
  const main = document.getElementById('main-content');

  // Período padrão: início do mês atual
  const hoje    = new Date();
  const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
  const hojeStr   = today();

  // Totais rápidos
  const ativos = lancamentos.filter(l=>l.status==='ativo');
  const totalDesp = ativos.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+(l.valor||0),0);
  const totalRec  = ativos.filter(l=>l.tipo==='receita').reduce((s,l)=>s+(l.valor||0),0);

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">📊</div>Lançamentos</h1>
      <div class="page-actions">
        ${App.podeAgir('lancar')?`<button class="btn btn-primary" onclick="showNovoLancamento()">+ Novo</button>`:''}
      </div>
    </div>

    <!-- Totais rápidos -->
    <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Total Despesas</div><div class="stat-value sm red">${fmt(totalDesp)}</div></div><div class="stat-icon red">📉</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Total Receitas</div><div class="stat-value sm green">${fmt(totalRec)}</div></div><div class="stat-icon green">📈</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Saldo Período</div><div class="stat-value sm ${totalRec-totalDesp>=0?'green':'red'}">${fmt(totalRec-totalDesp)}</div></div><div class="stat-icon blue">⚖️</div></div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card" style="margin-bottom:12px">
      <div class="card-body" style="padding:14px">
        <div class="filter-row" style="flex-wrap:wrap;gap:8px">
          <select id="fl-obra" class="form-input" style="flex:1;min-width:140px" onchange="filtrarLancs()">
            <option value="">Todas as obras</option>
            ${obras.map(o=>`<option value="${o.id}">${o.nome}</option>`).join('')}
          </select>
          <select id="fl-origem" class="form-input" style="flex:1;min-width:130px" onchange="filtrarLancs()">
            <option value="">Todas as origens</option>
            <option value="ordem_compra">Ordem de Compra</option>
            <option value="funcionarios">Funcionários</option>
            <option value="repasse">Repasse</option>
            <option value="manual">Manual</option>
          </select>
          <select id="fl-tipo" class="form-input" style="flex:1;min-width:120px" onchange="filtrarLancs()">
            <option value="">Todos os tipos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
          </select>
        </div>
        <div class="filter-row" style="flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center">
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:200px">
            <label style="font-size:12px;color:var(--text2);white-space:nowrap">De:</label>
            <input id="fl-data-ini" class="form-input" type="date" value="${inicioMes}" onchange="filtrarLancs()" style="flex:1">
            <label style="font-size:12px;color:var(--text2);white-space:nowrap">Até:</label>
            <input id="fl-data-fim" class="form-input" type="date" value="${hojeStr}" onchange="filtrarLancs()" style="flex:1">
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="filtrarPeriodo('mes')">Este mês</button>
            <button class="btn btn-secondary btn-sm" onclick="filtrarPeriodo('trimestre')">Trimestre</button>
            <button class="btn btn-secondary btn-sm" onclick="filtrarPeriodo('tudo')">Tudo</button>
          </div>
        </div>
        <div id="fl-resumo" style="font-size:11px;color:var(--text3);margin-top:8px;text-align:right"></div>
      </div>
    </div>

    <div class="card" id="lancs-container">
      <div class="card-body"></div>
    </div>
  </div>`;

  window._lancsData = { lancamentos, obras, planilhas };
  filtrarLancs();
}

function filtrarPeriodo(tipo) {
  const hoje = new Date();
  let ini, fim = today();
  if (tipo === 'mes') {
    ini = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
  } else if (tipo === 'trimestre') {
    const d = new Date(hoje); d.setMonth(d.getMonth()-3);
    ini = d.toISOString().split('T')[0];
  } else {
    ini = '2020-01-01';
    fim = today();
  }
  document.getElementById('fl-data-ini').value = ini;
  document.getElementById('fl-data-fim').value = fim;
  filtrarLancs();
}

function filtrarLancs() {
  const obraF   = document.getElementById('fl-obra')?.value;
  const origemF = document.getElementById('fl-origem')?.value;
  const tipoF   = document.getElementById('fl-tipo')?.value;
  const dataIni = document.getElementById('fl-data-ini')?.value;
  const dataFim = document.getElementById('fl-data-fim')?.value;
  const { lancamentos, obras, planilhas } = window._lancsData;

  const filtrados = lancamentos.filter(l => {
    if (l.status !== 'ativo') return false;
    if (obraF   && l.obra_id !== obraF)   return false;
    if (origemF && l.origem  !== origemF)  return false;
    if (tipoF   && l.tipo    !== tipoF)    return false;
    if (dataIni || dataFim) {
      const d = l.created_at?.toDate?.() || null;
      if (d) {
        const ds = d.toISOString().split('T')[0];
        if (dataIni && ds < dataIni) return false;
        if (dataFim && ds > dataFim) return false;
      }
    }
    return true;
  });

  // Atualiza resumo
  const desp = filtrados.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+(l.valor||0),0);
  const rec  = filtrados.filter(l=>l.tipo==='receita').reduce((s,l)=>s+(l.valor||0),0);
  const resumoEl = document.getElementById('fl-resumo');
  if (resumoEl) resumoEl.innerHTML =
    `${filtrados.length} lançamento${filtrados.length!==1?'s':''} · Despesas: <strong style="color:var(--danger)">${fmt(desp)}</strong> · Receitas: <strong style="color:var(--success)">${fmt(rec)}</strong> · Saldo: <strong style="color:${rec-desp>=0?'var(--success)':'var(--danger)'}">${fmt(rec-desp)}</strong>`;

  document.querySelector('#lancs-container .card-body').innerHTML = renderLancList(filtrados, obras, planilhas);
}

function renderLancList(lancs, obras, planilhas) {
  const sorted = [...lancs].sort((a,b)=>(b.created_at?.toDate?.()||0)-(a.created_at?.toDate?.()||0));
  if (sorted.length===0) return '<div class="empty"><div class="empty-icon">📋</div>Nenhum lançamento encontrado</div>';
  return sorted.map(l => {
    const obra  = obras.find(o=>o.id===l.obra_id);
    const pl    = planilhas.find(p=>p.id===l.planilha_id);
    const icons = {ordem_compra:'📄', funcionarios:'👷', repasse:'↩', manual:'✏️'};
    const cls   = {ordem_compra:'oc', funcionarios:'func', repasse:'repasse', manual:'manual'};
    return `
    <div class="lanc-row">
      <div class="lanc-icon ${cls[l.origem]||'manual'}">${icons[l.origem]||'✏️'}</div>
      <div class="lanc-info">
        <div class="lanc-desc">${l.descricao||''}</div>
        <div class="lanc-meta">${obra?.nome||''} ${pl?'· '+pl.nome:''}</div>
        <div class="lanc-tags"><span class="tag">${l.categoria||''}</span> <span style="font-size:10px;color:var(--text3)">${fmtDate(l.created_at)}</span></div>
      </div>
      <div class="lanc-right">
        <div class="lanc-value ${l.tipo}">${l.tipo==='despesa'?'-':'+'}${fmt(l.valor)}</div>
        <button class="btn-link danger" onclick="excluirLancUI('${l.id}')">excluir</button>
      </div>
    </div>`;
  }).join('');
}

async function excluirLancUI(lancId, obraId = '') {
  if (!confirm('Excluir este lançamento? O valor será devolvido automaticamente ao saldo.')) return;
  App.loading(true);
  try {
    await deleteDoc2('lancamentos', lancId);
    App.toast('Lançamento excluído! Valor devolvido ao saldo.');
    if (obraId) {
      App.navigate('obra_detail', {id: obraId});
    } else {
      App.navigate('lancamentos');
    }
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

// NOVO LANÇAMENTO — Repasse = SAÍDA (despesa)
async function showNovoLancamento(obraIdPre = '') {
  const { obras, planilhas } = await loadAll();
  showModal({
    title: 'Novo Lançamento',
    body: `
      <div class="form-group">
        <label class="form-label">Tipo de Lançamento</label>
        <div class="toggle-group">
          <button id="tog-despesa" class="toggle-btn active" onclick="setTipoLanc('despesa')">💸 Despesa</button>
          <button id="tog-repasse" class="toggle-btn" onclick="setTipoLanc('repasse')">↩ Repasse</button>
          <button id="tog-receita" class="toggle-btn" onclick="setTipoLanc('receita')">📥 Receita</button>
        </div>
        <div id="tipo-hint" class="form-hint" style="color:var(--danger)">Saída de dinheiro da obra</div>
        <input type="hidden" id="nl-tipo" value="despesa">
        <input type="hidden" id="nl-obra-pre" value="${obraIdPre}">
      </div>
      <div class="form-group">
        <label class="form-label">Obra *</label>
        <select id="nl-obra" class="form-input" onchange="carregarPlanilhasNL()">
          <option value="">— Selecione —</option>
          ${obras.filter(o=>o.status==='ativa').map(o=>`<option value="${o.id}" ${o.id===obraIdPre?'selected':''}>${o.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Planilha (centro de custo)</label>
        <select id="nl-planilha" class="form-input">
          <option value="">Direto na obra (sem planilha específica)</option>
        </select>
        <div class="form-hint">Selecione uma planilha para debitar de um centro de custo específico</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select id="nl-cat" class="form-input">
            ${['Material','Serviço','Equipamento','Transporte','Alimentação','Folha','Repasse','Outros'].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Forma de Pagamento</label>
          <select id="nl-forma" class="form-input">
            ${['PIX','Dinheiro','Transferência','Boleto','Cartão','N/A'].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Valor (R$) *</label>
        <input id="nl-valor" class="form-input" type="number" step="0.01" placeholder="0,00">
      </div>
      <div class="form-group">
        <label class="form-label">Descrição *</label>
        <input id="nl-desc" class="form-input" placeholder="Descreva o lançamento">
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarNovoLanc()">✓ Salvar</button>`
  });

  if (obraIdPre) carregarPlanilhasNL();
}

function setTipoLanc(t) {
  document.getElementById('nl-tipo').value = t;
  ['despesa','repasse','receita'].forEach(x => {
    const el = document.getElementById('tog-'+x);
    if (el) el.classList.toggle('active', x===t);
  });
  const hint = document.getElementById('tipo-hint');
  if (hint) {
    if (t==='despesa') { hint.textContent='Saída de dinheiro da obra'; hint.style.color='var(--danger)'; }
    else if (t==='repasse') { hint.textContent='Repasse = saída de recursos (dinheiro repassado a terceiros)'; hint.style.color='var(--danger)'; }
    else { hint.textContent='Entrada de dinheiro na obra'; hint.style.color='var(--success)'; }
  }
}

async function carregarPlanilhasNL() {
  const obraId = document.getElementById('nl-obra')?.value;
  const sel    = document.getElementById('nl-planilha');
  if (!sel) return;
  if (!obraId) { sel.innerHTML='<option value="">Direto na obra</option>'; return; }
  let plSnap2;
  try {
    plSnap2 = await empresaCol('planilhas').where('obra_id','==',obraId).get();
  } catch(e) {
    const allPl2 = await empresaCol('planilhas').get();
    plSnap2 = { docs: allPl2.docs.filter(d => d.data().obra_id === obraId) };
  }
  const pls  = plSnap2.docs.map(d=>({id:d.id,...d.data()}));
  sel.innerHTML = '<option value="">Direto na obra (sem planilha específica)</option>'
    + pls.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
}

async function confirmarNovoLanc() {
  const tipoLogico = document.getElementById('nl-tipo').value;
  const obraId  = document.getElementById('nl-obra')?.value;
  const planId  = document.getElementById('nl-planilha')?.value;
  const cat     = document.getElementById('nl-cat')?.value;
  const forma   = document.getElementById('nl-forma')?.value;
  const valor   = parseFloat(document.getElementById('nl-valor')?.value)||0;
  const desc    = document.getElementById('nl-desc')?.value.trim();

  if (!obraId) return App.toast('Selecione a obra','error');
  if (!valor)  return App.toast('Informe o valor','error');
  if (!desc)   return App.toast('Informe a descrição','error');

  // REGRA: repasse = saída (despesa), não entrada
  const tipoReal = tipoLogico === 'receita' ? 'receita' : 'despesa';

  App.loading(true);
  try {
    await addDoc2('lancamentos', {
      obra_id: obraId,
      planilha_id: planId || null,
      tipo: tipoReal,
      categoria: tipoLogico==='repasse' ? 'Repasse' : cat,
      valor, descricao: desc,
      forma_pagamento: forma,
      origem: tipoLogico==='repasse' ? 'repasse' : 'manual',
      status: 'ativo',
    });
    closeModal();
    App.toast('Lançamento salvo!');
    const obraPreId = document.getElementById('nl-obra-pre')?.value;
    if (obraPreId) {
      App.navigate('obra_detail', {id: obraPreId});
    } else {
      App.navigate('lancamentos');
    }
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}




// ── HORAS EXTRAS ──────────────────────────────────────────────
async function renderHorasExtras() {
  const { funcionarios, obras } = await loadAll();
  const main = document.getElementById('main-content');

  const hoje = today();
  const inicioMes = hoje.substring(0,7)+'-01';

  // Busca registros de horas extras do mês atual
  let registros = [];
  try {
    const snapHE = await empresaCol('horas_extras').get();
    registros = snapHE.docs.map(d=>({id:d.id,...d.data()})).filter(r => r.data >= inicioMes);
  } catch(e) { console.warn('[horas_extras]', e.message); registros = []; }

  const ativos = funcionarios.filter(f=>f.ativo);

  // Totais do mês
  const totalHoras = registros.reduce((s,r)=>s+(r.horas||0),0);
  const totalValor = registros.reduce((s,r)=>s+(r.valor_calculado||0),0);

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">⏱</div>Horas Extras</h1>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('presenca')">← Presença</button>
        <button class="btn btn-primary" onclick="showRegistrarHoraExtra()">+ Registrar</button>
      </div>
    </div>

    <!-- Resumo do mês -->
    <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Total de Horas</div><div class="stat-value">${totalHoras.toFixed(1)}h</div></div><div class="stat-icon blue">⏱</div></div>
        <div class="stat-label">este mês</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Valor Total</div><div class="stat-value sm green">${fmt(totalValor)}</div></div><div class="stat-icon green">💰</div></div>
        <div class="stat-label">a pagar</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Registros</div><div class="stat-value">${registros.length}</div></div><div class="stat-icon blue">📋</div></div>
        <div class="stat-label">este mês</div>
      </div>
    </div>

    <!-- Por funcionário -->
    ${ativos.map(f => {
      const regsFunc = registros.filter(r=>r.funcionario_id===f.id)
        .sort((a,b)=>b.data.localeCompare(a.data));
      if (regsFunc.length === 0) return '';
      const totalH = regsFunc.reduce((s,r)=>s+(r.horas||0),0);
      const totalV = regsFunc.reduce((s,r)=>s+(r.valor_calculado||0),0);
      const jaPago = regsFunc.filter(r=>r.pago).reduce((s,r)=>s+(r.valor_calculado||0),0);
      const apagar = totalV - jaPago;

      return `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="func-avatar" style="width:36px;height:36px;font-size:13px">${f.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div>
            <div>
              <div style="font-size:14px;font-weight:700">${f.nome}</div>
              <div style="font-size:11px;color:var(--text3)">${totalH.toFixed(1)}h · ${fmt(totalV)} este mês</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${apagar>0?`<span style="font-size:12px;color:var(--warning);font-weight:700">${fmt(apagar)} a pagar</span>`:'<span style="font-size:11px;color:var(--success)">✓ Quitado</span>'}
            <button class="btn btn-primary btn-sm" onclick="pagarHorasExtras('${f.id}')">Pagar Extras</button>
          </div>
        </div>
        <div class="card-body">
          ${regsFunc.slice(0,8).map(r => {
            const obra = obras.find(o=>o.id===r.obra_id);
            const dt   = new Date(r.data+'T12:00:00');
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);gap:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600">${dt.toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'})}</div>
                <div style="font-size:11px;color:var(--text3)">${obra?.nome||'—'} · ${r.descricao||''}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:13px;font-weight:700;color:var(--blue-600)">${r.horas}h</div>
                <div style="font-size:11px;color:var(--success)">${fmt(r.valor_calculado)}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                ${r.pago?'<span class="badge ativa" style="font-size:9px">pago</span>':`
                  <button class="btn-link danger" style="font-size:11px" onclick="excluirHoraExtra('${r.id}')">excluir</button>`}
              </div>
            </div>`;
          }).join('')}
          ${regsFunc.length>8?`<div style="font-size:11px;color:var(--text3);text-align:center;padding-top:8px">+${regsFunc.length-8} registros mais antigos</div>`:''}
        </div>
      </div>`;
    }).join('')}

    ${registros.length===0?`
    <div class="empty-state">
      <span class="empty-icon">⏱</span>
      <p>Nenhuma hora extra registrada este mês.</p>
      <button class="btn btn-primary" onclick="showRegistrarHoraExtra()">Registrar primeiro</button>
    </div>`:''}
  </div>`;

  window._heData = { funcionarios: ativos, obras };
}

async function showRegistrarHoraExtra() {
  const funcs = App.cache.funcionarios.filter(f=>f.ativo);
  const obras  = App.cache.obras.filter(o=>o.status==='ativa');

  showModal({
    title: '⏱ Registrar Horas Extras',
    body: `
      <div class="form-group">
        <label class="form-label">Funcionário *</label>
        <select id="he-func" class="form-input" onchange="calcularValorHE()">
          <option value="">— Selecione —</option>
          ${funcs.map(f=>`<option value="${f.id}" data-base="${f.valor_base}" data-contrato="${f.tipo_contrato}">${f.nome} (${f.tipo_contrato})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data *</label>
          <input id="he-data" class="form-input" type="date" value="${today()}" onchange="calcularValorHE()">
        </div>
        <div class="form-group">
          <label class="form-label">Horas Extras *</label>
          <input id="he-horas" class="form-input" type="number" step="0.5" min="0.5" max="12" placeholder="2.0" oninput="calcularValorHE()">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Adicional sobre hora normal</label>
        <select id="he-adicional" class="form-input" onchange="calcularValorHE()">
          <option value="50">50% — Hora extra padrão (CLT)</option>
          <option value="100">100% — Feriado / Domingo</option>
          <option value="0">0% — Sem adicional (valor fixo)</option>
          <option value="custom">Outro %</option>
        </select>
      </div>
      <div id="he-custom-grp" style="display:none">
        <div class="form-group">
          <label class="form-label">Percentual personalizado (%)</label>
          <input id="he-pct-custom" class="form-input" type="number" min="0" max="200" placeholder="75" oninput="calcularValorHE()">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Obra *</label>
        <select id="he-obra" class="form-input">
          <option value="">— Selecione —</option>
          ${obras.map(o=>`<option value="${o.id}">${o.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Observação</label>
        <input id="he-desc" class="form-input" placeholder="Ex: Reforço para entrega do prazo">
      </div>
      <!-- Preview do cálculo -->
      <div id="he-preview" style="background:var(--surface2);border-radius:10px;padding:14px;margin-top:4px;display:none">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Cálculo automático</div>
        <div id="he-calc-detalhe" style="font-size:13px;color:var(--text2)"></div>
        <div id="he-calc-total" style="font-size:18px;font-weight:800;color:var(--success);margin-top:6px"></div>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarHoraExtra()">Registrar</button>`
  });

  // Listener para opção "Outro %"
  document.getElementById('he-adicional').addEventListener('change', function() {
    document.getElementById('he-custom-grp').style.display = this.value==='custom' ? '' : 'none';
    calcularValorHE();
  });
}

function calcularValorHE() {
  const sel    = document.getElementById('he-func');
  const horas  = parseFloat(document.getElementById('he-horas')?.value)||0;
  const adicEl = document.getElementById('he-adicional');
  if (!sel?.value || horas<=0) { document.getElementById('he-preview').style.display='none'; return; }

  const opt       = sel.options[sel.selectedIndex];
  const valorBase = parseFloat(opt.dataset.base)||0;
  const contrato  = opt.dataset.contrato;

  // Valor hora normal: mensalistas ÷ 220h, diaristas ÷ 8h
  const valorHoraNormal = contrato==='diarista' ? valorBase/8 : valorBase/220;

  let pct = parseFloat(adicEl?.value)||50;
  if (adicEl?.value==='custom') {
    pct = parseFloat(document.getElementById('he-pct-custom')?.value)||0;
  }

  const valorHoraExtra = valorHoraNormal * (1 + pct/100);
  const total = valorHoraExtra * horas;

  const preview = document.getElementById('he-preview');
  const detalhe = document.getElementById('he-calc-detalhe');
  const totalEl = document.getElementById('he-calc-total');

  if (preview) preview.style.display = '';
  if (detalhe) detalhe.innerHTML = `
    Hora normal: ${fmt(valorHoraNormal)} × adicional ${pct}% = <strong>${fmt(valorHoraExtra)}/h</strong><br>
    ${horas}h × ${fmt(valorHoraExtra)} =
  `;
  if (totalEl) totalEl.textContent = fmt(total);

  // Guarda para salvar
  window._heValorCalculado = total;
  window._heValorHora = valorHoraExtra;
}

async function salvarHoraExtra() {
  const funcId = document.getElementById('he-func')?.value;
  const data   = document.getElementById('he-data')?.value;
  const horas  = parseFloat(document.getElementById('he-horas')?.value)||0;
  const obraId = document.getElementById('he-obra')?.value;
  const desc   = document.getElementById('he-desc')?.value.trim();

  if (!funcId || !data || horas<=0 || !obraId) return App.toast('Preencha todos os campos obrigatórios','error');
  if (!window._heValorCalculado) return App.toast('Aguarde o cálculo automático','error');

  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  App.loading(true);
  try {
    await addDoc2('horas_extras', {
      funcionario_id:   funcId,
      funcionario_nome: func?.nome||'',
      obra_id:          obraId,
      data,
      horas,
      valor_hora:       window._heValorHora||0,
      valor_calculado:  window._heValorCalculado,
      descricao:        desc,
      pago:             false,
    });
    closeModal();
    App.toast(`${horas}h extras registradas — ${fmt(window._heValorCalculado)}`);
    App.navigate('horas_extras');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function pagarHorasExtras(funcId) {
  const func = App.cache.funcionarios.find(f=>f.id===funcId);
  if (!func) return;

  // Busca registros não pagos do mês
  const inicioMes = today().substring(0,7)+'-01';
  const snapHE2 = await empresaCol('horas_extras').get();
  const pendentes = snapHE2.docs.map(d=>({id:d.id,...d.data()}))
    .filter(r => r.funcionario_id === funcId && r.pago === false && r.data >= inicioMes);
  const totalHoras = pendentes.reduce((s,r)=>s+(r.horas||0),0);
  const totalValor = pendentes.reduce((s,r)=>s+(r.valor_calculado||0),0);

  if (pendentes.length===0) return App.toast('Não há horas extras pendentes de pagamento este mês.','info');

  const obras = App.cache.obras;
  // Usa a obra mais frequente nos registros
  const obraContagem = {};
  pendentes.forEach(r=>{ obraContagem[r.obra_id]=(obraContagem[r.obra_id]||0)+1; });
  const obraIdPrinc = Object.entries(obraContagem).sort((a,b)=>b[1]-a[1])[0]?.[0];

  showModal({
    title: `Pagar Horas Extras — ${func.nome}`,
    body: `
      <div class="stat-card" style="margin-bottom:16px;padding:16px">
        <div style="font-size:13px;color:var(--text2);margin-bottom:4px">${pendentes.length} registros · ${totalHoras.toFixed(1)} horas</div>
        <div style="font-size:24px;font-weight:800;color:var(--success)">${fmt(totalValor)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Obra para debitar *</label>
        <select id="hepg-obra" class="form-input">
          ${obras.filter(o=>o.status==='ativa').map(o=>`<option value="${o.id}" ${o.id===obraIdPrinc?'selected':''}>${o.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Forma de Pagamento</label>
        <select id="hepg-forma" class="form-input">
          ${['PIX','Dinheiro','Transferência','Vale','Cheque'].map(f=>`<option>${f}</option>`).join('')}
        </select>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarPagamentoHE('${funcId}',${JSON.stringify(pendentes.map(r=>r.id))},${totalValor})">Confirmar Pagamento</button>`
  });
}

async function confirmarPagamentoHE(funcId, ids, total) {
  const obraId = document.getElementById('hepg-obra')?.value;
  const forma  = document.getElementById('hepg-forma')?.value;
  const func   = App.cache.funcionarios.find(f=>f.id===funcId);
  if (!obraId) return App.toast('Selecione a obra','error');

  App.loading(true);
  try {
    // Marca registros como pagos
    for (const id of ids) {
      await updateDoc2('horas_extras', id, { pago: true, data_pagamento: today() });
    }
    // Gera lançamento de despesa
    await addDoc2('lancamentos', {
      obra_id:         obraId,
      planilha_id:     null,
      tipo:            'despesa',
      categoria:       'Folha',
      valor:           total,
      descricao:       `Horas extras — ${func?.nome||''} (${ids.length} registros)`,
      forma_pagamento: forma,
      origem:          'funcionarios',
      status:          'ativo',
    });
    closeModal();
    App.toast(`Pagamento de ${fmt(total)} registrado!`);
    App.navigate('horas_extras');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

async function excluirHoraExtra(id) {
  if (!confirm('Excluir este registro de hora extra?')) return;
  App.loading(true);
  try {
    await deleteDoc2('horas_extras', id);
    App.toast('Registro excluído.');
    App.navigate('horas_extras');
  } catch(e) { App.toast('Erro: '+e.message,'error'); }
  finally { App.loading(false); }
}

// ── EXPOR GLOBALMENTE ─────────────────────────────────────────
window.renderFuncionarios    = renderFuncionarios;
window.renderPresenca        = renderPresenca;
window.renderOC              = renderOC;
window.renderLancamentos     = renderLancamentos;
window.showNovoFuncionario   = showNovoFuncionario;
window.atualizarLabelValor   = atualizarLabelValor;
window.salvarFuncionario     = salvarFuncionario;
window.showEditarFuncionario = showEditarFuncionario;
window.atualizarLabelValorEd = atualizarLabelValorEd;
window.salvarEdicaoFuncionario = salvarEdicaoFuncionario;
window.inativarFuncionario   = inativarFuncionario;
window.excluirFuncionario    = excluirFuncionario;
window.showEditarAloc        = showEditarAloc;
window.salvarAloc            = salvarAloc;
window.showPagamento         = showPagamento;
window.calcDiaria            = calcDiaria;
window.confirmarPagamento    = confirmarPagamento;
window.showFolhaSugerida     = showFolhaSugerida;
window.confirmarFolha        = confirmarFolha;
window.reativarFunc          = reativarFunc;
window.togglePresenca        = togglePresenca;
window.pagarDiasPresenca     = pagarDiasPresenca;
window.showImportarOC        = showImportarOC;
window.processarArquivoOC    = processarArquivoOC;
window.buscarObraPorAcao     = buscarObraPorAcao;
window.carregarPlanilhasOI   = carregarPlanilhasOI;
window.mostrarFormOCManual   = mostrarFormOCManual;
window.confirmarImportacaoOC = confirmarImportacaoOC;
window.forcarImportacaoOC    = forcarImportacaoOC;
window.showEditarOC           = showEditarOC;
window.carregarPlanilhasEOC  = carregarPlanilhasEOC;
window.salvarEdicaoOC        = salvarEdicaoOC;
window.filtrarOCs            = filtrarOCs;
window.filtrarOCsPeriodo     = filtrarOCsPeriodo;
window.cancelarOCGlobal      = cancelarOCGlobal;
window.filtrarLancs          = filtrarLancs;
window.filtrarPeriodo        = filtrarPeriodo;
window.excluirLancUI         = excluirLancUI;
window.showNovoLancamento    = showNovoLancamento;
window.setTipoLanc           = setTipoLanc;
window.carregarPlanilhasNL   = carregarPlanilhasNL;
window.confirmarNovoLanc     = confirmarNovoLanc;
window.showHistoricoPagamentos = showHistoricoPagamentos;
window.exportarHistoricoFunc   = exportarHistoricoFunc;
window.renderHorasExtras       = renderHorasExtras;
window.showRegistrarHoraExtra  = showRegistrarHoraExtra;
window.calcularValorHE         = calcularValorHE;
window.salvarHoraExtra         = salvarHoraExtra;
window.pagarHorasExtras        = pagarHorasExtras;
window.confirmarPagamentoHE    = confirmarPagamentoHE;
window.excluirHoraExtra        = excluirHoraExtra;


// ── RELATÓRIOS ────────────────────────────────────────────────
async function renderRelatorios() {
  const { obras, planilhas, lancamentos, ordens_compra } = await loadAll();
  const main = document.getElementById('main-content');

  const ativos = lancamentos.filter(l => l.status === 'ativo');

  // ── Resumo financeiro por obra
  const resumoObras = obras.map(o => {
    const obraLancs = ativos.filter(l => l.obra_id === o.id);
    const desp  = obraLancs.filter(l => l.tipo === 'despesa').reduce((s,l) => s+(l.valor||0), 0);
    const rec   = obraLancs.filter(l => l.tipo === 'receita').reduce((s,l) => s+(l.valor||0), 0);
    const base  = (o.saldo_inicial||0) + planilhas.filter(p=>p.obra_id===o.id).reduce((s,p)=>s+(p.saldo_inicial||0),0);
    const saldo = base - desp + rec;
    const pct   = base > 0 ? Math.max(0, Math.min(100, (saldo/base)*100)) : 0;
    return { obra: o, desp, rec, base, saldo, pct, nLancs: obraLancs.length };
  }).sort((a,b) => b.desp - a.desp);

  // ── Top fornecedores (por OCs ativas)
  const fornMap = {};
  ordens_compra.filter(oc=>oc.status==='ativa').forEach(oc => {
    const key = oc.fornecedor || 'Sem fornecedor';
    if (!fornMap[key]) fornMap[key] = { total: 0, count: 0 };
    fornMap[key].total += (oc.valor_total||0);
    fornMap[key].count++;
  });
  const topForn = Object.entries(fornMap).sort((a,b)=>b[1].total-a[1].total).slice(0,8);

  // ── Gastos por categoria
  const catMap = {};
  ativos.filter(l=>l.tipo==='despesa').forEach(l => {
    const c = l.categoria || 'Outros';
    catMap[c] = (catMap[c]||0) + (l.valor||0);
  });
  const topCat = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const totalCat = topCat.reduce((s,[,v])=>s+v,0);

  // ── Evolução mensal (últimos 6 meses)
  const hoje = new Date();
  const meses = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
    meses.push({ ano: d.getFullYear(), mes: d.getMonth()+1,
      label: d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}) });
  }
  const evolucao = meses.map(m => {
    const despM = ativos.filter(l=>l.tipo==='despesa').reduce((s,l) => {
      const d = l.created_at?.toDate?.();
      if (!d) return s;
      return (d.getMonth()+1===m.mes && d.getFullYear()===m.ano) ? s+(l.valor||0) : s;
    }, 0);
    const recM = ativos.filter(l=>l.tipo==='receita').reduce((s,l) => {
      const d = l.created_at?.toDate?.();
      if (!d) return s;
      return (d.getMonth()+1===m.mes && d.getFullYear()===m.ano) ? s+(l.valor||0) : s;
    }, 0);
    return { ...m, desp: despM, rec: recM };
  });
  const maxEv = Math.max(...evolucao.map(e=>Math.max(e.desp,e.rec)), 1);

  // ── Totais gerais
  const totalDesp = ativos.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+(l.valor||0),0);
  const totalRec  = ativos.filter(l=>l.tipo==='receita').reduce((s,l)=>s+(l.valor||0),0);
  const totalBase = obras.reduce((s,o)=>{
    return s+(o.saldo_inicial||0)+planilhas.filter(p=>p.obra_id===o.id).reduce((ss,p)=>ss+(p.saldo_inicial||0),0);
  },0);

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">📈</div>Relatórios</h1>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="exportarRelatorioCSV()">⬇ Exportar CSV</button>
      </div>
    </div>

    <!-- KPIs gerais -->
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Total Despesas</div><div class="stat-value sm red">${fmt(totalDesp)}</div></div><div class="stat-icon red">📉</div></div>
        <div class="stat-label">${ativos.filter(l=>l.tipo==='despesa').length} lançamentos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Total Receitas</div><div class="stat-value sm green">${fmt(totalRec)}</div></div><div class="stat-icon green">📈</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Saldo Geral</div><div class="stat-value sm ${totalRec-totalDesp>=0?'green':'red'}">${fmt(totalRec-totalDesp)}</div></div><div class="stat-icon blue">⚖️</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Budget Total</div><div class="stat-value sm">${fmt(totalBase)}</div></div><div class="stat-icon blue">🏦</div></div>
        <div class="stat-label">${totalBase>0?((totalDesp/totalBase)*100).toFixed(1)+'% utilizado':''}</div>
      </div>
    </div>

    <!-- Evolução mensal -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title-lg">📅 Evolução Mensal (6 meses)</span></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;align-items:end;height:120px;margin-bottom:8px">
          ${evolucao.map(m => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;justify-content:flex-end">
            <div style="font-size:10px;color:var(--danger);font-weight:700">${m.desp>0?fmt(m.desp).replace('R$',''):'—'}</div>
            <div style="width:100%;display:flex;gap:2px;align-items:flex-end;height:80px">
              <div style="flex:1;background:var(--danger);opacity:.8;border-radius:3px 3px 0 0;height:${Math.max(4,(m.desp/maxEv)*80)}px" title="Despesas ${fmt(m.desp)}"></div>
              <div style="flex:1;background:var(--success);opacity:.8;border-radius:3px 3px 0 0;height:${Math.max(m.rec>0?4:0,(m.rec/maxEv)*80)}px" title="Receitas ${fmt(m.rec)}"></div>
            </div>
          </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">
          ${evolucao.map(m=>`<div style="text-align:center;font-size:10px;color:var(--text3)">${m.label}</div>`).join('')}
        </div>
        <div style="display:flex;gap:16px;margin-top:10px;justify-content:center">
          <span style="display:flex;align-items:center;gap:5px;font-size:11px"><span style="width:12px;height:12px;background:var(--danger);opacity:.8;border-radius:2px;display:inline-block"></span>Despesas</span>
          <span style="display:flex;align-items:center;gap:5px;font-size:11px"><span style="width:12px;height:12px;background:var(--success);opacity:.8;border-radius:2px;display:inline-block"></span>Receitas</span>
        </div>
      </div>
    </div>

    <div class="dash-grid">
      <!-- Resumo por obra -->
      <div class="card">
        <div class="card-header"><span class="card-title-lg">🏗 Resumo por Obra</span></div>
        <div class="card-body">
          ${resumoObras.length===0 ? '<div class="empty">Nenhuma obra</div>' :
            resumoObras.map(r => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="App.navigate('obra_detail',{id:'${r.obra.id}'})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
                <div>
                  <div style="font-size:13px;font-weight:700">${r.obra.nome}</div>
                  <div style="font-size:10px;color:var(--text3)">${r.nLancs} lançamentos · Budget: ${fmt(r.base)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:13px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--danger)">-${fmt(r.desp)}</div>
                  <div style="font-size:10px;color:${r.saldo<0?'var(--danger)':'var(--success)'}">Saldo: ${fmt(r.saldo)}</div>
                </div>
              </div>
              <div class="progress-wrap xs"><div class="progress-fill ${r.saldo<0?'danger':r.pct<25?'low':''}" style="width:${r.saldo<0?100:r.pct}%"></div></div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">${r.pct.toFixed(1)}% disponível</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Top fornecedores -->
      <div class="card">
        <div class="card-header"><span class="card-title-lg">🏭 Top Fornecedores</span></div>
        <div class="card-body">
          ${topForn.length===0 ? '<div class="empty">Nenhuma OC ativa</div>' :
            topForn.map(([nome, d], i) => `
            <div class="cat-row" style="padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
                <span style="font-size:12px;font-weight:800;color:var(--text3);width:18px">${i+1}</span>
                <div style="min-width:0">
                  <div class="cat-nome" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</div>
                  <div style="font-size:10px;color:var(--text3)">${d.count} OC${d.count!==1?'s':''}</div>
                </div>
              </div>
              <div class="cat-val">${fmt(d.total)}</div>
            </div>
            <div class="progress-wrap xs" style="margin-bottom:4px"><div class="progress-fill" style="width:${((d.total/topForn[0][1].total)*100).toFixed(0)}%"></div></div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Gastos por categoria -->
    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title-lg">🏷 Gastos por Categoria</span></div>
      <div class="card-body">
        ${topCat.length===0 ? '<div class="empty">Nenhum dado</div>' :
          `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
            ${topCat.map(([cat,val]) => `
            <div style="padding:12px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text2);margin-bottom:2px">${cat}</div>
              <div style="font-size:16px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--danger)">${fmt(val)}</div>
              <div class="progress-wrap xs" style="margin-top:6px"><div class="progress-fill" style="width:${totalCat>0?((val/totalCat)*100).toFixed(0):0}%"></div></div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">${totalCat>0?((val/totalCat)*100).toFixed(1):'0'}% do total</div>
            </div>`).join('')}
          </div>`}
      </div>
    </div>
  </div>`;
}

function exportarRelatorioCSV() {
  const obras    = App.cache.obras;
  const planilhas = App.cache.planilhas;
  const lancs    = App.cache.lancamentos.filter(l=>l.status==='ativo');

  let csv = 'Obra,Categoria,Descrição,Tipo,Valor,Data\n';
  lancs.sort((a,b)=>(b.created_at?.toDate?.()||0)-(a.created_at?.toDate?.()||0)).forEach(l => {
    const obra = obras.find(o=>o.id===l.obra_id);
    csv += `"${obra?.nome||'—'}","${l.categoria||''}","${l.descricao||''}","${l.tipo}","${(l.valor||0).toFixed(2)}","${fmtDate(l.created_at)}"\n`;
  });

  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download='relatorio-financeiro.csv'; a.click();
  URL.revokeObjectURL(url);
  App.toast('Relatório exportado!');
}

window.renderRelatorios   = renderRelatorios;
window.exportarRelatorioCSV = exportarRelatorioCSV;
