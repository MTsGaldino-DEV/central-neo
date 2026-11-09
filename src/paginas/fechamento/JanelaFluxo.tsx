import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Equal, Loader2, Pencil, RotateCcw } from 'lucide-react';
import {
  fecharEtapa1, corrigirEtapa1, informarNspr, informarLancamentoSf, informarApropriacao,
  desfazerNspr, desfazerLancamentoSf, desfazerApropriacao, supervisorDaEquipe,
  formatarUS, formatarReais, emReais, lerNumero,
  type Nsis, type ItemNsis, type Etapa,
} from '@/lib/fechamento';
import { listarContrato, type CodigoContrato } from '@/lib/contrato';
import { FATORES_NOVOS, calcularValor, fatorPadrao, totalPedido } from '@/lib/fechamentoCobranca';
import {
  CAMPO, ROTULO_CAMPO, impedirEnvioPeloEnter, EditorCodigos, SeletorFator, valorDaLinha, type LinhaLancamento,
} from './ComponentesLancamento';

/**
 * Janela da NSIS do fluxo novo (neo_nsis.fluxo_novo = true): mostra o formulário da etapa atual e, acima dele,
 * o que já foi informado nas etapas anteriores, com Corrigir e Desfazer.
 */

type Passo = 'FECHAR' | 'NSPR' | 'SF' | 'AP';

const PASSO_DA_ETAPA: Partial<Record<Etapa, Passo>> = {
  A_FECHAR: 'FECHAR',
  AGUARDANDO_NSPR: 'NSPR',
  AGUARDANDO_SALESFORCE: 'SF',
  AGUARDANDO_APROPRIACAO: 'AP',
};

interface Props {
  nsis: Nsis;
  itens: ItemNsis[];
  /** Recarrega a NSIS e a fila depois de gravar. */
  onAlterado: () => void;
  /** Avisa a janela de fora que há código escolhido e ainda não salvo (para o aviso ao fechar). */
  onRascunho?: (tem: boolean) => void;
}

const ehNsri = (nsis: Nsis) => nsis.tipo_serv === 'NSRI';

function tituloDoPasso(passo: Passo, nsis: Nsis): string {
  const nsri = ehNsri(nsis);
  if (passo === 'FECHAR') return nsri ? 'Códigos, equipe, NSMC e valor pago' : 'Códigos, equipe e NSMP';
  if (passo === 'NSPR') return 'NSPR e valor pago';
  if (passo === 'SF') return 'Lançamento no Salesforce';
  return 'Apropriação (AP)';
}

/** YYYY-MM-DD → DD/MM/AAAA sem passar por fuso (uma data sem hora não pode voltar um dia). */
function dataBR(dia: string | null): string {
  if (!dia) return '—';
  const [a, m, d] = dia.split('-');
  return a && m && d ? `${d}/${m}/${a}` : dia;
}

const hojeBrasilia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const numeroParaCampo = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

/** Valor pago em US: vazio é recusado, zero é aceito, vírgula vale como ponto. */
function lerValorPago(texto: string): number {
  if (!texto.trim()) throw new Error('Informe o valor pago (zero é aceito).');
  const v = lerNumero(texto);
  if (v === null || v < 0) throw new Error('Valor pago inválido.');
  return v;
}

/** Grava uma vez por vez: o botão fica desabilitado e um segundo clique não passa pela trava. */
function useEnvio(onAlterado: () => void | Promise<void>, onConcluido?: () => void) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const trava = useRef(false);

  async function executar(acao: () => Promise<void>) {
    if (trava.current) return;
    trava.current = true;
    setSalvando(true);
    setErro(null);
    try {
      await acao();
      await onAlterado();
      onConcluido?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }
  return { salvando, erro, setErro, executar };
}

