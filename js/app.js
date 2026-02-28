// ================================================================
// app.js — Core: estado, roteamento, helpers, Firebase
// ================================================================

// ── Perfis de Acesso ──────────────────────────────────────────
// admin       → acesso total
// encarregado → obras (só as suas), funcionários, presença, lançamentos
//               pode lançar despesas/OC/presença, criar funcionários, alocar na sua obra
// visualizador→ dashboard, obras (todas, só leitura), planilhas (só leitura)

const PERFIL_TELAS = {
  admin:        ['dashboard','obras','obra_detail','planilhas','funcionarios','presenca','horas_extras','ordens_compra','lancamentos','configuracoes'],
  encarregado:  ['obras','obra_detail','funcionarios','presenca','horas_extras','lancamentos'],
  visualizador: ['dashboard','obras','obra_detail','planilhas'],
};

const PERFIL_HOME = {
  admin:        'dashboard',
  encarregado:  'obras',
  visualizador: 'dashboard',
};

// Menus da sidebar visíveis por perfil
const PERFIL_NAV = {
  admin:        ['dashboard','obras','planilhas','funcionarios','presenca','horas_extras','ordens_compra','lancamentos','configuracoes'],
  encarregado:  ['obras','funcionarios','presenca','horas_extras','lancamentos'],
  visualizador: ['dashboard','obras','planilhas'],
};

// ── Estado Global ─────────────────────────────────────────────
var App = {
  user:      null,
  empresaId: EMPRESA_ID,
  page:      'dashboard',
  params:    {},
  perfil:    'visualizador', // padrão mais restrito até carregar
  obraIds:   [],             // obras atribuídas ao encarregado
  cache: { obras:[], planilhas:[], funcionarios:[], lancamentos:[], ordens_compra:[], alocacoes:[] },

  // Verifica se o perfil atual pode acessar esta tela
  podeAcessar(page) {
    return PERFIL_TELAS[this.perfil]?.includes(page) ?? false;
  },

  // Verifica se pode executar uma ação
  podeAgir(acao) {
    // ações: 'criar_obra','editar_obra','excluir_planilha','criar_planilha',
    //        'lancar','criar_funcionario','importar_oc','configuracoes','ver_dashboard'
    const regras = {
      admin:        true, // tudo
      encarregado:  ['lancar','criar_funcionario','importar_oc','alocar_funcionario'],
      visualizador: [],   // só leitura
    };
    if (this.perfil === 'admin') return true;
    const permitidas = regras[this.perfil] || [];
    return permitidas.includes(acao);
  },

  navigate(page, params = {}) {
    if (!this.podeAcessar(page)) {
      this.toast('Acesso não permitido para o seu perfil.', 'error');
      return;
    }
    this.page   = page;
    this.params = params;
    updateNav(page);
    renderPage(page, params);
    window.scrollTo(0, 0);
  },

  toast(msg, type = 'success') {
    const wrap = document.getElementById('toast-wrap');
    const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||'•'}</span><span class="toast-msg">${msg}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500);
  },

  loading(v) {
    document.getElementById('loading-overlay').style.display = v ? 'flex' : 'none';
  }
};

// ── Formatters ────────────────────────────────────────────────
const fmt = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v || 0);
const fmtDate = d => {
  if (!d) return '-';
  try { const dt = d?.toDate ? d.toDate() : new Date(d); return dt.toLocaleDateString('pt-BR'); }
  catch { return d; }
};
const today = () => new Date().toISOString().split('T')[0];
const mes = () => ({ mes: new Date().getMonth()+1, ano: new Date().getFullYear() });

// ── Cálculo de Saldos ─────────────────────────────────────────
function calcSaldoPlanilha(planilha, lancamentos) {
  const despesas = lancamentos
    .filter(l => l.planilha_id === planilha.id && l.status === 'ativo' && l.tipo === 'despesa')
    .reduce((s, l) => s + (l.valor || 0), 0);
  const receitas = lancamentos
    .filter(l => l.planilha_id === planilha.id && l.status === 'ativo' && l.tipo === 'receita')
    .reduce((s, l) => s + (l.valor || 0), 0);
  return (planilha.saldo_inicial || 0) - despesas + receitas;
}

