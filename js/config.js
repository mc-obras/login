// ================================================================
// config.js — Configurações, Backup/Restauração, Alertas
// ================================================================

// ── ALERTA DE SALDO CRÍTICO ───────────────────────────────────
// Chamado após loadAll() no dashboard e obra_detail
async function verificarSaldoCritico() {
  const { obras, planilhas, lancamentos } = App.cache;
  if (!obras.length) return;

  const alertas = [];

  // Planilhas com saldo negativo
  planilhas.forEach(p => {
    const s = calcSaldoPlanilha(p, lancamentos);
    if (s < 0) {
      const obra = obras.find(o=>o.id===p.obra_id);
      alertas.push({ tipo:'negativo', msg:`Planilha <strong>${p.nome}</strong> (${obra?.nome||''}) está com saldo negativo: ${fmt(s)}`, obraId:p.obra_id });
    }
  });

  // Obras com saldo abaixo de 10% do base
  obras.filter(o=>o.status==='ativa').forEach(o => {
    const s    = calcSaldoObra(o, planilhas, lancamentos);
    const base = (o.saldo_inicial||0) + planilhas.filter(p=>p.obra_id===o.id).reduce((ss,p)=>ss+(p.saldo_inicial||0),0);
    const pct  = base > 0 ? (s/base)*100 : 100;
    if (pct < 10 && pct >= 0 && base > 0) {
      alertas.push({ tipo:'critico', msg:`Obra <strong>${o.nome}</strong> com apenas ${pct.toFixed(1)}% do saldo restante (${fmt(s)})`, obraId:o.id });
    }
  });

  if (alertas.length === 0) return;

  // Alertas já dispensados na sessão atual
  if (!window._alertasDismissed) window._alertasDismissed = new Set();

  const alertasFiltrados = alertas.filter((_, i) => !window._alertasDismissed.has(i));
  if (alertasFiltrados.length === 0) return;

  // Mostra badge no menu e banner no topo do conteúdo
  const banner = document.getElementById('alertas-banner');
  if (banner) {
    banner.style.display = '';
    banner.innerHTML = alertas.map((a, i) => window._alertasDismissed.has(i) ? '' : `
      <div class="alert danger" id="alerta-item-${i}" style="cursor:pointer;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex:1" onclick="App.navigate('obra_detail',{id:'${a.obraId}'})">
          <span class="alert-icon">⚠</span>
          <span>${a.msg} — <u>Ver obra</u></span>
        </div>
        <button onclick="dispensarAlerta(${i}, event)" title="Dispensar aviso"
          style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:18px;font-weight:700;line-height:1;padding:0 4px;flex-shrink:0;opacity:0.7"
          onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">✕</button>
      </div>`).join('');
  }

  // Badge no nav
  document.querySelectorAll('[data-page="obras"]').forEach(el => {
    if (!el.querySelector('.alert-badge')) {
      const badge = document.createElement('span');
      badge.className = 'alert-badge';
      badge.textContent = alertasFiltrados.length;
      badge.style.cssText = 'background:var(--danger);color:white;border-radius:10px;font-size:9px;padding:1px 5px;margin-left:auto;font-weight:700';
      el.appendChild(badge);
    }
  });
}

function dispensarAlerta(index, event) {
  event.stopPropagation();
  if (!window._alertasDismissed) window._alertasDismissed = new Set();
  window._alertasDismissed.add(index);

  const item = document.getElementById('alerta-item-' + index);
  if (item) {
    item.style.transition = 'opacity 0.2s';
    item.style.opacity = '0';
    setTimeout(() => {
      item.remove();
      // Esconde o banner se não restar nenhum aviso visível
      const banner = document.getElementById('alertas-banner');
      if (banner && !banner.querySelector('[id^="alerta-item-"]')) {
        banner.style.display = 'none';
      }
      // Atualiza badge do nav
      document.querySelectorAll('.alert-badge').forEach(b => {
        const atual = parseInt(b.textContent) - 1;
        if (atual <= 0) b.remove();
        else b.textContent = atual;
      });
    }, 200);
  }
}

window.dispensarAlerta = dispensarAlerta;