export default function JanelaFluxo({ nsis, itens, onAlterado, onRascunho }: Props) {
  const nsri = ehNsri(nsis);
  const passos: Passo[] = nsri ? ['FECHAR', 'SF', 'AP'] : ['FECHAR', 'NSPR', 'SF', 'AP'];
  const atual = PASSO_DA_ETAPA[nsis.etapa] ?? null; // null: concluída
  const posicaoAtual = atual === null ? passos.length : Math.max(passos.indexOf(atual), 0);
  const feitos = passos.slice(0, posicaoAtual);
  const passoAtual = atual === null ? null : passos[posicaoAtual];
  const [editando, setEditando] = useState<Passo | null>(null);

  useEffect(() => { setEditando(null); }, [nsis.etapa]);

  const numero = (p: Passo) => passos.indexOf(p) + 1;
  const comum = { nsis, itens, onAlterado, onRascunho };

  function formulario(passo: Passo, corrigindo: boolean) {
    const encerrar = corrigindo ? () => setEditando(null) : undefined;
    const props = { ...comum, titulo: `${numero(passo)}. ${tituloDoPasso(passo, nsis)}`, corrigindo, onCancelar: encerrar, onConcluido: encerrar };
    if (passo === 'FECHAR') return <FormFechar key={`f-${passo}-${corrigindo}`} {...props} />;
    if (passo === 'NSPR') return <FormNspr key={`f-${passo}-${corrigindo}`} {...props} />;
    if (passo === 'SF') return <FormSalesforce key={`f-${passo}-${corrigindo}`} {...props} />;
    return <FormApropriacao key={`f-${passo}-${corrigindo}`} {...props} />;
  }

  return (
    <div className="space-y-3">
      {feitos.map((passo) => (editando === passo ? formulario(passo, true) : (
        <ResumoPasso key={passo} passo={passo} titulo={`${numero(passo)}. ${tituloDoPasso(passo, nsis)}`} nsis={nsis} itens={itens}
          onCorrigir={() => setEditando(passo)} onAlterado={onAlterado} />
      )))}

      {passoAtual ? formulario(passoAtual, false) : (
        <p className="flex items-center gap-2 rounded-xl bg-concluido-fundo px-4 py-3 text-sm font-bold text-concluido">
          <Check size={16} /> NSIS concluída: todas as etapas foram informadas.
        </p>
      )}
    </div>
  );
}

// ─── Resumo de uma etapa já informada ────────────────────────────────────────

