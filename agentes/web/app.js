/* Interface dos painéis de agente (MABEN). Vanilla JS, sem dependências. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = { brl, pct: v => (Number(v) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%', pct4: v => (Number(v) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%',
  num: v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }), txt: v => String(v) };
const fmt = (f, v) => (FMT[f] || FMT.txt)(v);
const api = async (rota, metodo = 'GET', corpo) => {
  const r = await fetch(rota, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && j.ok === false) throw new Error(j.motivo || ('erro ' + r.status));
  return j;
};
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

let P, clientes = [], abaAtual = 'rotina';
const view = $('#view');

async function iniciar() {
  P = await api('/api/perfil');
  document.documentElement.style.setProperty('--c', P.perfil.cor);
  document.title = P.perfil.nome + ' · ' + P.perfil.cargo;
  $('#setor').textContent = P.perfil.setor + ' · MABEN Gestão Empresarial';
  $('#titulo').textContent = P.perfil.nome + ' — ' + P.perfil.cargo;
  $('#missao').textContent = P.perfil.missao;
  clientes = await api('/api/clientes');
  const abas = [['rotina', 'Rotina']].concat(P.ferramentas.map(f => [f.id, f.nome]), [['clientes', 'Clientes']]);
  if (P.contaAzul) abas.push(['contaazul', 'Conta Azul · financeiro do escritório']);
  if (P.acessorias) abas.push(['acessorias', 'Acessórias']);
  abas.push(['ref', 'Base legal']);
  $('#nav').innerHTML = abas.map(([id, n]) => `<button data-a="${id}">${esc(n)}</button>`).join('');
  $('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) abrir(b.dataset.a); });
  abrir(location.hash.slice(1) || 'rotina');
}

function abrir(id) {
  abaAtual = id; location.hash = id;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.a === id));
  const f = P.ferramentas.find(x => x.id === id);
  if (id === 'rotina') return telaRotina();
  if (id === 'clientes') return telaClientes();
  if (id === 'contaazul') return telaContaAzul();
  if (id === 'acessorias') return telaAcessorias();
  if (id === 'ref') return telaRef();
  if (f) return f.tipo === 'calc' ? telaCalc(f) : telaRegistro(f);
}

/* ---------------- rotina ---------------- */
function telaRotina() {
  const e = P.estado, feitas = new Set(e.feitas), total = P.perfil.rotinas.length;
  const pct = Math.round(feitas.size / total * 100);
  view.innerHTML = `<section><h2>Rotina de hoje · ${pct}%</h2><div class="bar"><i style="width:${pct}%"></i></div>
    ${P.perfil.rotinas.map((r, i) => `<label class="chk ${feitas.has(i) ? 'ok' : ''}"><input type="checkbox" data-i="${i}" ${feitas.has(i) ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}
    <p class="dim">As marcações zeram todo dia e alimentam a central do Guilherme.</p></section>
    <section><h2>Anotações</h2><label class="f"><textarea id="notas" rows="5" placeholder="Pendências, combinados, lembretes…">${esc(e.notas)}</textarea></label>
    <button class="b" id="salvar">Salvar anotações</button> <span class="dim" id="ok"></span></section>`;
  view.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', async () => {
    const r = await api('/api/estado', 'POST', { marcar: Number(cb.dataset.i), valor: cb.checked }); P.estado = r.estado; telaRotina();
  }));
  $('#salvar').onclick = async () => { const r = await api('/api/estado', 'POST', { notas: $('#notas').value }); P.estado = r.estado; $('#ok').textContent = 'salvo'; };
}

/* ---------------- calculadoras ---------------- */
function campoHtml(c, valor) {
  const v = valor !== undefined ? valor : (c.padrao !== undefined ? c.padrao : '');
  let ctl;
  if (c.tipo === 'sel') ctl = `<select name="${c.n}">${c.opcoes.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  else if (c.tipo === 'data') ctl = `<input type="date" name="${c.n}" value="${esc(v)}">`;
  else if (c.tipo === 'num') ctl = `<input type="number" step="any" name="${c.n}" value="${esc(v)}">`;
  else ctl = `<input type="text" name="${c.n}" value="${esc(v)}">`;
  return `<label class="f">${esc(c.rotulo)}${ctl}</label>`;
}
const lerForm = (form) => Object.fromEntries(new FormData(form).entries());

function resultadoHtml(r) {
  return `<div class="res">${r.linhas.map(l => `<div class="linha ${l.d ? 'd' : ''}"><span>${esc(l.r)}</span><span>${esc(fmt(l.f, l.v))}</span></div>`).join('')}</div>
    ${r.tabela ? `<table style="margin-top:10px"><tr>${r.tabela.cab.map((c, i) => `<th class="${i ? 'n' : ''}">${esc(c)}</th>`).join('')}</tr>
      ${r.tabela.linhas.map(l => `<tr>${l.map((c, i) => `<td class="${i ? 'n' : ''}">${typeof c === 'number' ? (r.tabela.cab[i].includes('%') ? FMT.pct(c) : brl(c)) : esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : ''}
    ${(r.avisos || []).map(a => `<div class="aviso">${esc(a)}</div>`).join('')}
    ${r.base ? `<div class="base"><b>Base legal:</b> ${r.base.map(esc).join(' · ')}</div>` : ''}`;
}

function telaCalc(f) {
  const temDe = f.campos.some(c => c.de);
  view.innerHTML = `<section><h2>${esc(f.nome)}</h2><p class="dim">${esc(f.descricao)}</p>
    ${temDe ? `<label class="f">Carregar dados de um cliente cadastrado<select id="cli"><option value="">— digitar manualmente —</option>${clientes.map(c => `<option value="${esc(c.id)}">${esc(c.razao)}</option>`).join('')}</select></label>` : ''}
    <form id="f" class="form">${f.campos.map(c => campoHtml(c)).join('')}</form>
    <button class="b" id="calc">Calcular</button></section><div id="out"></div>`;
  const form = $('#f');
  if (temDe) $('#cli').onchange = () => {
    const c = clientes.find(x => x.id === $('#cli').value); if (!c) return;
    f.campos.filter(x => x.de && c[x.de] !== undefined && c[x.de] !== '').forEach(x => { const el = form.elements[x.n]; if (el) el.value = c[x.de]; });
  };
  $('#calc').onclick = async () => {
    try { const r = await api('/api/calc/' + f.id, 'POST', { valores: lerForm(form) }); $('#out').innerHTML = `<section>${resultadoHtml(r.resultado)}</section>`; }
    catch (e) { $('#out').innerHTML = `<div class="aviso">${esc(e.message)}</div>`; }
  };
}

/* ---------------- registros ---------------- */
async function telaRegistro(f) {
  const dados = await api('/api/reg/' + f.id);
  const hoje = P.hoje, fechado = f.fechado;
  const aberto = dados.filter(x => x.status !== fechado);
  const venc = aberto.filter(x => x.vencimento && x.vencimento < hoje);
  const soma = (l) => l.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const temValor = f.campos.some(c => c.n === 'valor');
  const kpis = [[aberto.length, 'em aberto'], [venc.length, 'vencidos', venc.length ? 'bad' : '']];
  if (temValor) kpis.push([brl(soma(aberto)), 'valor em aberto'], [brl(soma(venc)), 'valor vencido', venc.length ? 'bad' : '']);
  if (f.alerta) kpis.push([aberto.filter(x => x.vencimento && x.vencimento >= hoje && diasEntre(hoje, x.vencimento) <= f.alerta).length, `vencem em ${f.alerta} dias`, 'warn']);
  let extra = '';
  if (f.aging) {
    const b = [[0, 30], [31, 60], [61, 90], [91, 99999]].map(([a, z]) => aberto.filter(x => { const d = diasEntre(x.vencimento, hoje); return x.vencimento && d >= a && d <= z && d > 0; }));
    extra = `<section><h2>Aging da inadimplência</h2><div class="grid g4">${['1–30 dias', '31–60 dias', '61–90 dias', 'Mais de 90'].map((n, i) => `<div class="kpi ${b[i].length ? 'bad' : ''}"><b>${brl(soma(b[i]))}</b><span>${n} · ${b[i].length} título(s)</span></div>`).join('')}</div></section>`;
  }
  let prog = '';
  if (f.gerador) {
    const por = {}; dados.forEach(x => { (por[x.cliente] = por[x.cliente] || []).push(x); });
    prog = `<section><h2>Andamento por cliente</h2>${Object.keys(por).length ? Object.entries(por).map(([c, l]) => { const ok = l.filter(x => x.status === 'concluido').length, pc = Math.round(ok / l.length * 100); return `<div style="margin-bottom:10px"><b>${esc(c)}</b> <span class="dim">${ok}/${l.length} etapas · ${pc}%</span><div class="bar"><i style="width:${pc}%"></i></div></div>`; }).join('') : '<p class="dim">Nenhum cliente em onboarding.</p>'}
      <div class="form" style="margin-top:8px"><label class="f">Novo cliente de BPO<input id="gcli" list="lc" placeholder="Nome do cliente"></label><datalist id="lc">${clientes.map(c => `<option value="${esc(c.razao)}">`).join('')}</datalist></div>
      <button class="b" id="gerar">${esc(f.gerador.rotulo)}</button></section>`;
  }
  const cols = f.campos.filter(c => c.n !== 'obs');
  const ordenado = dados.slice().sort((a, b) => String(a.vencimento || a.prazo || '').localeCompare(String(b.vencimento || b.prazo || '')));
  view.innerHTML = `<div class="grid g4" style="margin-bottom:14px">${kpis.map(k => `<div class="kpi ${k[2] || ''}"><b>${esc(k[0])}</b><span>${esc(k[1])}</span></div>`).join('')}</div>${prog}${extra}
    <section><h2>${esc(f.nome)}</h2><p class="dim">${esc(f.descricao)}</p>
    <form id="f" class="form">${f.campos.map(c => campoHtml(c)).join('')}</form><button class="b" id="add">Lançar</button> <span class="dim" id="msg"></span></section>
    <section><table><tr>${cols.map(c => `<th class="${c.tipo === 'num' ? 'n' : ''}">${esc(c.rotulo.replace(/ \(.*/, ''))}</th>`).join('')}<th></th></tr>
    ${ordenado.map(x => { const dt = x.vencimento || x.prazo; const cls = x.status === fechado ? 'fechado' : (dt && dt < hoje ? 'venc' : (f.alerta && dt && diasEntre(hoje, dt) <= f.alerta ? 'alerta' : ''));
      return `<tr class="${cls}">${cols.map(c => `<td class="${c.tipo === 'num' ? 'n' : ''}">${c.tipo === 'num' ? brl(x[c.n] || 0) : esc(c.tipo === 'sel' ? ((c.opcoes.find(o => o[0] === x[c.n]) || [])[1] || x[c.n]) : (c.tipo === 'data' && x[c.n] ? x[c.n].split('-').reverse().join('/') : x[c.n]))}</td>`).join('')}
      <td class="n">${x.status !== fechado ? `<button class="b s" data-ok="${x.id}">✔ ${esc(fechado)}</button> ` : ''}<button class="b x" data-del="${x.id}">✕</button></td></tr>`; }).join('') || `<tr><td colspan="${cols.length + 1}" class="dim">Nada lançado ainda.</td></tr>`}</table></section>`;
  $('#add').onclick = async () => {
    try { await api('/api/reg/' + f.id, 'POST', lerForm($('#f'))); telaRegistro(f); } catch (e) { $('#msg').textContent = e.message; }
  };
  if (f.gerador) $('#gerar').onclick = async () => {
    const c = $('#gcli').value.trim(); if (!c) return $('#gcli').focus();
    await api(`/api/reg/${f.id}/gerar`, 'POST', { cliente: c }); telaRegistro(f);
  };
  view.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => { await api('/api/reg/' + f.id, 'PATCH', { id: b.dataset.ok, status: fechado }); telaRegistro(f); });
  view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('Remover este lançamento?')) { await api('/api/reg/' + f.id + '?id=' + b.dataset.del, 'DELETE'); telaRegistro(f); } });
}

/* ---------------- clientes ---------------- */
const CAMPOS_CLIENTE = [
  { n: 'razao', rotulo: 'Razão social', tipo: 'txt' }, { n: 'cnpj', rotulo: 'CNPJ/CPF', tipo: 'txt' },
  { n: 'regime', rotulo: 'Regime', tipo: 'sel', opcoes: [['Simples Nacional', 'Simples Nacional'], ['Lucro Presumido', 'Lucro Presumido'], ['Lucro Real', 'Lucro Real'], ['MEI', 'MEI']], padrao: 'Simples Nacional' },
  { n: 'atividade', rotulo: 'Atividade', tipo: 'sel', opcoes: [['servico', 'Serviços'], ['comercio', 'Comércio'], ['industria', 'Indústria']], padrao: 'servico' },
  { n: 'cnae', rotulo: 'CNAE principal', tipo: 'txt' }, { n: 'uf', rotulo: 'UF', tipo: 'txt' }, { n: 'municipio', rotulo: 'Município', tipo: 'txt' },
  { n: 'rbt12', rotulo: 'RBT12 (R$)', tipo: 'num' }, { n: 'folha12', rotulo: 'Folha 12 meses (R$)', tipo: 'num' }, { n: 'iss', rotulo: 'ISS do município (%)', tipo: 'num' },
  { n: 'servicos', rotulo: 'Serviços contratados', tipo: 'sel', opcoes: [['contabil', 'Contábil'], ['bpo', 'BPO financeiro'], ['ambos', 'Contábil + BPO']], padrao: 'contabil' },
  { n: 'obs', rotulo: 'Observações', tipo: 'txt' }
];
function telaClientes() {
  view.innerHTML = `<section><h2>Cadastro de clientes</h2><p class="dim">Fica só nesta máquina (pasta data/, fora do git) e é compartilhado entre os agentes para preencher os cálculos.</p>
    <form id="f" class="form">${CAMPOS_CLIENTE.map(c => campoHtml(c)).join('')}</form><button class="b" id="add">Salvar cliente</button> <span class="dim" id="msg"></span></section>
    <section><table><tr><th>Cliente</th><th>CNPJ</th><th>Regime</th><th>Serviço</th><th class="n">RBT12</th><th></th></tr>
    ${clientes.map(c => `<tr><td>${esc(c.razao)}</td><td>${esc(c.cnpj)}</td><td>${esc(c.regime)}</td><td>${esc(c.servicos)}</td><td class="n">${brl(c.rbt12 || 0)}</td><td class="n"><button class="b x" data-del="${c.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="dim">Nenhum cliente cadastrado.</td></tr>'}</table></section>`;
  $('#add').onclick = async () => {
    const v = lerForm($('#f')); CAMPOS_CLIENTE.filter(c => c.tipo === 'num').forEach(c => v[c.n] = Number(String(v[c.n]).replace(',', '.')) || 0);
    try { await api('/api/clientes', 'POST', v); clientes = await api('/api/clientes'); telaClientes(); } catch (e) { $('#msg').textContent = e.message; }
  };
  view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('Remover o cliente?')) { await api('/api/clientes?id=' + b.dataset.del, 'DELETE'); clientes = await api('/api/clientes'); telaClientes(); } });
}

/* ---------------- Conta Azul (só Miguel) ---------------- */
async function telaContaAzul() {
  const s = await api('/api/ca/estado');
  if (!s.conectado) {
    view.innerHTML = `<section><h2>Conectar o Conta Azul do escritório</h2>
      <p>Este painel lê o financeiro do <b>escritório</b> direto do Conta Azul (somente consulta; nada é lançado ou alterado). Só o Miguel tem acesso.</p>
      <ol><li>No portal de desenvolvedores do Conta Azul (<a href="https://developers.contaazul.com" target="_blank" rel="noopener">developers.contaazul.com</a>), cadastre um aplicativo e use como URL de redirecionamento exatamente o endereço abaixo.</li>
      <li>Copie o <b>client_id</b> e o <b>client_secret</b> e cole aqui. Eles ficam em <code>data/contaazul.json</code>, fora do git, e nunca voltam para o navegador.</li>
      <li>Clique em <b>Conectar</b>, entre com a conta do escritório e autorize.</li></ol>
      <form id="f" class="form"><label class="f">client_id<input name="clientId" autocomplete="off"></label>
      <label class="f">client_secret<input name="clientSecret" type="password" autocomplete="off"></label>
      <label class="f">URL de redirecionamento<input name="redirectUri" value="${esc(s.redirectUri || s.redirectPadrao)}"></label></form>
      <button class="b" id="salvar">Salvar</button> ${s.configurado ? '<a class="b" href="/conta-azul/conectar">Conectar ao Conta Azul</a>' : ''} <span class="dim" id="msg">${s.configurado ? 'Credenciais salvas.' : ''}</span></section>`;
    $('#salvar').onclick = async () => { await api('/api/ca/config', 'POST', lerForm($('#f'))); telaContaAzul(); };
    return;
  }
  view.innerHTML = '<section>Lendo o Conta Azul…</section>';
  try {
    const { dados: d } = await api('/api/ca/resumo?dias=90');
    const k = (v, r, c = '') => `<div class="kpi ${c}"><b>${esc(v)}</b><span>${esc(r)}</span></div>`;
    view.innerHTML = `<div class="grid g4" style="margin-bottom:14px">
      ${k(brl(d.saldoTotal), 'saldo em contas', d.saldoTotal < 0 ? 'bad' : '')}${k(brl(d.receberAberto), 'a receber (aberto)')}${k(brl(d.pagarAberto), 'a pagar (aberto)')}
      ${k(brl(d.vencidoReceber), 'recebimentos vencidos', d.vencidoReceber ? 'bad' : 'ok')}${k(brl(d.vencidoPagar), 'pagamentos vencidos', d.vencidoPagar ? 'bad' : 'ok')}${k(brl(d.pagar30), 'a pagar em 30 dias', d.pagar30 > d.saldoTotal ? 'warn' : '')}</div>
      ${d.flags.map(a => `<div class="aviso">⚠ ${esc(a)}</div>`).join('')}
      <section><h2>Projeção de caixa · 13 semanas (${esc(d.de)} a ${esc(d.ate)})</h2><table><tr><th>Semana</th><th class="n">Entradas</th><th class="n">Saídas</th><th class="n">Saldo</th></tr>
      ${d.proj.map(s => `<tr class="${s.saldo < 0 ? 'venc' : ''}"><td>Semana ${s.semana}</td><td class="n">${brl(s.ent)}</td><td class="n">${brl(s.sai)}</td><td class="n">${brl(s.saldo)}</td></tr>`).join('')}</table></section>
      <div class="grid g2"><section><h2>Contas financeiras</h2><table>${d.saldos.map(c => `<tr><td>${esc(c.nome)}</td><td class="dim">${esc(c.tipo)}</td><td class="n">${c.saldo === null ? esc(c.erro) : brl(c.saldo)}</td></tr>`).join('') || '<tr><td class="dim">Nenhuma conta encontrada.</td></tr>'}</table></section>
      <section><h2>Próximos recebimentos</h2><table>${d.proximosReceber.map(x => `<tr><td>${esc(x.vencimento.split('-').reverse().join('/'))}</td><td>${esc(x.pessoa || x.descricao)}</td><td class="n">${brl(x.valor)}</td></tr>`).join('') || '<tr><td class="dim">Nada em aberto.</td></tr>'}</table></section></div>
      <section><h2>Próximos pagamentos</h2><table>${d.proximosPagar.map(x => `<tr><td>${esc(x.vencimento.split('-').reverse().join('/'))}</td><td>${esc(x.pessoa || x.descricao)}</td><td class="n">${brl(x.valor)}</td></tr>`).join('') || '<tr><td class="dim">Nada em aberto.</td></tr>'}</table></section>
      <section><h2>Dado bruto do Conta Azul (para conferir os campos)</h2><p class="dim">A documentação do Conta Azul não lista os campos de cada item. Se algum valor acima parecer vazio, o nome do campo real aparece aqui.</p><pre>${esc(JSON.stringify(d.amostraBruta, null, 2))}</pre></section>`;
  } catch (e) { view.innerHTML = `<section><div class="aviso">${esc(e.message)}</div><a class="b" href="/conta-azul/conectar">Reconectar ao Conta Azul</a></section>`; }
}

/* ---------------- Acessórias ---------------- */
async function telaAcessorias() {
  const s = await api('/api/ac/estado');
  view.innerHTML = `<section><h2>Acessórias · consulta</h2>
    ${s.configurado ? '' : `<div class="aviso">Informe o token da API. A URL base e o cabeçalho abaixo seguem o padrão Bearer; se a Acessórias usar outro formato, ajuste aqui.</div>`}
    <form id="fc" class="form"><label class="f">URL base<input name="url" value="${esc(s.url)}"></label><label class="f">Cabeçalho de autenticação<input name="cabecalho" value="${esc(s.cabecalho)}"></label>
    <label class="f">Token ${s.configurado ? '(já salvo — deixe vazio para manter)' : ''}<input name="token" type="password" autocomplete="off"></label></form><button class="b" id="cfg">Salvar configuração</button></section>
    ${s.configurado ? `<section><h2>Consultar</h2><form id="fq" class="form"><label class="f">CNPJ da empresa<input name="cnpj"></label></form>
    <button class="b" id="emp">Dados da empresa</button> <button class="b" id="ent">Entregas pendentes (14 dias)</button> <button class="b" id="sol">Solicitações novas</button></section><div id="out"></div>` : ''}`;
  $('#cfg').onclick = async () => { await api('/api/ac/config', 'POST', lerForm($('#fc'))); telaAcessorias(); };
  if (!s.configurado) return;
  const rodar = async (rota) => { $('#out').innerHTML = '<section>Consultando…</section>'; try { const r = await api(rota); $('#out').innerHTML = `<section><pre>${esc(JSON.stringify(r.dados, null, 2))}</pre></section>`; } catch (e) { $('#out').innerHTML = `<div class="aviso">${esc(e.message)}</div>`; } };
  const cnpj = () => encodeURIComponent($('#fq').elements.cnpj.value);
  $('#emp').onclick = () => rodar('/api/ac/empresa?cnpj=' + cnpj());
  $('#ent').onclick = () => rodar('/api/ac/entregas?cnpj=' + cnpj());
  $('#sol').onclick = () => rodar('/api/ac/solicitacoes?status=A');
}

/* ---------------- base legal ---------------- */
function telaRef() {
  view.innerHTML = `<section><h2>Base legal e normas do cargo</h2><ul>${P.perfil.base.map(b => `<li>${esc(b)}</li>`).join('')}</ul></section>
    <section><h2>Fontes oficiais</h2><ul>${P.perfil.links.map(l => `<li><a href="${esc(l[1])}" target="_blank" rel="noopener">${esc(l[0])}</a></li>`).join('')}</ul>
    <p class="dim">Tabelas de 2026 usadas nos cálculos: INSS (Portaria Interministerial MPS/MF 13/2026), IRRF (Receita Federal e Lei 15.270/2025), Simples Nacional (LC 123/2006). Confirme as fontes oficiais a cada virada de ano.</p></section>`;
}

iniciar().catch(e => { view.innerHTML = `<div class="aviso">${esc(e.message)}</div>`; });
})();
