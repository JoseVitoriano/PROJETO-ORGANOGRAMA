/* ==========================================================================
   Estrutura Organizacional — Front-end (SPA em JavaScript puro)
   ========================================================================== */

const CARGO_SUGESTOES = [
  'GERENTE', 'SUB GERENTE', 'ESTOQUISTA', 'PREVISÃO', 'LÍDER DE DEPÓSITO',
  'OPERACIONAL 1', 'OPERACIONAL 2', 'COLABORADOR',
];

function cargoColor(cargo) {
  const c = (cargo || '').trim().toUpperCase();
  if (c === 'GERENTE') return 'var(--node-gerente)';
  if (c === 'SUB GERENTE') return 'var(--node-subgerente)';
  if (c === 'LÍDER DE DEPÓSITO') return 'var(--node-lider)';
  if (c === 'OPERACIONAL 1' || c === 'OPERACIONAL 2') return 'var(--node-op)';
  return 'var(--node-default)';
}

/* ---------------------------------- Utilitários ---------------------------------- */

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ------------------------------------ API ---------------------------------------- */

const SERVER_OFFLINE_MSG =
  'Não foi possível conectar ao servidor. Verifique se você rodou "node server.js" no terminal e se está acessando http://localhost:3001 (não abra o arquivo index.html diretamente).';

let offlineBannerShown = false;
function showOfflineBanner() {
  if (offlineBannerShown) return;
  offlineBannerShown = true;
  const content = document.getElementById('content');
  if (content) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">⚠️ Sem conexão com o servidor</div>${esc(SERVER_OFFLINE_MSG)}</div>`;
  }
  toast(SERVER_OFFLINE_MSG, 'error');
}

async function safeFetch(url, opts) {
  try {
    const res = await fetch(url, opts);
    offlineBannerShown = false;
    return res;
  } catch (e) {
    showOfflineBanner();
    throw new Error(SERVER_OFFLINE_MSG);
  }
}