function calcSaldoObra(obra, planilhas, lancamentos) {
  const basePlanilhas = planilhas
    .filter(p => p.obra_id === obra.id)
    .reduce((s, p) => s + (p.saldo_inicial || 0), 0);
  const base = (obra.saldo_inicial || 0) + basePlanilhas;
  const despesas = lancamentos
    .filter(l => l.obra_id === obra.id && l.status === 'ativo' && l.tipo === 'despesa')
    .reduce((s, l) => s + (l.valor || 0), 0);
  const receitas = lancamentos
    .filter(l => l.obra_id === obra.id && l.status === 'ativo' && l.tipo === 'receita')
    .reduce((s, l) => s + (l.valor || 0), 0);
  return base - despesas + receitas;
}

// ── Firebase Helpers ──────────────────────────────────────────
const empresaCol = sub => db.collection(`empresas/${App.empresaId}/${sub}`);

async function getAll(colName, orderField = 'created_at') {
  try {
    const snap = await empresaCol(colName).orderBy(orderField, 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    const snap = await empresaCol(colName).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

async function addDoc2(colName, data) {
  const ref = await empresaCol(colName).add({
    ...data,
    empresa_id: App.empresaId,
    created_at: firebase.firestore.FieldValue.serverTimestamp(),
    updated_at: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function updateDoc2(colName, id, data) {
  await empresaCol(colName).doc(id).update({
    ...data,
    updated_at: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function deleteDoc2(colName, id) {
  await empresaCol(colName).doc(id).delete();
}

async function loadAll() {
  let [obras, planilhas, funcionarios, lancamentos, ordens_compra, alocacoes] = await Promise.all([
    getAll('obras'), getAll('planilhas'), getAll('funcionarios'),
    getAll('lancamentos'), getAll('ordens_compra'), getAll('alocacoes', 'data_inicio'),
  ]);

  // Encarregado só vê suas obras atribuídas
  if (App.perfil === 'encarregado' && App.obraIds.length > 0) {
    obras        = obras.filter(o => App.obraIds.includes(o.id));
    planilhas    = planilhas.filter(p => App.obraIds.includes(p.obra_id));
    lancamentos  = lancamentos.filter(l => App.obraIds.includes(l.obra_id));
    ordens_compra= ordens_compra.filter(oc => App.obraIds.includes(oc.obra_id));
  }

  App.cache = { obras, planilhas, funcionarios, lancamentos, ordens_compra, alocacoes };
  return App.cache;
}

async function estornarLancamento(lancId) {
  const docRef = empresaCol('lancamentos').doc(lancId);
  const snap   = await docRef.get();
  if (!snap.exists) return;
  const l = snap.data();
  await docRef.update({ status: 'estornado' });
  await addDoc2('lancamentos', {
    obra_id:     l.obra_id,
    planilha_id: l.planilha_id || null,
    tipo:        l.tipo === 'despesa' ? 'receita' : 'despesa',
    categoria:   l.categoria,
    valor:       l.valor,
    descricao:   `[ESTORNO] ${l.descricao}`,
    origem:      l.origem,
    origem_ref_id: lancId,
    status:      'ativo',
  });
}

// ── Controle de Acesso — carrega perfil do Firestore ─────────
async function carregarPerfil(uid) {
  try {
    const snap = await empresaCol('usuarios').doc(uid).get();
    if (!snap.exists) {
      // Usuário não registrado na coleção → visualizador por padrão
      App.perfil  = 'visualizador';
      App.obraIds = [];
      return;
    }
    const dados = snap.data();
    // Suporte legado: campo "admin: true" vira perfil admin
    if (dados.admin === true || dados.perfil === 'admin') {
      App.perfil  = 'admin';
      App.obraIds = [];
    } else {
      App.perfil  = dados.perfil || 'visualizador';
      App.obraIds = dados.obra_ids || []; // obras atribuídas ao encarregado
    }
  } catch(e) {
    App.perfil  = 'visualizador';
    App.obraIds = [];
  }
}

// ── Atualiza interface conforme perfil ────────────────────────
function aplicarPerfil() {
  const permitidos = PERFIL_NAV[App.perfil] || [];

  // Sidebar
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.style.display = permitidos.includes(el.dataset.page) ? '' : 'none';
  });
  // Labels de seção — ocultar se todos itens abaixo estiverem ocultos
  document.querySelectorAll('.sidebar-section-label').forEach(lbl => {
    let prox = lbl.nextElementSibling;
    let temVisivel = false;
    while (prox && !prox.classList.contains('sidebar-section-label')) {
      if (prox.style.display !== 'none') temVisivel = true;
      prox = prox.nextElementSibling;
    }
    lbl.style.display = temVisivel ? '' : 'none';
  });

  // Bottom nav (mobile)
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(el => {
    el.style.display = permitidos.includes(el.dataset.page) ? '' : 'none';
  });

  // Badge de perfil na sidebar
  const badges = { admin:'🔑 Admin', encarregado:'🦺 Encarregado', visualizador:'👁 Visualizador' };
  const badgeEl = document.getElementById('sb-perfil-badge');
  if (badgeEl) badgeEl.textContent = badges[App.perfil] || '';

  // FAB e botão de lançamento rápido — só quem pode lançar
  const podeLancar = App.podeAgir('lancar');
  const fab = document.querySelector('.fab');
  if (fab) fab.style.display = podeLancar ? '' : 'none';
  const btnLancTop = document.getElementById('btn-lanc-top');
  if (btnLancTop) btnLancTop.style.display = podeLancar ? '' : 'none';
}

// ── Auth ──────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (user) {
    App.user = user;
    await carregarPerfil(user.uid);

    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').style.display   = 'flex';

    const email    = user.email || '';
    const initials = email.substring(0, 2).toUpperCase();
    document.getElementById('sb-user-initials').textContent = initials;
    document.getElementById('sb-user-email').textContent    = email;

    aplicarPerfil();

    App.navigate(PERFIL_HOME[App.perfil] || 'obras');
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display   = 'none';
  }
});

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return App.toast('Preencha e-mail e senha', 'error');
  App.loading(true);
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    const erros = {
      'auth/user-not-found':      'Usuário não encontrado.',
      'auth/wrong-password':      'Senha incorreta.',
      'auth/invalid-email':       'E-mail inválido.',
      'auth/user-disabled':       'Conta desativada. Contate o administrador.',
      'auth/too-many-requests':   'Muitas tentativas. Aguarde e tente novamente.',
      'auth/invalid-credential':  'E-mail ou senha incorretos.',
      'auth/network-request-failed':'Erro de conexão. Verifique sua internet.',
    };
    App.toast(erros[e.code] || 'Erro ao entrar.', 'error');
    document.getElementById('login-error').textContent = erros[e.code] || e.message;
  } finally {
    App.loading(false);
  }
}

async function doLogout() {
  if (confirm('Sair da conta?')) await auth.signOut();
}

// ── Roteamento ────────────────────────────────────────────────
function renderPage(page, params = {}) {
  const main = document.getElementById('main-content');
  main.innerHTML = `<div class="page-loading"><div class="spinner"></div><span>Carregando...</span></div>`;

  const titles = {
    dashboard:     'Dashboard',
    obras:         'Obras',
    obra_detail:   'Detalhe da Obra',
    planilhas:     'Planilhas',
    funcionarios:  'Funcionários',
    presenca:      'Controle de Presença',
    horas_extras:  'Horas Extras',
    ordens_compra: 'Ordens de Compra',
    lancamentos:   'Lançamentos',
    configuracoes: 'Configurações',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const map = {
    dashboard:     renderDashboard,
    obras:         renderObras,
    obra_detail:   renderObraDetail,
    planilhas:     renderPlanilhas,
    funcionarios:  renderFuncionarios,
    presenca:      renderPresenca,
    horas_extras:  renderHorasExtras,
    ordens_compra: renderOC,
    lancamentos:   renderLancamentos,
    configuracoes: renderConfig,
  };

  const fn = map[page];
  if (fn) fn(params).catch(e => {
    main.innerHTML = `<div class="alert danger no-click" style="margin:20px"><span>Erro: ${e.message}</span></div>`;
    console.error(e);
  });
}

function updateNav(page) {
  document.querySelectorAll('[data-page]').forEach(el => {
    const p = el.dataset.page;
    el.classList.toggle('active', p === page || (page === 'obra_detail' && p === 'obras'));
  });
}

// ── Modal Helpers ─────────────────────────────────────────────
function showModal(opts = {}) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal${opts.wide ? ' modal-wide' : ''}" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div class="modal-title">${opts.title || ''}</div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:6px;border-radius:8px">✕</button>
      </div>
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.footer ? `<div class="modal-footer">${opts.footer}</div>` : ''}
    </div>`;
  overlay.style.display = 'flex';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ── Configurações (somente Admin) ─────────────────────────────
async function renderConfig() {
  if (App.perfil !== 'admin') {
    document.getElementById('main-content').innerHTML = `
      <div class="page"><div class="alert danger no-click"><span>⛔ Acesso restrito ao administrador.</span></div></div>`;
    return;
  }

  const main = document.getElementById('main-content');
  App.loading(true);
  try {
    const snap    = await empresaCol('usuarios').get();
    const usuarios = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const todasObras = await getAll('obras');

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

      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title-lg">👥 Usuários do Sistema</span>
          <button class="btn btn-primary btn-sm" onclick="showNovoUsuario()">+ Adicionar</button>
        </div>
        <div class="card-body">
          ${usuarios.length === 0 ? '<div class="empty">Nenhum usuário cadastrado</div>' :
            usuarios.map(u => {
              const perfil = u.admin === true ? 'admin' : (u.perfil || 'visualizador');
              const obrasNomes = (u.obra_ids || [])
                .map(id => todasObras.find(o=>o.id===id)?.nome || id)
                .join(', ');
              return `
              <div class="func-row" style="align-items:flex-start">
                <div class="func-avatar">${(u.email||'?').substring(0,2).toUpperCase()}</div>
                <div class="func-info" style="flex:1">
                  <div class="func-name">${u.nome || u.email || u.uid}</div>
                  <div class="func-meta">${u.email || ''}</div>
                  <div style="margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    ${badgePerfil(perfil)}
                    ${perfil==='encarregado' && obrasNomes
                      ? `<span class="tag blue" style="font-size:10px">📍 ${obrasNomes}</span>`
                      : ''}
                  </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
                  ${u.uid !== App.user?.uid ? `
                    <button class="btn btn-secondary btn-sm" onclick="showEditarUsuario('${u.uid}')">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirUsuario('${u.uid}','${(u.nome||u.email||'').replace(/'/g,'&apos;')}')">Remover</button>
                  ` : `<span class="tag blue">Você</span>`}
                </div>
              </div>`;
            }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-lg">📖 Perfis de Acesso</span></div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;color:var(--text2)">
            <div style="padding:12px;background:var(--blue-50,#eff6ff);border-radius:10px;border-left:3px solid var(--blue-600)">
              <div style="font-weight:700;margin-bottom:4px">🔑 Administrador</div>
              <div>Acesso total ao sistema — todas as telas, criação, edição e exclusão de qualquer dado, configurações.</div>
            </div>
            <div style="padding:12px;background:#fffbeb;border-radius:10px;border-left:3px solid var(--warning)">
              <div style="font-weight:700;margin-bottom:4px">🦺 Encarregado</div>
              <div>Acessa <strong>Obras atribuídas, Funcionários, Presença e Lançamentos</strong>. Pode lançar despesas e OCs, criar funcionários e alocá-los na sua obra. Não vê Dashboard geral nem dados de outras obras.</div>
            </div>
            <div style="padding:12px;background:#f0fdf4;border-radius:10px;border-left:3px solid var(--success)">
              <div style="font-weight:700;margin-bottom:4px">👁 Visualizador</div>
              <div>Acessa <strong>Dashboard, Obras e Planilhas</strong> somente para consulta. Não pode criar, editar ou lançar nada.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header"><span class="card-title-lg">ℹ️ Como adicionar usuários</span></div>
        <div class="card-body">
          <div style="font-size:13px;color:var(--text2);line-height:1.8">
            <p><strong>Passo 1:</strong> Acesse o <a href="https://console.firebase.google.com" target="_blank" style="color:var(--blue-600)">Firebase Console</a> → Authentication → Add user. Crie o e-mail e senha.</p>
            <p><strong>Passo 2:</strong> Copie o <strong>UID</strong> do usuário criado.</p>
            <p><strong>Passo 3:</strong> Clique em <strong>"+ Adicionar"</strong> aqui, cole o UID, defina o perfil e (se Encarregado) selecione as obras atribuídas.</p>
          </div>
        </div>
      </div>
    </div>`;
  } finally {
    App.loading(false);
  }
}