function ResumoPasso({ passo, titulo, nsis, itens, onCorrigir, onAlterado }: {
  passo: Passo; titulo: string; nsis: Nsis; itens: ItemNsis[]; onCorrigir: () => void; onAlterado: () => void;
}) {
  const { salvando, erro, executar } = useEnvio(onAlterado);
  const nsri = ehNsri(nsis);
  const valorUS = nsis.valor_us_reais;
  const pago = Math.round(itens.reduce((s, it) => s + (it.valor_final ?? 0), 0) * 10000) / 10000;
  const pedido = totalPedido(itens);

  function desfazer() {
    if (passo === 'NSPR') return executar(() => desfazerNspr(itens));
    if (passo === 'SF') return executar(() => desfazerLancamentoSf(nsis.servico));
    return executar(() => desfazerApropriacao(itens));
  }

  const reais = (us: number) => (valorUS !== null ? <span className="text-cobre"> = {formatarReais(emReais(us, valorUS))}</span> : null);

  return (
    <section aria-label={titulo} className="rounded-xl border border-linha bg-concluido-fundo/40">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-linha px-4 py-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-aco">
          <Check size={13} className="text-concluido" /> {titulo}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onCorrigir} disabled={salvando} className="flex items-center gap-1 text-xs font-semibold text-sinal hover:underline disabled:opacity-50">
            <Pencil size={12} /> Corrigir
          </button>
          {passo !== 'FECHAR' && (
            <button type="button" onClick={desfazer} disabled={salvando} className="flex items-center gap-1 text-xs font-semibold text-aco hover:text-erro disabled:opacity-50">
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Desfazer esta etapa
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 px-4 py-3 text-sm">
        {passo === 'FECHAR' && (
          <>
            <ul className="space-y-0.5 text-xs text-aco">
              {itens.map((it) => (
                <li key={it.id}>
                  <span className="font-codigo font-semibold text-tinta">{it.codigo ?? 'Sem código'}</span>
                  {' · '}{it.descricao}
                  {it.codigo && <> · {formatarUS(it.quantidade, 0)} un</>}
                  {' · '}<span className="font-bold text-cobre">{formatarUS(it.valor_inicial, 4)} US</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
              <Dado rotulo="Equipe" valor={itens[0]?.equipe} codigo />
              <Dado rotulo="Supervisor" valor={nsis.supervisor_equipe} />
              <Dado rotulo={nsri ? 'NSMC' : 'NSMP'} valor={itens[0]?.nsmp} codigo />
              {nsri
                ? <Dado rotulo="Valor pago" valor={`${formatarUS(pago)} US`} />
                : <Dado rotulo="Pedido" valor={`${formatarUS(pedido, 4)} US`} />}
            </dl>
            {valorUS !== null && !nsri && <p className="text-xs text-cobre">{formatarReais(emReais(pedido, valorUS))} pelo valor da US na execução</p>}
          </>
        )}
        {passo === 'NSPR' && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
            <Dado rotulo="NSPR" valor={itens[0]?.nspr} codigo />
            <div>
              <dt className="text-[11px] text-aco">Valor pago</dt>
              <dd className={`font-semibold ${pago !== pedido ? 'text-erro' : ''}`}>{formatarUS(pago)} US{reais(pago)}</dd>
            </div>
            <Dado rotulo="Pedido" valor={`${formatarUS(pedido, 4)} US`} />
          </dl>
        )}
        {passo === 'SF' && (
          <dl><Dado rotulo="Lançada no Salesforce em" valor={dataBR(nsis.data_lancamento_sf)} /></dl>
        )}
        {passo === 'AP' && (
          <dl><Dado rotulo="Apropriação" valor={itens[0]?.fatura} codigo /></dl>
        )}
        {erro && <p role="alert" className="rounded-lg bg-erro-fundo px-3 py-2 text-xs text-erro">{erro}</p>}
      </div>
    </section>
  );
}

function Dado({ rotulo, valor, codigo }: { rotulo: string; valor: string | null | undefined; codigo?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-aco">{rotulo}</dt>
      <dd className={`font-semibold ${codigo ? 'font-codigo' : ''}`}>{valor || '—'}</dd>
    </div>
  );
}

// ─── Moldura comum dos formulários ──────────────────────────────────────────

function Formulario({ titulo, dica, salvando, erro, onEnviar, onCancelar, resumo, semEnter, children }: {
  titulo: string; dica?: string; salvando: boolean; erro: string | null; onEnviar: () => void; onCancelar?: () => void;
  resumo?: ReactNode; semEnter?: boolean; children: ReactNode;
}) {
  function enviar(e: FormEvent) {
    e.preventDefault();
    onEnviar();
  }
  return (
    <form onSubmit={enviar} noValidate onKeyDown={semEnter ? impedirEnvioPeloEnter : undefined} aria-label={titulo}
      className="space-y-4 rounded-xl border-2 border-sinal/40 bg-white p-4">
      <div>
        <p className="text-sm font-bold">{titulo}</p>
        {dica && <p className="mt-0.5 text-xs text-aco">{dica}</p>}
      </div>
      {erro && <p role="alert" className="rounded-lg bg-erro-fundo px-3 py-2 text-xs text-erro">{erro}</p>}
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
        <div className="text-sm">{resumo}</div>
        <div className="ml-auto flex gap-2">
          {onCancelar && (
            <button type="button" onClick={onCancelar} disabled={salvando}
              className="h-9 rounded-lg border border-linha px-4 text-sm font-semibold text-aco hover:bg-nevoa disabled:opacity-50">Cancelar</button>
          )}
          <button type="submit" disabled={salvando}
            className="flex h-9 items-center gap-2 rounded-lg bg-sinal px-4 text-sm font-bold text-white hover:bg-sinal-forte disabled:opacity-50">
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </form>
  );
}

interface PropsForm {
  nsis: Nsis;
  itens: ItemNsis[];
  titulo: string;
  corrigindo: boolean;
  onAlterado: () => void;
  onRascunho?: (tem: boolean) => void;
  onCancelar?: () => void;
  onConcluido?: () => void;
}

// ─── Etapa 1: códigos, equipe, NSMP (NSRI: NSMC e valor pago) ───────────────

function linhaDoItem(item: ItemNsis, tabela: CodigoContrato[]): LinhaLancamento {
  if (!item.codigo) {
    return { chave: `item-${item.id}`, codigo: null, descricao: item.descricao, quantidade: '1', valorManual: numeroParaCampo(item.valor_inicial), itemId: item.id };
  }
  const base = tabela.find((c) => c.codigo === item.codigo);
  // o item guarda o valor do código da época do pedido; acertos posteriores não mudam o item
  const fatorUS = item.fator_unitario ?? base?.fator_us ?? 0;
  const codigo: CodigoContrato = base
    ? { ...base, fator_us: fatorUS }
    : {
      codigo: item.codigo, tabela: '03', operacao: '', atividade: item.descricao, unidade: null, descricao: item.descricao, fator_original: null,
      fator_us: fatorUS, ativo: true, atualizado_em: '', acertado: false, qtd_usos: 0, ultimo_acerto: null,
    };
  return { chave: item.codigo, codigo, descricao: item.descricao, quantidade: numeroParaCampo(item.quantidade), valorManual: '', itemId: item.id };
}

function FormFechar({ nsis, itens, titulo, corrigindo, onAlterado, onRascunho, onCancelar, onConcluido }: PropsForm) {
  const nsri = ehNsri(nsis);
  const primeiro = itens[0];
  const fatorDoItem = itens.find((it) => it.codigo)?.fator;
  const [tabela, setTabela] = useState<CodigoContrato[]>([]);
  const [erroTabela, setErroTabela] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [pronto, setPronto] = useState(!corrigindo);
  const [fator, setFator] = useState<number>(corrigindo && FATORES_NOVOS.some((f) => f.valor === fatorDoItem) ? (fatorDoItem as number) : fatorPadrao(nsis.zona));
  const [equipe, setEquipe] = useState(corrigindo ? primeiro?.equipe ?? '' : '');
  const [nsmp, setNsmp] = useState(corrigindo ? primeiro?.nsmp ?? '' : '');
  const [valorPago, setValorPago] = useState(corrigindo && nsri ? numeroParaCampo(Math.round(itens.reduce((s, it) => s + (it.valor_final ?? 0), 0) * 10000) / 10000) : '');
  const [supervisorManual, setSupervisorManual] = useState(corrigindo ? nsis.supervisor_equipe ?? '' : '');
  // resultado da consulta de frota: só vale para a equipe consultada
  const [consulta, setConsulta] = useState<{ equipe: string; supervisor: string | null } | null>(null);
  const consultas = useRef(new Map<string, Promise<string | null>>());
  const equipeAtual = useRef(equipe);
  equipeAtual.current = equipe;
  const inicial = useRef<string | null>(null);
  const envio = useEnvio(onAlterado, onConcluido);

  useEffect(() => {
    listarContrato()
      .then((lista) => {
        setTabela(lista);
        if (corrigindo) setLinhas(itens.map((it) => linhaDoItem(it, lista)));
        setPronto(true);
      })
      .catch((e) => setErroTabela(e instanceof Error ? e.message : 'Falha ao carregar a tabela.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function consultar(nome: string): Promise<string | null> {
    const chave = nome.trim();
    if (!chave) return Promise.resolve(null);
    let promessa = consultas.current.get(chave);
    if (!promessa) {
      promessa = supervisorDaEquipe(chave);
      consultas.current.set(chave, promessa);
      promessa.catch(() => consultas.current.delete(chave));
    }
    return promessa;
  }

  async function aoSairDaEquipe() {
    const chave = equipe.trim();
    if (!chave) { setConsulta(null); return; }
    try {
      const supervisor = await consultar(chave);
      if (equipeAtual.current.trim() === chave) setConsulta({ equipe: chave, supervisor });
    } catch (e) {
      envio.setErro(e instanceof Error ? e.message : 'Falha ao buscar o supervisor da equipe.');
    }
  }

  // na correção a equipe já vem preenchida: mostra o supervisor sem esperar o foco
  useEffect(() => { if (corrigindo) aoSairDaEquipe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const estado = JSON.stringify([linhas.map((l) => [l.chave, l.descricao, l.quantidade, l.valorManual]), fator, equipe, nsmp, valorPago, supervisorManual]);
  useEffect(() => { if (corrigindo && pronto && inicial.current === null) inicial.current = estado; }, [pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  const alterado = corrigindo ? inicial.current !== null && inicial.current !== estado : linhas.length > 0;
  useEffect(() => { onRascunho?.(alterado); }, [alterado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onRascunho?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Math.round(linhas.reduce((soma, l) => soma + (valorDaLinha(l, fator) ?? 0), 0) * 10000) / 10000;
  const consultada = consulta !== null && consulta.equipe === equipe.trim() ? consulta : null;

  async function salvar() {
    await envio.executar(async () => {
      if (linhas.length === 0) throw new Error('Escolha pelo menos um código.');
      const campos = linhas.map((l) => {
        if (l.codigo) {
          const qtd = lerNumero(l.quantidade);
          if (qtd === null || qtd <= 0) throw new Error(`Informe a quantidade do código ${l.codigo.codigo}.`);
          return {
            id: l.itemId, descricao: l.descricao.trim() || `${l.codigo.operacao} ${l.codigo.atividade}`.trim(), codigo: l.codigo.codigo,
            quantidade: qtd, fator, fator_unitario: l.codigo.fator_us, valor_inicial: calcularValor(l.codigo.fator_us, qtd, fator),
          };
        }
        if (!l.descricao.trim()) throw new Error('Descreva o item sem código.');
        if (l.valorManual.trim() && lerNumero(l.valorManual) === null) throw new Error(`Valor inválido em "${l.descricao.trim()}".`);
        return {
          id: l.itemId, descricao: l.descricao.trim(), codigo: null, quantidade: 1, fator: 1, fator_unitario: null, valor_inicial: lerNumero(l.valorManual),
        };
      });
      const nomeEquipe = equipe.trim();
      if (!nomeEquipe) throw new Error('Informe o número da equipe.');
      if (!nsmp.trim()) throw new Error(nsri ? 'Informe a NSMC.' : 'Informe a NSMP.');
      const pagoUS = nsri ? lerValorPago(valorPago) : null;
      // sem ter saído do campo, a consulta ainda não rodou: o supervisor da frota vale mais que o campo à mão
      const daFrota = await consultar(nomeEquipe);
      const supervisor = daFrota ?? (supervisorManual.trim() || null);
      const dados = { equipe: nomeEquipe, nsmp, supervisor, valorPagoUS: pagoUS };
      if (corrigindo) await corrigirEtapa1(nsis, itens, { ...dados, itens: campos });
      else {
        await fecharEtapa1(nsis, {
          ...dados,
          itens: campos.map(({ id: _id, ...c }) => ({ ...c, equipe: nomeEquipe, nsmp: nsmp.trim(), us_adicional: null, nspr: null, valor_final: null, fatura: null, observacao: null })),
        });
      }
    });
  }

  return (
    <Formulario titulo={titulo} salvando={envio.salvando || !pronto} erro={envio.erro} onEnviar={salvar} onCancelar={onCancelar} semEnter
      dica={corrigindo ? 'Corrigindo o que foi informado nesta etapa.' : undefined}
      resumo={(
        <>
          <span className="text-aco">{linhas.length === 1 ? '1 código' : `${linhas.length} códigos`} · Total </span>
          <strong className="text-base text-cobre">{formatarUS(total, 4)} US</strong>
          {nsis.valor_us_reais !== null && <span className="text-cobre"> = {formatarReais(emReais(total, nsis.valor_us_reais))}</span>}
        </>
      )}>
      <EditorCodigos tabela={tabela} erroTabela={erroTabela} linhas={linhas} onLinhas={setLinhas} fator={fator} />

      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <div>
          <label htmlFor="equipe-fluxo" className={ROTULO_CAMPO}>Nº da equipe</label>
          <input id="equipe-fluxo" value={equipe} onChange={(e) => setEquipe(e.target.value)} onBlur={aoSairDaEquipe} className={`${CAMPO} font-codigo`} />
        </div>
        <SeletorFator valor={fator} fatores={FATORES_NOVOS} onMudar={setFator} />
      </div>

      {consultada && (consultada.supervisor ? (
        <p className="text-sm font-semibold">{`Supervisor: ${consultada.supervisor}`}</p>
      ) : (
        <div className="sm:max-w-sm">
          <label htmlFor="supervisor-fluxo" className={ROTULO_CAMPO}>Supervisor (informar à mão)</label>
          <input id="supervisor-fluxo" value={supervisorManual} onChange={(e) => setSupervisorManual(e.target.value)} className={CAMPO} />
          <p className="mt-1 text-[11px] text-aco">Opcional. Esta equipe não está nas frotas da Disponibilidade.</p>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nsmp-fluxo" className={ROTULO_CAMPO}>{nsri ? 'NSMC' : 'NSMP'}</label>
          <input id="nsmp-fluxo" value={nsmp} onChange={(e) => setNsmp(e.target.value)} className={`${CAMPO} font-codigo`} />
        </div>
        {nsri && (
          <div>
            <label htmlFor="pago-fluxo" className={ROTULO_CAMPO}>Valor pago (US)</label>
            <input id="pago-fluxo" value={valorPago} onChange={(e) => setValorPago(e.target.value)} inputMode="decimal" placeholder="0,00" className={CAMPO} />
          </div>
        )}
      </div>
    </Formulario>
  );
}

// ─── Etapa 2: NSPR e valor pago ──────────────────────────────────────────────

function FormNspr({ nsis, itens, titulo, corrigindo, onAlterado, onCancelar, onConcluido }: PropsForm) {
  const envio = useEnvio(onAlterado, onConcluido);
  const pedido = totalPedido(itens);
  const pagoAtual = Math.round(itens.reduce((s, it) => s + (it.valor_final ?? 0), 0) * 10000) / 10000;
  const [nspr, setNspr] = useState(corrigindo ? itens[0]?.nspr ?? '' : '');
  const [valor, setValor] = useState(corrigindo ? numeroParaCampo(pagoAtual) : '');

  return (
    <Formulario titulo={titulo} salvando={envio.salvando} erro={envio.erro} onCancelar={onCancelar}
      dica={corrigindo ? 'Corrigindo o que foi informado nesta etapa.' : `Pedido de ${formatarUS(pedido, 4)} US. Informe a NSPR que a CEMIG devolveu e o valor pago.`}
      onEnviar={() => envio.executar(async () => {
        if (!nspr.trim()) throw new Error('Informe a NSPR.');
        await informarNspr(itens, nspr, lerValorPago(valor));
      })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nspr-fluxo" className={ROTULO_CAMPO}>NSPR</label>
          <input id="nspr-fluxo" value={nspr} onChange={(e) => setNspr(e.target.value)} className={`${CAMPO} font-codigo`} />
        </div>
        <div>
          <label htmlFor="pago-nspr-fluxo" className={ROTULO_CAMPO}>Valor pago (US)</label>
          <div className="flex gap-1.5">
            <input id="pago-nspr-fluxo" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={CAMPO} />
            {pedido > 0 && (
              <button type="button" onClick={() => setValor(numeroParaCampo(pedido))} title="Pago igual ao pedido" aria-label="Pago igual ao pedido"
                className="h-9 shrink-0 rounded-lg border border-linha px-2.5 text-aco hover:border-sinal hover:text-sinal">
                <Equal size={14} />
              </button>
            )}
          </div>
          {nsis.valor_us_reais !== null && lerNumero(valor) !== null && (
            <p className="mt-1 text-[11px] text-cobre">= {formatarReais(emReais(lerNumero(valor), nsis.valor_us_reais))}</p>
          )}
        </div>
      </div>
    </Formulario>
  );
}

// ─── Etapa 3: data de lançamento no Salesforce ───────────────────────────────

function FormSalesforce({ nsis, titulo, corrigindo, onAlterado, onCancelar, onConcluido }: PropsForm) {
  const envio = useEnvio(onAlterado, onConcluido);
  const [data, setData] = useState(corrigindo ? nsis.data_lancamento_sf ?? '' : '');

  return (
    <Formulario titulo={titulo} salvando={envio.salvando} erro={envio.erro} onCancelar={onCancelar}
      dica={corrigindo ? 'Corrigindo o que foi informado nesta etapa.' : 'Informe o dia em que a NSIS foi lançada no Salesforce.'}
      onEnviar={() => envio.executar(() => informarLancamentoSf(nsis.servico, data))}>
      <div className="sm:max-w-xs">
        <label htmlFor="data-sf-fluxo" className={ROTULO_CAMPO}>Data de lançamento no Salesforce</label>
        <input id="data-sf-fluxo" type="date" value={data} max={hojeBrasilia()} onChange={(e) => setData(e.target.value)} className={CAMPO} />
      </div>
    </Formulario>
  );
}

// ─── Etapa 4: apropriação ────────────────────────────────────────────────────

function FormApropriacao({ itens, titulo, corrigindo, onAlterado, onCancelar, onConcluido }: PropsForm) {
  const envio = useEnvio(onAlterado, onConcluido);
  const [ap, setAp] = useState(corrigindo ? itens[0]?.fatura ?? '' : '');

  return (
    <Formulario titulo={titulo} salvando={envio.salvando} erro={envio.erro} onCancelar={onCancelar}
      dica={corrigindo ? 'Corrigindo o que foi informado nesta etapa.' : 'A apropriação chega algum tempo depois. Informe quando tiver o número.'}
      onEnviar={() => envio.executar(() => informarApropriacao(itens, ap))}>
      <div className="sm:max-w-xs">
        <label htmlFor="ap-fluxo" className={ROTULO_CAMPO}>Apropriação (AP)</label>
        <input id="ap-fluxo" value={ap} onChange={(e) => setAp(e.target.value)} placeholder="Ex.: AP 83809" className={`${CAMPO} font-codigo`} />
      </div>
    </Formulario>
  );
}
