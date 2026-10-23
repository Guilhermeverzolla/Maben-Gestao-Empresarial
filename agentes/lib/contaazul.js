/* ===========================================================
   contaazul.js — leitura do Conta Azul (API v2), só consulta.

   Fonte: https://developers.contaazul.com/docs/financial-apis-openapi
   - OAuth 2.0 com Authorization Code. A autorização abre em
     https://login.contaazul.com/#/oauth/authorize e a troca do código é
     POST https://api-v2.contaazul.com/oauth/token (Basic client_id:secret).
   - O access token dura 1 hora; este módulo renova com o refresh token.
   - Só chamamos GETs: nada aqui cria, altera ou apaga lançamento.

   As credenciais do aplicativo (client_id e client_secret) e os tokens
   ficam em data/contaazul.json, que está fora do git. Os painéis nunca
   devolvem esses valores para o navegador.

   A documentação não descreve os campos de cada item devolvido (só diz
   quantos são). Por isso o mapeamento abaixo é defensivo — aceita os
   nomes mais prováveis — e o painel mostra o JSON bruto do primeiro item,
   para ajustar com o dado real na mão.
   =========================================================== */
const path = require('path');
const { DATA, ler, gravar } = require('./store');

const API = 'https://api-v2.contaazul.com';
const LOGIN = 'https://login.contaazul.com/#/oauth/authorize';
const SCOPE = 'openid profile aws.cognito.signin.user.admin';
const ARQ = path.join(DATA, 'contaazul.json');

const cfg = () => ler(ARQ, {});
const salvar = (c) => gravar(ARQ, c);
const basic = (c) => 'Basic ' + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');

function estado() {
  const c = cfg();
  return {
    configurado: !!(c.clientId && c.clientSecret),
    conectado: !!c.refreshToken,
    redirectUri: c.redirectUri || '',
    conectadoEm: c.conectadoEm || null
  };
}

function configurar({ clientId, clientSecret, redirectUri }) {
  const c = cfg();
  if (clientId) c.clientId = String(clientId).trim();
  if (clientSecret) c.clientSecret = String(clientSecret).trim();
  if (redirectUri) c.redirectUri = String(redirectUri).trim();
  salvar(c);
  return estado();
}

function urlAutorizacao(state) {
  const c = cfg();
  if (!(c.clientId && c.redirectUri)) return null;
  const q = new URLSearchParams({ response_type: 'code', client_id: c.clientId,
    redirect_uri: c.redirectUri, state, scope: SCOPE });
  // o login do Conta Azul usa rota com "#": os parâmetros vão depois dela
  return LOGIN + '?' + q.toString().replace(/\+/g, '+');
}

async function pedirToken(corpo) {
  const c = cfg();
  const r = await fetch(API + '/oauth/token', {
    method: 'POST',
    headers: { Authorization: basic(c), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(corpo).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Conta Azul recusou a autorização (' + r.status + ')');
  c.accessToken = j.access_token;
  c.refreshToken = j.refresh_token || c.refreshToken;
  c.expira = Date.now() + (Number(j.expires_in || 3600) - 60) * 1000;
  c.conectadoEm = c.conectadoEm || new Date().toISOString();
  salvar(c);
}

const trocarCodigo = (code) => pedirToken({
  grant_type: 'authorization_code', code, redirect_uri: cfg().redirectUri,
  client_id: cfg().clientId, client_secret: cfg().clientSecret
});

async function token() {
  const c = cfg();
  if (!c.refreshToken) throw new Error('Conta Azul não conectado');
  if (!c.accessToken || Date.now() > (c.expira || 0))
    await pedirToken({ grant_type: 'refresh_token', refresh_token: c.refreshToken });
  return cfg().accessToken;
}

async function get(rota, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (Array.isArray(v)) v.forEach(x => q.append(k, x)); else if (v !== undefined && v !== '') q.append(k, v);
  const r = await fetch(API + rota + (q.toString() ? '?' + q : ''), {
    headers: { Authorization: 'Bearer ' + await token(), Accept: 'application/json' }
  });
  if (r.status === 429) throw new Error('Conta Azul pediu para esperar (limite de chamadas). Tente em instantes.');
  if (r.status === 401) throw new Error('Conta Azul recusou o token. Conecte de novo.');
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error('Conta Azul respondeu ' + r.status + (j && j.message ? ': ' + j.message : ''));
  return j;
}

/** percorre todas as páginas (limite de segurança de 10 × 200 itens) */
async function todos(rota, params) {
  let itens = [], pagina = 1, total = 0;
  for (; pagina <= 10; pagina++) {
    const j = await get(rota, Object.assign({}, params, { pagina, tamanho_pagina: 200 }));
    total = j.itens_totais || 0;
    itens = itens.concat(j.itens || []);
    if (itens.length >= total || !(j.itens || []).length) break;
  }
  return { itens, total };
}

/* ---- mapeamento defensivo dos campos ---- */
const pega = (o, ...ks) => { for (const k of ks) if (o && o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
function normaliza(it) {
  return {
    descricao: pega(it, 'descricao', 'nome', 'descricao_parcela', 'observacao') || '',
    vencimento: String(pega(it, 'data_vencimento', 'vencimento') || '').slice(0, 10),
    valor: Number(pega(it, 'valor', 'valor_total', 'valor_bruto', 'total') || 0),
    pago: Number(pega(it, 'valor_pago', 'pago', 'valor_recebido') || 0),
    status: pega(it, 'status', 'situacao') || '',
    pessoa: (pega(it, 'cliente', 'fornecedor', 'pessoa') || {}).nome || pega(it, 'nome_cliente', 'nome_fornecedor') || ''
  };
}

const iso = (d) => d.toISOString().slice(0, 10);

async function resumo(dias = 90) {
  const hoje = new Date();
  const ini = new Date(hoje); ini.setDate(ini.getDate() - 90);
  const fim = new Date(hoje); fim.setDate(fim.getDate() + dias);
  const comum = { data_vencimento_de: iso(ini), data_vencimento_ate: iso(fim) };
  const [rec, pag, contas] = await Promise.all([
    todos('/v1/financeiro/eventos-financeiros/contas-a-receber/buscar', comum),
    todos('/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar', comum),
    get('/v1/conta-financeira', { pagina: 1, tamanho_pagina: 100, apenas_ativo: 'true' }).catch(() => ({ itens: [] }))
  ]);
  const saldos = [];
  for (const c of (contas.itens || []).slice(0, 30)) {
    const id = pega(c, 'id', 'uuid', 'id_conta_financeira');
    if (!id) continue;
    try {
      const s = await get(`/v1/conta-financeira/${id}/saldo-atual`);
      saldos.push({ nome: pega(c, 'nome', 'descricao') || id, tipo: pega(c, 'tipo') || '', saldo: Number(s.saldo_atual || 0) });
    } catch (e) { saldos.push({ nome: pega(c, 'nome') || id, tipo: '', saldo: null, erro: e.message }); }
  }
  return {
    de: comum.data_vencimento_de, ate: comum.data_vencimento_ate,
    receber: rec.itens.map(normaliza), pagar: pag.itens.map(normaliza), saldos,
    totais: { receber: rec.total, pagar: pag.total },
    amostraBruta: { receber: rec.itens[0] || null, pagar: pag.itens[0] || null, conta: (contas.itens || [])[0] || null }
  };
}

module.exports = { estado, configurar, urlAutorizacao, trocarCodigo, resumo };