async function showNovoUsuario() {
  const obras = await getAll('obras');
  showModal({
    title: 'Adicionar Usuário',
    body: `
      <div class="alert info no-click">
        <span class="alert-icon">ℹ</span>
        <span>Crie o usuário primeiro no Firebase Authentication, depois registre-o aqui com o UID.</span>
      </div>
      <div class="form-group">
        <label class="form-label">Nome *</label>
        <input id="nu-nome" class="form-input" placeholder="Nome completo">
      </div>
      <div class="form-group">
        <label class="form-label">E-mail *</label>
        <input id="nu-email" class="form-input" type="email" placeholder="email@exemplo.com">
      </div>
      <div class="form-group">
        <label class="form-label">UID do Firebase Auth *</label>
        <input id="nu-uid" class="form-input" placeholder="Cole o UID do Firebase Console">
        <div class="form-hint">Authentication → usuário → User UID</div>
      </div>
      <div class="form-group">
        <label class="form-label">Perfil de Acesso</label>
        <select id="nu-perfil" class="form-input" onchange="toggleObrasField('nu-obras-grp',this.value)">
          <option value="visualizador">👁 Visualizador — só leitura</option>
          <option value="encarregado">🦺 Encarregado — operacional nas suas obras</option>
          <option value="admin">🔑 Administrador — acesso total</option>
        </select>
      </div>
      <div id="nu-obras-grp" style="display:none">
        <div class="form-group">
          <label class="form-label">Obras Atribuídas</label>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:10px">
            ${obras.filter(o=>o.status==='ativa').map(o=>`
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" class="checkbox" value="${o.id}" id="nuo-${o.id}">
              ${o.nome} <span style="font-size:10px;color:var(--text3)">(${o.numero_acao||'—'})</span>
            </label>`).join('')}
            ${obras.filter(o=>o.status==='ativa').length===0 ? '<span style="font-size:12px;color:var(--text3)">Nenhuma obra ativa</span>' : ''}
          </div>
          <div class="form-hint">Se nenhuma for selecionada, o encarregado não verá obras.</div>
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarNovoUsuario()">Adicionar</button>`
  });
}

