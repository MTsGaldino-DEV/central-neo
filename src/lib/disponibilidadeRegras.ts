// Regras da disponibilidade da frota: causas, valores e contas do painel. Sem React nem Supabase.
// Origem: planilha "Disponibilidade Contrato 7360" (docs/disponibilidade-frota-analise.md).

export const MULTAVEIS = ['Veículo Quebrado', 'Atraso superior a 4h', 'Descadastramento Antecipado'] as const;
export const CONTESTAVEIS = ['Atestado', 'Treinamento', 'Folga TAC', 'Folga de fim de escala', 'Férias', 'Suspensão', 'ASO', 'Interstício'] as const;

export const SIGLAS: Record<string, string> = {
  'Veículo Quebrado': 'VQ', 'Atraso superior a 4h': '4H', 'Descadastramento Antecipado': 'DA',
  Atestado: 'AT', Treinamento: 'TR', 'Folga TAC': 'FT', 'Folga de fim de escala': 'FF', Férias: 'FE', Suspensão: 'SU', ASO: 'ASO', Interstício: 'IN',
  'Equipe Desativada': 'ED',
};

export const SUPERVISORES = ['Vinícius', 'Victor', 'Elton', 'Pedro'] as const;
export const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const INICIO_CONTROLE = '2026-03-23';

export interface Frota { frota: number; placa: string; supervisor: string; regiao: string; escala: string; horario: string; local: string; ordem: number; ativo: boolean }
export interface Lancamento { dia: string; frota: number; situacao: 'CADASTROU' | 'OCORRENCIA'; causa: string | null; observacao: string | null }
export interface Ocorrencia { dia: string; frota: number; causa: string }
export interface ConfigDisp { valor_ocorrencia: number; meta_mensal: number }

export const ehMultavel = (causa: string | null | undefined) => !!causa && (MULTAVEIS as readonly string[]).includes(causa);

/** "A partir de `dia` a equipe fica ativa ou desativada, até a mudança seguinte." Sem mudança = ativa. */
export interface EstadoEquipe { frota: number; dia: string; ativa: boolean }
/** Mudanças por frota, em ordem de dia. */
export type EstadosEquipe = Record<number, EstadoEquipe[]>;

export function agruparEstados(lista: EstadoEquipe[]): EstadosEquipe {
  const r: EstadosEquipe = {};
  for (const e of lista) (r[e.frota] ??= []).push(e);
  for (const l of Object.values(r)) l.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
  return r;
}

/** A equipe está desativada neste dia? Vale daí em diante, mesmo para dias que ainda não chegaram; a tela só mostra os já liberados. */
export function equipeDesativada(estados: EstadosEquipe, frota: number, dia: string): boolean {
  const l = estados[frota];
  if (!l) return false;
  let desativada = false;
  for (const e of l) { if (e.dia > dia) break; desativada = !e.ativa; }
  return desativada;
}

/** Dia em que começou a desativação em vigor neste dia, ou null se a equipe está ativa. */
export function desativadaDesde(estados: EstadosEquipe, frota: number, dia: string): string | null {
  let desde: string | null = null;
  for (const e of estados[frota] ?? []) {
    if (e.dia > dia) break;
    if (!e.ativa) desde ??= e.dia; else desde = null;
  }
  return desde;
}

/** Estados depois de desativar (`ativa` falso) ou reativar a equipe a partir de `dia`. */
export function comEstadoEquipe(estados: EstadosEquipe, frota: number, dia: string, ativa: boolean): EstadosEquipe {
  const lista = [...(estados[frota] ?? []).filter(e => e.dia !== dia), { frota, dia, ativa }];
  lista.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
  return { ...estados, [frota]: lista };
}

