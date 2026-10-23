/* ===========================================================
   roster.js — quem trabalha aqui.
   BOSSES  : você (sempre em serviço, na Diretoria)
   CATALOG : o agente de exemplo + vagas sugeridas para começar
   =========================================================== */
const ROSTER = (() => {

  const KEY = 'escritorio-agentes-v1';

  /* ===========================================================
     O DONO — o nome vem de data/config.json ("dono")
     =========================================================== */
  const BOSSES = [
    {
      id: 'boss-1', name: (window.ESCRITORIO && ESCRITORIO.dono) || 'Guilherme', role: 'Chefe · Diretoria',
      emoji: '⭐', boss: true, dept: 'diretoria', slotId: 'DIR-1',
      status: 'trabalhando', locked: true,
      source: 'Diretoria', sistema: 'guilherme',
      brief: 'Chefe da MABEN. Sempre em serviço.',
      look: {
        skin: '#d9a17a', hair: '#2a1d14', style: 'curto',
        shirt: '#334155', pants: '#1e293b', shoes: '#15181f',
        glasses: null, beard: null, tattoo: false, cap: false,
        uniforme: false
      }
    }
  ];

  /* ===========================================================
     BANCO DE TALENTOS
     'detectado' = tem sistema no registro (data/sistemas.json)
     'sugerido'  = vaga de ideia; contrate e depois ligue um sistema a ela
     =========================================================== */
  const CATALOG = [
    /* ---------- SETOR CONTÁBIL ---------- */
    {
      key: 'joao-fiscal', sistema: 'joao-fiscal', name: 'João', role: 'Analista Fiscal', emoji: '🧾', cat: 'sugerido',
      setor: 'Setor Contábil', slotId: 'CTB-1',
      desc: 'Apuração de impostos, obrigações acessórias (SPED, EFD, DCTFWeb), conferência de notas e retenções.',
      why: 'Mantém a apuração fiscal em dia e evita multa por atraso ou erro de obrigação acessória.',
      look: { skin: '#e0a878', hair: '#241a13', style: 'curto', shirt: '#3f7f9e', pants: '#2c3347', glasses: 'retangular', beard: null }
    },
    {
      key: 'rodrigo-dp', sistema: 'rodrigo-dp', name: 'Rodrigo', role: 'Analista de Departamento Pessoal', emoji: '👥', cat: 'sugerido',
      setor: 'Setor Contábil', slotId: 'CTB-2',
      desc: 'Folha de pagamento, admissões, rescisões, férias, eSocial, FGTS Digital e compliance trabalhista.',
      why: 'Folha correta e eSocial sem pendência: menos risco trabalhista para o cliente.',
      look: { skin: '#c9854f', hair: '#140f0c', style: 'fade', shirt: '#6d8f5e', pants: '#2c3347', glasses: null, beard: 'cavanhaque' }
    },
    {
      key: 'joao-contabil', sistema: 'joao-contabil', name: 'João Contábil', role: 'Analista de Contabilidade', emoji: '📒', cat: 'sugerido',
      setor: 'Setor Contábil', slotId: 'CTB-3',
      desc: 'Escrituração, conciliações, balancetes, balanço, DRE e ECD/ECF.',
      why: 'Contabilidade fechada no prazo e demonstrativos confiáveis para o cliente decidir.',
      look: { skin: '#f0c29b', hair: '#3d2a1a', style: 'ondulado', shirt: '#8a6a4c', pants: '#26304a', glasses: 'redondo', beard: null }
    },
    {
      key: 'angellyca', sistema: 'angellyca', name: 'Angellyca', role: 'Analista de Legalização', emoji: '📑', cat: 'sugerido',
      setor: 'Setor Contábil', slotId: 'CTB-4',
      desc: 'Abertura, alteração e baixa de empresas, licenças, alvarás, certidões e registros em Junta e órgãos.',
      why: 'Empresa regular em todos os órgãos, com documentação sempre atualizada.',
      look: { skin: '#a2643b', hair: '#140f0c', style: 'longo', shirt: '#b4562f', pants: '#26304a', glasses: null, beard: null }
    },
    {
      key: 'miguel-cfo', sistema: 'miguel-cfo', name: 'Miguel', role: 'CFO Financeiro', emoji: '📊', cat: 'sugerido',
      setor: 'Setor Contábil', slotId: 'CTB-5',
      desc: 'Análise de demonstrativos, red flags, margem, caixa e estratégia financeira dos clientes.',
      why: 'Transforma número em decisão: aponta risco, corte de custo e oportunidade de margem.',
      look: { skin: '#f7d7bd', hair: '#8e8e93', style: 'curto', shirt: '#1f3a5f', pants: '#1b2030', glasses: 'retangular', beard: 'cheia' }
    },

    /* ---------- INTELIGÊNCIA DO CLIENTE ---------- */
    {
      key: 'otavio', sistema: 'otavio', name: 'Otávio', role: 'Inteligência Tributária & Fiscal', emoji: '🧠', cat: 'sugerido',
      setor: 'Inteligência do Cliente', slotId: 'INT-1',
      desc: 'Planejamento tributário e fiscal, regimes (Simples, Presumido, Real), ICMS de todos os estados e Reforma Tributária.',
      why: 'Reduz a carga tributária de forma legal e antecipa o impacto de mudanças na legislação.',
      look: { skin: '#e0a878', hair: '#241a13', style: 'franja', shirt: '#6d5bd0', pants: '#1b2030', glasses: 'redondo', beard: null }
    },
    {
      key: 'clayton', sistema: 'clayton', name: 'Clayton', role: 'Inteligência Municipal (ISS) & Gestão', emoji: '🏛️', cat: 'sugerido',
      setor: 'Inteligência do Cliente', slotId: 'INT-2',
      desc: 'Regulamentos municipais de ISS, enquadramento de serviços e planejamento de gestão empresarial.',
      why: 'Evita bitributação e retenção indevida de ISS e conecta a tributação à gestão do negócio.',
      look: { skin: '#7a4a2c', hair: '#140f0c', style: 'raspado', shirt: '#4a3f8f', pants: '#26304a', glasses: null, beard: 'cheia' }
    },

    /* ---------- BPO FINANCEIRO ---------- */
    {
      key: 'wesley', sistema: 'wesley', name: 'Wesley', role: 'BPO · Contas a Pagar & Faturamento', emoji: '💸', cat: 'sugerido',
      setor: 'BPO Financeiro', slotId: 'BPO-1',
      desc: 'Programa e paga contas, confere documentos, emite notas e controla o faturamento do cliente.',
      why: 'Pagamentos no prazo e faturamento sem erro: caixa organizado todo mês.',
      look: { skin: '#f0c29b', hair: '#6b4423', style: 'curto', shirt: '#3f8a5c', pants: '#2c3347', glasses: null, beard: null }
    },
    {
      key: 'jose', sistema: 'jose', name: 'José', role: 'BPO · Contas a Receber & Planejamento Financeiro', emoji: '💰', cat: 'sugerido',
      setor: 'BPO Financeiro', slotId: 'BPO-2',
      desc: 'Cobrança, conciliação de recebimentos, inadimplência, fluxo de caixa e planejamento financeiro.',
      why: 'Dinheiro entrando no prazo e previsão de caixa que o cliente consegue acompanhar.',
      look: { skin: '#a2643b', hair: '#241a13', style: 'cacheado', shirt: '#5f9a6e', pants: '#26304a', glasses: 'retangular', beard: 'cavanhaque' }
    },
    {
      key: 'pedro', sistema: 'pedro', name: 'Pedro', role: 'BPO · Financeiro Estratégico', emoji: '🎯', cat: 'sugerido',
      setor: 'BPO Financeiro', slotId: 'BPO-3',
      desc: 'Indicadores, orçamento, precificação, análise de resultado e apoio à decisão do dono.',
      why: 'Leva o cliente do operacional ao estratégico: margem, meta e investimento.',
      look: { skin: '#f7d7bd', hair: '#d9b56a', style: 'fade', shirt: '#2f6f4a', pants: '#1b2030', glasses: 'redondo', beard: null }
    },

    {
      key: 'exemplo', name: 'EXEMPLO', role: 'Agente de demonstração', emoji: '🤖',
      cat: 'detectado', system: 'Agente de exemplo', sistema: 'exemplo',
      desc: 'Um sistema mínimo que vem junto, na pasta exemplo-agente: sobe na porta 4401 e mostra uma página.',
      why: 'Serve de molde para cadastrar os sistemas reais dos agentes.',
      look: { skin: '#c9854f', hair: '#140f0c', style: 'cacheado', shirt: '#38bdf8', pants: '#26304a', glasses: null, beard: null }
    }
  ];

  /* ===========================================================
     ESTADO
     =========================================================== */
  let team = [];

  function defaults() {
    const base = BOSSES.map(b => Object.assign({}, b, { look: Object.assign({}, b.look) }));
    // a equipe da MABEN já nasce contratada, cada um na sua estação
    for (const k of CATALOG.filter(c => c.slotId).map(c => c.key)) {
      const c = CATALOG.find(c => c.key === k);
      base.push(fromCatalog(c));
    }
    return base;
  }

  function fromCatalog(c) {
    return {
      id: 'ag-' + c.key,
      key: c.key,
      name: c.name,
      role: c.role,
      emoji: c.emoji,
      system: c.system || null,
      sistema: c.sistema || null,
      path: c.path || null,
      brief: c.desc,
      dept: 'servico',
      setor: c.setor || null,
      slotId: c.slotId || null,
      status: 'trabalhando',
      boss: false,
      locked: false,
      look: AVATAR.makeLook(c.key, c.look)
    };
  }

  /* ===========================================================
     PERSISTÊNCIA

     O disco manda. A equipe já morava só no localStorage do navegador
     e um dia voltou inteira ao padrão: nome que você deu, contratação,
     estação, horário — tudo perdido de uma vez, sem aviso. O navegador
     limpa storage quando quer. Agora o arquivo é data/equipe.json, no
     servidor, e o localStorage é só um espelho para quando ele estiver
     fora do ar.
     =========================================================== */
  const doLocal = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d && Array.isArray(d.team) && d.team.length ? d.team : null;
    } catch (e) { return null; }
  };

  async function load() {
    let vindoDoDisco = null;
    try {
      const d = await (await fetch('/api/equipe')).json();
      if (d && Array.isArray(d.team) && d.team.length) vindoDoDisco = d.team;
    } catch (e) { /* servidor fora: vale o que o navegador tiver */ }

    team = vindoDoDisco || doLocal() || defaults();
    recompor();              // equipe salva antes pode não ter os campos novos
    if (!vindoDoDisco) save();   // primeira vez ou migração: carimba no disco
  }

  /** reencaixa campos que chegaram depois de a equipe já ter sido salva,
      como o id do sistema que o agente opera */
  function recompor() {
    for (const a of team) {
      const c = CATALOG.find(c => c.key === a.key);
      if (c) {
        if (!a.sistema && c.sistema) a.sistema = c.sistema;
        if (c.path && a.path !== c.path) a.path = c.path;
      }
      const b = BOSSES.find(b => b.id === a.id);
      if (b && !a.sistema && b.sistema) a.sistema = b.sistema;
      // sem look o boneco não é desenhado: fica um funcionário invisível na
      // mesa. Reconstrói a partir da key, que é determinística — o mesmo
      // agente volta com a mesma cara de sempre.
      if (!a.look || !a.look.skin) {
        const base = (c && c.look) || (b && b.look) || {};
        a.look = AVATAR.makeLook(a.key || a.id, Object.assign({}, base));
      }
    }
  }

  let gravando = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ team, v: 1 })); }
    catch (e) { /* storage bloqueado: o disco ainda pega */ }
    // junta as chamadas seguidas num POST só — arrastar um agente dispara
    // save() várias vezes por segundo
    clearTimeout(gravando);
    gravando = setTimeout(() => {
      fetch('/api/equipe', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, v: 1 })
      }).catch(() => { /* offline: fica o espelho do navegador */ });
    }, 300);
  }

  function reset() { team = defaults(); save(); }

  /* ---------- operações ---------- */
  function hire(key) {
    const c = CATALOG.find(c => c.key === key);
    if (!c || team.some(a => a.key === key)) return null;
    const a = fromCatalog(c);
    team.push(a); save();
    return a;
  }

  function hireCustom(data) {
    const key = 'custom-' + Date.now().toString(36);
    const a = {
      id: 'ag-' + key, key,
      name: data.name || 'Novo agente',
      role: data.role || 'Função a definir',
      emoji: data.emoji || '🤖',
      system: data.system || null, path: data.path || null,
      sistema: data.sistema || null, reuniao: data.reuniao !== false,
      brief: data.brief || '',
      dept: 'servico', slotId: null, status: 'trabalhando',
      boss: false, locked: false, custom: true,
      look: AVATAR.makeLook(key, data.look || {})
    };
    team.push(a); save();
    return a;
  }

  function fire(id) {
    const i = team.findIndex(a => a.id === id);
    if (i < 0 || team[i].locked) return false;
    team.splice(i, 1); save();
    return true;
  }

  const get = (id) => team.find(a => a.id === id);
  const all = () => team;
  const isHired = (key) => team.some(a => a.key === key);
  const count = (st) => team.filter(a => a.status === st).length;

  return { BOSSES, CATALOG, load, save, reset, hire, hireCustom, fire,
           get, all, isHired, count, fromCatalog };
})();
