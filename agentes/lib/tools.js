/* ===========================================================
   tools.js — as ferramentas dos painéis.

   tipo 'calc'     : formulário -> resultado (função pura em calc.js)
   tipo 'registro' : lista editável, gravada em data/registros/<id>.json
   Resultado de um cálculo: { linhas:[{r,v,f,d}], avisos:[], tabela:{cab,linhas}, base:[] }
     f = 'brl' | 'pct' | 'num' | 'txt'     d = true destaca a linha
   =========================================================== */
const C = require('./calc');
const { colecao } = require('./store');
const { n, r2 } = C;

const F = (nome, rotulo, tipo = 'num', extra = {}) => Object.assign({ n: nome, rotulo, tipo }, extra);
const SIM_NAO = [['nao', 'Não'], ['sim', 'Sim']];
const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

const TOOLS = {};

/* ---------------- Simples Nacional ---------------- */
TOOLS.das = {
  nome: 'DAS · Simples Nacional', tipo: 'calc',
  descricao: 'Alíquota efetiva e DAS do mês, com Fator R automático (Anexo III ou V).',
  campos: [
    F('anexo', 'Anexo', 'sel', { opcoes: [['I', 'I · Comércio'], ['II', 'II · Indústria'], ['III', 'III · Serviços'], ['IV', 'IV · Serviços (CPP fora)'], ['V', 'V · Serviços intelectuais'], ['R', 'III ou V pelo Fator R']], padrao: 'III' }),
    F('rbt12', 'RBT12 (receita bruta dos 12 meses anteriores)', 'num', { de: 'rbt12' }),
    F('receitaMes', 'Receita bruta do mês', 'num'),
    F('folha12', 'Folha de salários dos 12 meses (com pró-labore e encargos) — só para Fator R', 'num', { de: 'folha12' })
  ],
  run(v) {
    const R = C.simples({ anexo: v.anexo === 'R' ? 'III' : v.anexo, rbt12: n(v.rbt12), receitaMes: n(v.receitaMes), folha12: n(v.folha12), usaFatorR: v.anexo === 'R' });
    const linhas = [
      { r: 'Anexo aplicado', v: 'Anexo ' + R.anexoUsado, f: 'txt' }
    ];
    if (R.fatorR !== null) linhas.push({ r: 'Fator R (folha 12m ÷ RBT12)', v: R.fatorR, f: 'pct' });
    linhas.push(
      { r: 'Faixa', v: R.faixa + 'ª (até R$ ' + R.ate.toLocaleString('pt-BR') + ')', f: 'txt' },
      { r: 'Alíquota nominal', v: R.nominal / 100, f: 'pct' },
      { r: 'Parcela a deduzir', v: R.pd, f: 'brl' },
      { r: 'Alíquota efetiva', v: R.efetiva, f: 'pct4', d: true },
      { r: 'DAS estimado do mês', v: R.das, f: 'brl', d: true });
    return { linhas, avisos: R.avisos.concat(['Cálculo sobre a receita informada, sem a repartição por tributo e sem segregação de receitas (ST, monofásico, exportação). Confira no PGDAS-D.']),
             base: ['LC 123/2006, art. 18 e Anexos I a V (redação da LC 155/2016)', 'Resolução CGSN 140/2018'] };
  }
};

