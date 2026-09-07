// lib/jsonDb.js
// Persistência simples em arquivo JSON — sem dependências externas.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function nowIso() {
  return new Date().toISOString();
}

function emptyDb() {
  return {
    organizacoes: [],
    departamentos: [],
    nodes: [],
    meta: { nextId: { organizacoes: 1, departamentos: 1, nodes: 1 } },
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  if (fs.existsSync(DB_PATH)) {
    cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } else {
    cache = emptyDb();
    save();
  }
  return cache;
}

function save() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

function list(collection, filterFn) {
  const all = load()[collection];
  return filterFn ? all.filter(filterFn) : all;
}

function get(collection, id) {
  return load()[collection].find((x) => x.id === Number(id));
}

function create(collection, data) {
  const db = load();
  const id = db.meta.nextId[collection]++;
  const record = { id, ...data, createdAt: nowIso(), updatedAt: nowIso() };
  db[collection].push(record);
  save();
  return record;
}

function update(collection, id, data) {
  const db = load();
  const idx = db[collection].findIndex((x) => x.id === Number(id));
  if (idx === -1) return null;
  const updated = { ...db[collection][idx], ...data, id: db[collection][idx].id, updatedAt: nowIso() };
  db[collection][idx] = updated;
  save();
  return updated;
}

function remove(collection, id) {
  const db = load();
  const idx = db[collection].findIndex((x) => x.id === Number(id));
  if (idx === -1) return false;
  db[collection].splice(idx, 1);
  save();
  return true;
}

// ---------------------------------------------------------------------------
// Regras específicas do domínio (cascatas e reparenting)
// ---------------------------------------------------------------------------

function deleteOrganizacaoCascade(orgId) {
  const db = load();
  const depts = db.departamentos.filter((d) => d.organizacaoId === Number(orgId));
  depts.forEach((d) => deleteDepartamentoCascade(d.id));
  db.organizacoes = db.organizacoes.filter((o) => o.id !== Number(orgId));
  save();
}

function deleteDepartamentoCascade(deptId) {
  const db = load();
  db.nodes = db.nodes.filter((n) => n.departamentoId !== Number(deptId));
  db.departamentos = db.departamentos.filter((d) => d.id !== Number(deptId));
  save();
}

// Ao excluir um nó (cargo/colaborador), os filhos diretos sobem para o lugar
// do nó removido (ficam ligados ao superior de quem foi excluído), em vez de
// serem excluídos junto — assim a árvore nunca "quebra" ao remover alguém do meio.
function deleteNodeReparenting(nodeId) {
  const db = load();
  const node = db.nodes.find((n) => n.id === Number(nodeId));
  if (!node) return false;
  db.nodes.forEach((n) => {
    if (n.parentId === node.id) n.parentId = node.parentId;
  });
  db.nodes = db.nodes.filter((n) => n.id !== node.id);
  save();
  return true;
}

// Impede ciclos: um nó não pode virar filho de si mesmo nem de um descendente seu.
function isDescendant(db, candidateParentId, nodeId) {
  let current = db.nodes.find((n) => n.id === Number(candidateParentId));
  const visited = new Set();
  while (current) {
    if (current.id === Number(nodeId)) return true;
    if (visited.has(current.id)) break; // segurança contra loop já existente
    visited.add(current.id);
    current = db.nodes.find((n) => n.id === current.parentId);
  }
  return false;
}

function buildTree(departmentId) {
  const nodes = list('nodes', (n) => n.departamentoId === Number(departmentId));
  const byParent = new Map();
  nodes.forEach((n) => {
    const key = n.parentId || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  });
  function attach(parentId) {
    const children = (byParent.get(parentId) || []).slice().sort((a, b) => a.id - b.id);
    return children.map((n) => ({ ...n, children: attach(n.id) }));
  }
  return attach(null);
}

module.exports = {
  load,
  save,
  list,
  get,
  create,
  update,
  remove,
  deleteOrganizacaoCascade,
  deleteDepartamentoCascade,
  deleteNodeReparenting,
  isDescendant,
  buildTree,
};
