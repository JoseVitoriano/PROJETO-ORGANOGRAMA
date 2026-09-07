# Estrutura Organizacional — Organogramas

Aplicação web (full stack, zero dependências externas) para cadastrar organizações,
seus departamentos, e a hierarquia de cargos/colaboradores de cada departamento —
com visualização em organograma.

## Estrutura (3 níveis)

```
Organização  (identifica de onde é essa estrutura: nome, unidade, setor, responsável, localização)
  └── Departamentos   (infinitos, dentro da organização)
        └── Hierarquia de cargos/colaboradores  (árvore: gerente → sub gerente → estoquista,
             previsão, líder de depósito → operacional 1 → operacional 2 → outros colaboradores)
```

Cada nível tem **inclusão, edição e exclusão** completas, e você pode criar quantas
organizações, departamentos e cargos quiser — não há limite.

## Como rodar

Não precisa instalar nada (zero dependências — só usa o Node.js nativo).

```bash
node server.js
```

Depois acesse **http://localhost:3001** no navegador (não abra o `index.html` direto).

> Requisito: Node.js 16 ou superior instalado na máquina.

## Como usar

1. **Crie uma organização** — esse é o formulário que identifica "de onde" é a
   estrutura: nome, unidade/filial, setor, localização e responsável geral.
2. Clique na organização para entrar nela e **crie os departamentos** que quiser
   (Depósito, Estoque, Recebimento, Financeiro… quantos precisar).
3. Clique em um departamento para abrir o **organograma** dele e montar a hierarquia:
   - Clique em **"+ Adicionar cargo"** para criar o topo da hierarquia (ex: Gerente).
   - Em cada caixa do organograma, use **"+ Sub."** para adicionar um subordinado
     diretamente abaixo daquela pessoa — assim a árvore vai crescendo.
   - O campo **Cargo** sugere os cargos comuns (Gerente, Sub Gerente, Estoquista,
     Previsão, Líder de Depósito, Operacional 1, Operacional 2, Colaborador) mas
     aceita qualquer texto — não é uma lista fechada.
   - Use **✏️** para editar (inclusive para mudar o superior hierárquico de alguém)
     e **🗑️** para excluir.
   - Ao excluir alguém do meio da hierarquia, os subordinados diretos dessa pessoa
     são automaticamente promovidos para o superior dela — a árvore nunca "quebra".
   - Clique no círculo **"–"** abaixo de uma caixa para recolher/expandir aquele ramo
     (útil quando a hierarquia fica grande).

## Onde ficam os dados

Tudo fica salvo em `data/db.json`, criado automaticamente na primeira execução.
Não precisa de banco de dados externo.

## Estrutura do projeto

```
server.js         → servidor HTTP + rotas da API (Node puro, sem Express)
lib/jsonDb.js      → persistência em JSON + regras de cascata e prevenção de ciclos
data/db.json       → banco de dados da aplicação (gerado automaticamente)
public/            → front-end (HTML, CSS, JS puro — SPA com roteamento por hash)
```

## API (para referência)

| Método | Rota                                | Ação                                          |
|--------|-------------------------------------|------------------------------------------------|
| GET    | /api/organizacoes                   | Lista organizações                              |
| POST   | /api/organizacoes                   | Cria organização                                |
| GET/PUT/DELETE | /api/organizacoes/:id       | Detalhe / editar / excluir (cascata)            |
| GET    | /api/departamentos?organizacaoId=   | Lista departamentos de uma organização          |
| POST   | /api/departamentos                  | Cria departamento                               |
| GET/PUT/DELETE | /api/departamentos/:id      | Detalhe / editar / excluir (cascata)            |
| GET    | /api/departamentos/:id/tree         | Retorna a hierarquia já em formato de árvore    |
| GET    | /api/nodes?departamentoId=          | Lista os cargos/colaboradores de um departamento|
| POST   | /api/nodes                          | Cria cargo/colaborador (aceita `parentId`)      |
| GET/PUT/DELETE | /api/nodes/:id               | Detalhe / editar (reparentar) / excluir (promove filhos) |
