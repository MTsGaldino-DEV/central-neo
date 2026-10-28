// Textos da conferência por serviço e soma de totais; sem Supabase, testável em Node.
import { TIPOS_TURMA_FAT } from './faturamentoPlanilhas';
import type { ServicoFat, TotaisFat } from './faturamentoServicos';

export const usFat = (n: number | null | undefined) => n == null ? '—' : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:6,maximumFractionDigits:6});

export type UnidadeFat = 'reais' | 'us';
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
/** Valor em US convertido para a unidade escolhida; sem o valor da US, fica em US. */
export function valorFat(us: number | null | undefined, unidade: UnidadeFat, taxa: number | null, sinal = false): string {
  if (us == null) return '—';
  const n = Number(us), s = sinal ? (n > 0 ? '+' : n < 0 ? '−' : '') : n < 0 ? '−' : '';
  return unidade === 'reais' && taxa ? `${s}${reais(Math.abs(n) * taxa)}` : `${s}${usFat(Math.abs(n))} US`;
}
/** A outra unidade, para a linha de baixo; null quando não dá para converter. */
export function outraUnidadeFat(us: number | null | undefined, unidade: UnidadeFat, taxa: number | null): string | null {
  if (us == null || !taxa) return null;
  return valorFat(us, unidade === 'reais' ? 'us' : 'reais', taxa);
}

/** Possível fator errado: como o pago se relaciona com o previsto. */
export const FATOR_ERRADO_FAT: Record<string, string> = { ACIMA: 'pago × 1,2', ABAIXO: 'pago ÷ 1,2', ABAIXO_08: 'pago × 0,8' };
export const MOTIVOS_FAT: Record<string,string> = {
  MOTO_INDEVIDO:'Desconto de Moto indevido', RC_NAO_PAGO:'RC não pago', FATOR_MENOR:'Fator menor que o contrato',
  RC_VARIAS_LINHAS:'RC pago em várias linhas', FATOR_MAIOR:'Fator maior que o contrato', OUTRA:'Outra diferença',
};
export const SITUACOES_SERVICO_FAT: Record<string,string> = {
  OK:'Confere', A_MENOS:'Pagou a menos', A_MAIS:'Pagou a mais', FORA_CONTRATO:'Código fora do contrato', CONFERIDO:'Conferido',
};

export type ServicoTextoFat = Pick<ServicoFat,'situacao_calculo'|'motivo'|'devido'|'creditado'|'codigo_principal'|'tipo_turma'|'fator_aplicado'|'moto'|'rc_por_atendimento'|'qtd_linhas'|'parcial'>
  & Partial<Pick<ServicoFat,'multas'|'pago_comparado'>>;

const lista = (itens: string[]) => itens.length < 2 ? itens.join('') : `${itens.slice(0,-1).join(', ')} e ${itens[itens.length-1]}`;
const fator = (s: ServicoTextoFat) => `${s.moto ? 'fator Moto' : 'fator normal'}${s.fator_aplicado === 'COD' ? ', COD' : ''}`;

export function fraseServico(s: ServicoTextoFat): string {
  const d = usFat(s.devido), p = usFat(s.pago_comparado ?? s.creditado), cod = s.codigo_principal ?? 'O código';
  const deveria = `Deveria pagar ${d} (${cod}, ${fator(s)}) e pagou ${p}`;
  let frase: string;
  switch (s.situacao_calculo) {
    case 'OK':
      frase = (s.multas ?? 0) > 0 && (s.pago_comparado ?? s.creditado) < (s.devido ?? 0)
        ? `Glosado: a multa de ${usFat(s.multas)} cobre o valor devido. Multas ficam fora do saldo.`
        : 'Pago conforme o contrato.';
      break;
    case 'FORA_CONTRATO':
      frase = 'Código fora do contrato: não há fator para calcular o devido.';
      break;
    case 'A_MENOS':
      frase = s.motivo === 'MOTO_INDEVIDO' ? `${deveria}: aplicaram o desconto de Moto 0,7 numa equipe ${TIPOS_TURMA_FAT[s.tipo_turma ?? ''] ?? 'sem tipo identificado'}.`
        : s.motivo === 'RC_NAO_PAGO' ? `${cod} deveria ser pago uma vez (${d}), mas ${s.qtd_linhas > 1 ? `nenhuma das ${s.qtd_linhas} linhas do atendimento recebeu` : 'a linha do atendimento não recebeu'} crédito.`
        : s.motivo === 'FATOR_MENOR' ? `${deveria}: valor abaixo do contrato.`
        : `${deveria}.`;
      break;
    default:
      frase = s.motivo === 'RC_VARIAS_LINHAS' ? `${cod} deveria ser pago uma vez (${d}), mas foi creditado em mais de uma linha, somando ${p}.`
        : s.motivo === 'FATOR_MAIOR' ? `${deveria}: valor acima do contrato.`
        : `${deveria}.`;
  }
  return s.parcial ? `${frase} Parte dos códigos não tem fator no contrato.` : frase;
}

