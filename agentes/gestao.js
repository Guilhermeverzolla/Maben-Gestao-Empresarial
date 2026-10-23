/* ===========================================================
   Central de gestão do Guilherme — a produção do escritório em tempo real.

   Junta, num painel só:
   - a equipe e o status de cada agente (data/equipe.json);
   - a rotina do dia de cada um e o que registraram (agentes/estado, atividade);
   - clientes, onboarding do BPO, contas a pagar e a receber dos clientes e
     vencimentos (data/clientes.json, data/registros);
   - os sistemas dos agentes no ar (API do escritório).
   Atualiza sozinho: /api/stream (SSE) manda um retrato novo a cada 3 s.

   Não lê o Conta Azul: aquele financeiro é exclusivo do Miguel.
   =========================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { colecao, ler, DATA } = require('./lib/store');
const LOG = require('./lib/atividade');
const { diasEntre, hojeISO } = require('./lib/tools');

const PORT = Number(process.env.PORT) || 4400;
const ESCRITORIO = process.env.ESCRITORIO_URL || 'http://127.0.0.1:4321';
const WEB = path.join(__dirname, 'web-gestao');
const WEB_COMUM = path.join(__dirname, 'web');
const perfis = JSON.parse(fs.readFileSync(path.join(__dirname, 'perfis.json'), 'utf8'));
const config = ler(path.join(DATA, 'config.json'), {});

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const soma = (l, k = 'valor') => r2(l.reduce((s, x) => s + (Number(x[k]) || 0), 0));

async function sistemasNoAr() {
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(ESCRITORIO + '/api/sistemas', { signal: ctl.signal });
    const j = await r.json();
    const lista = Array.isArray(j) ? j : (j.sistemas || []);
    return Object.fromEntries(lista.map(s => [s.id, s.estado]));
  } catch (e) { return null; }
}

function rotinaDe(chave) {
  const total = perfis[chave].rotinas.length;
  const e = ler(path.join(__dirname, 'estado', chave + '.json'), null);
  const feitas = e && e.dia === hojeISO() ? e.feitas.length : 0;
  return { feitas, total, pct: Math.round(feitas / total * 100) };
}

async function retrato() {
  const hoje = hojeISO();
  const equipe = (ler(path.join(DATA, 'equipe.json'), { team: [] }).team) || [];
  const sis = await sistemasNoAr();
  const ativ24 = LOG.desde(24 * 3600 * 1000), ativ7 = LOG.desde(7 * 24 * 3600 * 1000);

  const pessoas = equipe.filter(a => !a.boss).map(a => {
    const rot = perfis[a.key] ? rotinaDe(a.key) : { feitas: 0, total: 0, pct: 0 };
    const nome = a.name;
    const minhas = ativ24.filter(x => x.agente === nome);
    return { key: a.key, nome, cargo: a.role, setor: (perfis[a.key] || {}).setor || 'Outros', status: a.status,
             rotina: rot, acoesHoje: ativ24.filter(x => x.agente === nome && x.quando.slice(0, 10) === hoje).length,
             acoes24h: minhas.length, ultima: minhas[0] || null,
             sistema: sis ? (sis[a.key] || 'desconhecido') : 'sem resposta do escritório', porta: (perfis[a.key] || {}).porta };
  });

  const setores = {};
  pessoas.forEach(p => { const s = setores[p.setor] = setores[p.setor] || { nome: p.setor, pessoas: 0, feitas: 0, total: 0, acoes: 0 }; s.pessoas++; s.feitas += p.rotina.feitas; s.total += p.rotina.total; s.acoes += p.acoesHoje; });
  Object.values(setores).forEach(s => s.pct = s.total ? Math.round(s.feitas / s.total * 100) : 0);

  const clientes = colecao('clientes').lista();
  const pagar = colecao('pagar').lista(), receber = colecao('receber').lista();
  const venc = colecao('vencimentos').lista(), onb = colecao('onboarding').lista();
  const pAb = pagar.filter(x => x.status !== 'pago'), rAb = receber.filter(x => x.status !== 'recebido');
  const vAb = venc.filter(x => x.status !== 'renovado');

  const porCli = {};
  onb.forEach(x => { (porCli[x.cliente] = porCli[x.cliente] || []).push(x); });
  const onboarding = Object.entries(porCli).map(([cliente, l]) => ({ cliente, total: l.length, feitas: l.filter(x => x.status === 'concluido').length,
    pendentes: l.filter(x => x.status !== 'concluido').slice(0, 4).map(x => x.item) }));

  const criticos = vAb.filter(x => x.vencimento && diasEntre(hoje, x.vencimento) <= 15)
    .sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).slice(0, 12)
    .map(x => ({ cliente: x.cliente, item: x.item, vencimento: x.vencimento, dias: diasEntre(hoje, x.vencimento) }));

  const dias7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10); return { dia: d, n: ativ7.filter(x => x.quando.slice(0, 10) === d).length }; });

  const rotTotal = pessoas.reduce((s, p) => s + p.rotina.total, 0), rotFeitas = pessoas.reduce((s, p) => s + p.rotina.feitas, 0);
  return {
    agora: new Date().toISOString(), escritorio: config.nome || 'MABEN Gestão Empresarial LTDA',
    kpis: { agentes: pessoas.length, trabalhando: pessoas.filter(p => p.status === 'trabalhando' || p.status === 'reuniao').length,
            rotinaPct: rotTotal ? Math.round(rotFeitas / rotTotal * 100) : 0, acoesHoje: ativ24.filter(x => x.quando.slice(0, 10) === hoje).length,
            clientes: clientes.length, clientesBpo: clientes.filter(c => c.servicos === 'bpo' || c.servicos === 'ambos').length,
            sistemasNoAr: sis ? Object.values(sis).filter(s => s === 'no ar').length : null },
    setores: Object.values(setores), pessoas, onboarding, criticos, dias7,
    financeiroClientes: { pagarAberto: soma(pAb), pagarVencido: soma(pAb.filter(x => x.vencimento < hoje)), receberAberto: soma(rAb), receberVencido: soma(rAb.filter(x => x.vencimento < hoje)),
                          titulosVencidos: pAb.filter(x => x.vencimento < hoje).length + rAb.filter(x => x.vencimento < hoje).length },
    clientes: { porRegime: contar(clientes, 'regime'), porServico: contar(clientes, 'servicos'), lista: clientes.slice(0, 40).map(c => ({ razao: c.razao, regime: c.regime, servicos: c.servicos })) },
    vencimentos: { abertos: vAb.length, criticos: criticos.length },
    atividade: LOG.recentes(40)
  };
}
const contar = (l, k) => l.reduce((o, x) => { const v = x[k] || 'não informado'; o[v] = (o[v] || 0) + 1; return o; }, {});

const clientesSSE = new Set();
setInterval(async () => {
  if (!clientesSSE.size) return;
  try { const s = 'data: ' + JSON.stringify(await retrato()) + '\n\n'; for (const r of clientesSSE) r.write(s); } catch (e) { /* tenta no próximo ciclo */ }
}, 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname;
  try {
    if (rota === '/api/retrato') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(await retrato())); }
    if (rota === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      clientesSSE.add(res); req.on('close', () => clientesSSE.delete(res));
      res.write('data: ' + JSON.stringify(await retrato()) + '\n\n'); return;
    }
    const arq = rota === '/' ? 'index.html' : rota.replace(/^\/+/, '');
    for (const base of [WEB, WEB_COMUM]) {
      const full = path.join(base, arq);
      if (full.startsWith(base) && fs.existsSync(full) && fs.statSync(full).isFile() && (base === WEB || arq === 'estilo.css')) {
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(full));
      }
    }
    res.writeHead(404); res.end('não encontrado');
  } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, motivo: e.message })); }
}).listen(PORT, '127.0.0.1', () => console.log(`Central de gestão -> http://localhost:${PORT}`));
