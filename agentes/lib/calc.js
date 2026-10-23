/* ===========================================================
   calc.js — cálculos tributários, trabalhistas e financeiros.

   Parâmetros de 2026 (conferir a cada virada de ano):
   - INSS empregado: Portaria Interministerial MPS/MF nº 13/2026
   - IRRF: tabela da Receita Federal 2026 + redutor da Lei 15.270/2025
   - Simples Nacional: LC 123/2006, anexos com a redação da LC 155/2016
   Tudo aqui é função pura: entra número, sai número.
   =========================================================== */

const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const n = (x) => { const v = Number(String(x === undefined || x === null ? 0 : x).replace(',', '.')); return Number.isFinite(v) ? v : 0; };

const PARAM = {
  ano: 2026,
  salarioMinimo: 1621.00,
  tetoInss: 8475.55,
  inssFaixas: [            // empregado: alíquota progressiva por faixa
    { ate: 1621.00, aliq: 0.075 },
    { ate: 2902.84, aliq: 0.09 },
    { ate: 4354.27, aliq: 0.12 },
    { ate: 8475.55, aliq: 0.14 }
  ],
  inssContribuinteIndividual: 0.11,
  irrfFaixas: [
    { ate: 2428.80, aliq: 0,     ded: 0 },
    { ate: 2826.65, aliq: 0.075, ded: 182.16 },
    { ate: 3751.05, aliq: 0.15,  ded: 394.16 },
    { ate: 4664.68, aliq: 0.225, ded: 675.49 },
    { ate: Infinity, aliq: 0.275, ded: 908.73 }
  ],
  dedDependente: 189.59,
  descontoSimplificado: 607.20,
  redutor: { isencaoAte: 5000.00, reducaoAte: 7350.00, constante: 978.62, coef: 0.133145 }
};

/* ---------------- INSS ---------------- */
function inssEmpregado(bruto) {
  const base = Math.min(bruto, PARAM.tetoInss);
  let ant = 0, tot = 0;
  for (const f of PARAM.inssFaixas) {
    if (base > ant) tot += (Math.min(base, f.ate) - ant) * f.aliq;
    ant = f.ate;
  }
  return r2(tot);
}
function inssPorLabore(bruto, jaRecolhidoBase = 0) {
  const sobra = Math.max(0, PARAM.tetoInss - jaRecolhidoBase);
  return r2(Math.min(bruto, sobra) * PARAM.inssContribuinteIndividual);
}

/* ---------------- IRRF ---------------- */
function irrf({ rendimento, inss = 0, dependentes = 0, pensao = 0 }) {
  const legais = inss + dependentes * PARAM.dedDependente + pensao;
  const usaSimplificado = PARAM.descontoSimplificado > legais;
  const deducao = Math.max(legais, PARAM.descontoSimplificado);
  const base = Math.max(0, rendimento - deducao);
  const f = PARAM.irrfFaixas.find(x => base <= x.ate);
  let imposto = Math.max(0, base * f.aliq - f.ded);
  let redutor = 0;
  const R = PARAM.redutor;
  if (rendimento <= R.isencaoAte) { redutor = imposto; imposto = 0; }
  else if (rendimento <= R.reducaoAte) {
    redutor = Math.min(imposto, Math.max(0, R.constante - R.coef * rendimento));
    imposto -= redutor;
  }
  return { base: r2(base), imposto: r2(imposto), redutor: r2(redutor), usaSimplificado,
           deducao: r2(deducao), aliq: f.aliq };
}

/* ---------------- Folha ---------------- */
function folha({ bruto, dependentes = 0, pensao = 0, outrosDescontos = 0, patronal = 'simples', rat = 0.01, terceiros = 0.058 }) {
  const inss = inssEmpregado(bruto);
  const ir = irrf({ rendimento: bruto, inss, dependentes, pensao });
  const liquido = r2(bruto - inss - ir.imposto - pensao - outrosDescontos);
  const fgts = r2(bruto * 0.08);
  let cpp = 0, ratV = 0, terc = 0;
  if (patronal === 'completo') {
    cpp = r2(bruto * 0.20); ratV = r2(bruto * rat); terc = r2(bruto * terceiros);
  }
  const custo = r2(bruto + fgts + cpp + ratV + terc);
  return { inss, ir, liquido, fgts, cpp, rat: ratV, terceiros: terc, custo };
}

/* ---------------- Pró-labore ---------------- */
function proLabore({ bruto, dependentes = 0, pensao = 0, inssJaBase = 0 }) {
  const inss = inssPorLabore(bruto, inssJaBase);
  const ir = irrf({ rendimento: bruto, inss, dependentes, pensao });
  return { inss, ir, liquido: r2(bruto - inss - ir.imposto - pensao), patronal: r2(bruto * 0.20) };
}

/* ---------------- Simples Nacional ---------------- */
const ANEXOS = {
  I:   [[180000, 4.00, 0], [360000, 7.30, 5940], [720000, 9.50, 13860], [1800000, 10.70, 22500], [3600000, 14.30, 87300], [4800000, 19.00, 378000]],
  II:  [[180000, 4.50, 0], [360000, 7.80, 5940], [720000, 10.00, 13860], [1800000, 11.20, 22500], [3600000, 14.70, 85500], [4800000, 30.00, 720000]],
  III: [[180000, 6.00, 0], [360000, 11.20, 9360], [720000, 13.50, 17640], [1800000, 16.00, 35640], [3600000, 21.00, 125640], [4800000, 33.00, 648000]],
  IV:  [[180000, 4.50, 0], [360000, 9.00, 8100], [720000, 10.20, 12420], [1800000, 14.00, 39780], [3600000, 22.00, 183780], [4800000, 33.00, 828000]],
  V:   [[180000, 15.50, 0], [360000, 18.00, 4500], [720000, 19.50, 9900], [1800000, 20.50, 17100], [3600000, 23.00, 62100], [4800000, 30.50, 540000]]
};