// ── RENDERIZA CONFIGURAÇÕES ───────────────────────────────────
async function renderConfig() {
  if (App.perfil !== 'admin') {
    document.getElementById('main-content').innerHTML = `
      <div class="page"><div class="alert danger no-click"><span>⛔ Acesso restrito ao administrador.</span></div></div>`;
    return;
  }

  const main = document.getElementById('main-content');
  App.loading(true);
  try {
    const [usuariosSnap, contsSnap, todasObras] = await Promise.all([
      empresaCol('usuarios').get(),
      empresaCol('empresas_contratantes').get(),
      getAll('obras'),
    ]);

    const usuarios = usuariosSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const conts    = contsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const badgePerfil = p => ({
      admin:        '<span class="badge ativa" style="background:var(--blue-600);color:#fff">🔑 Admin</span>',
      encarregado:  '<span class="badge" style="background:var(--warning);color:#fff">🦺 Encarregado</span>',
      visualizador: '<span class="badge">👁 Visualizador</span>',
    }[p] || '<span class="badge">—</span>');

    main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title"><div class="page-title-icon">⚙️</div>Configurações</h1>
      </div>

      <!-- USUÁRIOS -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title-lg">👥 Usuários do Sistema</span>
          <button class="btn btn-primary btn-sm" onclick="showNovoUsuario()">+ Adicionar</button>
        </div>
        <div class="card-body">
          ${usuarios.length === 0
            ? '<div class="empty">Nenhum usuário cadastrado</div>'
            : usuarios.map(u => {
                const perfil    = u.admin === true ? 'admin' : (u.perfil || 'visualizador');
                const obrasNomes = (u.obra_ids || [])
                  .map(id => todasObras.find(o => o.id === id)?.nome || id)
                  .join(', ');
                return `
                <div class="func-row" style="align-items:flex-start;flex-wrap:wrap;gap:10px">
                  <div class="func-avatar">${(u.email||'?').substring(0,2).toUpperCase()}</div>
                  <div class="func-info" style="flex:1;min-width:160px">
                    <div class="func-name">${u.nome || u.email || u.uid}</div>
                    <div class="func-meta">${u.email || ''}</div>
                    <div style="margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                      ${badgePerfil(perfil)}
                      ${perfil === 'encarregado' && obrasNomes
                        ? `<span class="tag blue" style="font-size:10px">📍 ${obrasNomes}</span>`
                        : ''}
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
                    ${u.uid !== App.user?.uid
                      ? `<button class="btn btn-secondary btn-sm" onclick="showEditarUsuario('${u.uid}')">Editar</button>
                         <button class="btn btn-danger btn-sm" onclick="excluirUsuario('${u.uid}','${(u.nome||u.email||'').replace(/'/g,'&apos;')}')">Remover</button>`
                      : `<span class="tag blue">Você</span>`}
                  </div>
                </div>`;
              }).join('')}
        </div>
      </div>

      <!-- EMPRESAS CONTRATANTES -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title-lg">🏢 Empresas Contratantes</span>
          <button class="btn btn-primary btn-sm" onclick="showNovaContratante()">+ Adicionar</button>
        </div>
        <div class="card-body">
          ${conts.length === 0
            ? '<div class="empty">Nenhuma cadastrada</div>'
            : conts.map(c => `
              <div class="func-row">
                <div class="func-avatar" style="background:var(--blue-100);color:var(--blue-700)">🏢</div>
                <div class="func-info">
                  <div class="func-name">${c.nome}</div>
                  <div class="func-meta">${c.cnpj || 'CNPJ não informado'}</div>
                </div>
              </div>`).join('')}
        </div>
      </div>

      <!-- BACKUP E RESTAURAÇÃO -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title-lg">💾 Backup e Restauração</span></div>
        <div class="card-body">
          <div style="font-size:13px;color:var(--text2);margin-bottom:16px;line-height:1.7">
            O backup exporta <strong>todos os dados</strong> do sistema em um arquivo <code>.json</code> que você salva no computador.
            A restauração reimporta esse arquivo, com confirmação por coleção antes de sobrescrever qualquer dado.
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="fazerBackup()">⬇ Exportar Backup</button>
            <label class="btn btn-secondary" style="cursor:pointer">
              ⬆ Importar Backup
              <input type="file" accept=".json" style="display:none" onchange="iniciarRestauracao(this)">
            </label>
          </div>
          <div id="backup-status" style="margin-top:12px;font-size:12px;color:var(--text3)"></div>
        </div>
      </div>

      <!-- PERFIS INFO -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title-lg">📖 Perfis de Acesso</span></div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;color:var(--text2)">
            <div style="padding:12px;background:var(--blue-50,#eff6ff);border-radius:10px;border-left:3px solid var(--blue-600)">
              <div style="font-weight:700;margin-bottom:4px">🔑 Administrador</div>
              <div>Acesso total — todas as telas, criação, edição, exclusão e configurações.</div>
            </div>
            <div style="padding:12px;background:#fffbeb;border-radius:10px;border-left:3px solid var(--warning)">
              <div style="font-weight:700;margin-bottom:4px">🦺 Encarregado</div>
              <div>Obras atribuídas, Funcionários, Presença e Lançamentos. Pode lançar despesas e OCs, criar funcionários e alocá-los.</div>
            </div>
            <div style="padding:12px;background:#f0fdf4;border-radius:10px;border-left:3px solid var(--success)">
              <div style="font-weight:700;margin-bottom:4px">👁 Visualizador</div>
              <div>Dashboard, Obras e Planilhas somente leitura.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- COMO ADICIONAR -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title-lg">ℹ️ Como adicionar usuários</span></div>
        <div class="card-body">
          <div style="font-size:13px;color:var(--text2);line-height:1.9">
            <p><strong>Passo 1:</strong> Acesse o <a href="https://console.firebase.google.com" target="_blank" style="color:var(--blue-600)">Firebase Console</a> → Authentication → Add user.</p>
            <p><strong>Passo 2:</strong> Copie o <strong>UID</strong> gerado (clique no usuário → User UID).</p>
            <p><strong>Passo 3:</strong> Clique em <strong>"+ Adicionar"</strong> acima, cole o UID, defina o perfil e as obras.</p>
          </div>
        </div>
      </div>

      <!-- SOBRE -->
      <div class="card">
        <div class="card-header"><span class="card-title-lg">ℹ Sobre o Sistema</span></div>
        <div class="card-body">
          <div style="font-size:13px;color:var(--text2);line-height:1.8">
            <strong>Marques Caetano · Gestão de Obras v3.0</strong><br>
            Firebase Firestore · GitHub · Controle de Acesso por Perfil<br><br>
            ✓ Registros financeiros imutáveis (estorno)<br>
            ✓ Saldo calculado dinamicamente<br>
            ✓ Controle de presença e diaristas<br>
            ✓ Parser de OC (Ferreira Santos / ENGIX)<br>
            ✓ Backup e restauração completos<br>
            ✓ Alertas de saldo crítico<br>
            ✓ Filtro por período nos lançamentos<br>
            ✓ Histórico de pagamentos por funcionário<br>
            ✓ Controle de acesso (Admin / Encarregado / Visualizador)
          </div>
        </div>
      </div>
    </div>`;

  } finally {
    App.loading(false);
  }
}

// ── BACKUP ────────────────────────────────────────────────────
async function fazerBackup() {
  const status = document.getElementById('backup-status');
  if (status) status.textContent = 'Coletando dados...';
  App.loading(true);

  try {
    const colecoes = ['obras','planilhas','lancamentos','funcionarios','alocacoes','ordens_compra','usuarios','empresas_contratantes'];
    const backup = {
      versao: '3.0',
      empresa_id: App.empresaId,
      data_backup: new Date().toISOString(),
      dados: {}
    };

    for (const col of colecoes) {
      if (status) status.textContent = `Exportando: ${col}...`;
      const snap = await empresaCol(col).get();
      backup.dados[col] = snap.docs.map(d => ({
        _id: d.id,
        ...d.data(),
        // Converte Timestamps para string ISO
        ...Object.fromEntries(
          Object.entries(d.data()).map(([k,v]) => [
            k,
            v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v
          ])
        )
      }));
    }

    const json     = JSON.stringify(backup, null, 2);
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const dataStr  = new Date().toISOString().split('T')[0];
    a.href         = url;
    a.download     = `mc-obras-backup-${dataStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const total = Object.values(backup.dados).reduce((s,v)=>s+v.length,0);
    if (status) status.innerHTML = `✅ Backup gerado com sucesso — <strong>${total} registros</strong> exportados em ${dataStr}`;
    App.toast('Backup exportado com sucesso!');
  } catch(e) {
    if (status) status.textContent = '❌ Erro ao gerar backup: ' + e.message;
    App.toast('Erro no backup: '+e.message, 'error');
  } finally {
    App.loading(false);
  }
}

// ── RESTAURAÇÃO ───────────────────────────────────────────────
async function iniciarRestauracao(input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById('backup-status');

  try {
    const texto = await file.text();
    const backup = JSON.parse(texto);

    if (!backup.dados || !backup.versao) {
      App.toast('Arquivo inválido — não é um backup do MC Obras.', 'error');
      return;
    }

    const colecoes = Object.keys(backup.dados);
    const totais   = colecoes.map(c=>`${c}: ${backup.dados[c].length}`).join(', ');

    showModal({
      title: '⬆ Restaurar Backup',
      wide: true,
      body: `
        <div class="alert danger no-click">
          <span class="alert-icon">⚠</span>
          <span><strong>Atenção!</strong> A restauração pode sobrescrever dados existentes. Revise cada coleção antes de confirmar.</span>
        </div>
        <div style="font-size:13px;color:var(--text2);margin:12px 0">
          <strong>Arquivo:</strong> ${file.name}<br>
          <strong>Data do backup:</strong> ${backup.data_backup ? new Date(backup.data_backup).toLocaleString('pt-BR') : '—'}<br>
          <strong>Empresa:</strong> ${backup.empresa_id || '—'}
        </div>
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">Selecione quais coleções restaurar:</div>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto">
          ${colecoes.map(col => `
          <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <input type="checkbox" class="checkbox rest-col" value="${col}" checked>
              <span style="font-weight:600">${col}</span>
            </div>
            <span class="tag">${backup.dados[col].length} registros</span>
          </label>`).join('')}
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="confirmarRestauracao(${JSON.stringify(backup).replace(/"/g,'&quot;')})">⚠ Restaurar Selecionados</button>`
    });

  } catch(e) {
    App.toast('Erro ao ler arquivo: '+e.message, 'error');
  }

  // Reset input para permitir reselecionar o mesmo arquivo
  input.value = '';
}

async function confirmarRestauracao(backup) {
  const selecionadas = Array.from(document.querySelectorAll('.rest-col:checked')).map(c=>c.value);
  if (selecionadas.length === 0) return App.toast('Selecione ao menos uma coleção', 'error');

  if (!confirm(`Restaurar ${selecionadas.length} coleção(ões)?\n\nIsso irá SOBRESCREVER os dados existentes nessas coleções. Tem certeza?`)) return;

  closeModal();
  App.loading(true);
  const status = document.getElementById('backup-status');

  try {
    let totalImportado = 0;

    for (const col of selecionadas) {
      const docs = backup.dados[col] || [];
      if (status) status.textContent = `Restaurando ${col} (${docs.length} registros)...`;

      // Batch write (Firestore limita 500 por batch)
      const BATCH_SIZE = 400;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const lote  = docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        lote.forEach(doc => {
          const { _id, ...data } = doc;
          // Reconverte strings ISO de volta para datas onde aplicável
          const dataLimpa = Object.fromEntries(
            Object.entries(data).map(([k,v]) => {
              if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) &&
                  (k === 'created_at' || k === 'updated_at' || k === 'data_inicio' || k === 'data_fim')) {
                return [k, firebase.firestore.Timestamp.fromDate(new Date(v))];
              }
              return [k, v];
            })
          );
          const ref = empresaCol(col).doc(_id);
          batch.set(ref, dataLimpa);
        });
        await batch.commit();
        totalImportado += lote.length;
      }
    }

    if (status) status.innerHTML = `✅ Restauração concluída — <strong>${totalImportado} registros</strong> importados.`;
    App.toast(`Restauração concluída! ${totalImportado} registros importados.`);
    setTimeout(() => App.navigate('configuracoes'), 1500);

  } catch(e) {
    if (status) status.textContent = '❌ Erro na restauração: '+e.message;
    App.toast('Erro na restauração: '+e.message, 'error');
  } finally {
    App.loading(false);
  }
}

