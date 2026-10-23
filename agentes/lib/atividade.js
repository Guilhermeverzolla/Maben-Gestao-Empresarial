/* ===========================================================
   atividade.js — diário de tudo o que os agentes fazem nos painéis.
   Uma linha JSON por evento em data/atividade.jsonl (fora do git).
   A central do Guilherme lê este arquivo em tempo real.
   =========================================================== */
const fs = require('fs');
const path = require('path');
const { DATA } = require('./store');

const ARQ = path.join(DATA, 'atividade.jsonl');

function registrar(agente, acao, detalhe) {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    fs.appendFileSync(ARQ, JSON.stringify({ quando: new Date().toISOString(), agente, acao, detalhe: detalhe || '' }) + '\n');
  } catch (e) { /* o diário nunca derruba o painel */ }
}

function recentes(n = 60) {
  try {
    const linhas = fs.readFileSync(ARQ, 'utf8').trim().split('\n').slice(-n);
    return linhas.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean).reverse();
  } catch (e) { return []; }
}

function desde(ms) {
  const corte = Date.now() - ms;
  return recentes(2000).filter(x => new Date(x.quando).getTime() >= corte);
}

module.exports = { registrar, recentes, desde };
