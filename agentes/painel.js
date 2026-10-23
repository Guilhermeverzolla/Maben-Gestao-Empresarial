/* ===========================================================
   Painel de agente da MABEN.

   Um servidor para os dez agentes: o escritório o sobe uma vez por
   agente (data/sistemas.json), com a chave do perfil como argumento e
   a porta em PORT. Cada agente enxerga só as ferramentas do seu cargo
   (lib/tools.js). O Conta Azul existe apenas no painel do Miguel.

   Dados: data/clientes.json e data/registros/*.json (compartilhados),
   agentes/estado/<chave>.json (rotina do dia e anotações).
   Escuta só em 127.0.0.1 e recusa POST vindo de outro site.
   =========================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TOOLS, FERRAMENTAS_POR_AGENTE, diasEntre, hojeISO } = require('./lib/tools');
const { colecao } = require('./lib/store');
const CA = require('./lib/contaazul');
const AC = require('./lib/acessorias');
const LOG = require('./lib/atividade');

const chave = process.argv[2];
const perfis = JSON.parse(fs.readFileSync(path.join(__dirname, 'perfis.json'), 'utf8'));
const p = perfis[chave];
if (!p) { console.error('Perfil desconhecido: ' + chave); process.exit(1); }

const PORT = Number(process.env.PORT) || p.porta;
const PASTA = path.join(__dirname, 'estado');
const ARQ = path.join(PASTA, chave + '.json');
const WEB = path.join(__dirname, 'web');
const TEM_CONTA_AZUL = chave === 'miguel-cfo';
const TEM_ACESSORIAS = ['joao-fiscal', 'rodrigo-dp', 'angellyca', 'joao-contabil'].includes(chave);
const meusIds = FERRAMENTAS_POR_AGENTE[chave] || [];
fs.mkdirSync(PASTA, { recursive: true });

/* ---------- rotina do dia + anotações ---------- */
const ler = () => { try { return JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch (e) { return { feitas: [], notas: '', dia: '' }; } };
const gravar = (e) => fs.writeFileSync(ARQ, JSON.stringify(e, null, 2));
function estado() {
  const e = ler();
  if (e.dia !== hojeISO()) { e.dia = hojeISO(); e.feitas = []; gravar(e); }
  return e;
}

/* ---------- utilidades HTTP ---------- */
const json = (res, cod, obj) => { res.writeHead(cod, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const corpoDe = (req) => new Promise((ok, no) => {
  let b = ''; req.on('data', d => { b += d; if (b.length > 2e5) { req.destroy(); no(new Error('corpo grande demais')); } });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(new Error('json inválido')); } });
});
const origemOk = (req) => {
  const o = req.headers.origin;
  if (!o) return true;
  return o === 'http://localhost:' + PORT || o === 'http://127.0.0.1:' + PORT;
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

/* ---------- ferramentas visíveis para este agente ---------- */
function defsParaTela() {
  return meusIds.map(id => {
    const t = TOOLS[id];
    return { id, nome: t.nome, tipo: t.tipo, descricao: t.descricao, campos: t.campos,
             fechado: t.fechado, aging: !!t.aging, alerta: t.alerta || 0, gerador: t.gerador ? { rotulo: t.gerador.rotulo } : null };
  });
}

/* ---------- Conta Azul: análise do financeiro do escritório (só Miguel) ---------- */
const FECHADOS = /^(RECEBIDO|PAGO|PERDIDO|RENEGOCIADO|CANCELADO|QUITADO)$/i;
async function analiseContaAzul(dias) {
  const r = await CA.resumo(dias);
  const hoje = hojeISO();
  const abertos = (l) => l.filter(x => !FECHADOS.test(x.status || '') && x.vencimento);
  const rec = abertos(r.receber), pag = abertos(r.pagar);
  const soma = (l) => Math.round(l.reduce((s, x) => s + (x.valor - (x.pago || 0)), 0) * 100) / 100;
  const vencR = rec.filter(x => x.vencimento < hoje), vencP = pag.filter(x => x.vencimento < hoje);
  const saldoTotal = Math.round(r.saldos.reduce((s, c) => s + (c.saldo || 0), 0) * 100) / 100;
  const semanas = Array.from({ length: 13 }, () => ({ ent: 0, sai: 0 }));
  const aloc = (l, k) => l.filter(x => x.vencimento >= hoje).forEach(x => {
    const s = Math.floor(diasEntre(hoje, x.vencimento) / 7);
    if (s >= 0 && s < 13) semanas[s][k] += x.valor - (x.pago || 0);
  });
  aloc(rec, 'ent'); aloc(pag, 'sai');
  let acum = saldoTotal, menor = saldoTotal, semMenor = 0;
  const proj = semanas.map((s, i) => { acum += s.ent - s.sai; if (acum < menor) { menor = acum; semMenor = i + 1; } return { semana: i + 1, ent: Math.round(s.ent * 100) / 100, sai: Math.round(s.sai * 100) / 100, saldo: Math.round(acum * 100) / 100 }; });
  const flags = [];
  if (menor < 0) flags.push(`Caixa projetado negativo na semana ${semMenor} (R$ ${Math.round(menor).toLocaleString('pt-BR')}).`);
  if (vencR.length) flags.push(`${vencR.length} recebimento(s) vencido(s) somando R$ ${soma(vencR).toLocaleString('pt-BR')}: acionar cobrança.`);
  if (vencP.length) flags.push(`${vencP.length} pagamento(s) vencido(s) somando R$ ${soma(vencP).toLocaleString('pt-BR')}: risco de multa e juros.`);
  const pagar30 = soma(pag.filter(x => diasEntre(hoje, x.vencimento) <= 30 && x.vencimento >= hoje));
  if (saldoTotal > 0 && pagar30 > saldoTotal) flags.push('As contas a pagar dos próximos 30 dias superam o saldo atual em caixa e bancos.');
  if (r.saldos.some(c => c.erro)) flags.push('Alguns saldos não puderam ser lidos; veja o detalhe das contas.');
  return { de: r.de, ate: r.ate, saldoTotal, saldos: r.saldos, receberAberto: soma(rec), pagarAberto: soma(pag),
           vencidoReceber: soma(vencR), vencidoPagar: soma(vencP), pagar30, proj, flags,
           totais: r.totais, amostraBruta: r.amostraBruta,
           proximosReceber: rec.filter(x => x.vencimento >= hoje).sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).slice(0, 15),
           proximosPagar: pag.filter(x => x.vencimento >= hoje).sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).slice(0, 15) };
}

