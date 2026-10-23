/* ===========================================================
   acessorias.js — consulta (somente leitura) à API da Acessórias.

   O que está documentado para nós são só os três GETs equivalentes às
   consultas do conector: /companies/{cnpj}, /deliveries e /requests.
   A URL base e o formato de autenticação NÃO foram confirmados em
   documentação pública: ficam configuráveis em data/acessorias.json
   (url, token, cabecalho) e o painel mostra o erro real se algo divergir.
   O token nunca volta para o navegador.
   =========================================================== */
const path = require('path');
const { DATA, ler, gravar } = require('./store');

const ARQ = path.join(DATA, 'acessorias.json');
const cfg = () => Object.assign({ url: 'https://api.acessorias.com', cabecalho: 'Authorization', prefixo: 'Bearer ' }, ler(ARQ, {}));

const estado = () => { const c = cfg(); return { configurado: !!c.token, url: c.url, cabecalho: c.cabecalho }; };

function configurar({ url, token, cabecalho, prefixo }) {
  const c = ler(ARQ, {});
  if (url) c.url = String(url).trim().replace(/\/$/, '');
  if (token) c.token = String(token).trim();
  if (cabecalho) c.cabecalho = String(cabecalho).trim();
  if (prefixo !== undefined) c.prefixo = String(prefixo);
  gravar(ARQ, c);
  return estado();
}

async function get(rota, params = {}) {
  const c = cfg();
  if (!c.token) throw new Error('Acessórias não configurada: informe o token.');
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.append(k, v);
  const r = await fetch(c.url + rota + (q.toString() ? '?' + q : ''), {
    headers: { [c.cabecalho]: c.prefixo + c.token, Accept: 'application/json' }
  });
  const texto = await r.text();
  let j = null; try { j = JSON.parse(texto); } catch (e) { /* não era JSON */ }
  if (!r.ok) throw new Error('Acessórias respondeu ' + r.status + (j && j.message ? ': ' + j.message : ''));
  return j !== null ? j : texto.slice(0, 2000);
}

const so = (s) => String(s || '').replace(/\D/g, '');
module.exports = {
  estado, configurar,
  empresa: (cnpj) => get('/companies/' + so(cnpj), { obligations: 'true', registrationData: 'true' }),
  entregas: (cnpj, ini, fim, situacao) => get('/deliveries', { cnpj: so(cnpj), DtInitial: ini, DtFinal: fim, situation: situacao || 'pending' }),
  solicitacoes: (status) => get('/requests', { SolStatus: status })
};