const api = {
  async list(resource, params) {
    const qs = new URLSearchParams(params || {}).toString();
    const res = await safeFetch(`/api/${resource}${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Falha ao carregar dados');
    return res.json();
  },
  async get(resource, id) {
    const res = await safeFetch(`/api/${resource}/${id}`);
    if (!res.ok) throw new Error((await res.json()).error || 'Registro não encontrado');
    return res.json();
  },
  async create(resource, data) {
    const res = await safeFetch(`/api/${resource}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar');
    return body;
  },
  async update(resource, id, data) {
    const res = await safeFetch(`/api/${resource}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar');
    return body;
  },
  async remove(resource, id) {
    const res = await safeFetch(`/api/${resource}/${id}`, { method: 'DELETE' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao excluir');
    return body;
  },
  tree(deptId) {
    return safeFetch(`/api/departamentos/${deptId}/tree`).then((r) => r.json());
  },
};

/* ---------------------------------- Toasts / Modal -------------------------------- */

function toast(message, type = 'default') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function openModal(innerHtml, opts = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal ${opts.cls || ''}">${innerHtml}</div></div>`;
  document.getElementById('modal-overlay').addEventListener('mousedown', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.addEventListener('keydown', escListener);
}
function escListener(e) { if (e.key === 'Escape') closeModal(); }
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.removeEventListener('keydown', escListener);
}
function confirmDialog(message, confirmLabel = 'Confirmar') {
  return new Promise((resolve) => {
    openModal(
      `<div class="modal-header"><h3>Confirmar ação</h3></div>
       <div class="modal-body"><p>${esc(message)}</p></div>
       <div class="modal-footer">
         <button class="btn" id="cf-cancel">Cancelar</button>
         <button class="btn btn-danger" id="cf-ok">${esc(confirmLabel)}</button>
       </div>`,
      { cls: 'confirm-box' }
    );
    document.getElementById('cf-cancel').onclick = () => { closeModal(); resolve(false); };
    document.getElementById('cf-ok').onclick = () => { closeModal(); resolve(true); };
  });
}

/* ------------------------------------ Router -------------------------------------- */

const state = { route: 'organizacoes', params: {}, filters: {} };

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'organizacoes' && parts[1] && parts[2] === 'departamentos') {
    return { route: 'departamentos', params: { orgId: Number(parts[1]) } };
  }
  if (parts[0] === 'departamentos' && parts[1]) {
    return { route: 'organograma', params: { deptId: Number(parts[1]) } };
  }
  return { route: 'organizacoes', params: {} };
}

window.addEventListener('hashchange', () => {
  Object.assign(state, parseRoute());
  render();
});

function goTo(hash) { window.location.hash = hash; }

/* ------------------------------------ Render -------------------------------------- */

async function render() {
  document.querySelectorAll('.nav-link').forEach((a) => a.classList.toggle('active', state.route === a.dataset.route));
  const content = document.getElementById('content');
  const title = document.getElementById('page-title');
  const subtitle = document.getElementById('page-subtitle');
  const actions = document.getElementById('topbar-actions');
  const bcNav = document.getElementById('breadcrumb-nav');
  actions.innerHTML = '';
  bcNav.style.display = 'none';
  bcNav.innerHTML = '';

  if (state.route === 'organizacoes') {
    title.textContent = 'Organizações';
    subtitle.textContent = 'Cadastre as organizações e explore seus departamentos';
    actions.innerHTML = `<button class="btn btn-primary" id="btn-novo">+ Nova organização</button>`;
    document.getElementById('btn-novo').onclick = () => openOrgForm(null);
    content.innerHTML = '<div class="empty-state">Carregando…</div>';
    await renderOrganizacoes(content);
  } else if (state.route === 'departamentos') {
    content.innerHTML = '<div class="empty-state">Carregando…</div>';
    await renderDepartamentos(content, state.params.orgId, title, subtitle, actions, bcNav);
  } else if (state.route === 'organograma') {
    content.innerHTML = '<div class="empty-state">Carregando…</div>';
    await renderOrganograma(content, state.params.deptId, title, subtitle, actions, bcNav);
  }
}

/* ------------------------------------ Organizações --------------------------------- */

async function renderOrganizacoes(content) {
  let orgs;
  try { orgs = await api.list('organizacoes'); } catch (e) { return; }

  if (!orgs.length) {
    content.innerHTML = `<div class="empty-state">
      <div class="empty-title">Nenhuma organização cadastrada</div>
      Comece criando a primeira organização — é a partir dela que os departamentos e a hierarquia serão montados.
      <div style="margin-top:14px"><button class="btn btn-primary" id="btn-novo-vazio">+ Nova organização</button></div>
    </div>`;
    document.getElementById('btn-novo-vazio').onclick = () => openOrgForm(null);
    return;
  }

  content.innerHTML = `<div class="card-grid">${orgs.map(orgCard).join('')}</div>`;
  content.querySelectorAll('[data-action="open-org"]').forEach((el) => {
    el.addEventListener('click', () => goTo(`/organizacoes/${el.dataset.id}/departamentos`));
  });
  content.querySelectorAll('[data-action="edit-org"]').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openOrgForm(Number(el.dataset.id)); });
  });
  content.querySelectorAll('[data-action="delete-org"]').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteOrg(Number(el.dataset.id), el.dataset.name); });
  });
}

function orgCard(o) {
  const meta = [o.unidade, o.setor, o.localizacao].filter(Boolean).join(' • ');
  return `<div class="entity-card" data-action="open-org" data-id="${o.id}">
    <span class="ec-badge">${o.totalDepartamentos ?? 0} departamento${(o.totalDepartamentos ?? 0) === 1 ? '' : 's'}</span>
    <div class="ec-title">${esc(o.nome)}</div>
    ${meta ? `<div class="ec-meta">${esc(meta)}</div>` : ''}
    ${o.responsavelGeral ? `<div class="ec-meta">Responsável: ${esc(o.responsavelGeral)}</div>` : ''}
    ${o.descricao ? `<div class="ec-desc">${esc(o.descricao)}</div>` : ''}
    <div class="ec-actions">
      <button class="btn btn-sm btn-ghost" data-action="edit-org" data-id="${o.id}">✏️ Editar</button>
      <button class="btn btn-sm btn-ghost" data-action="delete-org" data-id="${o.id}" data-name="${esc(o.nome)}">🗑️ Excluir</button>
    </div>
  </div>`;
}