/* ---------- servidor ---------- */
const estadosOAuth = new Set();

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname;
  try {
    if (req.method !== 'GET' && !origemOk(req)) return json(res, 403, { ok: false, motivo: 'origem recusada' });

    /* --- páginas e arquivos estáticos --- */
    if (req.method === 'GET' && !rota.startsWith('/api/') && !rota.startsWith('/conta-azul') ) {
      const arq = rota === '/' ? 'index.html' : rota.replace(/^\/+/, '');
      const full = path.join(WEB, arq);
      if (full.startsWith(WEB) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(full));
      }
      return json(res, 404, { ok: false });
    }

    /* --- perfil e rotina --- */
    if (rota === '/api/status') return json(res, 200, { ok: true, agente: p.nome, feitas: estado().feitas.length, total: p.rotinas.length });
    if (rota === '/api/perfil') {
      return json(res, 200, { chave, perfil: p, estado: estado(), ferramentas: defsParaTela(),
                              contaAzul: TEM_CONTA_AZUL, acessorias: TEM_ACESSORIAS, hoje: hojeISO() });
    }
    if (rota === '/api/estado' && req.method === 'POST') {
      const m = await corpoDe(req), e = estado();
      if (typeof m.notas === 'string') e.notas = m.notas.slice(0, 20000);
      if (Number.isInteger(m.marcar) && m.marcar >= 0 && m.marcar < p.rotinas.length) {
        const s = new Set(e.feitas); if (m.valor) s.add(m.marcar); else s.delete(m.marcar); e.feitas = [...s];
      }
      if (Number.isInteger(m.marcar)) LOG.registrar(p.nome, m.valor ? 'rotina concluída' : 'rotina reaberta', p.rotinas[m.marcar]);
      gravar(e); return json(res, 200, { ok: true, estado: e });
    }

    /* --- clientes --- */
    if (rota === '/api/clientes') {
      const c = colecao('clientes');
      if (req.method === 'GET') return json(res, 200, c.lista());
      if (req.method === 'POST') {
        const m = await corpoDe(req);
        if (!String(m.razao || '').trim()) return json(res, 400, { ok: false, motivo: 'informe a razão social' });
        LOG.registrar(p.nome, m.id ? 'cliente atualizado' : 'cliente cadastrado', m.razao);
        return json(res, 200, m.id ? c.atualizar(m.id, m) : c.adicionar(m));
      }
      if (req.method === 'DELETE') return json(res, 200, { ok: c.remover(url.searchParams.get('id')) });
    }

    /* --- cálculos --- */
    let m = rota.match(/^\/api\/calc\/([a-z0-9_-]+)$/i);
    if (m && req.method === 'POST') {
      if (!meusIds.includes(m[1]) || TOOLS[m[1]].tipo !== 'calc') return json(res, 404, { ok: false, motivo: 'ferramenta indisponível para este agente' });
      const corpo = await corpoDe(req);
      LOG.registrar(p.nome, 'cálculo: ' + TOOLS[m[1]].nome, '');
      return json(res, 200, { ok: true, resultado: TOOLS[m[1]].run(corpo.valores || {}) });
    }

    /* --- registros --- */
    m = rota.match(/^\/api\/reg\/([a-z0-9_-]+)(\/gerar)?$/i);
    if (m) {
      const t = TOOLS[m[1]];
      if (!t || t.tipo !== 'registro' || !meusIds.includes(m[1])) return json(res, 404, { ok: false, motivo: 'ferramenta indisponível' });
      const c = colecao(m[1]);
      if (m[2] && req.method === 'POST') {
        const b = await corpoDe(req);
        if (!t.gerador || !String(b.cliente || '').trim()) return json(res, 400, { ok: false, motivo: 'informe o cliente' });
        const ja = new Set(c.lista().filter(x => x.cliente === b.cliente).map(x => x.item));
        let n = 0;
        for (const [item, grupo] of t.gerador.itens) if (!ja.has(item)) { c.adicionar({ cliente: b.cliente, item, grupo, status: 'pendente', prazo: '', obs: '' }); n++; }
        LOG.registrar(p.nome, 'checklist de onboarding gerado', b.cliente + ' (' + n + ' etapas)');
        return json(res, 200, { ok: true, criados: n });
      }
      if (req.method === 'GET') return json(res, 200, c.lista());
      if (req.method === 'POST') {
        const b = await corpoDe(req);
        const reg = {}; for (const f of t.campos) reg[f.n] = b[f.n] === undefined ? '' : (f.tipo === 'num' ? Number(String(b[f.n]).replace(',', '.')) || 0 : String(b[f.n]).slice(0, 500));
        LOG.registrar(p.nome, (b.id ? 'atualizou ' : 'lançou ') + t.nome, [reg.cliente, reg.item || reg.descricao].filter(Boolean).join(' · '));
        return json(res, 200, b.id ? c.atualizar(b.id, reg) : c.adicionar(reg));
      }
      if (req.method === 'PATCH') { const b = await corpoDe(req); const campos = {}; if (b.status) campos.status = String(b.status).slice(0, 30); LOG.registrar(p.nome, t.nome + ': situação alterada', String(b.status)); return json(res, 200, c.atualizar(b.id, campos) || { ok: false }); }
      if (req.method === 'DELETE') return json(res, 200, { ok: c.remover(url.searchParams.get('id')) });
    }

    /* --- Conta Azul (somente Miguel) --- */
    if (rota.startsWith('/api/ca/') || rota.startsWith('/conta-azul')) {
      if (!TEM_CONTA_AZUL) return json(res, 404, { ok: false, motivo: 'o Conta Azul é exclusivo do painel do Miguel' });
      if (rota === '/api/ca/estado') return json(res, 200, Object.assign(CA.estado(), { redirectPadrao: `http://localhost:${PORT}/conta-azul/callback` }));
      if (rota === '/api/ca/config' && req.method === 'POST') return json(res, 200, CA.configurar(await corpoDe(req)));
      if (rota === '/conta-azul/conectar') {
        const st = crypto.randomBytes(12).toString('hex'); estadosOAuth.add(st);
        const alvo = CA.urlAutorizacao(st);
        if (!alvo) return json(res, 400, { ok: false, motivo: 'salve client_id e redirect_uri antes de conectar' });
        res.writeHead(302, { Location: alvo }); return res.end();
      }
      if (rota === '/conta-azul/callback') {
        const st = url.searchParams.get('state'), code = url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (!code || !estadosOAuth.delete(st)) return res.end('<p>Autorização inválida ou expirada. Volte ao painel e conecte de novo.</p>');
        try { await CA.trocarCodigo(code); return res.end('<p>Conta Azul conectado. Pode fechar esta janela e voltar ao painel.</p><script>setTimeout(()=>location="/",1200)</script>'); }
        catch (e) { return res.end('<p>Não foi possível conectar: ' + String(e.message).replace(/[<>&]/g, '') + '</p>'); }
      }
      if (rota === '/api/ca/resumo') return json(res, 200, { ok: true, dados: await analiseContaAzul(Math.min(180, Number(url.searchParams.get('dias')) || 90)) });
    }

    /* --- Acessórias --- */
    if (rota.startsWith('/api/ac/')) {
      if (!TEM_ACESSORIAS) return json(res, 404, { ok: false, motivo: 'indisponível para este agente' });
      if (rota === '/api/ac/estado') return json(res, 200, AC.estado());
      if (rota === '/api/ac/config' && req.method === 'POST') return json(res, 200, AC.configurar(await corpoDe(req)));
      if (rota === '/api/ac/empresa') return json(res, 200, { ok: true, dados: await AC.empresa(url.searchParams.get('cnpj')) });
      if (rota === '/api/ac/entregas') {
        const hoje = new Date(), fim = new Date(hoje.getTime() + 14 * 86400000);
        return json(res, 200, { ok: true, dados: await AC.entregas(url.searchParams.get('cnpj'), url.searchParams.get('ini') || hojeISO(), url.searchParams.get('fim') || fim.toISOString().slice(0, 10), url.searchParams.get('situacao')) });
      }
      if (rota === '/api/ac/solicitacoes') return json(res, 200, { ok: true, dados: await AC.solicitacoes(url.searchParams.get('status') || 'A') });
    }

    json(res, 404, { ok: false, motivo: 'rota não encontrada' });
  } catch (e) {
    json(res, 500, { ok: false, motivo: e.message });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`${p.nome} (${p.cargo}) -> http://localhost:${PORT}`));
