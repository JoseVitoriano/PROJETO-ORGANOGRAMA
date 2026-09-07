// server.js
// Servidor único, sem dependências externas. Rode com: node server.js
// Acesse: http://localhost:3001

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const db = require('./lib/jsonDb');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo não encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Payload muito grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/* ------------------------------- Organizações ------------------------------ */

async function handleOrganizacoes(req, res, id) {
  if (req.method === 'GET' && !id) {
    const records = db.list('organizacoes').map((o) => ({
      ...o,
      totalDepartamentos: db.list('departamentos', (d) => d.organizacaoId === o.id).length,
    }));
    return sendJson(res, 200, records.sort((a, b) => a.id - b.id));
  }
  if (req.method === 'GET' && id) {
    const rec = db.get('organizacoes', id);
    if (!rec) return sendJson(res, 404, { error: 'Organização não encontrada' });
    const totalDepartamentos = db.list('departamentos', (d) => d.organizacaoId === Number(id)).length;
    return sendJson(res, 200, { ...rec, totalDepartamentos });
  }
  if (req.method === 'POST' && !id) {
    const body = await readBody(req);
    if (!body.nome || !body.nome.trim()) return sendJson(res, 400, { error: 'Informe o nome da organização' });
    const rec = db.create('organizacoes', {
      nome: body.nome.trim(),
      unidade: body.unidade || '',
      setor: body.setor || '',
      responsavelGeral: body.responsavelGeral || '',
      localizacao: body.localizacao || '',
      descricao: body.descricao || '',
    });
    return sendJson(res, 201, rec);
  }
  if (req.method === 'PUT' && id) {
    const body = await readBody(req);
    if (!body.nome || !body.nome.trim()) return sendJson(res, 400, { error: 'Informe o nome da organização' });
    const rec = db.update('organizacoes', id, {
      nome: body.nome.trim(),
      unidade: body.unidade || '',
      setor: body.setor || '',
      responsavelGeral: body.responsavelGeral || '',
      localizacao: body.localizacao || '',
      descricao: body.descricao || '',
    });
    if (!rec) return sendJson(res, 404, { error: 'Organização não encontrada' });
    return sendJson(res, 200, rec);
  }
  if (req.method === 'DELETE' && id) {
    if (!db.get('organizacoes', id)) return sendJson(res, 404, { error: 'Organização não encontrada' });
    db.deleteOrganizacaoCascade(id);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'Método não permitido' });
}

/* ------------------------------- Departamentos ------------------------------ */

async function handleDepartamentos(req, res, id, query) {
  if (req.method === 'GET' && !id) {
    let records = db.list('departamentos');
    if (query.organizacaoId) records = records.filter((d) => d.organizacaoId === Number(query.organizacaoId));
    if (query.q) {
      const q = query.q.toLowerCase();
      records = records.filter((d) => (d.nome + ' ' + (d.descricao || '')).toLowerCase().includes(q));
    }
    records = records.map((d) => ({ ...d, totalPessoas: db.list('nodes', (n) => n.departamentoId === d.id).length }));
    return sendJson(res, 200, records.slice().sort((a, b) => a.id - b.id));
  }
  if (req.method === 'GET' && id) {
    const rec = db.get('departamentos', id);
    if (!rec) return sendJson(res, 404, { error: 'Departamento não encontrado' });
    const org = db.get('organizacoes', rec.organizacaoId);
    return sendJson(res, 200, { ...rec, organizacao: org || null });
  }
  if (req.method === 'POST' && !id) {
    const body = await readBody(req);
    if (!body.nome || !body.nome.trim()) return sendJson(res, 400, { error: 'Informe o nome do departamento' });
    if (!body.organizacaoId) return sendJson(res, 400, { error: 'Departamento precisa pertencer a uma organização' });
    if (!db.get('organizacoes', body.organizacaoId)) return sendJson(res, 400, { error: 'Organização inválida' });
    const rec = db.create('departamentos', {
      nome: body.nome.trim(),
      descricao: body.descricao || '',
      organizacaoId: Number(body.organizacaoId),
    });
    return sendJson(res, 201, rec);
  }
  if (req.method === 'PUT' && id) {
    const body = await readBody(req);
    if (!body.nome || !body.nome.trim()) return sendJson(res, 400, { error: 'Informe o nome do departamento' });
    const rec = db.update('departamentos', id, { nome: body.nome.trim(), descricao: body.descricao || '' });
    if (!rec) return sendJson(res, 404, { error: 'Departamento não encontrado' });
    return sendJson(res, 200, rec);
  }
  if (req.method === 'DELETE' && id) {
    if (!db.get('departamentos', id)) return sendJson(res, 404, { error: 'Departamento não encontrado' });
    db.deleteDepartamentoCascade(id);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'Método não permitido' });
}

