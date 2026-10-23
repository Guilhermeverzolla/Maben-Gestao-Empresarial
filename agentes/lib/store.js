/* ===========================================================
   store.js — coleções em JSON, compartilhadas entre os painéis.

   Os dez painéis são processos separados, mas leem e gravam os mesmos
   arquivos em data/ (fora do git): clientes.json e registros/<tipo>.json.
   Cada gravação lê o arquivo de novo antes de mexer, para não pisar na
   alteração que outro painel acabou de fazer.
   =========================================================== */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'data');

function ler(arq, padrao) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { return padrao; }
}
function gravar(arq, dados) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2));
  fs.renameSync(tmp, arq);
}

const arquivoDe = (nome) => nome === 'clientes'
  ? path.join(DATA, 'clientes.json')
  : path.join(DATA, 'registros', nome.replace(/[^a-z0-9_-]/gi, '') + '.json');

function colecao(nome) {
  const arq = arquivoDe(nome);
  return {
    lista: () => ler(arq, []),
    adicionar(item) {
      const l = ler(arq, []);
      const novo = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), criado: new Date().toISOString() }, item);
      l.push(novo); gravar(arq, l); return novo;
    },
    atualizar(id, campos) {
      const l = ler(arq, []);
      const i = l.findIndex(x => x.id === id);
      if (i < 0) return null;
      l[i] = Object.assign(l[i], campos, { id, atualizado: new Date().toISOString() });
      gravar(arq, l); return l[i];
    },
    remover(id) {
      const l = ler(arq, []);
      const nova = l.filter(x => x.id !== id);
      gravar(arq, nova); return nova.length !== l.length;
    }
  };
}

module.exports = { DATA, ler, gravar, colecao };