export function notaCalculo(s: ServicoTextoFat, codigos: string[]): string {
  if (s.rc_por_atendimento) return `${s.codigo_principal} pago uma vez por atendimento; os códigos ${lista(codigos)} só indicam o trabalho feito.`;
  if (codigos.length > 1) return `Pagamento por código: cada código (${lista(codigos)}) é pago na sua linha.`;
  return `Pagamento por código: ${codigos[0] ?? s.codigo_principal} pago pela quantidade lançada.`;
}

type Grupo = TotaisFat['grupos']['tipo_turma'][number];
type PorMotivo = TotaisFat['a_menos']['por_motivo'];

const somarGrupos = (a: Grupo[], b: Grupo[]) => {
  const mapa = new Map<string|null, Grupo>(a.map(g => [g.valor, { ...g }]));
  for (const g of b) {
    const atual = mapa.get(g.valor);
    if (!atual) { mapa.set(g.valor, { ...g }); continue; }
    for (const [k, v] of Object.entries(g)) if (typeof v === 'number') (atual as unknown as Record<string,number>)[k] = ((atual as unknown as Record<string,number>)[k] ?? 0) + v;
  }
  return [...mapa.values()].sort((x, y) => y.creditado - x.creditado);
};
const somarMotivos = (a: PorMotivo, b: PorMotivo) => {
  const r: PorMotivo = { ...a };
  for (const [k, v] of Object.entries(b)) r[k] = { us: (r[k]?.us ?? 0) + v.us, servicos: (r[k]?.servicos ?? 0) + v.servicos };
  return r;
};

const VAZIO: TotaisFat = {
  fatura:'', inicio:'', fim:'', importado_em:'', linhas:0, servicos:0, creditado:0, pago_com_fator:0, multas:0, estorno:0,
  devido:0, diferenca:0, sem_fator_servicos:0, parciais:0, saldo_a_receber:0, pago_a_mais:0,
  a_menos:{servicos:0,us:0,pago:0,devido:0,com_1ns:0,por_motivo:{}}, a_mais:{servicos:0,us:0,pago:0,devido:0,c562:{servicos:0,us:0},por_motivo:{}},
  fora_contrato:0,
  funil:{importados:0,equipe_identificada:0,codigo_no_contrato:0,valor_confere:0,conferidos:0},
  grupos:{tipo_turma:[],codserv:[],cidade:[]}, ajustes:{debito:0,credito:0,itens:[]},
};
const NUMEROS = ['linhas','servicos','creditado','pago_com_fator','multas','estorno','devido','diferenca','sem_fator_servicos','parciais','saldo_a_receber','pago_a_mais','fora_contrato'] as const;
const n0 = (v: number | undefined) => v ?? 0;

/** Soma várias faturas num só total (Resumo por período). */
export function somarTotais(lista: TotaisFat[]): TotaisFat {
  return lista.reduce<TotaisFat>((s, t, i) => {
    const r: TotaisFat = { ...s,
      fatura: i ? `${s.fatura}, ${t.fatura}` : t.fatura,
      inicio: !s.inicio || t.inicio < s.inicio ? t.inicio : s.inicio,
      fim: t.fim > s.fim ? t.fim : s.fim,
      importado_em: t.importado_em > s.importado_em ? t.importado_em : s.importado_em,
      a_menos: { servicos: s.a_menos.servicos + t.a_menos.servicos, us: n0(s.a_menos.us) + n0(t.a_menos.us),
        pago: n0(s.a_menos.pago) + n0(t.a_menos.pago), devido: n0(s.a_menos.devido) + n0(t.a_menos.devido),
        com_1ns: n0(s.a_menos.com_1ns) + n0(t.a_menos.com_1ns), por_motivo: somarMotivos(s.a_menos.por_motivo, t.a_menos.por_motivo) },
      a_mais: { servicos: s.a_mais.servicos + t.a_mais.servicos, us: n0(s.a_mais.us) + n0(t.a_mais.us),
        pago: n0(s.a_mais.pago) + n0(t.a_mais.pago), devido: n0(s.a_mais.devido) + n0(t.a_mais.devido),
        c562: { servicos: n0(s.a_mais.c562?.servicos) + n0(t.a_mais.c562?.servicos), us: n0(s.a_mais.c562?.us) + n0(t.a_mais.c562?.us) },
        por_motivo: somarMotivos(s.a_mais.por_motivo, t.a_mais.por_motivo) },
      funil: Object.fromEntries(Object.entries(s.funil).map(([k, v]) => [k, v + (t.funil[k as keyof TotaisFat['funil']] ?? 0)])) as TotaisFat['funil'],
      grupos: { tipo_turma: somarGrupos(s.grupos.tipo_turma, t.grupos.tipo_turma), codserv: somarGrupos(s.grupos.codserv, t.grupos.codserv), cidade: somarGrupos(s.grupos.cidade, t.grupos.cidade) },
      ajustes: { debito: s.ajustes.debito + t.ajustes.debito, credito: s.ajustes.credito + t.ajustes.credito, itens: [...s.ajustes.itens, ...t.ajustes.itens] },
    };
    for (const k of NUMEROS) r[k] = (s[k] ?? 0) + (t[k] ?? 0);
    return r;
  }, VAZIO);
}

/** Variação percentual; null quando não há base de comparação. */
export const variacao = (atual: number, anterior: number): number | null => anterior === 0 ? null : (atual - anterior) / anterior * 100;
