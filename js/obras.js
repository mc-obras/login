// ================================================================
// obras.js — Dashboard, Obras, Planilhas
// ================================================================

// ── DASHBOARD ─────────────────────────────────────────────────
async function renderDashboard() {
  const { obras, planilhas, lancamentos, funcionarios } = await loadAll();
  const main = document.getElementById('main-content');

  const saldoTotal  = obras.reduce((s, o) => s + calcSaldoObra(o, planilhas, lancamentos), 0);
  const baseTotal   = obras.reduce((s, o) => {
    const basePl = planilhas.filter(p=>p.obra_id===o.id).reduce((ss,p)=>ss+(p.saldo_inicial||0),0);
    return s + (o.saldo_inicial||0) + basePl;
  }, 0);
  const pctTotal    = baseTotal > 0 ? Math.max(0, Math.min(100, (saldoTotal/baseTotal)*100)) : 0;
  const folhaMes    = lancamentos.filter(l=>l.origem==='funcionarios'&&l.status==='ativo').reduce((s,l)=>s+(l.valor||0),0);
  const totalDesp   = lancamentos.filter(l=>l.tipo==='despesa'&&l.status==='ativo').reduce((s,l)=>s+(l.valor||0),0);
  const obrasAtivas = obras.filter(o=>o.status==='ativa').length;
  const negativos   = planilhas.filter(p=>calcSaldoPlanilha(p,lancamentos)<0);

  const now = new Date();
  const weekBars = Array.from({length:8},(_,i)=>{
    const wEnd=new Date(now); wEnd.setDate(now.getDate()-i*7);
    const wStart=new Date(wEnd); wStart.setDate(wEnd.getDate()-7);
    return lancamentos.filter(l=>{
      const d=l.created_at?.toDate?.()||new Date(0);
      return d>=wStart&&d<=wEnd&&l.tipo==='despesa'&&l.status==='ativo';
    }).reduce((s,l)=>s+(l.valor||0),0);
  }).reverse();
  const maxBar = Math.max(...weekBars,1);

  const catMap={};
  lancamentos.filter(l=>l.tipo==='despesa'&&l.status==='ativo').forEach(l=>{catMap[l.categoria]=(catMap[l.categoria]||0)+(l.valor||0);});
  const topCat=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const ultimos=[...lancamentos].filter(l=>l.status==='ativo').sort((a,b)=>(b.created_at?.toDate?.()||0)-(a.created_at?.toDate?.()||0)).slice(0,8);

  main.innerHTML = `
  <div class="page">
    <div class="stats-grid">
      <div class="stat-card" onclick="App.navigate('obras')" style="cursor:pointer">
        <div class="stat-card-inner"><div><div class="stat-label">Saldo Total</div><div class="stat-value sm ${saldoTotal<0?'red':'green'}">${fmt(saldoTotal)}</div></div><div class="stat-icon blue">🏦</div></div>
        <div class="progress-wrap" style="margin-top:10px"><div class="progress-fill ${pctTotal<25?'low':saldoTotal<0?'danger':''}" style="width:${saldoTotal<0?100:pctTotal}%"></div></div>
        <div class="stat-label" style="margin-top:4px">${pctTotal.toFixed(1)}% disponível de ${fmt(baseTotal)}</div>
      </div>
      <div class="stat-card" onclick="App.navigate('obras')" style="cursor:pointer">
        <div class="stat-card-inner"><div><div class="stat-label">Obras Ativas</div><div class="stat-value">${obrasAtivas}</div></div><div class="stat-icon blue">🏗</div></div>
        <div class="stat-label">${obras.length} total</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Folha do Mês</div><div class="stat-value sm">${fmt(folhaMes)}</div></div><div class="stat-icon green">👷</div></div>
        <div class="stat-label">${funcionarios.filter(f=>f.ativo).length} funcionários ativos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-inner"><div><div class="stat-label">Total Despesas</div><div class="stat-value sm red">${fmt(totalDesp)}</div></div><div class="stat-icon red">📉</div></div>
        <div class="stat-label">${lancamentos.filter(l=>l.tipo==='despesa'&&l.status==='ativo').length} lançamentos</div>
      </div>
    </div>

    ${negativos.length>0?`<div class="alert danger" onclick="App.navigate('planilhas')"><span class="alert-icon">⚠</span><span><strong>${negativos.length} planilha${negativos.length>1?'s':''} com saldo negativo</strong> — clique para visualizar</span></div>`:''}

    <div class="dash-grid" style="margin-bottom:16px">
      <div class="card">
        <div class="card-header"><span class="card-title">Gastos · Últimas 8 semanas</span><span class="tag">${fmt(weekBars[7])}</span></div>
        <div class="card-body">
          <div class="mini-bars">${weekBars.map((v,i)=>`<div class="mini-bar-col" title="${fmt(v)}"><div class="mini-bar ${i===7?'cur':''}" style="height:${Math.max(4,(v/maxBar)*100)}%"></div></div>`).join('')}</div>
          <div style="display:flex;justify-content:space-between;margin-top:6px"><span style="font-size:10px;color:var(--text3)">7 sem. atrás</span><span style="font-size:10px;color:var(--text3)">Esta semana</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Top Categorias</span></div>
        <div class="card-body">
          ${topCat.length===0?'<div class="empty">Nenhum dado</div>':topCat.map(([cat,val])=>`
          <div class="cat-row"><div class="cat-nome">${cat}</div><div class="cat-val">${fmt(val)}</div></div>
          <div class="progress-wrap xs" style="margin-bottom:8px"><div class="progress-fill" style="width:${(val/topCat[0][1]*100).toFixed(0)}%"></div></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Saldo por Obra</span><button class="btn-link" onclick="App.navigate('obras')">Ver todas →</button></div>
      <div class="card-body">
        ${obras.slice(0,5).map(o=>{
          const s=calcSaldoObra(o,planilhas,lancamentos);
          const base=(o.saldo_inicial||0)+planilhas.filter(p=>p.obra_id===o.id).reduce((ss,p)=>ss+(p.saldo_inicial||0),0);
          const pct=base>0?Math.max(0,Math.min(100,(s/base)*100)):0;
          return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;cursor:pointer" onclick="App.navigate('obra_detail',{id:'${o.id}'})">
            <div><div style="font-size:13px;font-weight:600">${o.nome}</div><div style="font-size:10px;color:var(--text3)">${o.empresa_contratante||''}</div></div>
            <div style="font-size:13px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${s<0?'var(--danger)':'var(--success)'}">${fmt(s)}</div>
          </div>
          <div class="progress-wrap sm" style="margin-bottom:12px"><div class="progress-fill ${s<0?'danger':pct<25?'low':''}" style="width:${s<0?100:pct}%"></div></div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Últimos Lançamentos</span><button class="btn-link" onclick="App.navigate('lancamentos')">Ver todos →</button></div>
      <div class="card-body">
        ${ultimos.length===0?'<div class="empty">Nenhum lançamento ainda</div>':ultimos.map(l=>{
          const obra=App.cache.obras.find(o=>o.id===l.obra_id);
          const icons={ordem_compra:'📄',funcionarios:'👷',repasse:'↩',manual:'✏️'};
          const cls={ordem_compra:'oc',funcionarios:'func',repasse:'repasse',manual:'manual'};
          return `<div class="lanc-row">
            <div class="lanc-icon ${cls[l.origem]||'manual'}">${icons[l.origem]||'✏️'}</div>
            <div class="lanc-info"><div class="lanc-desc">${l.descricao||''}</div><div class="lanc-meta">${obra?.nome||''} · ${fmtDate(l.created_at)}</div></div>
            <div class="lanc-value ${l.tipo}">${l.tipo==='despesa'?'-':'+'}${fmt(l.valor)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;

  // Verifica alertas de saldo crítico após render
  setTimeout(() => { if (typeof verificarSaldoCritico === 'function') verificarSaldoCritico(); }, 200);
}

// ── OBRAS ─────────────────────────────────────────────────────
async function renderObras() {
  const { obras, planilhas, lancamentos } = await loadAll();
  const main = document.getElementById('main-content');
  const isAdmin = App.perfil === 'admin';

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">🏗</div>Obras${App.perfil==='encarregado'?' (suas obras)':''}</h1>
      ${isAdmin?`<div class="page-actions"><button class="btn btn-primary" onclick="showNovaObra()">+ Nova Obra</button></div>`:''}
    </div>
    ${obras.length===0?`<div class="empty-state"><span class="empty-icon">🏗</span><p>${App.perfil==='encarregado'?'Nenhuma obra atribuída a você. Contate o administrador.':'Nenhuma obra cadastrada ainda.'}</p>${isAdmin?`<button class="btn btn-primary" onclick="showNovaObra()">Cadastrar primeira obra</button>`:''}</div>`:`
    <div class="obras-grid">
      ${obras.map(o=>{
        const s=calcSaldoObra(o,planilhas,lancamentos);
        const base=(o.saldo_inicial||0)+planilhas.filter(p=>p.obra_id===o.id).reduce((ss,p)=>ss+(p.saldo_inicial||0),0);
        const pct=base>0?Math.max(0,Math.min(100,(s/base)*100)):0;
        const pls=planilhas.filter(p=>p.obra_id===o.id);
        return `<div class="obra-card" onclick="App.navigate('obra_detail',{id:'${o.id}'})">
          <div class="obra-card-header">
            <div><div class="obra-card-nome">${o.nome}</div><div class="obra-card-acao">${o.numero_acao||'—'}</div></div>
            <span class="badge ${o.status}">${o.status}</span>
          </div>
          <div class="obra-card-tags">
            <span class="tag blue">${o.empresa_contratante||'Sem contratante'}</span>
            <span class="tag">${pls.length} planilha${pls.length!==1?'s':''}</span>
          </div>
          <div class="obra-saldo ${s<0?'negative':'positive'}">${fmt(s)}</div>
          <div class="obra-saldo-label">Base: ${fmt(base)} · ${pct.toFixed(1)}% disponível</div>
          <div class="progress-wrap"><div class="progress-fill ${s<0?'danger':pct<25?'low':''}" style="width:${s<0?100:pct}%"></div></div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

// ── OBRA DETAIL ───────────────────────────────────────────────
async function renderObraDetail(params={}) {
  const { obras, planilhas, lancamentos, ordens_compra } = await loadAll();
  const main = document.getElementById('main-content');
  const obra = obras.find(o=>o.id===params.id);
  if (!obra) { main.innerHTML='<div class="alert danger no-click" style="margin:20px">Obra não encontrada ou sem acesso.</div>'; return; }

  const s    = calcSaldoObra(obra,planilhas,lancamentos);
  const base = (obra.saldo_inicial||0)+planilhas.filter(p=>p.obra_id===obra.id).reduce((ss,p)=>ss+(p.saldo_inicial||0),0);
  const pct  = base>0?Math.max(0,Math.min(100,(s/base)*100)):0;
  const obraPlans = planilhas.filter(p=>p.obra_id===obra.id);
  const obraLancs = lancamentos.filter(l=>l.obra_id===obra.id&&l.status==='ativo').sort((a,b)=>(b.created_at?.toDate?.()||0)-(a.created_at?.toDate?.()||0));
  const obraOCs   = ordens_compra.filter(o=>o.obra_id===obra.id);

  const isAdmin      = App.perfil==='admin';
  const podeLancar   = App.podeAgir('lancar');
  const podeEditar   = isAdmin;

  main.innerHTML = `
  <div class="page">
    <button class="back-btn" onclick="App.navigate('obras')">← Voltar para Obras</button>

    <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,var(--blue-900),var(--blue-700));color:white;border:none">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.5);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">${obra.empresa_contratante||''} · ${obra.numero_acao||''}</div>
            <div style="font-size:22px;font-weight:800;margin-bottom:8px;letter-spacing:-.3px">${obra.nome}</div>
            <span class="badge ${obra.status}">${obra.status}</span>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:rgba(255,255,255,.5);margin-bottom:4px">Saldo Disponível</div>
            <div style="font-size:30px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${s<0?'#FCA5A5':'#6EE7B7'}">${fmt(s)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px">Base: ${fmt(base)}</div>
          </div>
        </div>
        <div style="background:rgba(255,255,255,.15);height:5px;border-radius:3px;overflow:hidden;margin-top:16px">
          <div style="height:100%;width:${s<0?100:pct}%;background:${s<0?'#F87171':'#34D399'};border-radius:3px;transition:width .5s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <span style="font-size:10px;color:rgba(255,255,255,.4)">${pct.toFixed(1)}% disponível</span>
          <span style="font-size:10px;color:rgba(255,255,255,.4)">Obra: ${fmt(obra.saldo_inicial||0)} + Planilhas: ${fmt(planilhas.filter(p=>p.obra_id===obra.id).reduce((ss,p)=>ss+(p.saldo_inicial||0),0))}</span>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
      ${podeLancar?`<button class="btn btn-primary" onclick="showNovoLancamento('${obra.id}')">+ Lançamento</button>`:''}
      ${podeLancar?`<button class="btn btn-secondary" onclick="showImportarOC('${obra.id}')">+ Importar OC</button>`:''}
      ${isAdmin?`<button class="btn btn-secondary" onclick="showNovaPlanilha('${obra.id}')">+ Planilha</button>`:''}
      ${podeEditar?`<button class="btn btn-secondary" onclick="showEditarObra('${obra.id}')">✏️ Editar</button>`:''}
      ${isAdmin&&obra.status==='ativa'?`<button class="btn btn-danger btn-sm" onclick="encerrarObra('${obra.id}')">Encerrar</button>`:''}
      ${isAdmin&&obra.status!=='ativa'?`<button class="btn btn-secondary btn-sm" onclick="reativarObra('${obra.id}')">Reativar</button>`:''}
      ${isAdmin?`<button class="btn btn-danger btn-sm" onclick="excluirObra('${obra.id}','${obra.nome.replace(/'/g,"\\'")}')">🗑 Excluir</button>`:''}
    </div>

    <div class="dash-grid">
      <!-- Planilhas -->
      <div class="card">
        <div class="card-header">
          <span class="card-title-lg">📋 Planilhas</span>
          ${isAdmin?`<button class="btn-link" onclick="showNovaPlanilha('${obra.id}')">+ Adicionar</button>`:''}
        </div>
        <div class="card-body">
          ${obraPlans.length===0?'<div class="empty">Nenhuma planilha cadastrada</div>':obraPlans.map(p=>{
            const ps=calcSaldoPlanilha(p,lancamentos);
            const pp=p.saldo_inicial>0?Math.max(0,Math.min(100,(ps/p.saldo_inicial)*100)):0;
            return `<div class="planilha-item ${ps<0?'negative':''}">
              <div class="planilha-item-info">
                <div class="planilha-item-name">${p.nome}</div>
                <div class="planilha-item-sub">Inicial: ${fmt(p.saldo_inicial||0)}</div>
                <div class="progress-wrap xs" style="margin-top:6px;width:120px"><div class="progress-fill ${ps<0?'danger':pp<25?'low':''}" style="width:${ps<0?100:pp}%"></div></div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                <div class="planilha-item-saldo ${ps<0?'negative':'positive'}">${fmt(ps)}</div>
                ${isAdmin?`<div style="display:flex;gap:6px">
                  <button class="btn-link" onclick="showEditarPlanilha('${p.id}','${obra.id}')">editar</button>
                  <span style="color:var(--border2)">|</span>
                  <button class="btn-link danger" onclick="excluirPlanilha('${p.id}','${obra.id}')">excluir</button>
                </div>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- OCs -->
      <div class="card">
        <div class="card-header">
          <span class="card-title-lg">📄 Ordens de Compra</span>
          <span class="tag">${obraOCs.filter(o=>o.status==='ativa').length} ativas</span>
        </div>
        <div class="card-body">
          ${obraOCs.length===0?'<div class="empty">Nenhuma OC</div>':obraOCs.slice(0,6).map(oc=>{
            const pl=planilhas.find(p=>p.id===oc.planilha_id);
            return `<div class="oc-row ${oc.status==='cancelada'?'cancelada':''}">
              <div class="oc-header"><span class="oc-num">OC ${oc.numero_oc||'—'}</span><span class="oc-date">${fmtDate(oc.data_emissao)}</span></div>
              <div class="oc-forn">${oc.fornecedor||'—'}</div>
              <div class="oc-footer">
                <span class="tag">${pl?.nome||'Direto na obra'}</span>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="oc-value">${fmt(oc.valor_total)}</span>
                  ${isAdmin&&oc.status==='ativa'?`<button class="btn-link danger" onclick="cancelarOC('${oc.id}','${obra.id}')">Cancelar</button>`:''}
                  ${oc.status==='cancelada'?`<span class="badge cancelada">cancelada</span>`:''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Lançamentos -->
    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title-lg">📊 Lançamentos da Obra</span><span class="tag">${obraLancs.length}</span></div>
      <div class="card-body">
        ${obraLancs.length===0?'<div class="empty">Nenhum lançamento</div>':obraLancs.map(l=>{
          const pl=planilhas.find(p=>p.id===l.planilha_id);
          const icons={ordem_compra:'📄',funcionarios:'👷',repasse:'↩',manual:'✏️'};
          const cls={ordem_compra:'oc',funcionarios:'func',repasse:'repasse',manual:'manual'};
          return `<div class="lanc-row">
            <div class="lanc-icon ${cls[l.origem]||'manual'}">${icons[l.origem]||'✏️'}</div>
            <div class="lanc-info">
              <div class="lanc-desc">${l.descricao||''}</div>
              <div class="lanc-meta">${pl?pl.nome:'Direto na obra'} · ${fmtDate(l.created_at)}</div>
              <div class="lanc-tags"><span class="tag">${l.categoria||''}</span></div>
            </div>
            <div class="lanc-right">
              <div class="lanc-value ${l.tipo}">${l.tipo==='despesa'?'-':'+'}${fmt(l.valor)}</div>
              ${isAdmin?`<button class="btn-link danger" onclick="estornarUI('${l.id}','${obra.id}')">estornar</button>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

// ── Modais de Obras (somente Admin) ───────────────────────────
async function showNovaObra() {
  if (!App.podeAgir('criar_obra')) return App.toast('Sem permissão','error');
  const snap = await empresaCol('empresas_contratantes').get();
  const conts = snap.docs.map(d=>({id:d.id,...d.data()}));
  showModal({
    title: 'Nova Obra',
    body: `
      <div class="form-group"><label class="form-label">Nome da Obra *</label><input id="on-nome" class="form-input" placeholder="Ex: Reforma Escola Municipal"></div>
      <div class="form-group"><label class="form-label">Número da Ação</label><input id="on-acao" class="form-input" placeholder="Ex: 1671" style="font-family:'JetBrains Mono',monospace"></div>
      <div class="form-group">
        <label class="form-label">Empresa Contratante</label>
        <input id="on-cont" class="form-input" placeholder="Ex: ENGIX, Ferreira Santos..." list="conts-dl">
        <datalist id="conts-dl">${conts.map(c=>`<option value="${c.nome}">`).join('')}</datalist>
      </div>
      <div class="alert info no-click" style="margin-top:8px"><span class="alert-icon">ℹ</span><span>O saldo da obra será composto pelo saldo das planilhas adicionadas.</span></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarObra()">Criar Obra</button>`
  });
}

async function salvarObra() {
  const nome=document.getElementById('on-nome').value.trim();
  const acao=document.getElementById('on-acao').value.trim();
  const cont=document.getElementById('on-cont').value.trim();
  if (!nome) return App.toast('Informe o nome da obra','error');
  App.loading(true);
  try {
    await addDoc2('obras',{nome,numero_acao:acao,saldo_inicial:0,empresa_contratante:cont,status:'ativa'});
    closeModal(); App.toast('Obra criada!'); App.navigate('obras');
  } catch(e){App.toast('Erro: '+e.message,'error');}
  finally{App.loading(false);}
}

async function showEditarObra(obraId) {
  const obra=App.cache.obras.find(o=>o.id===obraId); if(!obra) return;
  const snap=await empresaCol('empresas_contratantes').get();
  const conts=snap.docs.map(d=>({id:d.id,...d.data()}));
  showModal({
    title:'Editar Obra',
    body:`
      <div class="form-group"><label class="form-label">Nome da Obra *</label><input id="eo-nome" class="form-input" value="${obra.nome}"></div>
      <div class="form-group"><label class="form-label">Número da Ação</label><input id="eo-acao" class="form-input" value="${obra.numero_acao||''}" style="font-family:'JetBrains Mono',monospace"></div>
      <div class="form-group"><label class="form-label">Empresa Contratante</label><input id="eo-cont" class="form-input" value="${obra.empresa_contratante||''}" list="conts-dl2"><datalist id="conts-dl2">${conts.map(c=>`<option value="${c.nome}">`).join('')}</datalist></div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarEdicaoObra('${obraId}')">Salvar</button>`
  });
}

async function salvarEdicaoObra(obraId) {
  const nome=document.getElementById('eo-nome').value.trim();
  const acao=document.getElementById('eo-acao').value.trim();
  const cont=document.getElementById('eo-cont').value.trim();
  if(!nome) return App.toast('Informe o nome','error');
  App.loading(true);
  try {
    await updateDoc2('obras',obraId,{nome,numero_acao:acao,empresa_contratante:cont});
    closeModal(); App.toast('Obra atualizada!'); App.navigate('obra_detail',{id:obraId});
  } catch(e){App.toast('Erro: '+e.message,'error');}
  finally{App.loading(false);}
}

async function showNovaPlanilha(obraId) {
  showModal({
    title:'Nova Planilha',
    body:`
      <div class="alert info no-click"><span class="alert-icon">ℹ</span><span>O saldo desta planilha será somado ao saldo total da obra.</span></div>
      <div class="form-group"><label class="form-label">Nome da Planilha *</label><input id="pn-nome" class="form-input" placeholder="Ex: Estrutura, Acabamento..."></div>
      <div class="form-group"><label class="form-label">Saldo Inicial (R$) *</label><input id="pn-saldo" class="form-input" type="number" step="0.01" placeholder="0,00"><div class="form-hint">Valor destinado a este centro de custo</div></div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarPlanilha('${obraId}')">Criar</button>`
  });
}

async function salvarPlanilha(obraId) {
  const nome=document.getElementById('pn-nome').value.trim();
  const saldo=parseFloat(document.getElementById('pn-saldo').value)||0;
  if(!nome) return App.toast('Informe o nome','error');
  App.loading(true);
  try {
    await addDoc2('planilhas',{obra_id:obraId,nome,saldo_inicial:saldo,status:'ativa'});
    closeModal(); App.toast(`Planilha "${nome}" criada!`); App.navigate('obra_detail',{id:obraId});
  } catch(e){App.toast('Erro: '+e.message,'error');}
  finally{App.loading(false);}
}

async function showEditarPlanilha(planilhaId, obraId) {
  const p=App.cache.planilhas.find(p=>p.id===planilhaId); if(!p) return;
  showModal({
    title:'Editar Planilha',
    body:`
      <div class="form-group"><label class="form-label">Nome *</label><input id="ep-nome" class="form-input" value="${p.nome}"></div>
      <div class="form-group"><label class="form-label">Saldo Inicial (R$)</label><input id="ep-saldo" class="form-input" type="number" step="0.01" value="${p.saldo_inicial||0}"><div class="form-hint">Alterar afeta o saldo disponível.</div></div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarEdicaoPlanilha('${planilhaId}','${obraId}')">Salvar</button>`
  });
}

async function salvarEdicaoPlanilha(planilhaId, obraId) {
  const nome=document.getElementById('ep-nome').value.trim();
  const saldo=parseFloat(document.getElementById('ep-saldo').value)||0;
  if(!nome) return App.toast('Informe o nome','error');
  App.loading(true);
  try {
    await updateDoc2('planilhas',planilhaId,{nome,saldo_inicial:saldo});
    closeModal(); App.toast('Planilha atualizada!'); App.navigate('obra_detail',{id:obraId});
  } catch(e){App.toast('Erro: '+e.message,'error');}
  finally{App.loading(false);}
}

async function excluirPlanilha(planilhaId, obraId) {
  const p=App.cache.planilhas.find(p=>p.id===planilhaId);
  if(App.cache.lancamentos.some(l=>l.planilha_id===planilhaId&&l.status==='ativo'))
    return App.toast('Planilha possui lançamentos ativos. Estorne-os antes.','error');
  if(!confirm(`Excluir a planilha "${p?.nome}"? Esta ação não pode ser desfeita.`)) return;
  App.loading(true);
  try {
    await deleteDoc2('planilhas',planilhaId);
    App.toast('Planilha excluída.'); App.navigate('obra_detail',{id:obraId});
  } catch(e){App.toast('Erro: '+e.message,'error');}
  finally{App.loading(false);}
}

async function encerrarObra(id) {
  if(!confirm('Encerrar esta obra?')) return;
  await updateDoc2('obras',id,{status:'encerrada'});
  App.toast('Obra encerrada'); App.navigate('obra_detail',{id});
}

async function reativarObra(id) {
  await updateDoc2('obras',id,{status:'ativa'});
  App.toast('Obra reativada!'); App.navigate('obra_detail',{id});
}

async function excluirObra(id, nome) {
  // Verificação de segurança: checa lançamentos e planilhas ativas
  const lancsAtivos = App.cache.lancamentos.filter(l=>l.obra_id===id&&l.status==='ativo');
  const planilhas   = App.cache.planilhas.filter(p=>p.obra_id===id);

  if (lancsAtivos.length > 0) {
    return App.toast(`Não é possível excluir: a obra possui ${lancsAtivos.length} lançamento(s) ativo(s). Estorne todos antes de excluir.`, 'error');
  }

  const confirmMsg = planilhas.length > 0
    ? `Excluir permanentemente a obra "${nome}"?\n\nIsso também excluirá ${planilhas.length} planilha(s) vinculada(s).\n\n⚠ Esta ação não pode ser desfeita.`
    : `Excluir permanentemente a obra "${nome}"?\n\n⚠ Esta ação não pode ser desfeita.`;

  if (!confirm(confirmMsg)) return;

  App.loading(true);
  try {
    // Exclui planilhas vinculadas
    for (const p of planilhas) {
      await deleteDoc2('planilhas', p.id);
    }
    // Exclui OCs vinculadas
    const obraOCs = App.cache.ordens_compra.filter(oc=>oc.obra_id===id);
    for (const oc of obraOCs) {
      await deleteDoc2('ordens_compra', oc.id);
    }
    // Exclui a obra
    await deleteDoc2('obras', id);
    App.toast(`Obra "${nome}" excluída.`);
    App.navigate('obras');
  } catch(e) { App.toast('Erro: '+e.message, 'error'); }
  finally { App.loading(false); }
}

async function estornarUI(lancId, obraId) {
  if(!confirm('Estornar este lançamento?')) return;
  App.loading(true);
  try {
    await estornarLancamento(lancId);
    App.toast('Lançamento estornado!'); App.navigate('obra_detail',{id:obraId});
  } catch(e){App.toast('Erro: '+e.message,'error');}
  finally{App.loading(false);}
}

async function cancelarOC(ocId, obraId) {
  if(!confirm('Cancelar esta OC? Será gerado estorno automático.')) return;
  App.loading(true);
  try {
    await updateDoc2('ordens_compra',ocId,{status:'cancelada'});
    const snap=await empresaCol('lancamentos').where('origem_ref_id','==',ocId).where('status','==','ativo').get();
    for(const d of snap.docs) await estornarLancamento(d.id);
    App.toast('OC cancelada!'); App.navigate('obra_detail',{id:obraId});
  } catch(e){App.toast('Erro: '+e.message,'error');}
  finally{App.loading(false);}
}

// ── PLANILHAS PAGE ────────────────────────────────────────────
async function renderPlanilhas() {
  const { obras, planilhas, lancamentos } = await loadAll();
  const main = document.getElementById('main-content');
  const isAdmin = App.perfil === 'admin';

  // Obras visíveis — encarregado só vê as suas
  const obrasVisiveis = App.perfil === 'encarregado'
    ? obras.filter(o => App.obraIds.includes(o.id))
    : obras;

  const temObras = obrasVisiveis.length > 0;

  main.innerHTML = `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><div class="page-title-icon">📋</div>Planilhas</h1>
    </div>

    ${!temObras ? '<div class="empty-state"><span class="empty-icon">📋</span><p>Nenhuma obra disponível.</p></div>' :
      obrasVisiveis.map(o => {
        const obraPls = planilhas.filter(p=>p.obra_id===o.id);
        return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div>
              <div class="card-title-lg" style="cursor:pointer" onclick="App.navigate('obra_detail',{id:'${o.id}'})">${o.nome}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${o.empresa_contratante||''} · Nº ${o.numero_acao||'—'} · <span class="badge ${o.status}" style="font-size:10px">${o.status}</span></div>
            </div>
            ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="showNovaPlanilha('${o.id}')">+ Planilha</button>` : ''}
          </div>
          <div class="card-body">
            ${obraPls.length === 0
              ? `<div class="empty" style="padding:12px 0">Nenhuma planilha cadastrada nesta obra${isAdmin?' — clique em "+ Planilha" para adicionar':''}</div>`
              : obraPls.map(p => {
                  const s   = calcSaldoPlanilha(p, lancamentos);
                  const pct = p.saldo_inicial>0 ? Math.max(0,Math.min(100,(s/p.saldo_inicial)*100)) : 0;
                  return `
                  <div style="padding:12px 0;border-bottom:1px solid var(--border);${s<0?'border-left:3px solid var(--danger);padding-left:10px':''}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                      <div style="flex:1;min-width:0">
                        <div style="font-size:14px;font-weight:700;margin-bottom:2px">${p.nome}</div>
                        ${isAdmin ? `<div style="display:flex;gap:8px;margin-top:4px">
                          <button class="btn-link" onclick="showEditarPlanilha('${p.id}','${o.id}')">editar</button>
                          <span style="color:var(--border2)">|</span>
                          <button class="btn-link danger" onclick="excluirPlanilha('${p.id}','${o.id}')">excluir</button>
                        </div>` : ''}
                      </div>
                      <div style="text-align:right;flex-shrink:0">
                        <div style="font-size:18px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${s<0?'var(--danger)':'var(--success)'}">${fmt(s)}</div>
                        <div style="font-size:10px;color:var(--text3)">de ${fmt(p.saldo_inicial||0)}</div>
                      </div>
                    </div>
                    ${s<0 ? '<div style="font-size:11px;color:var(--danger);margin-top:4px">⚠ Saldo negativo</div>' : ''}
                    <div class="progress-wrap" style="margin-top:8px"><div class="progress-fill ${s<0?'danger':pct<25?'low':''}" style="width:${s<0?100:pct}%"></div></div>
                    <div style="font-size:10px;color:var(--text3);margin-top:3px">${pct.toFixed(1)}% disponível</div>
                  </div>`;
                }).join('')}
          </div>
        </div>`;
      }).join('')}
  </div>`;
}

// ── Expor ─────────────────────────────────────────────────────
window.renderDashboard      = renderDashboard;
window.renderObras          = renderObras;
window.renderObraDetail     = renderObraDetail;
window.renderPlanilhas      = renderPlanilhas;
window.showNovaObra         = showNovaObra;
window.salvarObra           = salvarObra;
window.showEditarObra       = showEditarObra;
window.salvarEdicaoObra     = salvarEdicaoObra;
window.showNovaPlanilha     = showNovaPlanilha;
window.salvarPlanilha       = salvarPlanilha;
window.showEditarPlanilha   = showEditarPlanilha;
window.salvarEdicaoPlanilha = salvarEdicaoPlanilha;
window.excluirPlanilha      = excluirPlanilha;
window.encerrarObra         = encerrarObra;
window.reativarObra         = reativarObra;
window.excluirObra          = excluirObra;
window.estornarUI           = estornarUI;
window.cancelarOC           = cancelarOC;