function openOrgForm(id) {
  (async () => {
    let record = null;
    if (id) { try { record = await api.get('organizacoes', id); } catch (e) { toast(e.message, 'error'); return; } }
    const v = (k) => esc(record ? (record[k] || '') : '');
    openModal(`
      <div class="modal-header"><h3>${record ? 'Editar organização' : 'Nova organização'}</h3><button class="btn btn-ghost" id="modal-close">✕</button></div>
      <form id="org-form">
        <div class="modal-body">
          <div class="field-error" id="form-error"></div>
          <div class="field-group">
            <label>Nome da organização *</label>
            <input class="field-input" id="f-nome" type="text" value="${v('nome')}" placeholder="Ex: Rede Supermercados Bom Preço" />
          </div>
          <div class="field-group">
            <label>Unidade / Filial</label>
            <input class="field-input" id="f-unidade" type="text" value="${v('unidade')}" placeholder="Ex: Loja Centro, Matriz, CD Sul…" />
          </div>
          <div class="field-group">
            <label>Setor / Segmento</label>
            <input class="field-input" id="f-setor" type="text" value="${v('setor')}" placeholder="Ex: Varejo alimentar, Logística…" />
          </div>
          <div class="field-group">
            <label>Localização</label>
            <input class="field-input" id="f-localizacao" type="text" value="${v('localizacao')}" placeholder="Cidade / Endereço" />
          </div>
          <div class="field-group">
            <label>Responsável geral</label>
            <input class="field-input" id="f-responsavel" type="text" value="${v('responsavelGeral')}" placeholder="Nome de quem responde pela organização" />
          </div>
          <div class="field-group">
            <label>Observações</label>
            <textarea class="field-textarea" id="f-descricao" rows="3">${v('descricao')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" id="modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${record ? 'Salvar alterações' : 'Criar organização'}</button>
        </div>
      </form>
    `);
    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('org-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nome: document.getElementById('f-nome').value,
        unidade: document.getElementById('f-unidade').value,
        setor: document.getElementById('f-setor').value,
        localizacao: document.getElementById('f-localizacao').value,
        responsavelGeral: document.getElementById('f-responsavel').value,
        descricao: document.getElementById('f-descricao').value,
      };
      try {
        if (record) { await api.update('organizacoes', record.id, data); toast('Organização atualizada.', 'success'); }
        else { await api.create('organizacoes', data); toast('Organização criada.', 'success'); }
        closeModal();
        render();
      } catch (err) { document.getElementById('form-error').textContent = err.message; }
    });
  })();
}

async function handleDeleteOrg(id, name) {
  const ok = await confirmDialog(`Excluir "${name}"? Todos os departamentos e toda a hierarquia cadastrada dentro dela também serão excluídos. Esta ação não pode ser desfeita.`, 'Excluir tudo');
  if (!ok) return;
  try { await api.remove('organizacoes', id); toast('Organização excluída.', 'success'); render(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ------------------------------------ Departamentos --------------------------------- */

async function renderDepartamentos(content, orgId, title, subtitle, actions, bcNav) {
  let org, depts;
  try {
    org = await api.get('organizacoes', orgId);
    depts = await api.list('departamentos', { organizacaoId: orgId, q: state.filters.deptQ || '' });
  } catch (e) {
    content.innerHTML = `<div class="empty-state">Organização não encontrada. <a href="#/organizacoes">Voltar</a></div>`;
    return;
  }

  title.textContent = org.nome;
  subtitle.textContent = 'Departamentos desta organização';
  actions.innerHTML = `<button class="btn btn-primary" id="btn-novo">+ Novo departamento</button>`;
  document.getElementById('btn-novo').onclick = () => openDeptForm(orgId, null);

  bcNav.style.display = 'flex';
  bcNav.innerHTML = `<a class="bc-org" href="#/organizacoes">← Todas as organizações</a><div class="bc-dept bc-dept-name">${esc(org.nome)}</div>`;

  content.innerHTML = `
    <div class="toolbar">
      <input class="field-input search-input" id="f-search" type="text" placeholder="Pesquisar departamentos…" value="${esc(state.filters.deptQ || '')}" />
      <span class="result-count">${depts.length} departamento${depts.length === 1 ? '' : 's'}</span>
    </div>
    ${depts.length ? `<div class="card-grid">${depts.map(deptCard).join('')}</div>` : `
      <div class="empty-state">
        <div class="empty-title">Nenhum departamento cadastrado</div>
        Crie quantos departamentos forem necessários — não há limite.
      </div>`}
  `;

  document.getElementById('f-search').addEventListener('input', debounce((e) => {
    state.filters.deptQ = e.target.value;
    renderDepartamentos(content, orgId, title, subtitle, actions, bcNav);
  }, 300));

  content.querySelectorAll('[data-action="open-dept"]').forEach((el) => {
    el.addEventListener('click', () => goTo(`/departamentos/${el.dataset.id}`));
  });
  content.querySelectorAll('[data-action="edit-dept"]').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openDeptForm(orgId, Number(el.dataset.id)); });
  });
  content.querySelectorAll('[data-action="delete-dept"]').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteDept(Number(el.dataset.id), el.dataset.name, orgId, content, title, subtitle, actions, bcNav); });
  });
}