export const chaveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dataDe = (chave: string) => { const [a, m, d] = chave.split('-').map(Number); return new Date(a, m - 1, d); };
export const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, '0')}`;
/** `mes` de 0 a 11. */
export const diasDoMes = (ano: number, mes: number) => Array.from({ length: new Date(ano, mes + 1, 0).getDate() }, (_, i) => new Date(ano, mes, i + 1));
export const somarDias = (chave: string, n: number) => { const d = dataDe(chave); d.setDate(d.getDate() + n); return chaveDia(d); };

/** Multa sempre aparece negativa (decisão do Matheus). */
export const brlNegativo = (v: number) => (v > 0 ? '-' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export type Tom = 'ok' | 'atencao' | 'critico';
export interface Estado { tom: Tom; texto: string }

/** Limite herdado da planilha: até o limite é atenção; acima, crítico. */
export function estadoValor(valor: number, limite: number): Estado {
  if (valor === 0) return { tom: 'ok', texto: 'OK' };
  return valor <= limite ? { tom: 'atencao', texto: 'Atenção' } : { tom: 'critico', texto: 'Crítico' };
}
export const estadoQtd = (qtd: number, limite: number): Estado =>
  qtd === 0 ? { tom: 'ok', texto: 'OK' } : qtd < limite ? { tom: 'atencao', texto: 'Atenção' } : { tom: 'critico', texto: 'Crítico' };

/** Meses do controle no ano. Em 2026 o controle começa em março. */
export const mesesDoAno = (ano: number) => {
  const inicio = dataDe(INICIO_CONTROLE);
  const primeiro = ano === inicio.getFullYear() ? inicio.getMonth() : 0;
  return Array.from({ length: 12 - primeiro }, (_, i) => primeiro + i);
};

export interface ResumoPainel {
  valor: number; qtdMultaveis: number; qtdOcorrencias: number; frotasComMulta: number; baseFrotas: number; totalAno: number;
  comparacao: { pct: number | null; texto: string };
  ranking: { supervisor: string; frotas: number; valor: number; estado: Estado }[];
  causasMultaveis: { nome: string; qtd: number; estado: Estado }[];
  causasContestaveis: { nome: string; qtd: number }[];
  serie: { mes: number; valor: number }[];
  impacto: { qtd: number; pct: number; valor: number; criticos: string[]; criticidade: Estado };
  top: { frota: number; placa: string; supervisor: string; qtd: number; valor: number }[];
  frotaOperacao: { frota: number; operacao: number; contestaveis: number };
}

export function resumoPainel(frotas: Frota[], ocorrencias: Ocorrencia[], ano: number, mes: number, supervisor: string, config: ConfigDisp): ResumoPainel {
  const valorUn = config.valor_ocorrencia;
  const porFrota = new Map(frotas.map(f => [f.frota, f]));
  const doSup = (o: Ocorrencia, s: string) => s === 'T' || porFrota.get(o.frota)?.supervisor === s;
  const mesDe = (o: Ocorrencia) => Number(o.dia.slice(5, 7)) - 1;
  const multas = (l: Ocorrencia[]) => l.filter(o => ehMultavel(o.causa)).length;

  const noAno = ocorrencias.filter(o => Number(o.dia.slice(0, 4)) === ano);
  const filtradas = noAno.filter(o => doSup(o, supervisor));
  const doMes = filtradas.filter(o => mesDe(o) === mes);
  const qtdMultaveis = multas(doMes);
  const valor = qtdMultaveis * valorUn;
  const conta = (c: string) => doMes.filter(o => o.causa === c).length;

  const meses = mesesDoAno(ano);
  const serie = meses.map(m => ({ mes: m, valor: multas(filtradas.filter(o => mesDe(o) === m)) * valorUn }));

  const anterior = meses.indexOf(mes) > 0 ? meses[meses.indexOf(mes) - 1] : null;
  let comparacao: ResumoPainel['comparacao'] = { pct: null, texto: 'sem mês anterior' };
  if (anterior !== null) {
    const v = serie.find(s => s.mes === anterior)!.valor;
    const nome = NOMES_MES[anterior];
    if (v > 0) {
      const pct = Math.round((valor - v) / v * 100);
      const parcial = chaveMes(ano, anterior) === INICIO_CONTROLE.slice(0, 7) ? ` (desde ${INICIO_CONTROLE.slice(8)}/${INICIO_CONTROLE.slice(5, 7)})` : '';
      comparacao = { pct, texto: `${pct > 0 ? 'mais' : pct < 0 ? 'menos' : 'igual'} que ${nome.toLowerCase()}${parcial}` };
    } else comparacao = { pct: null, texto: `${nome} sem multa` };
  }

  const visiveis = SUPERVISORES.filter(s => supervisor === 'T' || s === supervisor);
  const ranking = visiveis.map(s => {
    const v = multas(noAno.filter(o => mesDe(o) === mes && doSup(o, s))) * valorUn;
    return { supervisor: s as string, frotas: frotas.filter(f => f.supervisor === s).length, valor: v, estado: estadoValor(v, 10000) };
  }).sort((a, b) => b.valor - a.valor);

  const qtdVq = conta('Veículo Quebrado');
  const pctVq = doMes.length ? qtdVq / doMes.length : 0;
  const maior = ranking[0]?.valor ?? 0;

  const porFrotaMulta = new Map<number, number>();
  for (const o of doMes) if (ehMultavel(o.causa)) porFrotaMulta.set(o.frota, (porFrotaMulta.get(o.frota) ?? 0) + 1);
  const top = [...porFrotaMulta].map(([frota, qtd]) => {
    const f = porFrota.get(frota);
    return { frota, placa: f?.placa ?? '', supervisor: f?.supervisor ?? '', qtd, valor: qtd * valorUn };
  }).sort((a, b) => b.qtd - a.qtd || a.frota - b.frota).slice(0, 5);

  const operacao = conta('Atraso superior a 4h') + conta('Descadastramento Antecipado');

  return {
    valor, qtdMultaveis, qtdOcorrencias: doMes.length, frotasComMulta: porFrotaMulta.size,
    baseFrotas: supervisor === 'T' ? frotas.length : frotas.filter(f => f.supervisor === supervisor).length,
    totalAno: multas(filtradas) * valorUn,
    comparacao, ranking, serie, top,
    causasMultaveis: [
      { nome: 'Veículo Quebrado', qtd: qtdVq, estado: estadoQtd(qtdVq, 10) },
      { nome: 'Atraso >4h', qtd: conta('Atraso superior a 4h'), estado: estadoQtd(conta('Atraso superior a 4h'), 10) },
      { nome: 'Descadastramento', qtd: conta('Descadastramento Antecipado'), estado: estadoQtd(conta('Descadastramento Antecipado'), 5) },
    ],
    causasContestaveis: [
      { nome: 'Atestado / ASO', qtd: conta('Atestado') + conta('ASO') },
      { nome: 'Treinamento', qtd: conta('Treinamento') },
      { nome: 'Férias / Folgas', qtd: conta('Férias') + conta('Folga TAC') + conta('Folga de fim de escala') },
      { nome: 'Suspensão / Interstício / outros', qtd: conta('Suspensão') + conta('Interstício') + conta('Equipe Desativada') },
    ],
    impacto: {
      qtd: qtdVq, pct: pctVq, valor: qtdVq * valorUn,
      criticos: maior > 0 ? ranking.filter(r => r.valor === maior).map(r => r.supervisor) : [],
      criticidade: pctVq <= 0.15 ? { tom: 'ok', texto: 'Baixo' } : pctVq <= 0.25 ? { tom: 'atencao', texto: 'Médio' } : { tom: 'critico', texto: 'Crítico' },
    },
    frotaOperacao: { frota: qtdVq, operacao, contestaveis: doMes.length - qtdVq - operacao },
  };
}