// ── EMPRESAS CONTRATANTES ─────────────────────────────────────
async function showNovaContratante() {
  showModal({
    title: 'Nova Empresa Contratante',
    body: `
      <div class="form-group">
        <label class="form-label">Nome *</label>
        <input id="ct-nome" class="form-input" placeholder="Ex: ENGIX Construções">
      </div>
      <div class="form-group">
        <label class="form-label">CNPJ</label>
        <input id="ct-cnpj" class="form-input" placeholder="00.000.000/0000-00">
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarContratante()">Salvar</button>`
  });
}

async function salvarContratante() {
  const nome = document.getElementById('ct-nome')?.value.trim();
  const cnpj = document.getElementById('ct-cnpj')?.value.trim();
  if (!nome) return App.toast('Informe o nome', 'error');
  App.loading(true);
  try {
    await addDoc2('empresas_contratantes', { nome, cnpj });
    closeModal();
    App.toast('Empresa contratante salva!');
    App.navigate('configuracoes');
  } catch(e) { App.toast('Erro: '+e.message, 'error'); }
  finally { App.loading(false); }
}

window.renderConfig          = renderConfig;
window.verificarSaldoCritico = verificarSaldoCritico;
window.fazerBackup           = fazerBackup;
window.iniciarRestauracao    = iniciarRestauracao;
window.confirmarRestauracao  = confirmarRestauracao;
window.showNovaContratante   = showNovaContratante;
window.salvarContratante     = salvarContratante;