function deptCard(d) {
  return `<div class="entity-card" data-action="open-dept" data-id="${d.id}">
    <span class="ec-badge">${d.totalPessoas ?? 0} pessoa${(d.totalPessoas ?? 0) === 1 ? '' : 's'}</span>
    <div class="ec-title">${esc(d.nome)}</div>
    ${d.descricao ? `<div class="ec-desc">${esc(d.descricao)}</div>` : ''}
    <div class="ec-actions">
      <button class="btn btn-sm btn-ghost" data-action="edit-dept" data-id="${d.id}">✏️ Editar</button>
      <button class="btn btn-sm btn-ghost" data-action="delete-dept" data-id="${d.id}" data-name="${esc(d.nome)}">🗑️ Excluir</button>
    </div>
  </div>`;
}

function openDeptForm(orgId, id) {
  (async () => {
    let record = null;
    if (id) { try { record = await api.get('departamentos', id); } catch (e) { toast(e.message, 'error'); return; } }
    const v = (k) => esc(record ? (record[k] || '') : '');
    openModal(`
      <div class="modal-header"><h3>${record ? 'Editar departamento' : 'Novo departamento'}</h3><button class="btn btn-ghost" id="modal-close">✕</button></div>
      <form id="dept-form">
        <div class="modal-body">
          <div class="field-error" id="form-error"></div>
          <div class="field-group">
            <label>Nome do departamento *</label>
            <input class="field-input" id="f-nome" type="text" value="${v('nome')}" placeholder="Ex: Depósito, Estoque, Recebimento…" />
          </div>
          <div class="field-group">
            <label>Observações</label>
            <textarea class="field-textarea" id="f-descricao" rows="3">${v('descricao')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" id="modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${record ? 'Salvar alterações' : 'Criar departamento'}</button>
        </div>
      </form>
    `);
    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('dept-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = { nome: document.getElementById('f-nome').value, descricao: document.getElementById('f-descricao').value, organizacaoId: orgId };
      try {
        if (record) { await api.update('departamentos', record.id, data); toast('Departamento atualizado.', 'success'); }
        else { await api.create('departamentos', data); toast('Departamento criado.', 'success'); }
        closeModal();
        render();
      } catch (err) { document.getElementById('form-error').textContent = err.message; }
    });
  })();
}

async function handleDeleteDept(id, name, orgId, content, title, subtitle, actions, bcNav) {
  const ok = await confirmDialog(`Excluir "${name}"? Toda a hierarquia de cargos e colaboradores deste departamento também será excluída.`, 'Excluir tudo');
  if (!ok) return;
  try { await api.remove('departamentos', id); toast('Departamento excluído.', 'success'); renderDepartamentos(content, orgId, title, subtitle, actions, bcNav); }
  catch (e) { toast(e.message, 'error'); }
}

/* ------------------------------------ Organograma ----------------------------------- */