function simples({ anexo, rbt12, receitaMes, folha12 = 0, usaFatorR = false }) {
  const avisos = [];
  let usado = anexo, fatorR = null;
  if (usaFatorR) {
    fatorR = rbt12 > 0 ? folha12 / rbt12 : 0;
    usado = fatorR >= 0.28 ? 'III' : 'V';
  }
  if (rbt12 > 4800000) avisos.push('RBT12 acima de R$ 4.800.000,00: excede o limite do Simples Nacional (LC 123/2006, art. 3º, II).');
  const tab = ANEXOS[usado];
  const faixaIdx = tab.findIndex(f => rbt12 <= f[0]);
  const i = faixaIdx < 0 ? tab.length - 1 : faixaIdx;
  const [ate, nominal, pd] = tab[i];
  const efetiva = rbt12 > 0 ? ((rbt12 * nominal / 100) - pd) / rbt12 : nominal / 100;
  if (rbt12 > 3600000 && rbt12 <= 4800000)
    avisos.push('RBT12 acima de R$ 3.600.000,00: ICMS e ISS passam a ser recolhidos fora do DAS (sublimite estadual/municipal) — o DAS calculado inclui esses tributos e deve ser reduzido pela parcela deles.');
  if (rbt12 === 0) avisos.push('RBT12 zerado: nos primeiros 12 meses a RBT12 é proporcionalizada (LC 123, art. 18, §§ 1º a 3º). Informe a RBT12 proporcional.');
  if (usado === 'IV') avisos.push('Anexo IV: a CPP patronal (20% + RAT) é recolhida fora do DAS, via GPS/DCTFWeb.');
  return { anexoUsado: usado, fatorR, faixa: i + 1, ate, nominal, pd, efetiva, das: r2(receitaMes * efetiva), avisos };
}

/* ---------------- Lucro Presumido / Real (mensal, estimado) ---------------- */
function adicionalIrpj(base, meses = 1) { return Math.max(0, base - 20000 * meses) * 0.10; }

function presumido({ receita, atividade, issAliq = 0, icmsEfetivo = 0, folhaMes = 0, rat = 0.01, terceiros = 0.058 }) {
  const servico = atividade === 'servico';
  const baseIr = receita * (servico ? 0.32 : 0.08);
  const baseCs = receita * (servico ? 0.32 : 0.12);
  const irpj = baseIr * 0.15 + adicionalIrpj(baseIr);
  const csll = baseCs * 0.09;
  const pis = receita * 0.0065, cofins = receita * 0.03;
  const iss = servico ? receita * issAliq : 0;
  const icms = servico ? 0 : receita * icmsEfetivo;
  const patronal = folhaMes * (0.20 + rat + terceiros);
  const total = irpj + csll + pis + cofins + iss + icms + patronal;
  return { irpj: r2(irpj), csll: r2(csll), pis: r2(pis), cofins: r2(cofins), iss: r2(iss), icms: r2(icms), patronal: r2(patronal), total: r2(total) };
}

function real({ receita, atividade, issAliq = 0, icmsEfetivo = 0, folhaMes = 0, custos = 0, despesas = 0, creditosPct = 0, rat = 0.01, terceiros = 0.058 }) {
  const servico = atividade === 'servico';
  const patronal = folhaMes * (0.20 + rat + terceiros);
  const iss = servico ? receita * issAliq : 0;
  const icms = servico ? 0 : receita * icmsEfetivo;
  const baseCred = (custos + despesas) * (creditosPct / 100);
  const pis = Math.max(0, receita * 0.0165 - baseCred * 0.0165);
  const cofins = Math.max(0, receita * 0.076 - baseCred * 0.076);
  const lucro = receita - custos - despesas - folhaMes - patronal - iss - icms - pis - cofins;
  const irpj = lucro > 0 ? lucro * 0.15 + adicionalIrpj(lucro) : 0;
  const csll = lucro > 0 ? lucro * 0.09 : 0;
  const total = irpj + csll + pis + cofins + iss + icms + patronal;
  return { lucro: r2(lucro), irpj: r2(irpj), csll: r2(csll), pis: r2(pis), cofins: r2(cofins), iss: r2(iss), icms: r2(icms), patronal: r2(patronal), total: r2(total) };
}

/* ---------------- Finanças ---------------- */
function vpl(taxa, fluxos) { return fluxos.reduce((s, f, t) => s + f / Math.pow(1 + taxa, t), 0); }
function tir(fluxos) {
  let lo = -0.99, hi = 10;
  if (vpl(lo, fluxos) * vpl(hi, fluxos) > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (vpl(lo, fluxos) * vpl(mid, fluxos) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
function payback(fluxos) {
  let acum = 0;
  for (let t = 0; t < fluxos.length; t++) {
    const ant = acum; acum += fluxos[t];
    if (t > 0 && acum >= 0 && ant < 0) return t - 1 + (-ant / fluxos[t]);
  }
  return null;
}

module.exports = { PARAM, r2, n, inssEmpregado, inssPorLabore, irrf, folha, proLabore, ANEXOS, simples,
                   presumido, real, vpl, tir, payback };