/* ------------------------------------ Nodes ---------------------------------- */
// "nodes" = cada cargo/colaborador dentro da hierarquia de um departamento

async function handleNodes(req, res, id, query) {
  if (req.method === 'GET' && !id) {
    let records = db.list('nodes');
    if (query.departamentoId) records = records.filter((n) => n.departamentoId === Number(query.departamentoId));
    return sendJson(res, 200, records.slice().sort((a, b) => a.id - b.id));
  }
  if (req.method === 'GET' && id) {
    const rec = db.get('nodes', id);
    if (!rec) return sendJson(res, 404, { error: 'Registro não encontrado' });
    return sendJson(res, 200, rec);
  }
  if (req.method === 'POST' && !id) {
    const body = await readBody(req);
    if (!body.nome || !body.nome.trim()) return sendJson(res, 400, { error: 'Informe o nome do colaborador' });
    if (!body.cargo || !body.cargo.trim()) return sendJson(res, 400, { error: 'Informe o cargo' });
    if (!body.departamentoId) return sendJson(res, 400, { error: 'Cargo precisa pertencer a um departamento' });
    if (!db.get('departamentos', body.departamentoId)) return sendJson(res, 400, { error: 'Departamento inválido' });
    let parentId = body.parentId ? Number(body.parentId) : null;
    if (parentId) {
      const parent = db.get('nodes', parentId);
      if (!parent || parent.departamentoId !== Number(body.departamentoId)) {
        return sendJson(res, 400, { error: 'Superior hierárquico inválido' });
      }
    }
    const rec = db.create('nodes', {
      nome: body.nome.trim(),
      cargo: body.cargo.trim(),
      observacoes: body.observacoes || '',
      departamentoId: Number(body.departamentoId),
      parentId,
    });
    return sendJson(res, 201, rec);
  }
  if (req.method === 'PUT' && id) {
    const body = await readBody(req);
    const existing = db.get('nodes', id);
    if (!existing) return sendJson(res, 404, { error: 'Registro não encontrado' });
    if (!body.nome || !body.nome.trim()) return sendJson(res, 400, { error: 'Informe o nome do colaborador' });
    if (!body.cargo || !body.cargo.trim()) return sendJson(res, 400, { error: 'Informe o cargo' });
    let parentId = body.parentId ? Number(body.parentId) : null;
    if (parentId === existing.id) {
      return sendJson(res, 400, { error: 'Um cargo não pode ser superior de si mesmo' });
    }
    if (parentId) {
      const parent = db.get('nodes', parentId);
      if (!parent || parent.departamentoId !== existing.departamentoId) {
        return sendJson(res, 400, { error: 'Superior hierárquico inválido' });
      }
      if (db.isDescendant(db.load(), parentId, existing.id)) {
        return sendJson(res, 400, { error: 'Esse superior escolhido é um subordinado atual — isso criaria um ciclo na hierarquia' });
      }
    }
    const rec = db.update('nodes', id, {
      nome: body.nome.trim(),
      cargo: body.cargo.trim(),
      observacoes: body.observacoes || '',
      parentId,
    });
    return sendJson(res, 200, rec);
  }
  if (req.method === 'DELETE' && id) {
    if (!db.get('nodes', id)) return sendJson(res, 404, { error: 'Registro não encontrado' });
    db.deleteNodeReparenting(id);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'Método não permitido' });
}

/* --------------------------------------- Router -------------------------------- */

async function handleApi(req, res, parsed) {
  const segments = parsed.pathname.split('/').filter(Boolean); // ['api','organizacoes','3']
  const resource = segments[1];
  const id = segments[2];
  const sub = segments[3];

  if (resource === 'organizacoes') return handleOrganizacoes(req, res, id);
  if (resource === 'departamentos' && sub === 'tree' && req.method === 'GET') {
    if (!db.get('departamentos', id)) return sendJson(res, 404, { error: 'Departamento não encontrado' });
    return sendJson(res, 200, db.buildTree(id));
  }
  if (resource === 'departamentos') return handleDepartamentos(req, res, id, parsed.query);
  if (resource === 'nodes') return handleNodes(req, res, id, parsed.query);

  return sendJson(res, 404, { error: 'Recurso não encontrado' });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, parsed);
    } catch (e) {
      console.error(e);
      sendJson(res, 500, { error: 'Erro interno do servidor' });
    }
    return;
  }

  let filePath = path.join(PUBLIC_DIR, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Proibido');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html'); // fallback SPA
  }
  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n  Estrutura Organizacional rodando em http://localhost:${PORT}\n`);
});