async function renderOrganograma(content, deptId, title, subtitle, actions, bcNav) {
  let dept, nodes;
  try {
    dept = await api.get('departamentos', deptId);
    nodes = await api.list('nodes', { departamentoId: deptId });
  } catch (e) {
    content.innerHTML = `<div class="empty-state">Departamento não encontrado. <a href="#/organizacoes">Voltar</a></div>`;
    return;
  }

  title.textContent = dept.nome;
  subtitle.textContent = `Hierarquia e organograma — ${dept.organizacao ? dept.organizacao.nome : ''}`;
  actions.innerHTML = `<button class="btn btn-primary" id="btn-novo-cargo">+ Adicionar cargo</button>`;
  document.getElementById('btn-novo-cargo').onclick = () => openNodeForm(deptId, nodes, null, null);

  bcNav.style.display = 'center';
  bcNav.innerHTML = `
    <a class="bc-org" href="#/organizacoes">← Todas as organizações</a>
    ${dept.organizacao ? `<a class="bc-org" href="#/organizacoes/${dept.organizacao.id}/departamentos">${esc(dept.organizacao.nome)}</a>` : ''}
    <div class="bc-dept bc-dept-name">${esc(dept.nome)}</div>
  `;

  const tree = buildTreeClient(nodes);

  content.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Organograma</h2>
        <span class="result-count">${nodes.length} cargo${nodes.length === 1 ? '' : 's'}/colaborador${nodes.length === 1 ? '' : 'es'}</span>
      </div>
      <div class="panel-body">
        ${nodes.length ? `
          <div class="legend-cargos">
            <span class="li"><span class="dot" style="background:var(--node-gerente)"></span>Gerência</span>
            <span class="li"><span class="dot" style="background:var(--node-subgerente)"></span>Sub gerência</span>
            <span class="li"><span class="dot" style="background:var(--node-lider)"></span>Liderança</span>
            <span class="li"><span class="dot" style="background:var(--node-op)"></span>Operacional</span>
            <span class="li"><span class="dot" style="background:var(--node-default)"></span>Outros</span>
          </div>
          <div class="orgchart-scroll"><ul class="orgchart">${tree.map(nodeLi).join('')}</ul></div>
        ` : `
          <div class="empty-state">
            <div class="empty-title">Nenhum cargo cadastrado ainda</div>
            Comece adicionando o topo da hierarquia (ex: Gerente) e depois vá encaixando os subordinados.
          </div>
        `}
      </div>
    </div>
  `;

  wireOrgChartEvents(content, deptId, nodes);
}

function countDescendants(node) {
  if (!node.children || !node.children.length) return 0;
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function nodeLi(node) {
  const hasChildren = node.children && node.children.length > 0;
  const count = countDescendants(node);
  return `<li data-node-id="${node.id}">
    <div class="org-node" style="--node-color:${cargoColor(node.cargo)}" data-count="${count}">
      <div class="on-cargo">${esc(node.cargo)}</div>
      <div class="on-nome">${esc(node.nome)}</div>
      ${node.observacoes ? `<div class="on-obs">${esc(node.observacoes)}</div>` : ''}
      <div class="on-actions">
        <button data-action="add-child" data-id="${node.id}" title="Adicionar subordinado">+ Sub.</button>
        <button data-action="edit-node" data-id="${node.id}" title="Editar">✏️</button>
        <button data-action="delete-node" data-id="${node.id}" title="Excluir">🗑️</button>
      </div>
      ${hasChildren ? `<button class="org-toggle" data-action="toggle">–</button>` : ''}
    </div>
    ${hasChildren ? `<ul>${node.children.map(nodeLi).join('')}</ul>` : ''}
  </li>`;
}

function buildTreeClient(nodes) {
  const byParent = new Map();
  nodes.forEach((n) => {
    const key = n.parentId || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  });
  function attach(parentId) {
    return (byParent.get(parentId) || []).slice().sort((a, b) => a.id - b.id).map((n) => ({ ...n, children: attach(n.id) }));
  }
  return attach(null);
}

function getDescendantIds(nodes, nodeId) {
  const byParent = new Map();
  nodes.forEach((n) => { const k = n.parentId || null; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(n); });
  const result = new Set();
  function walk(id) {
    (byParent.get(id) || []).forEach((n) => { result.add(n.id); walk(n.id); });
  }
  walk(nodeId);
  return result;
}

function wireOrgChartEvents(content, deptId, nodes) {
  content.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const li = btn.closest('li');
      li.classList.toggle('collapsed');
      btn.textContent = li.classList.contains('collapsed') ? '+' : '–';
    };
  });
  content.querySelectorAll('[data-action="add-child"]').forEach((btn) => {
    btn.onclick = () => openNodeForm(deptId, nodes, null, Number(btn.dataset.id));
  });
  content.querySelectorAll('[data-action="edit-node"]').forEach((btn) => {
    btn.onclick = () => openNodeForm(deptId, nodes, Number(btn.dataset.id), null);
  });
  content.querySelectorAll('[data-action="delete-node"]').forEach((btn) => {
    btn.onclick = () => handleDeleteNode(Number(btn.dataset.id), deptId);
  });
}

function openNodeForm(deptId, allNodes, editId, presetParentId) {
  (async () => {
    let record = null;
    if (editId) { try { record = await api.get('nodes', editId); } catch (e) { toast(e.message, 'error'); return; } }

    const excluded = record ? new Set([record.id, ...getDescendantIds(allNodes, record.id)]) : new Set();
    const options = allNodes
      .filter((n) => !excluded.has(n.id))
      .map((n) => `<option value="${n.id}" ${((record && record.parentId === n.id) || (!record && presetParentId === n.id)) ? 'selected' : ''}>${esc(n.nome)} — ${esc(n.cargo)}</option>`)
      .join('');

    const v = (k) => esc(record ? (record[k] || '') : '');
    const cargoListId = 'cargo-datalist';

    openModal(`
      <div class="modal-header"><h3>${record ? 'Editar cargo / colaborador' : 'Novo cargo / colaborador'}</h3><button class="btn btn-ghost" id="modal-close">✕</button></div>
      <form id="node-form">
        <div class="modal-body">
          <div class="field-error" id="form-error"></div>
          <div class="field-group">
            <label>Nome do colaborador *</label>
            <input class="field-input" id="f-nome" type="text" value="${v('nome')}" placeholder="Ex: Maria Souza" />
          </div>
          <div class="field-group">
            <label>Cargo *</label>
            <input class="field-input" id="f-cargo" type="text" value="${v('cargo')}" list="${cargoListId}" placeholder="Ex: Gerente, Operacional 1…" />
            <datalist id="${cargoListId}">${CARGO_SUGESTOES.map((c) => `<option value="${c}">`).join('')}</datalist>
          </div>
          <div class="field-group">
            <label>Superior hierárquico</label>
            <select class="field-select" id="f-parent">
              <option value="">— Topo da hierarquia (sem superior) —</option>
              ${options}
            </select>
            <span class="field-hint">Quem essa pessoa responde diretamente dentro do departamento.</span>
          </div>
          <div class="field-group">
            <label>Observações</label>
            <textarea class="field-textarea" id="f-obs" rows="2">${v('observacoes')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" id="modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${record ? 'Salvar alterações' : 'Adicionar'}</button>
        </div>
      </form>
    `);

    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('node-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nome: document.getElementById('f-nome').value,
        cargo: document.getElementById('f-cargo').value,
        parentId: document.getElementById('f-parent').value || null,
        observacoes: document.getElementById('f-obs').value,
        departamentoId: deptId,
      };
      try {
        if (record) { await api.update('nodes', record.id, data); toast('Registro atualizado.', 'success'); }
        else { await api.create('nodes', data); toast('Cargo adicionado.', 'success'); }
        closeModal();
        render();
      } catch (err) { document.getElementById('form-error').textContent = err.message; }
    });
  })();
}

async function handleDeleteNode(id, deptId) {
  const ok = await confirmDialog('Excluir este cargo/colaborador? Os subordinados diretos dele passarão a responder ao superior dele (a hierarquia não é quebrada).', 'Excluir');
  if (!ok) return;
  try { await api.remove('nodes', id); toast('Registro excluído.', 'success'); render(); }
  catch (e) { toast(e.message, 'error'); }
}

/* -------------------------------------- Init --------------------------------------- */

Object.assign(state, parseRoute());
render();