/* ---------------- Folha ---------------- */
TOOLS.folha = {
  nome: 'Folha · INSS, IRRF e FGTS', tipo: 'calc',
  descricao: 'Líquido do empregado e custo total para a empresa, tabelas de 2026.',
  campos: [
    F('bruto', 'Salário bruto do mês (inclui adicionais e horas extras)'),
    F('dependentes', 'Dependentes para IRRF', 'num', { padrao: 0 }),
    F('pensao', 'Pensão alimentícia (R$)', 'num', { padrao: 0 }),
    F('outros', 'Outros descontos (VT, adiantamento, etc.)', 'num', { padrao: 0 }),
    F('patronal', 'Encargos patronais', 'sel', { opcoes: [['simples', 'Simples Nacional (sem CPP, anexos I, II, III e V)'], ['completo', 'Presumido/Real ou Anexo IV (CPP 20% + RAT + terceiros)']], padrao: 'simples' }),
    F('rat', 'RAT/FAP total (%)', 'num', { padrao: 1 }),
    F('terceiros', 'Terceiros / Sistema S (%)', 'num', { padrao: 5.8 })
  ],
  run(v) {
    const R = C.folha({ bruto: n(v.bruto), dependentes: n(v.dependentes), pensao: n(v.pensao), outrosDescontos: n(v.outros),
                        patronal: v.patronal, rat: n(v.rat) / 100, terceiros: n(v.terceiros) / 100 });
    const avisos = [`IRRF: ${R.ir.usaSimplificado ? 'desconto simplificado (mais vantajoso)' : 'deduções legais (INSS, dependentes, pensão)'}` +
      (R.ir.redutor ? `; redutor da Lei 15.270/2025 aplicado: R$ ${R.ir.redutor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '') + '.'];
    if (n(v.bruto) <= C.PARAM.redutor.reducaoAte) avisos.push('Rendimento até R$ 7.350,00: o redutor depende do total de rendimentos tributáveis do mês. Confirme se há outras fontes.');
    return { linhas: [
      { r: 'INSS do empregado (progressivo)', v: R.inss, f: 'brl' },
      { r: 'Base do IRRF', v: R.ir.base, f: 'brl' },
      { r: 'IRRF', v: R.ir.imposto, f: 'brl' },
      { r: 'Salário líquido', v: R.liquido, f: 'brl', d: true },
      { r: 'FGTS (8%)', v: R.fgts, f: 'brl' },
      { r: 'CPP patronal 20%', v: R.cpp, f: 'brl' },
      { r: 'RAT', v: R.rat, f: 'brl' },
      { r: 'Terceiros', v: R.terceiros, f: 'brl' },
      { r: 'Custo total para a empresa', v: R.custo, f: 'brl', d: true }],
      avisos, base: ['Portaria Interministerial MPS/MF nº 13/2026 (INSS)', 'Receita Federal: tabelas 2026 e Lei 15.270/2025 (IRRF)', 'Lei 8.036/1990 (FGTS) · Lei 8.212/1991 (CPP)'] };
  }
};

TOOLS.ferias = {
  nome: 'Férias', tipo: 'calc',
  descricao: 'Férias com 1/3 constitucional, abono pecuniário opcional, INSS e IRRF.',
  campos: [
    F('salario', 'Salário mensal (média de variáveis incluída)'),
    F('dias', 'Dias de férias gozados', 'num', { padrao: 30 }),
    F('abono', 'Vender 10 dias (abono pecuniário)?', 'sel', { opcoes: SIM_NAO, padrao: 'nao' }),
    F('dependentes', 'Dependentes para IRRF', 'num', { padrao: 0 })
  ],
  run(v) {
    const s = n(v.salario), dias = n(v.dias) || 30;
    const ferias = r2(s / 30 * dias), terco = r2(ferias / 3);
    const abono = v.abono === 'sim' ? r2(s / 30 * 10) : 0, abonoTerco = r2(abono / 3);
    const tributavel = ferias + terco;
    const inss = C.inssEmpregado(tributavel);
    const ir = C.irrf({ rendimento: tributavel, inss, dependentes: n(v.dependentes) });
    return { linhas: [
      { r: 'Férias', v: ferias, f: 'brl' }, { r: '1/3 constitucional', v: terco, f: 'brl' },
      { r: 'Abono pecuniário (isento de INSS/IRRF)', v: abono + abonoTerco, f: 'brl' },
      { r: 'INSS', v: inss, f: 'brl' }, { r: 'IRRF', v: ir.imposto, f: 'brl' },
      { r: 'Líquido a pagar', v: r2(tributavel + abono + abonoTerco - inss - ir.imposto), f: 'brl', d: true }],
      avisos: ['O IRRF das férias entra no total tributável do mês de pagamento: se houver salário no mesmo mês, some as bases.', 'Pagamento até 2 dias antes do início do período (CLT, art. 145).'],
      base: ['CLT, arts. 129 a 145', 'CF/88, art. 7º, XVII'] };
  }
};

TOOLS.decimo = {
  nome: '13º salário', tipo: 'calc',
  descricao: '1ª parcela (50%, sem desconto) e 2ª parcela com INSS e IRRF.',
  campos: [
    F('salario', 'Salário mensal (média de variáveis incluída)'),
    F('avos', 'Meses trabalhados no ano (avos, 15+ dias = 1)', 'num', { padrao: 12 }),
    F('dependentes', 'Dependentes para IRRF', 'num', { padrao: 0 })
  ],
  run(v) {
    const total = r2(n(v.salario) / 12 * Math.min(12, n(v.avos)));
    const p1 = r2(total / 2);
    const inss = C.inssEmpregado(total);
    const ir = C.irrf({ rendimento: total, inss, dependentes: n(v.dependentes) });
    return { linhas: [
      { r: '13º bruto proporcional', v: total, f: 'brl' }, { r: '1ª parcela (50%, até 30/11)', v: p1, f: 'brl' },
      { r: 'INSS sobre o total', v: inss, f: 'brl' }, { r: 'IRRF sobre o total (tributação exclusiva)', v: ir.imposto, f: 'brl' },
      { r: '2ª parcela líquida (até 20/12)', v: r2(total - p1 - inss - ir.imposto), f: 'brl', d: true },
      { r: 'FGTS sobre o 13º (8%)', v: r2(total * 0.08), f: 'brl' }],
      avisos: ['O INSS e o IRRF do 13º são calculados à parte da folha mensal e descontados na 2ª parcela.'],
      base: ['Lei 4.090/1962 e Lei 4.749/1965', 'Decreto 10.854/2021'] };
  }
};

TOOLS.prolabore = {
  nome: 'Pró-labore', tipo: 'calc',
  descricao: 'INSS 11% (teto) e IRRF do sócio administrador, mais a CPP patronal.',
  campos: [
    F('bruto', 'Pró-labore bruto do mês'),
    F('dependentes', 'Dependentes para IRRF', 'num', { padrao: 0 }),
    F('pensao', 'Pensão alimentícia (R$)', 'num', { padrao: 0 }),
    F('jaBase', 'Já contribuiu com INSS no mês em outra fonte (base R$)', 'num', { padrao: 0 })
  ],
  run(v) {
    const R = C.proLabore({ bruto: n(v.bruto), dependentes: n(v.dependentes), pensao: n(v.pensao), inssJaBase: n(v.jaBase) });
    return { linhas: [
      { r: 'INSS do sócio (11%, limitado ao teto)', v: R.inss, f: 'brl' },
      { r: 'IRRF', v: R.ir.imposto, f: 'brl' }, { r: 'Líquido do sócio', v: R.liquido, f: 'brl', d: true },
      { r: 'CPP patronal (20%) — custo da empresa', v: R.patronal, f: 'brl' }],
      avisos: ['Sem FGTS. Para emitir o recibo no layout da folha, use a skill Simulador_Pró-Labore.', 'Rendimento até R$ 7.350: confirme se há outros rendimentos tributáveis no mês (redutor da Lei 15.270/2025).'],
      base: ['Lei 8.212/1991, arts. 21 e 22', 'Lei 10.666/2003, art. 4º'] };
  }
};

/* ---------------- Comparativo de regimes ---------------- */
TOOLS.comparativo = {
  nome: 'Comparativo de regimes', tipo: 'calc',
  descricao: 'Estimativa mensal: Simples × Presumido × Real, com encargos sobre a folha.',
  campos: [
    F('atividade', 'Atividade', 'sel', { opcoes: [['servico', 'Serviços'], ['comercio', 'Comércio'], ['industria', 'Indústria']], padrao: 'servico', de: 'atividade' }),
    F('receita', 'Receita bruta mensal'),
    F('rbt12', 'RBT12 (Simples)', 'num', { de: 'rbt12' }),
    F('folhaMes', 'Folha mensal (salários + pró-labore)', 'num', { padrao: 0 }),
    F('folha12', 'Folha dos 12 meses (Fator R)', 'num', { de: 'folha12' }),
    F('custos', 'Custos de mercadorias/insumos mensais (Real)', 'num', { padrao: 0 }),
    F('despesas', 'Outras despesas operacionais mensais (Real)', 'num', { padrao: 0 }),
    F('creditos', '% de custos e despesas que geram crédito de PIS/COFINS (Real)', 'num', { padrao: 0 }),
    F('iss', 'Alíquota de ISS (%) — serviços', 'num', { padrao: 5, de: 'iss' }),
    F('icms', 'ICMS efetivo sobre a receita (%) — comércio/indústria', 'num', { padrao: 0 })
  ],
  run(v) {
    const rec = n(v.receita), folhaMes = n(v.folhaMes), at = v.atividade;
    const avisos = [];
    const anexo = at === 'comercio' ? 'I' : at === 'industria' ? 'II' : 'R';
    const rbt12 = n(v.rbt12) || rec * 12;
    if (!n(v.rbt12)) avisos.push('RBT12 não informado: usei receita mensal × 12.');
    const folha12 = n(v.folha12) || folhaMes * 12;
    const S = C.simples({ anexo: anexo === 'R' ? 'III' : anexo, rbt12, receitaMes: rec, folha12, usaFatorR: anexo === 'R' });
    const elegivel = rbt12 <= 4800000;
    const P = C.presumido({ receita: rec, atividade: at, issAliq: n(v.iss) / 100, icmsEfetivo: n(v.icms) / 100, folhaMes });
    const Rl = C.real({ receita: rec, atividade: at, issAliq: n(v.iss) / 100, icmsEfetivo: n(v.icms) / 100, folhaMes,
                        custos: n(v.custos), despesas: n(v.despesas), creditosPct: n(v.creditos) });
    const cppSimples = S.anexoUsado === 'IV' ? r2(folhaMes * 0.20) : 0;
    const dasTot = r2(S.das + cppSimples);
    const opcoes = [['Simples Nacional' + (elegivel ? '' : ' (inelegível: RBT12 > R$ 4,8 mi)'), dasTot], ['Lucro Presumido', P.total], ['Lucro Real', Rl.total]];
    const melhor = opcoes.filter((o, i) => i > 0 || elegivel).sort((a, b) => a[1] - b[1])[0];
    avisos.push(...S.avisos.filter(a => /sublimite|proporcional/.test(a)));
    avisos.push('Estimativa mensal: Presumido e Real são apurados por trimestre (ou anual com estimativa) e têm regras de compensação, JCP, benefícios e substituição tributária que não entram aqui.');
    avisos.push('Reforma Tributária (LC 214/2025, LC 227/2026): a partir de 2027 entram CBS e IBS e a comparação muda. Refaça com o simulador da reforma.');
    return {
      linhas: [
        { r: 'Simples · alíquota efetiva', v: S.efetiva, f: 'pct4' },
        { r: 'Simples · DAS' + (cppSimples ? ' + CPP' : ''), v: dasTot, f: 'brl' },
        { r: 'Presumido · IRPJ + CSLL', v: r2(P.irpj + P.csll), f: 'brl' },
        { r: 'Presumido · PIS + COFINS', v: r2(P.pis + P.cofins), f: 'brl' },
        { r: 'Presumido · ISS/ICMS', v: r2(P.iss + P.icms), f: 'brl' },
        { r: 'Presumido · CPP, RAT e terceiros', v: P.patronal, f: 'brl' },
        { r: 'Presumido · total', v: P.total, f: 'brl' },
        { r: 'Real · lucro apurado no mês', v: Rl.lucro, f: 'brl' },
        { r: 'Real · IRPJ + CSLL', v: r2(Rl.irpj + Rl.csll), f: 'brl' },
        { r: 'Real · PIS + COFINS (não cumulativo)', v: r2(Rl.pis + Rl.cofins), f: 'brl' },
        { r: 'Real · total (com ISS/ICMS e CPP)', v: Rl.total, f: 'brl' },
        { r: 'Menor carga estimada', v: melhor[0], f: 'txt', d: true },
        { r: 'Carga sobre a receita', v: rec ? melhor[1] / rec : 0, f: 'pct', d: true }],
      tabela: { cab: ['Regime', 'Carga mensal', '% da receita'], linhas: opcoes.map(o => [o[0], o[1], rec ? o[1] / rec : 0]) },
      avisos, base: ['LC 123/2006', 'Lei 9.249/1995 (presunção e adicional)', 'Leis 10.637/2002 e 10.833/2003 (PIS/COFINS)', 'LC 214/2025 e LC 227/2026']
    };
  }
};

/* ---------------- ISS ---------------- */
TOOLS.iss = {
  nome: 'ISS municipal', tipo: 'calc',
  descricao: 'ISS por nota, ISS fixo de sociedade uniprofissional e checagem de alíquota (2% a 5%).',
  campos: [
    F('modo', 'Modo', 'sel', { opcoes: [['nota', 'Sobre o valor do serviço'], ['fixo', 'ISS fixo (uniprofissional)']], padrao: 'nota' }),
    F('valor', 'Valor do serviço (nota)', 'num', { padrao: 0 }),
    F('deducoes', 'Deduções legais da base (materiais, subempreitada)', 'num', { padrao: 0 }),
    F('aliquota', 'Alíquota do município (%)', 'num', { padrao: 5, de: 'iss' }),
    F('profissionais', 'Profissionais habilitados (ISS fixo)', 'num', { padrao: 1 }),
    F('valorFixo', 'Valor anual por profissional fixado pelo município (R$)', 'num', { padrao: 0 }),
    F('retido', 'Tomador retém o ISS?', 'sel', { opcoes: SIM_NAO, padrao: 'nao' })
  ],
  run(v) {
    const avisos = [];
    if (v.modo === 'fixo') {
      const anual = n(v.profissionais) * n(v.valorFixo);
      return { linhas: [{ r: 'ISS fixo anual', v: anual, f: 'brl' }, { r: 'ISS fixo mensal (1/12)', v: r2(anual / 12), f: 'brl', d: true }],
        avisos: ['O valor por profissional vem da lei municipal. Regime do DL 406/1968, art. 9º, §§ 1º e 3º, para sociedades uniprofissionais que cumpram os requisitos.', 'Simples Nacional: o ISS fixo não se aplica; o ISS vai no DAS.'],
        base: ['DL 406/1968, art. 9º', 'LC 116/2003'] };
    }
    const base = Math.max(0, n(v.valor) - n(v.deducoes)), al = n(v.aliquota);
    if (al < 2) avisos.push('Alíquota abaixo de 2%: o piso é 2% (LC 116/2003, art. 8º-A), salvo as exceções da própria lei (itens 7.02, 7.05 e 16.01 da lista).');
    if (al > 5) avisos.push('Alíquota acima de 5%: o teto é 5% (LC 116/2003, art. 8º, II).');
    avisos.push('O local de incidência segue o art. 3º da LC 116/2003 (estabelecimento do prestador, ou o tomador nos casos de exceção, como os itens 3.05, 7.02, 7.04, 7.05, 7.09, 7.10, 7.12, 7.14, 7.15, 7.16, 7.17, 7.19, 11.01, 11.02, 17.05, 17.10 e outros) e o art. 3º com a redação da LC 157/2016 para leasing, planos e cartões.');
    return { linhas: [
      { r: 'Base de cálculo', v: base, f: 'brl' }, { r: 'ISS devido', v: r2(base * al / 100), f: 'brl', d: true },
      { r: 'Quem recolhe', v: v.retido === 'sim' ? 'Tomador (retenção na fonte)' : 'Prestador', f: 'txt' },
      { r: 'Líquido a receber após ISS retido', v: r2(n(v.valor) - (v.retido === 'sim' ? base * al / 100 : 0)), f: 'brl' }],
      avisos, base: ['LC 116/2003, arts. 3º, 7º e 8º-A', 'LC 157/2016', 'Código Tributário do município'] };
  }
};

/* ---------------- DRE, balanço e red flags ---------------- */
TOOLS.dre = {
  nome: 'DRE, índices e red flags', tipo: 'calc',
  descricao: 'Demonstração do resultado e índices do balanço, com alertas de risco.',
  campos: [
    F('receita', 'Receita bruta'), F('deducoes', 'Deduções e impostos sobre vendas', 'num', { padrao: 0 }),
    F('custos', 'Custo das mercadorias/serviços (CMV/CSP)', 'num', { padrao: 0 }),
    F('despesas', 'Despesas operacionais (administrativas, comerciais, pessoal)', 'num', { padrao: 0 }),
    F('financeiro', 'Resultado financeiro líquido (negativo = despesa)', 'num', { padrao: 0 }),
    F('irCs', 'IRPJ e CSLL', 'num', { padrao: 0 }),
    F('ac', 'Ativo circulante', 'num', { padrao: 0 }), F('estoque', 'Estoques', 'num', { padrao: 0 }),
    F('caixa', 'Caixa e equivalentes', 'num', { padrao: 0 }),
    F('pc', 'Passivo circulante', 'num', { padrao: 0 }), F('pnc', 'Passivo não circulante', 'num', { padrao: 0 }),
    F('pl', 'Patrimônio líquido', 'num', { padrao: 0 })
  ],
  run(v) {
    const rec = n(v.receita), liq = rec - n(v.deducoes), bruto = liq - n(v.custos);
    const ebit = bruto - n(v.despesas), antes = ebit + n(v.financeiro), lucro = antes - n(v.irCs);
    const pct = (a, b) => b ? a / b : 0;
    const linhas = [
      { r: 'Receita líquida', v: liq, f: 'brl' }, { r: 'Lucro bruto', v: bruto, f: 'brl' }, { r: 'Margem bruta', v: pct(bruto, liq), f: 'pct' },
      { r: 'Resultado operacional (EBIT)', v: ebit, f: 'brl' }, { r: 'Margem operacional', v: pct(ebit, liq), f: 'pct' },
      { r: 'Lucro líquido', v: lucro, f: 'brl', d: true }, { r: 'Margem líquida', v: pct(lucro, liq), f: 'pct', d: true }];
    const flags = [];
    if (liq > 0 && lucro < 0) flags.push('Prejuízo no período.');
    if (liq > 0 && bruto / liq < 0.2) flags.push('Margem bruta abaixo de 20%: revise preço e custo.');
    if (liq > 0 && n(v.despesas) / liq > 0.4) flags.push('Despesas operacionais acima de 40% da receita líquida.');
    if (liq > 0 && n(v.financeiro) < 0 && -n(v.financeiro) / liq > 0.05) flags.push('Despesa financeira acima de 5% da receita: endividamento caro.');
    if (n(v.pc)) {
      const lc = n(v.ac) / n(v.pc), ls = (n(v.ac) - n(v.estoque)) / n(v.pc), li = n(v.caixa) / n(v.pc);
      linhas.push({ r: 'Liquidez corrente', v: lc, f: 'num' }, { r: 'Liquidez seca', v: ls, f: 'num' }, { r: 'Liquidez imediata', v: li, f: 'num' });
      if (lc < 1) flags.push('Liquidez corrente abaixo de 1: o circulante não cobre as dívidas de curto prazo.');
    }
    const passivo = n(v.pc) + n(v.pnc), total = passivo + n(v.pl);
    if (total) {
      linhas.push({ r: 'Endividamento (passivo ÷ ativo total)', v: passivo / total, f: 'pct' });
      if (passivo / total > 0.7) flags.push('Endividamento acima de 70% do ativo.');
    }
    if (n(v.pl)) { linhas.push({ r: 'Retorno sobre o PL (ROE)', v: lucro / n(v.pl), f: 'pct' }); if (n(v.pl) < 0) flags.push('Patrimônio líquido negativo (passivo a descoberto).'); }
    return { linhas, avisos: flags.map(f => '⚠ ' + f).concat(['Os limites dos alertas são referências gerais, não normas: ajuste ao setor do cliente.']),
             base: ['Lei 6.404/1976, arts. 176 a 188', 'NBC TG 26 (R5)', 'NBC TG 1000'] };
  }
};

/* ---------------- Ponto de equilíbrio e preço ---------------- */
TOOLS.ponto = {
  nome: 'Ponto de equilíbrio e preço', tipo: 'calc',
  descricao: 'Margem de contribuição, ponto de equilíbrio e preço para uma meta de lucro.',
  campos: [
    F('preco', 'Preço de venda unitário (ou ticket médio)'), F('cv', 'Custo variável unitário (CMV/CSP)'),
    F('imp', 'Impostos sobre a venda (%)', 'num', { padrao: 0 }), F('com', 'Comissões e taxas (%)', 'num', { padrao: 0 }),
    F('fixos', 'Custos e despesas fixas mensais'), F('meta', 'Meta de lucro mensal', 'num', { padrao: 0 })
  ],
  run(v) {
    const preco = n(v.preco), pv = (n(v.imp) + n(v.com)) / 100 * preco;
    const mc = preco - n(v.cv) - pv, mcPct = preco ? mc / preco : 0;
    const avisos = [];
    if (mc <= 0) avisos.push('⚠ Margem de contribuição zero ou negativa: cada venda aumenta o prejuízo.');
    const pe = mc > 0 ? n(v.fixos) / mc : null, peMeta = mc > 0 ? (n(v.fixos) + n(v.meta)) / mc : null;
    return { linhas: [
      { r: 'Margem de contribuição unitária', v: mc, f: 'brl' }, { r: 'Margem de contribuição (%)', v: mcPct, f: 'pct' },
      { r: 'Ponto de equilíbrio (unidades/mês)', v: pe === null ? 'inviável' : Math.ceil(pe), f: pe === null ? 'txt' : 'num', d: true },
      { r: 'Ponto de equilíbrio (faturamento)', v: pe === null ? 'inviável' : r2(pe * preco), f: pe === null ? 'txt' : 'brl' },
      { r: 'Unidades para a meta de lucro', v: peMeta === null ? 'inviável' : Math.ceil(peMeta), f: peMeta === null ? 'txt' : 'num', d: true },
      { r: 'Faturamento para a meta', v: peMeta === null ? 'inviável' : r2(peMeta * preco), f: peMeta === null ? 'txt' : 'brl' }],
      avisos, base: ['Análise de custo-volume-lucro (margem de contribuição)'] };
  }
};

TOOLS.investimento = {
  nome: 'Investimento · VPL, TIR e payback', tipo: 'calc',
  descricao: 'Avalia um investimento a partir dos fluxos de caixa esperados.',
  campos: [
    F('inv', 'Investimento inicial'), F('fluxos', 'Fluxos líquidos por período, separados por ponto e vírgula (ex.: 12000;15000;18000)', 'txt'),
    F('taxa', 'Taxa mínima de atratividade por período (%)', 'num', { padrao: 12 })
  ],
  run(v) {
    const fl = String(v.fluxos || '').split(';').map(s => n(s)).filter((x, i, a) => a.length);
    const todos = [-Math.abs(n(v.inv))].concat(fl);
    const V = C.vpl(n(v.taxa) / 100, todos), T = C.tir(todos), P = C.payback(todos);
    return { linhas: [
      { r: 'VPL', v: r2(V), f: 'brl', d: true }, { r: 'TIR por período', v: T === null ? 'não converge' : T, f: T === null ? 'txt' : 'pct' },
      { r: 'Payback simples (períodos)', v: P === null ? 'não recupera no horizonte' : r2(P), f: P === null ? 'txt' : 'num' },
      { r: 'Decisão pela taxa informada', v: V > 0 ? 'Viável (VPL positivo)' : 'Não compensa (VPL ≤ 0)', f: 'txt', d: true }],
      avisos: ['Fluxos já líquidos de impostos. Períodos iguais (mês, ano) para taxa e fluxos.'], base: ['Matemática financeira: VPL, TIR e payback'] };
  }
};

/* ---------------- Agenda de obrigações ---------------- */
TOOLS.agenda = {
  nome: 'Agenda de obrigações', tipo: 'calc',
  descricao: 'Datas nominais das obrigações recorrentes do mês. Confira o calendário oficial.',
  campos: [F('mes', 'Mês de referência do vencimento (AAAA-MM)', 'txt', { padrao: hojeISO().slice(0, 7) })],
  run(v) {
    const [a, m] = String(v.mes || hojeISO().slice(0, 7)).split('-').map(Number);
    const dow = (d) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(a, m - 1, d).getDay()];
    const util = (k) => { let c = 0; for (let d = 1; d <= 31; d++) { const dt = new Date(a, m - 1, d); if (dt.getMonth() !== m - 1) break; if (dt.getDay() % 6 && ++c === k) return d; } return null; };
    const itens = [
      [util(5), 'Pagamento da folha (5º dia útil, sem feriados municipais)', 'Pessoal'],
      [10, 'Prazo comum para o eSocial: eventos de fechamento da folha (conferir cronograma)', 'Pessoal'],
      [15, 'DCTFWeb e EFD-Reinf', 'Fiscal/Pessoal'],
      [20, 'DAS do Simples Nacional (PGDAS-D)', 'Fiscal'],
      [20, 'FGTS Digital (DAE) e DARF de IRRF sobre folha e retenções', 'Pessoal/Fiscal'],
      [25, 'DARF de PIS/COFINS (Presumido e Real)', 'Fiscal'],
      [util(10), 'EFD-Contribuições (10º dia útil do 2º mês seguinte, conforme IN RFB)', 'Fiscal'],
      [null, 'IRPJ/CSLL trimestral: último dia útil do mês seguinte ao trimestre (Presumido/Real)', 'Fiscal'],
      [null, 'ISS e ICMS: o dia varia por município e por estado — conferir cada legislação', 'Fiscal']
    ];
    return { linhas: itens.map(([d, t, s]) => ({ r: (d ? String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + ' (' + dow(d) + ')' : 'Data variável') + ' · ' + s, v: t, f: 'txt' })),
      avisos: ['Datas nominais. Em dia não útil, cada tributo antecipa ou prorroga de forma própria; confirme no calendário oficial e em atos de prorrogação.'],
      base: ['Receita Federal: agenda tributária', 'CLT, art. 459, §1º', 'Manual do eSocial'] };
  }
};

/* ---------------- Fluxo de caixa (lê pagar e receber) ---------------- */
TOOLS.fluxo = {
  nome: 'Fluxo de caixa · 90 dias', tipo: 'calc',
  descricao: 'Projeta o caixa semana a semana a partir de contas a pagar e a receber em aberto.',
  campos: [F('saldo', 'Saldo inicial em caixa e bancos', 'num', { padrao: 0 }), F('cliente', 'Cliente (vazio = todos)', 'txt', { padrao: '' })],
  run(v) {
    const hoje = hojeISO();
    const ok = (x) => !v.cliente || String(x.cliente || '').toLowerCase().includes(String(v.cliente).toLowerCase());
    const rec = colecao('receber').lista().filter(x => x.status !== 'recebido' && ok(x));
    const pag = colecao('pagar').lista().filter(x => x.status !== 'pago' && ok(x));
    const semanas = Array.from({ length: 13 }, (_, i) => ({ i, ent: 0, sai: 0 }));
    let atrasR = 0, atrasP = 0;
    const alloc = (lista, campo) => lista.forEach(x => {
      const d = diasEntre(hoje, x.vencimento);
      if (d < 0) { if (campo === 'ent') atrasR += n(x.valor); else atrasP += n(x.valor); return; }
      const s = Math.min(12, Math.floor(d / 7));
      if (d <= 91) semanas[s][campo] += n(x.valor);
    });
    alloc(rec, 'ent'); alloc(pag, 'sai');
    let saldo = n(v.saldo) + 0, menor = saldo, menorSem = 0;
    const linhas = semanas.map((s, i) => { saldo += s.ent - s.sai; if (saldo < menor) { menor = saldo; menorSem = i + 1; } return [`Semana ${i + 1}`, s.ent, s.sai, saldo]; });
    const avisos = [];
    if (menor < 0) avisos.push(`⚠ Caixa fica negativo na semana ${menorSem} (R$ ${r2(menor).toLocaleString('pt-BR')}). Antecipe recebimentos, renegocie vencimentos ou capte capital de giro.`);
    if (atrasR) avisos.push(`Há R$ ${r2(atrasR).toLocaleString('pt-BR')} a receber vencido (fora da projeção). Veja a cobrança em Contas a receber.`);
    if (atrasP) avisos.push(`Há R$ ${r2(atrasP).toLocaleString('pt-BR')} a pagar vencido (fora da projeção).`);
    if (!rec.length && !pag.length) avisos.push('Nenhuma conta em aberto cadastrada. Cadastre em Contas a pagar e Contas a receber.');
    return { linhas: [{ r: 'Saldo final em 13 semanas', v: saldo, f: 'brl', d: true }, { r: 'Menor saldo projetado', v: menor, f: 'brl' }],
      tabela: { cab: ['Período', 'Entradas', 'Saídas', 'Saldo acumulado'], linhas }, avisos, base: ['NBC TG 03 (fluxo de caixa)'] };
  }
};

/* ---------------- Registros ---------------- */
const STATUS = (...o) => o.map(x => [x, x[0].toUpperCase() + x.slice(1)]);
const REG = (nome, descricao, campos, extras = {}) => Object.assign({ nome, tipo: 'registro', descricao, campos }, extras);

TOOLS.pagar = REG('Contas a pagar', 'Títulos a pagar por cliente do BPO.', [
  F('cliente', 'Cliente', 'txt'), F('fornecedor', 'Fornecedor', 'txt'), F('descricao', 'Descrição', 'txt'),
  F('valor', 'Valor (R$)'), F('vencimento', 'Vencimento', 'data'), F('status', 'Situação', 'sel', { opcoes: STATUS('aberto', 'pago'), padrao: 'aberto' }),
  F('aprovado', 'Aprovado pelo cliente?', 'sel', { opcoes: SIM_NAO, padrao: 'nao' })],
  { fechado: 'pago', resumo: 'valor' });
TOOLS.receber = REG('Contas a receber', 'Títulos a receber, com régua de cobrança e aging.', [
  F('cliente', 'Cliente do BPO', 'txt'), F('devedor', 'Quem deve', 'txt'), F('descricao', 'Descrição', 'txt'),
  F('valor', 'Valor (R$)'), F('vencimento', 'Vencimento', 'data'), F('status', 'Situação', 'sel', { opcoes: STATUS('aberto', 'recebido'), padrao: 'aberto' }),
  F('cobranca', 'Última cobrança', 'txt', { padrao: '' })],
  { fechado: 'recebido', resumo: 'valor', aging: true });
TOOLS.vencimentos = REG('Controle de vencimentos', 'Certidões, alvarás, licenças, ASO, contratos e procurações.', [
  F('cliente', 'Cliente', 'txt'), F('item', 'Documento / obrigação', 'txt'), F('tipo', 'Tipo', 'sel', { opcoes: [['certidao', 'Certidão'], ['alvara', 'Alvará/Licença'], ['aso', 'ASO/Saúde'], ['contrato', 'Contrato'], ['procuracao', 'Procuração'], ['outro', 'Outro']], padrao: 'certidao' }),
  F('vencimento', 'Vence em', 'data'), F('status', 'Situação', 'sel', { opcoes: STATUS('aberto', 'renovado'), padrao: 'aberto' }), F('obs', 'Observação', 'txt', { padrao: '' })],
  { fechado: 'renovado', alerta: 30 });

const ITENS_ONB = [
  ['Contrato de BPO assinado e escopo definido', 'Contrato'],
  ['Cadastro do cliente completo (CNPJ, regime, responsáveis)', 'Cadastro'],
  ['Acesso de consulta aos bancos (somente leitura/aprovador do cliente)', 'Acessos'],
  ['Acesso ao sistema financeiro (ex.: Conta Azul) com perfil adequado', 'Acessos'],
  ['Extratos bancários dos últimos 3 meses', 'Documentos'],
  ['Contas a pagar e a receber em aberto (posição de abertura)', 'Documentos'],
  ['Plano de contas / categorias financeiras definidas', 'Estrutura'],
  ['Alçadas e rotina de aprovação de pagamentos combinadas', 'Governança'],
  ['Calendário de pagamentos e régua de cobrança acordados', 'Rotina'],
  ['Relatório mensal e reunião de resultado agendados', 'Rotina']
];
TOOLS.onboarding = REG('Onboarding BPO', 'Recebimento das informações do cliente e organização para iniciar a terceirização do financeiro.', [
  F('cliente', 'Cliente', 'txt'), F('item', 'Etapa', 'txt'),
  F('grupo', 'Grupo', 'sel', { opcoes: ['Contrato', 'Cadastro', 'Acessos', 'Documentos', 'Estrutura', 'Governança', 'Rotina', 'Outro'].map(x => [x, x]), padrao: 'Documentos' }),
  F('status', 'Situação', 'sel', { opcoes: [['pendente', 'Pendente'], ['recebido', 'Recebido'], ['concluido', 'Concluído']], padrao: 'pendente' }),
  F('prazo', 'Prazo', 'data', { padrao: '' }), F('obs', 'Observação (nunca grave senhas aqui)', 'txt', { padrao: '' })],
  { fechado: 'concluido', gerador: { rotulo: 'Gerar checklist padrão para um cliente', itens: ITENS_ONB } });

const FERRAMENTAS_POR_AGENTE = {
  'joao-fiscal': ['das', 'comparativo', 'iss', 'agenda', 'vencimentos'],
  'rodrigo-dp': ['folha', 'ferias', 'decimo', 'prolabore', 'agenda', 'vencimentos'],
  'joao-contabil': ['dre', 'agenda'],
  'angellyca': ['vencimentos', 'agenda'],
  'miguel-cfo': ['dre', 'ponto'],
  'otavio': ['comparativo', 'das', 'iss'],
  'clayton': ['iss', 'comparativo', 'ponto'],
  'wesley': ['onboarding', 'pagar', 'agenda'],
  'jose': ['receber', 'fluxo'],
  'pedro': ['ponto', 'investimento', 'dre']
};

module.exports = { TOOLS, FERRAMENTAS_POR_AGENTE, diasEntre, hojeISO };
