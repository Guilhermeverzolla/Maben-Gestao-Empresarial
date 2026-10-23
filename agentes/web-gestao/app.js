/* Central de gestão do Guilherme: recebe o retrato do escritório por SSE e redesenha. */
(() => {
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ST = { trabalhando: ['ok', 'Trabalhando'], reuniao: ['ok', 'Em reunião'], descanso: ['warn', 'Descanso'], offline: ['bad', 'Offline'] };
const SIS = { 'no ar': ['ok', 'no ar'], caiu: ['bad', 'caiu'], parado: ['warn', 'desligado'] };
const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR');
const dataHora = (iso) => { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const k = (v, r, c = '') => `<div class="kpi ${c}"><b>${esc(v)}</b><span>${esc(r)}</span></div>`;
const bar = (p) => `<div class="bar"><i style="width:${p}%"></i></div>`;

function desenhar(d) {
  $('#esc').textContent = d.escritorio;
  $('#hora').textContent = 'ao vivo · atualizado às ' + hora(d.agora);
  const f = d.financeiroClientes, K = d.kpis;
  const max = Math.max(1, ...d.dias7.map(x => x.n));
  $('#v').innerHTML = `
  <div class="grid g4" style="margin-bottom:14px">
    ${k(K.trabalhando + ' / ' + K.agentes, 'agentes trabalhando', K.trabalhando < K.agentes ? 'warn' : 'ok')}
    ${k(K.rotinaPct + '%', 'rotinas do dia concluídas', K.rotinaPct >= 70 ? 'ok' : K.rotinaPct >= 30 ? 'warn' : 'bad')}
    ${k(K.acoesHoje, 'ações registradas hoje')}
    ${k(K.clientes, 'clientes cadastrados (' + K.clientesBpo + ' com BPO)')}
    ${k(K.sistemasNoAr === null ? '—' : K.sistemasNoAr, 'painéis de agente no ar', K.sistemasNoAr === null ? 'warn' : '')}
    ${k(brl(f.receberAberto), 'a receber dos clientes (BPO)')}
    ${k(brl(f.pagarAberto), 'a pagar dos clientes (BPO)')}
    ${k(f.titulosVencidos, 'títulos vencidos (BPO)', f.titulosVencidos ? 'bad' : 'ok')}
  </div>

  <div class="grid g2">
    <section><h2>Andamento por setor</h2>${d.setores.map(s => `<div style="margin-bottom:12px"><b>${esc(s.nome)}</b> <span class="dim">${s.pessoas} pessoa(s) · rotina ${s.pct}% · ${s.acoes} ação(ões) hoje</span>${bar(s.pct)}</div>`).join('')}</section>
    <section><h2>Produção · ações nos últimos 7 dias</h2><div class="sp">${d.dias7.map(x => `<div style="height:${Math.round(x.n / max * 100)}%"><span>${x.n}</span></div>`).join('')}</div>
      <div class="sp" style="height:auto;margin-top:2px">${d.dias7.map(x => `<small style="flex:1">${esc(x.dia.slice(8, 10) + '/' + x.dia.slice(5, 7))}</small>`).join('')}</div></section>
  </div>

  <section><h2>Equipe em tempo real</h2><table><tr><th>Agente</th><th>Cargo</th><th>Status</th><th style="width:170px">Rotina de hoje</th><th class="n">Ações hoje</th><th>Painel</th><th>Última ação</th></tr>
    ${d.pessoas.map(p => { const s = ST[p.status] || ['', p.status], y = SIS[p.sistema] || ['warn', p.sistema];
      return `<tr><td><b>${esc(p.nome)}</b><br><span class="dim">${esc(p.setor)}</span></td><td>${esc(p.cargo)}</td><td><span class="tag ${s[0]}">${s[1]}</span></td>
      <td>${p.rotina.feitas}/${p.rotina.total} · ${p.rotina.pct}%${bar(p.rotina.pct)}</td><td class="n">${p.acoesHoje}</td>
      <td><a href="http://localhost:${p.porta}" target="_blank" rel="noopener"><span class="tag ${y[0]}">${esc(y[1])}</span></a></td>
      <td class="dim">${p.ultima ? esc(p.ultima.acao) + ' · ' + dataHora(p.ultima.quando) : 'sem registro'}</td></tr>`; }).join('')}</table></section>

  <div class="grid g2">
    <section><h2>Clientes e onboarding do BPO</h2>
      <p class="dim">Regimes: ${Object.entries(d.clientes.porRegime).map(([a, n]) => esc(a) + ' ' + n).join(' · ') || 'nenhum cliente'} &nbsp;|&nbsp; Serviços: ${Object.entries(d.clientes.porServico).map(([a, n]) => esc(a) + ' ' + n).join(' · ') || '—'}</p>
      ${d.onboarding.length ? d.onboarding.map(o => { const p = Math.round(o.feitas / o.total * 100); return `<div style="margin-bottom:12px"><b>${esc(o.cliente)}</b> <span class="dim">${o.feitas}/${o.total} etapas · ${p}%</span>${bar(p)}${o.pendentes.length ? `<div class="dim">Falta: ${o.pendentes.map(esc).join('; ')}</div>` : ''}</div>`; }).join('') : '<p class="dim">Nenhum cliente em onboarding. O Wesley inicia pelo painel dele.</p>'}</section>
    <section><h2>Financeiro dos clientes (BPO)</h2><table>
      <tr><td>A receber em aberto</td><td class="n">${brl(f.receberAberto)}</td></tr><tr><td>A receber vencido</td><td class="n"><span class="tag ${f.receberVencido ? 'bad' : 'ok'}">${brl(f.receberVencido)}</span></td></tr>
      <tr><td>A pagar em aberto</td><td class="n">${brl(f.pagarAberto)}</td></tr><tr><td>A pagar vencido</td><td class="n"><span class="tag ${f.pagarVencido ? 'bad' : 'ok'}">${brl(f.pagarVencido)}</span></td></tr></table>
      <h3>Vencimentos críticos (até 15 dias)</h3>
      ${d.criticos.length ? `<table>${d.criticos.map(c => `<tr class="${c.dias < 0 ? 'venc' : 'alerta'}"><td>${esc(c.cliente)}</td><td>${esc(c.item)}</td><td class="n">${c.dias < 0 ? 'venceu há ' + (-c.dias) + ' d' : c.dias === 0 ? 'hoje' : 'em ' + c.dias + ' d'}</td></tr>`).join('')}</table>` : '<p class="dim">Nada crítico.</p>'}</section>
  </div>

  <section><h2>Atividade ao vivo</h2><ul class="feed">${d.atividade.map(a => `<li><span class="dim">${dataHora(a.quando)}</span> · <b>${esc(a.agente)}</b> ${esc(a.acao)}${a.detalhe ? ' — ' + esc(a.detalhe) : ''}</li>`).join('') || '<li class="dim">Sem atividade registrada ainda. Assim que um agente marcar uma rotina ou lançar algo, aparece aqui.</li>'}</ul></section>`;
}

function conectar() {
  const es = new EventSource('/api/stream');
  es.onmessage = (e) => { $('#pulso').style.background = ''; desenhar(JSON.parse(e.data)); };
  es.onerror = () => { $('#hora').textContent = 'reconectando…'; $('#pulso').style.background = '#c0392b'; };
}
conectar();
})();