function toggleObrasField(grpId, perfil) {
  const grp = document.getElementById(grpId);
  if (grp) grp.style.display = perfil === 'encarregado' ? '' : 'none';
}

async function salvarNovoUsuario() {
  const nome   = document.getElementById('nu-nome').value.trim();
  const email  = document.getElementById('nu-email').value.trim();
  const uid    = document.getElementById('nu-uid').value.trim();
  const perfil = document.getElementById('nu-perfil').value;

  if (!nome || !email || !uid) return App.toast('Preencha todos os campos', 'error');

  const obraIds = perfil === 'encarregado'
    ? Array.from(document.querySelectorAll('#nu-obras-grp input[type=checkbox]:checked')).map(c=>c.value)
    : [];

  App.loading(true);
  try {
    await empresaCol('usuarios').doc(uid).set({
      nome, email, perfil,
      admin: perfil === 'admin',
      obra_ids: obraIds,
      empresa_id: App.empresaId,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeModal();
    App.toast(`Usuário ${nome} adicionado como ${perfil}!`);
    App.navigate('configuracoes');
  } catch(e) { App.toast('Erro: '+e.message, 'error'); }
  finally { App.loading(false); }
}

async function showEditarUsuario(uid) {
  const snap = await empresaCol('usuarios').doc(uid).get();
  if (!snap.exists) return App.toast('Usuário não encontrado','error');
  const u = { uid, ...snap.data() };
  const perfilAtual = u.admin === true ? 'admin' : (u.perfil || 'visualizador');
  const obras = await getAll('obras');

  showModal({
    title: 'Editar Usuário',
    body: `
      <div class="form-group">
        <label class="form-label">Nome *</label>
        <input id="eu-nome" class="form-input" value="${u.nome||''}">
      </div>
      <div class="form-group">
        <label class="form-label">E-mail</label>
        <input class="form-input" value="${u.email||''}" disabled style="opacity:.6">
      </div>
      <div class="form-group">
        <label class="form-label">Perfil de Acesso</label>
        <select id="eu-perfil" class="form-input" onchange="toggleObrasField('eu-obras-grp',this.value)">
          <option value="visualizador" ${perfilAtual==='visualizador'?'selected':''}>👁 Visualizador</option>
          <option value="encarregado"  ${perfilAtual==='encarregado'?'selected':''}>🦺 Encarregado</option>
          <option value="admin"        ${perfilAtual==='admin'?'selected':''}>🔑 Administrador</option>
        </select>
      </div>
      <div id="eu-obras-grp" style="display:${perfilAtual==='encarregado'?'':'none'}">
        <div class="form-group">
          <label class="form-label">Obras Atribuídas</label>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:10px">
            ${obras.filter(o=>o.status==='ativa').map(o=>`
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" class="checkbox" value="${o.id}" ${(u.obra_ids||[]).includes(o.id)?'checked':''}>
              ${o.nome} <span style="font-size:10px;color:var(--text3)">(${o.numero_acao||'—'})</span>
            </label>`).join('')}
          </div>
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicaoUsuario('${uid}')">Salvar</button>`
  });
}

async function salvarEdicaoUsuario(uid) {
  const nome   = document.getElementById('eu-nome').value.trim();
  const perfil = document.getElementById('eu-perfil').value;
  if (!nome) return App.toast('Informe o nome', 'error');

  const obraIds = perfil === 'encarregado'
    ? Array.from(document.querySelectorAll('#eu-obras-grp input[type=checkbox]:checked')).map(c=>c.value)
    : [];

  App.loading(true);
  try {
    await empresaCol('usuarios').doc(uid).update({
      nome, perfil,
      admin: perfil === 'admin',
      obra_ids: obraIds,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeModal();
    App.toast('Usuário atualizado!');
    App.navigate('configuracoes');
  } catch(e) { App.toast('Erro: '+e.message, 'error'); }
  finally { App.loading(false); }
}

async function excluirUsuario(uid, nome) {
  if (!confirm(`Remover "${nome}" do sistema?\n(A conta no Firebase Auth permanece.)`)) return;
  App.loading(true);
  try {
    await empresaCol('usuarios').doc(uid).delete();
    App.toast('Usuário removido.');
    App.navigate('configuracoes');
  } catch(e) { App.toast('Erro: '+e.message, 'error'); }
  finally { App.loading(false); }
}

// ── Expor Globalmente ─────────────────────────────────────────
window.App               = App;
window.fmt               = fmt;
window.fmtDate           = fmtDate;
window.today             = today;
window.mes               = mes;
window.calcSaldoPlanilha = calcSaldoPlanilha;
window.calcSaldoObra     = calcSaldoObra;
window.empresaCol        = empresaCol;
window.getAll            = getAll;
window.addDoc2           = addDoc2;
window.updateDoc2        = updateDoc2;
window.deleteDoc2        = deleteDoc2;
window.loadAll           = loadAll;
window.estornarLancamento  = estornarLancamento;
window.doLogin             = doLogin;
window.doLogout            = doLogout;
window.showModal           = showModal;
window.closeModal          = closeModal;
window.renderConfig        = renderConfig;
window.showNovoUsuario     = showNovoUsuario;
window.toggleObrasField    = toggleObrasField;
window.salvarNovoUsuario   = salvarNovoUsuario;
window.showEditarUsuario   = showEditarUsuario;
window.salvarEdicaoUsuario = salvarEdicaoUsuario;
window.excluirUsuario      = excluirUsuario;
