import { useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro } from 'react';
import NumberFlow from '@number-flow/react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, CopyCheck, Download, FileText, Info, Loader2, MapPin, Maximize2, Minus, Plus, Truck, UploadCloud, X,
} from 'lucide-react';
import {
  calcular, formatarDia, formatarHora, formatarKm, formatarUs, haversine, kmDosStatus, kmLinearExcedente, linhasAuditoria,
  KM_LINEAR_FATOR_US, KM_LINEAR_FRANQUIA, LIMITE_LINHAS, NOME_MOTIVO, REPETICOES_FANTASMA, SALTO_KM, SEM_STATUS, STATUS_ACIONADO,
  VELOCIDADE_IMPOSSIVEL, type Atendimento, type PontoKm, type ResultadoKm, type RelatorioKm, type TipoAlerta,
} from '@/lib/calculoKm';
import { lerPdfPercursos } from '@/lib/calculoKmPdf';
import { ErroNeo, traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { AvisoErro } from '@/components/faturamento/AvisoErro';

const MAXIMO = 5;

interface Entrada {
  id: string;
  arquivo: File;
  estado: 'lendo' | 'ok' | 'erro';
  relatorio?: RelatorioKm;
  erro?: ErroAmigavel;
}

export default function CalculoKm() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [aviso, setAviso] = useState<ErroAmigavel | null>(null);
  const lendo = entradas.some(e => e.estado === 'lendo');

  const resultados = useMemo(
    () => calcular(entradas.filter(e => e.estado === 'ok' && e.relatorio).map(e => e.relatorio!)),
    [entradas],
  );
  const totalKm = resultados.reduce((s, r) => s + r.kmLimpo, 0);

  async function adicionar(lista: FileList | File[]) {
    setAviso(null);
    const novos = [...lista];
    const jaTem = (f: File) => entradas.some(e => e.arquivo.name === f.name && e.arquivo.size === f.size);
    const repetidos = novos.filter(jaTem);
    const aceitos = novos.filter(f => !jaTem(f)).slice(0, Math.max(0, MAXIMO - entradas.length));
    const sobra = novos.length - repetidos.length - aceitos.length;
    if (sobra > 0) setAviso(traduzirErro(new ErroNeo(`Limite de ${MAXIMO} relatórios por cálculo. ${sobra === 1 ? '1 arquivo ficou' : `${sobra} arquivos ficaram`} de fora: remova um da lista para incluir outro.`)));
    else if (repetidos.length) setAviso(traduzirErro(new ErroNeo(`${repetidos.map(f => `"${f.name}"`).join(', ')} já ${repetidos.length === 1 ? 'está' : 'estão'} na lista.`)));
    if (!aceitos.length) return;

    const criadas: Entrada[] = aceitos.map(arquivo => ({ id: crypto.randomUUID(), arquivo, estado: 'lendo' }));
    setEntradas(es => [...es, ...criadas]);
    // Um de cada vez: o pdf.js usa um único worker e a tela continua respondendo.
    for (const e of criadas) {
      try {
        const relatorio = await lerPdfPercursos(e.arquivo);
        setEntradas(es => es.map(x => x.id === e.id ? { ...x, estado: 'ok', relatorio } : x));
      } catch (err) {
        setEntradas(es => es.map(x => x.id === e.id ? { ...x, estado: 'erro', erro: traduzirErro(err, `Cálculo de KM › ler ${e.arquivo.name}`) } : x));
      }
    }
  }

  const remover = (id: string) => { setAviso(null); setEntradas(es => es.filter(e => e.id !== id)); };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-sinal mb-2">Ferramentas · Percursos do rastreador</p>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">Quantos km a equipe rodou</h2>
          <p className="mt-2 text-sm text-aco max-w-2xl leading-relaxed">
            Importe até {MAXIMO} relatórios de Percursos em PDF. Relatórios da mesma equipe e do mesmo dia são somados num único percurso, e os pontos falsos do GPS ficam de fora.
          </p>
        </div>
      </header>

      {aviso && <AvisoErro erro={aviso} />}

      <section className="bg-white rounded-2xl border border-linha p-5 lg:p-6 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5">
        <AreaPdf ocupado={lendo} cheio={entradas.length >= MAXIMO} onArquivos={f => void adicionar(f)} />
        <ListaArquivos entradas={entradas} ocupado={lendo} onRemover={remover} />
      </section>

      {resultados.length > 1 && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-aco px-1">
          <span className="font-extrabold text-tinta text-lg tabular-nums">{formatarKm(totalKm)} km</span>
          somando {resultados.length} percursos de {new Set(resultados.map(r => r.agente)).size} equipes.
        </p>
      )}

      {resultados.length ? (
        <div className="space-y-6">{resultados.map(r => <CartaoResultado key={r.chave} r={r} />)}</div>
      ) : (
        <ComoFunciona aberto />
      )}
      {resultados.length > 0 && <ComoFunciona />}
    </div>
  );
}

// ─── Importação ──────────────────────────────────────────────────────────────

function AreaPdf({ ocupado, cheio, onArquivos }: { ocupado: boolean; cheio: boolean; onArquivos: (f: FileList) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const bloqueado = ocupado || cheio;
  return (
    <div>
      <input ref={input} type="file" accept=".pdf,application/pdf" multiple aria-label="Relatórios de Percursos em PDF" className="hidden" disabled={bloqueado}
        onChange={e => { if (e.target.files?.length) onArquivos(e.target.files); e.target.value = ''; }} />
      <button type="button" disabled={bloqueado} onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!bloqueado) setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={e => { e.preventDefault(); setArrastando(false); if (!bloqueado && e.dataTransfer.files.length) onArquivos(e.dataTransfer.files); }}
        className={'w-full h-full min-h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-sinal ' +
          (arrastando ? 'border-sinal bg-sinal-fundo' : 'border-linha hover:border-sinal hover:bg-sinal-fundo/30')}>
        {ocupado ? <Loader2 size={27} className="text-sinal animate-spin" /> : <UploadCloud size={27} className="text-sinal" />}
        <span className="text-sm font-bold mt-1">{ocupado ? 'Lendo relatório…' : cheio ? `Limite de ${MAXIMO} relatórios` : 'Arraste os PDFs ou selecione'}</span>
        <span className="text-xs text-aco text-center leading-relaxed max-w-64">
          {cheio ? 'Remova um relatório da lista para incluir outro.' : 'Relatório "Percursos" do rastreador, com as colunas Data e hora, Velocidade e Coordenadas.'}
        </span>
      </button>
    </div>
  );
}

function ListaArquivos({ entradas, ocupado, onRemover }: { entradas: Entrada[]; ocupado: boolean; onRemover: (id: string) => void }) {
  return (
    <div className="min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold">Relatórios</h3>
        <span className="flex items-center gap-1" aria-label={`${entradas.length} de ${MAXIMO} relatórios`}>
          {Array.from({ length: MAXIMO }, (_, i) => (
            <span key={i} className={`h-1.5 w-5 rounded-full ${i < entradas.length ? 'bg-sinal' : 'bg-linha'}`} />
          ))}
          <span className="ml-1.5 text-xs font-semibold text-aco tabular-nums">{entradas.length}/{MAXIMO}</span>
        </span>
      </div>
      {entradas.length === 0 ? (
        <p className="flex-1 rounded-xl bg-nevoa text-sm text-aco p-4 flex items-center">
          Nenhum relatório ainda. Para um dia que o rastreador cortou em {LIMITE_LINHAS} linhas, emita o relatório em dois intervalos e importe os dois juntos.
        </p>
      ) : (
        <ul className="space-y-2">
          {entradas.map(e => (
            <li key={e.id} className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 ${e.estado === 'erro' ? 'border-erro/30 bg-erro-fundo/50' : 'border-linha'}`}>
              {e.estado === 'lendo' ? <Loader2 size={18} className="text-sinal animate-spin shrink-0 mt-0.5" />
                : e.estado === 'erro' ? <AlertTriangle size={18} className="text-erro shrink-0 mt-0.5" />
                : <FileText size={18} className="text-sinal shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold break-all">{e.arquivo.name}</p>
                {e.estado === 'lendo' && <p className="text-xs text-aco mt-0.5">Lendo as posições…</p>}
                {e.estado === 'erro' && <p className="text-xs text-erro mt-0.5">{e.erro?.mensagem}</p>}
                {e.relatorio && (
                  <p className="text-xs text-aco mt-0.5">
                    Equipe <b className="text-tinta">{e.relatorio.agente}</b> <span className="font-codigo">{e.relatorio.placa}</span>
                    {' '}· {formatarDia(new Date(e.relatorio.pontos[0].ts).toISOString().slice(0, 10))}
                    {' '}· {formatarHora(e.relatorio.pontos[0].ts)} às {formatarHora(e.relatorio.pontos[e.relatorio.pontos.length - 1].ts)}
                    {' '}· <span className="tabular-nums">{e.relatorio.pontos.length}</span> posições
                  </p>
                )}
              </div>
              <button type="button" aria-label={`Remover ${e.arquivo.name}`} disabled={ocupado} onClick={() => onRemover(e.id)}
                className="text-aco hover:text-erro p-1 rounded disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sinal">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Resultado ───────────────────────────────────────────────────────────────

const COR_STATUS: Record<string, string> = {
  'A CAMINHO': 'var(--color-sinal)',
  'TRABALHANDO': 'var(--color-concluido-marca)',
  'DISPONÍVEL': 'var(--color-aco-claro)',
  'ALMOÇANDO': 'var(--color-pendente-marca)',
  [SEM_STATUS]: 'var(--color-linha)',
};
const corStatus = (s: string) => COR_STATUS[s] ?? 'var(--color-revisao-marca)';
/** "A CAMINHO" → "A caminho"; o rótulo interno já vem em frase. */
const nomeStatus = (s: string) => s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;

const ESTILO_ALERTA: Record<TipoAlerta, string> = {
  CORTADO: 'bg-pendente-fundo text-pendente',
  LACUNA: 'bg-pendente-fundo text-pendente',
  SALTO: 'bg-nevoa text-aco',
};

function CartaoResultado({ r }: { r: ResultadoKm }) {
  const [copiado, setCopiado] = useState(false);
  const [baixando, setBaixando] = useState(false);
  // Guarda os status desmarcados: um status novo (outro relatório do mesmo dia) já entra marcado.
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [verAcionamentos, setVerAcionamentos] = useState(false);
  const [foco, setFoco] = useState<Atendimento | null>(null);

  const selecionados = useMemo(() => new Set(r.kmPorStatus.map(s => s.status).filter(s => !excluidos.has(s))), [r, excluidos]);
  const todos = selecionados.size === r.kmPorStatus.length;
  const contrato = kmLinearExcedente(kmDosStatus(r, selecionados));
  const kmFalsos = r.kmBruto - r.kmLimpo;
  const inicio = r.pontos[0], fim = r.pontos[r.pontos.length - 1];

  async function copiar() {
    try { await navigator.clipboard.writeText(resumoTexto(r, selecionados)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setCopiado(false); }
  }
  async function baixar() {
    setBaixando(true);
    try { await baixarAuditoria(r, selecionados); } finally { setBaixando(false); }
  }
  function alternarAcionamentos() {
    setVerAcionamentos(v => !v);
    setFoco(null);
  }

  return (
    <section className="rounded-2xl border border-linha bg-white overflow-hidden" aria-label={`Percurso da equipe ${r.agente} em ${formatarDia(r.dia)}`}>
      <div className="p-5 lg:p-6 flex flex-wrap items-center justify-between gap-3 border-b border-linha">
        <div className="flex items-center gap-3 min-w-0">
          <span className="rounded-xl bg-sinal-fundo text-sinal p-3"><Truck size={22} /></span>
          <div className="min-w-0">
            <h3 className="font-extrabold text-lg flex flex-wrap items-center gap-x-2">
              Equipe {r.agente}
              <span className="font-codigo text-xs font-bold text-aco bg-nevoa border border-linha rounded-md px-1.5 py-0.5">{r.placa}</span>
            </h3>
            <p className="text-xs text-aco mt-1">
              {formatarDia(r.dia)}, das {formatarHora(inicio.ts)} às {formatarHora(fim.ts)}
              {r.arquivos.length > 1 && <> · {r.arquivos.length} relatórios combinados</>}
            </p>
          </div>
        </div>
        {r.alertas.some(a => a.tipo !== 'SALTO')
          ? <span className="inline-flex items-center gap-1.5 bg-pendente-fundo text-pendente rounded-full px-3 py-1.5 text-xs font-bold"><AlertTriangle size={14} /> Dia possivelmente incompleto</span>
          : <span className="inline-flex items-center gap-1.5 bg-concluido-fundo text-concluido rounded-full px-3 py-1.5 text-xs font-bold"><CheckCircle2 size={14} /> Período coberto</span>}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="p-5 lg:p-6 lg:border-r border-b lg:border-b-0 border-linha min-w-0">
          <Tracado r={r} selecionados={selecionados} atendimentos={verAcionamentos ? r.atendimentos : []} foco={foco} />
        </div>
        <div className="p-5 lg:p-6 flex flex-col gap-6 min-w-0">
          <dl className="text-sm" aria-label="Conta dos quilômetros">
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-aco">Leitura bruta <span className="text-aco-claro">· {r.pontosLidos} posições</span></dt>
              <dd className="font-semibold tabular-nums">{formatarKm(r.kmBruto)} km</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2 border-b-2 border-tinta/80">
              <dt className="text-aco">Pontos falsos do GPS <span className="text-aco-claro">· {r.descartados.length}</span></dt>
              <dd className={`font-semibold tabular-nums ${kmFalsos > 0.05 ? 'text-erro' : ''}`}>− {formatarKm(kmFalsos)} km</dd>
            </div>
            <div className="pt-3">
              <dt className="text-xs font-bold text-sinal">km rodados</dt>
              <dd className="text-5xl font-extrabold tracking-tight tabular-nums leading-none mt-1.5">
                <NumberFlow value={Math.round(r.kmLimpo * 10) / 10} locales="pt-BR" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
                <span className="text-lg font-bold text-aco ml-1.5">km</span>
              </dd>
              <p className="text-xs text-aco mt-2.5 leading-relaxed">
                Em linha reta, do primeiro ao último ponto: <b className="text-tinta tabular-nums">{formatarKm(r.kmLinhaReta)} km</b>.
                {r.kmLinhaReta < 5 && ' A equipe terminou perto de onde começou.'}
              </p>
            </div>
          </dl>
          <QuadroContrato contrato={contrato} todos={todos} />
          <PorStatus r={r} selecionados={selecionados}
            onAlternar={s => setExcluidos(ex => { const n = new Set(ex); if (n.has(s)) n.delete(s); else n.add(s); return n; })}
            onTodos={() => setExcluidos(new Set())}
            onSo={s => setExcluidos(new Set(r.kmPorStatus.map(x => x.status).filter(x => x !== s)))} />
        </div>
      </div>

      <Acionamentos r={r} ver={verAcionamentos} onAlternar={alternarAcionamentos} foco={foco} onFoco={setFoco} />

      {(r.alertas.length > 0 || r.descartados.length > 0) && (
        <div className="px-5 lg:px-6 pb-5 lg:pb-6 space-y-3 border-t border-linha pt-5">
          {r.alertas.map((a, i) => (
            <p key={i} className={`flex gap-2.5 rounded-xl p-3.5 text-sm leading-relaxed ${ESTILO_ALERTA[a.tipo]}`}>
              {a.tipo === 'SALTO' ? <Info size={17} className="shrink-0 mt-0.5" /> : <AlertTriangle size={17} className="shrink-0 mt-0.5" />}
              <span>{a.texto}</span>
            </p>
          ))}
          {r.descartados.length > 0 && <TabelaDescartados r={r} />}
        </div>
      )}

      <div className="bg-nevoa/60 border-t border-linha p-5 lg:px-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-aco max-w-lg leading-relaxed">A planilha traz todas as posições do dia, o km de cada trecho, o acumulado, o status de cada trecho e o motivo de cada ponto descartado, para quem quiser refazer a conta.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copiar()}
            className="rounded-xl border border-linha bg-white px-4 py-2.5 text-sm font-bold text-tinta inline-flex items-center gap-2 hover:border-sinal focus-visible:outline-2 focus-visible:outline-sinal">
            {copiado ? <CopyCheck size={16} className="text-concluido" /> : <Copy size={16} />} {copiado ? 'Resumo copiado' : 'Copiar resumo'}
          </button>
          <button type="button" onClick={() => void baixar()} disabled={baixando}
            className="bg-sinal hover:bg-sinal-forte text-white rounded-xl px-4 py-2.5 font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sinal">
            {baixando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Baixar planilha de auditoria
          </button>
        </div>
      </div>
    </section>
  );
}

/** Cláusula 8.2.1: caminhonete em dupla, km linear acima de 100 km na jornada. */
function QuadroContrato({ contrato, todos }: { contrato: ReturnType<typeof kmLinearExcedente>; todos: boolean }) {
  return (
    <section className="rounded-xl border border-linha p-4" aria-label="Km linear excedente do contrato">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-bold">Km linear excedente</h4>
        <span className="text-xs text-aco">Cláusula 8.2.1 · caminhonete em dupla</span>
      </div>
      <dl className="text-sm mt-3">
        <div className="flex items-baseline justify-between gap-3 py-1">
          <dt className="text-aco">{todos ? 'km rodados' : 'km nos status marcados'}</dt>
          <dd className="font-semibold tabular-nums">{formatarKm(contrato.km)} km</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1 border-b border-linha pb-2">
          <dt className="text-aco">Franquia da jornada</dt>
          <dd className="font-semibold tabular-nums">− {formatarKm(KM_LINEAR_FRANQUIA)} km</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-2">
          <dt className="font-bold">Excedente</dt>
          <dd className="font-extrabold tabular-nums">{formatarKm(contrato.excedente)} km</dd>
        </div>
      </dl>
      {contrato.excedente > 0 ? (
        <div className="mt-3 rounded-lg bg-cobre-fundo px-3 py-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-xs text-aco tabular-nums">{formatarKm(contrato.excedente)} km × {KM_LINEAR_FATOR_US.toLocaleString('pt-BR', { minimumFractionDigits: 6 })} US</span>
          <span className="text-lg font-extrabold text-cobre tabular-nums">{formatarUs(contrato.us)} <span className="text-xs font-bold">US</span></span>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-nevoa px-3 py-2.5 text-xs text-aco">Não passou de {KM_LINEAR_FRANQUIA} km na jornada: sem km linear a receber.</p>
      )}
    </section>
  );
}

function PorStatus({ r, selecionados, onAlternar, onTodos, onSo }: {
  r: ResultadoKm; selecionados: ReadonlySet<string>; onAlternar: (s: string) => void; onTodos: () => void; onSo: (s: string) => void;
}) {
  const total = r.kmPorStatus.reduce((s, x) => s + x.km, 0) || 1;
  const visiveis = r.kmPorStatus.filter(s => s.km >= 0.05 || selecionados.has(s.status));
  const temCaminho = r.kmPorStatus.some(s => s.status === STATUS_ACIONADO);
  const soCaminho = temCaminho && selecionados.size === 1 && selecionados.has(STATUS_ACIONADO);
  const atalho = (ativo: boolean) => `rounded-full px-2.5 py-1 text-xs font-bold border focus-visible:outline-2 focus-visible:outline-sinal ${ativo ? 'bg-sinal text-white border-sinal' : 'border-linha text-aco hover:border-sinal hover:text-sinal'}`;
  return (
    <fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <legend className="text-sm font-bold float-left">Status considerados</legend>
        <div className="flex gap-1.5">
          <button type="button" onClick={onTodos} aria-pressed={selecionados.size === r.kmPorStatus.length} className={atalho(selecionados.size === r.kmPorStatus.length)}>Todos</button>
          {temCaminho && <button type="button" onClick={() => onSo(STATUS_ACIONADO)} aria-pressed={soCaminho} className={atalho(soCaminho)}>Só “A caminho”</button>}
        </div>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-nevoa clear-both" aria-hidden="true">
        {visiveis.map(s => <span key={s.status} style={{ width: `${(s.km / total) * 100}%`, background: corStatus(s.status), opacity: selecionados.has(s.status) ? 1 : 0.18 }}
          className="h-full border-r-2 border-white last:border-r-0 transition-opacity motion-reduce:transition-none" />)}
      </div>
      <ul className="mt-2 space-y-0.5">
        {visiveis.map(s => {
          const marcado = selecionados.has(s.status);
          return (
            <li key={s.status}>
              <label className={`flex items-center gap-2.5 text-sm rounded-lg px-1.5 py-1.5 -mx-1.5 cursor-pointer hover:bg-nevoa ${marcado ? '' : 'text-aco-claro'}`}>
                <input type="checkbox" checked={marcado} onChange={() => onAlternar(s.status)} className="size-4 accent-sinal shrink-0" />
                <span className="size-2.5 rounded-full shrink-0" style={{ background: corStatus(s.status), opacity: marcado ? 1 : 0.35 }} />
                <span className="flex-1 min-w-0 truncate">{nomeStatus(s.status)}</span>
                <span className="font-semibold tabular-nums">{formatarKm(s.km)} km</span>
                <span className="w-10 text-right text-xs text-aco tabular-nums">{Math.round((s.km / total) * 100)}%</span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-aco-claro mt-2 leading-relaxed">Cada trecho conta para o status que a equipe tinha marcado quando ele começou. Os status vêm do que a equipe marcou no aparelho; desmarque os que não devem entrar no km linear.</p>
    </fieldset>
  );
}

function Acionamentos({ r, ver, onAlternar, foco, onFoco }: {
  r: ResultadoKm; ver: boolean; onAlternar: () => void; foco: Atendimento | null; onFoco: (a: Atendimento | null) => void;
}) {
  const chegaram = r.atendimentos.filter(a => a.chegou).length;
  return (
    <div className="border-t border-linha">
      <div className="px-5 lg:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-bold">Acionamentos e chegadas</p>
          <p className="text-xs text-aco mt-0.5 leading-relaxed">
            Do status “A caminho” até “Trabalhando”, pelos eventos do rastreador. É informação de apoio: depende de a equipe ter marcado o status na hora certa.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={ver} onClick={onAlternar} disabled={!r.atendimentos.length}
          className="inline-flex items-center gap-2.5 text-sm font-semibold text-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sinal rounded-full">
          <span className={`relative h-6 w-11 rounded-full transition-colors motion-reduce:transition-none ${ver ? 'bg-sinal' : 'bg-linha'}`}>
            <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${ver ? 'translate-x-5' : ''}`} />
          </span>
          {r.atendimentos.length ? `Mostrar no mapa (${r.atendimentos.length})` : 'Nenhum acionamento no relatório'}
        </button>
      </div>
      {ver && (
        <div className="px-5 lg:px-6 pb-5">
          <p className="text-xs text-aco mb-2.5">{r.atendimentos.length} acionamentos, {chegaram} com chegada em “Trabalhando”. Clique numa linha para aproximar o mapa.</p>
          <div className="overflow-x-auto rounded-xl border border-linha">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-xs text-aco bg-nevoa/60">
                <tr>
                  <th className="text-left font-semibold px-4 py-2 w-12">Nº</th>
                  <th className="text-left font-semibold px-4 py-2">A caminho</th>
                  <th className="text-left font-semibold px-4 py-2">Chegada</th>
                  <th className="text-right font-semibold px-4 py-2">Tempo</th>
                  <th className="text-right font-semibold px-4 py-2 whitespace-nowrap">km percorrido</th>
                  <th className="text-right font-semibold px-4 py-2 whitespace-nowrap">Linha reta</th>
                </tr>
              </thead>
              <tbody>
                {r.atendimentos.map(a => {
                  const ativo = foco === a;
                  const minutos = Math.round((a.fim.ts - a.saida.ts) / 60_000);
                  return (
                    <tr key={a.n} onClick={() => onFoco(ativo ? null : a)}
                      className={`border-t border-linha cursor-pointer ${ativo ? 'bg-sinal-fundo' : 'hover:bg-nevoa/70'}`}>
                      <td className="px-4 py-2">
                        <button type="button" aria-pressed={ativo} aria-label={`Aproximar o mapa no acionamento ${a.n}`}
                          onClick={e => { e.stopPropagation(); onFoco(ativo ? null : a); }}
                          className="size-6 rounded-full bg-cobre text-white text-xs font-bold inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sinal">{a.n}</button>
                      </td>
                      <td className="px-4 py-2 font-codigo text-xs whitespace-nowrap">{formatarHora(a.saida.ts)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {a.chegou
                          ? <span className="font-codigo text-xs">{formatarHora(a.fim.ts)}</span>
                          : <span className="text-xs text-aco">Sem chegada · virou {nomeStatus(a.interrompidoPor)} às <span className="font-codigo">{formatarHora(a.fim.ts)}</span></span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-aco whitespace-nowrap">{minutos} min</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{formatarKm(a.kmPercorrido)} km</td>
                      <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{formatarKm(a.kmLinhaReta)} km</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabelaDescartados({ r }: { r: ResultadoKm }) {
  return (
    <details className="group rounded-xl border border-linha">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-sinal rounded-xl">
        <span>{r.descartados.length === 1 ? '1 ponto descartado' : `${r.descartados.length} pontos descartados`}: ver horário, posição e motivo</span>
        <ChevronDown size={16} className="text-aco transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="overflow-x-auto border-t border-linha">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-aco bg-nevoa/60">
            <tr>
              <th className="text-left font-semibold px-4 py-2">Horário</th>
              <th className="text-left font-semibold px-4 py-2">Posição</th>
              <th className="text-right font-semibold px-4 py-2">Velocidade</th>
              <th className="text-left font-semibold px-4 py-2">Motivo</th>
              <th className="text-right font-semibold px-4 py-2 whitespace-nowrap">km evitados</th>
            </tr>
          </thead>
          <tbody>
            {r.descartados.map(d => (
              <tr key={d.ponto.ts + d.ponto.arquivo} className="border-t border-linha">
                <td className="px-4 py-2 font-codigo text-xs whitespace-nowrap">{d.ponto.hora.slice(6)}</td>
                <td className="px-4 py-2">
                  <a href={`https://www.google.com/maps?q=${d.ponto.lat},${d.ponto.lon}`} target="_blank" rel="noreferrer"
                    className="font-codigo text-xs text-sinal hover:underline inline-flex items-center gap-1 whitespace-nowrap">
                    <MapPin size={12} /> {d.ponto.lat}; {d.ponto.lon}
                  </a>
                </td>
                <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{d.ponto.vel} km/h</td>
                <td className="px-4 py-2 whitespace-nowrap">{NOME_MOTIVO[d.motivo]}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-erro">{formatarKm(d.kmEvitados, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ─── Traçado com zoom ────────────────────────────────────────────────────────

const LARGURA = 640, ALTURA = 400, MARGEM = 30;
const KM_POR_GRAU = 111.195;
const ESCALAS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const ZOOM_MAXIMO = 60;

interface Vista { x: number; y: number; w: number }
const VISTA_INTEIRA: Vista = { x: 0, y: 0, w: LARGURA };
const alturaDe = (v: Vista) => (v.w * ALTURA) / LARGURA;

/** Mantém a vista dentro de limites: entre o dia inteiro e ZOOM_MAXIMO vezes, sem perder o traçado de vista. */
function limitar(v: Vista): Vista {
  const w = Math.min(LARGURA, Math.max(LARGURA / ZOOM_MAXIMO, v.w)), h = alturaDe({ ...v, w });
  return { w, x: Math.min(LARGURA - w / 2, Math.max(-w / 2, v.x)), y: Math.min(ALTURA - h / 2, Math.max(-h / 2, v.y)) };
}

/** Zoom mantendo o ponto (px, py) do desenho parado na tela. */
const ampliar = (v: Vista, fator: number, px = v.x + v.w / 2, py = v.y + alturaDe(v) / 2): Vista => {
  const w = v.w / fator;
  return limitar({ w, x: px - (px - v.x) * (w / v.w), y: py - (py - v.y) * (w / v.w) });
};

/** Desenho do percurso (projeção simples, suficiente para dezenas de km). */
function Tracado({ r, selecionados, atendimentos, foco }: {
  r: ResultadoKm; selecionados: ReadonlySet<string>; atendimentos: Atendimento[]; foco: Atendimento | null;
}) {
  const reduzir = useReducedMotion();
  const caixa = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [vista, setVista] = useState<Vista>(VISTA_INTEIRA);
  const [dica, setDica] = useState<{ x: number; y: number; p: PontoKm; status: string } | null>(null);
  const arrasto = useRef<{ id: number; cx: number; cy: number; v: Vista } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const k = LARGURA / vista.w;

  const geo = useMemo(() => {
    const latMedia = r.pontos.reduce((s, p) => s + p.lat, 0) / r.pontos.length;
    const kx = Math.cos((latMedia * Math.PI) / 180);
    const xs = r.pontos.map(p => p.lon * kx), ys = r.pontos.map(p => -p.lat);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const escala = Math.min((LARGURA - 2 * MARGEM) / Math.max(x1 - x0, 1e-4), (ALTURA - 2 * MARGEM) / Math.max(y1 - y0, 1e-4));
    const dx = (LARGURA - (x1 - x0) * escala) / 2, dy = (ALTURA - (y1 - y0) * escala) / 2;
    const proj = (p: { lat: number; lon: number }) => [dx + (p.lon * kx - x0) * escala, dy + (-p.lat - y0) * escala] as const;
    const pontos = r.pontos.map(proj);
    const caminho = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('');
    // Cada ponto descartado sai do último ponto bom antes dele: mostra o salto que teria entrado na conta.
    const saltos = r.descartados.map(d => {
      const antes = [...r.pontos].reverse().find(p => p.ts < d.ponto.ts) ?? r.pontos[0];
      return { de: proj(antes), ate: proj(d.ponto), d };
    });
    const statusDoPonto = new Map<PontoKm, string>();
    r.trechos.forEach(t => { statusDoPonto.set(t.de, t.status); statusDoPonto.set(t.ate, statusDoPonto.get(t.ate) ?? t.status); });
    return { proj, pontos, caminho, saltos, statusDoPonto, pxPorKm: escala / KM_POR_GRAU };
  }, [r]);

  // Trechos dos status marcados, juntando os consecutivos num traço só.
  const destaque = useMemo(() => {
    let d = '', aberto = false;
    r.trechos.forEach((t, i) => {
      if (!selecionados.has(t.status)) { aberto = false; return; }
      const [a, b] = [geo.pontos[i], geo.pontos[i + 1]];
      d += (aberto ? '' : `M${a[0].toFixed(2)} ${a[1].toFixed(2)}`) + `L${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
      aberto = true;
    });
    return d;
  }, [r, geo, selecionados]);

  // Rodinha do mouse: precisa de ouvinte não passivo para não rolar a página junto.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const ret = el.getBoundingClientRect();
      setVista(v => ampliar(v, e.deltaY < 0 ? 1.25 : 1 / 1.25,
        v.x + ((e.clientX - ret.left) / ret.width) * v.w, v.y + ((e.clientY - ret.top) / ret.height) * alturaDe(v)));
      setDica(null);
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  // Acionamento escolhido na tabela: enquadra o trecho dele; sem foco, volta ao dia inteiro.
  useEffect(() => {
    if (!foco) { setVista(VISTA_INTEIRA); return; }
    const idx = r.pontos.map((p, i) => [p, i] as const).filter(([p]) => p.ts >= foco.saida.ts && p.ts <= foco.fim.ts).map(([, i]) => i);
    const pts = (idx.length ? idx : [r.pontos.indexOf(foco.saida)]).map(i => geo.pontos[i]).filter(Boolean);
    if (!pts.length) return;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const w = Math.max((x1 - x0) * 1.5, (y1 - y0) * 1.5 * (LARGURA / ALTURA), LARGURA / 25);
    setVista(limitar({ w, x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - alturaDe({ x: 0, y: 0, w }) / 2 }));
    caixa.current?.scrollIntoView({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
  }, [foco, r, geo, reduzir]);

  function aoPressionar(e: EventoPonteiro<SVGSVGElement>) {
    if (e.button !== 0) return;
    arrasto.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, v: vista };
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastando(true); setDica(null);
  }
  function aoMover(e: EventoPonteiro<SVGSVGElement>) {
    const ret = e.currentTarget.getBoundingClientRect();
    const a = arrasto.current;
    if (a && a.id === e.pointerId) {
      setVista(limitar({ w: a.v.w, x: a.v.x - ((e.clientX - a.cx) / ret.width) * a.v.w, y: a.v.y - ((e.clientY - a.cy) / ret.height) * alturaDe(a.v) }));
      return;
    }
    if (e.pointerType !== 'mouse') return;
    // Dica do ponto mais próximo do cursor (até 14 px na tela).
    const mx = ((e.clientX - ret.left) / ret.width) * vista.w + vista.x, my = ((e.clientY - ret.top) / ret.height) * alturaDe(vista) + vista.y;
    let melhor = -1, dist = ((14 / ret.width) * vista.w) ** 2;
    geo.pontos.forEach(([x, y], i) => { const d = (x - mx) ** 2 + (y - my) ** 2; if (d < dist) { dist = d; melhor = i; } });
    if (melhor < 0) { setDica(null); return; }
    const [px, py] = geo.pontos[melhor], p = r.pontos[melhor];
    setDica({ x: ((px - vista.x) / vista.w) * 100, y: ((py - vista.y) / alturaDe(vista)) * 100, p, status: geo.statusDoPonto.get(p) ?? '' });
  }
  function aoSoltar(e: EventoPonteiro<SVGSVGElement>) {
    if (arrasto.current?.id === e.pointerId) { arrasto.current = null; setArrastando(false); }
  }

  // Régua de escala na tela: escolhe a distância redonda que ocupa pelo menos ~12% da largura.
  const pctPorKm = (geo.pxPorKm / vista.w) * 100;
  const kmRegua = ESCALAS.find(km => km * pctPorKm >= 12) ?? ESCALAS[ESCALAS.length - 1];
  const juntos = haversine(r.pontos[0], r.pontos[r.pontos.length - 1]) < 0.3;
  const [ini, fim] = [geo.pontos[0], geo.pontos[geo.pontos.length - 1]];
  const todosMarcados = r.trechos.every(t => selecionados.has(t.status));
  const botao = 'size-8 grid place-items-center rounded-lg bg-white/95 border border-linha text-tinta shadow-sm hover:border-sinal hover:text-sinal disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sinal';

  return (
    <figure className="m-0 lg:sticky lg:top-4">
      <div ref={caixa} className="relative rounded-xl bg-nevoa overflow-hidden select-none"
        style={{ backgroundImage: 'radial-gradient(circle, rgb(11 114 133 / 0.12) 1px, transparent 1.5px)', backgroundSize: '20px 20px' }}>
        <svg ref={svg} viewBox={`${vista.x} ${vista.y} ${vista.w} ${alturaDe(vista)}`} className={`w-full h-auto block ${arrastando ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ touchAction: k > 1.01 ? 'none' : 'pan-y' }} role="img"
          aria-label={`Traçado do percurso: ${r.pontos.length} posições consideradas e ${r.descartados.length} descartadas.`}
          onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} onPointerLeave={() => setDica(null)}>
          {geo.saltos.map(({ de, ate, d }) => (
            <g key={d.ponto.ts} className="text-erro-marca">
              <line x1={de[0]} y1={de[1]} x2={ate[0]} y2={ate[1]} stroke="currentColor" strokeWidth={1.5 / k} strokeDasharray={`${4 / k} ${4 / k}`} opacity="0.7" />
              <circle cx={ate[0]} cy={ate[1]} r={4 / k} fill="white" stroke="currentColor" strokeWidth={2 / k}>
                <title>{`${d.ponto.hora.slice(6)} · ${NOME_MOTIVO[d.motivo]}`}</title>
              </circle>
            </g>
          ))}
          <path d={geo.caminho} fill="none" stroke="white" strokeWidth={6 / k} strokeLinejoin="round" strokeLinecap="round" />
          {!todosMarcados && <path d={geo.caminho} fill="none" stroke="var(--color-aco-claro)" strokeWidth={2 / k} strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />}
          <motion.path d={destaque} fill="none" stroke="var(--color-sinal)" strokeWidth={2.5 / k} strokeLinejoin="round" strokeLinecap="round"
            initial={reduzir ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
          {atendimentos.map(a => {
            const [s, f] = [geo.proj(a.saida), geo.proj(a.fim)];
            const ativo = foco === a, raio = (ativo ? 9 : 7.5) / k;
            return (
              <g key={a.n} opacity={foco && !ativo ? 0.35 : 1}>
                {ativo && <line x1={s[0]} y1={s[1]} x2={f[0]} y2={f[1]} stroke="var(--color-cobre)" strokeWidth={2 / k} strokeDasharray={`${4 / k} ${3 / k}`} />}
                <MarcaAtendimento x={f[0]} y={f[1]} r={raio} k={k} n={a.n} cor={a.chegou ? 'var(--color-concluido-marca)' : 'var(--color-aco-claro)'}
                  titulo={`${a.n} · ${a.chegou ? 'Trabalhando' : nomeStatus(a.interrompidoPor)} às ${formatarHora(a.fim.ts)}`} />
                <MarcaAtendimento x={s[0]} y={s[1]} r={raio} k={k} n={a.n} cor="var(--color-cobre)" titulo={`${a.n} · A caminho às ${formatarHora(a.saida.ts)}`} />
              </g>
            );
          })}
          <circle cx={ini[0]} cy={ini[1]} r={6 / k} fill="var(--color-tinta)" stroke="white" strokeWidth={2.5 / k} />
          <circle cx={fim[0]} cy={fim[1]} r={(juntos ? 11 : 7) / k} fill="none" stroke="var(--color-tinta)" strokeWidth={2.5 / k} />
          {dica && <circle cx={vista.x + (dica.x / 100) * vista.w} cy={vista.y + (dica.y / 100) * alturaDe(vista)} r={5 / k} fill="white" stroke="var(--color-sinal)" strokeWidth={2.5 / k} pointerEvents="none" />}
        </svg>

        {dica && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-3 rounded-lg bg-noite text-white px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
            style={{ left: `${dica.x}%`, top: `${dica.y}%` }}>
            <span className="font-codigo font-bold">{dica.p.hora.slice(6, 11)}</span>
            <span className="text-white/70"> · {dica.p.vel} km/h{dica.status && ` · ${nomeStatus(dica.status)}`}</span>
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" aria-label="Aproximar" title="Aproximar" onClick={() => setVista(v => ampliar(v, 1.6))} disabled={k >= ZOOM_MAXIMO - 0.01} className={botao}><Plus size={16} /></button>
          <button type="button" aria-label="Afastar" title="Afastar" onClick={() => setVista(v => ampliar(v, 1 / 1.6))} disabled={k <= 1.001} className={botao}><Minus size={16} /></button>
          <button type="button" aria-label="Ver o dia inteiro" title="Ver o dia inteiro" onClick={() => setVista(VISTA_INTEIRA)} disabled={k <= 1.001} className={botao}><Maximize2 size={15} /></button>
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/90 px-2 pt-1 pb-1.5" style={{ width: `calc(${kmRegua * pctPorKm}% + 16px)` }}>
          <p className="text-[11px] font-semibold text-aco text-center leading-none mb-1 tabular-nums">{formatarKm(kmRegua, kmRegua < 1 ? 1 : 0)} km</p>
          <div className="h-1.5 border-x-2 border-b-2 border-aco" />
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 hidden sm:block text-[11px] text-aco/80">
          {k > 1.01 ? `${k.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× · arraste para mover` : 'Role ou use + para aproximar'}
        </p>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-aco">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-tinta" /> Início {formatarHora(r.pontos[0].ts)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-tinta" /> Fim {formatarHora(r.pontos[r.pontos.length - 1].ts)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-sinal" /> {todosMarcados ? 'Trajeto considerado' : 'Status marcados'}</span>
        {!todosMarcados && <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-aco-claro" /> Outros status</span>}
        {atendimentos.length > 0 && <>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-cobre" /> A caminho</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-concluido-marca" /> Trabalhando</span>
          {foco && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-cobre" /> Linha reta do acionamento {foco.n}</span>}
        </>}
        {r.descartados.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-erro-marca" /> Salto descartado</span>}
      </figcaption>
    </figure>
  );
}

function MarcaAtendimento({ x, y, r, k, n, cor, titulo }: { x: number; y: number; r: number; k: number; n: number; cor: string; titulo: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={cor} stroke="white" strokeWidth={1.75 / k}><title>{titulo}</title></circle>
      <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={9.5 / k} fontWeight="700" fill="white" pointerEvents="none">{n}</text>
    </g>
  );
}

// ─── Método ──────────────────────────────────────────────────────────────────

function ComoFunciona({ aberto = false }: { aberto?: boolean }) {
  const passos = [
    ['Junta os relatórios', 'Posições da mesma equipe e do mesmo dia entram num único percurso, em ordem de horário. Uma posição que aparece em dois relatórios conta uma vez só.'],
    ['Descarta os pontos falsos do GPS', `Posição presa: parada (0 km/h), na mesma coordenada exata ${REPETICOES_FANTASMA} ou mais vezes no dia e longe da rota (mais de ${SALTO_KM} km ou acima de ${VELOCIDADE_IMPOSSIVEL} km/h dos vizinhos). Vai e volta: o ponto sai da rota e o seguinte volta para perto do anterior, num salto impossível. Paradas reais, como a equipe na base, ficam.`],
    ['Soma a distância entre os pontos', 'Mede a linha reta entre cada posição e a seguinte pela fórmula de Haversine, a mesma dos GPS e do Google Maps, e soma tudo. Como a linha reta corta as curvas, o odômetro tende a marcar alguns por cento a mais.'],
    ['Aplica a cláusula 8.2.1', `Para caminhonete em dupla, o que passar de ${KM_LINEAR_FRANQUIA} km na jornada vale ${KM_LINEAR_FATOR_US.toLocaleString('pt-BR', { minimumFractionDigits: 6 })} US por km linear excedente. Você escolhe quais status da equipe entram nessa conta.`],
  ];
  return (
    <details open={aberto} className="group rounded-2xl bg-sinal-fundo/60 border border-sinal/10">
      <summary className="cursor-pointer list-none p-5 flex items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-sinal">
        <Info size={20} className="text-sinal shrink-0" />
        <span className="font-bold text-sm text-sinal flex-1">Como o cálculo é feito</span>
        <ChevronDown size={16} className="text-sinal transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <ol className="px-5 pb-5 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {passos.map(([titulo, texto], i) => (
          <li key={titulo} className="rounded-xl bg-white/70 p-4">
            <span className="text-xs font-codigo font-bold text-sinal bg-sinal-fundo rounded-lg size-7 inline-flex items-center justify-center">{i + 1}</span>
            <h4 className="font-bold text-sm mt-3">{titulo}</h4>
            <p className="text-sm text-aco leading-relaxed mt-1.5">{texto}</p>
          </li>
        ))}
      </ol>
      <p className="px-5 pb-5 -mt-1 text-xs text-aco leading-relaxed">
        Nenhuma estimativa é feita: o resultado sai só das coordenadas do relatório. Para conferir um trecho, abra o Google Maps, clique com o botão direito no primeiro ponto, escolha "Medir distância" e clique no segundo.
      </p>
    </details>
  );
}

// ─── Saídas ──────────────────────────────────────────────────────────────────

function resumoTexto(r: ResultadoKm, selecionados: ReadonlySet<string>): string {
  const inicio = r.pontos[0], fim = r.pontos[r.pontos.length - 1];
  const todos = selecionados.size === r.kmPorStatus.length;
  const c = kmLinearExcedente(kmDosStatus(r, selecionados));
  return [
    `Equipe ${r.agente} (${r.placa}) — ${formatarDia(r.dia)}, das ${formatarHora(inicio.ts)} às ${formatarHora(fim.ts)}`,
    `km rodados: ${formatarKm(r.kmLimpo)} km`,
    `Leitura bruta: ${formatarKm(r.kmBruto)} km, com ${r.descartados.length} ponto(s) falso(s) de GPS descartado(s) (− ${formatarKm(r.kmBruto - r.kmLimpo)} km)`,
    `Linha reta do primeiro ao último ponto: ${formatarKm(r.kmLinhaReta)} km`,
    `Km linear (cláusula 8.2.1, caminhonete em dupla): ${formatarKm(c.km)} km${todos ? '' : ` nos status ${[...selecionados].map(nomeStatus).join(', ')}`} − franquia ${KM_LINEAR_FRANQUIA} km = ${formatarKm(c.excedente)} km excedentes × ${KM_LINEAR_FATOR_US} = ${formatarUs(c.us)} US`,
    ...r.alertas.filter(a => a.tipo !== 'SALTO').map(a => `Atenção: ${a.texto}`),
    'Cálculo: soma da distância em linha reta (Haversine) entre posições consecutivas do rastreador. Central NEO › Ferramentas › Cálculo de KM.',
  ].join('\n');
}

async function baixarAuditoria(r: ResultadoKm, selecionados: ReadonlySet<string>) {
  const X = await import('xlsx');
  const wb = X.utils.book_new();
  const c = kmLinearExcedente(kmDosStatus(r, selecionados));
  const resumo = [
    { Item: 'Equipe', Valor: r.agente }, { Item: 'Placa', Valor: r.placa }, { Item: 'Dia', Valor: formatarDia(r.dia) },
    { Item: 'Relatórios', Valor: r.arquivos.join(', ') },
    { Item: 'Posições lidas', Valor: r.pontosLidos }, { Item: 'Posições descartadas', Valor: r.descartados.length },
    { Item: 'Leitura bruta (km)', Valor: +r.kmBruto.toFixed(3) },
    { Item: 'km rodados', Valor: +r.kmLimpo.toFixed(3) },
    { Item: 'Linha reta início → fim (km)', Valor: +r.kmLinhaReta.toFixed(3) },
    ...r.kmPorStatus.map(s => ({ Item: `km com status ${nomeStatus(s.status)}`, Valor: +s.km.toFixed(3) })),
    { Item: 'Status no km linear', Valor: [...selecionados].map(nomeStatus).join(', ') },
    { Item: 'Km linear considerado (km)', Valor: +c.km.toFixed(3) },
    { Item: `Franquia da jornada (km) — cláusula 8.2.1`, Valor: KM_LINEAR_FRANQUIA },
    { Item: 'Km linear excedente (km)', Valor: +c.excedente.toFixed(3) },
    { Item: `Fator (US por km excedente)`, Valor: KM_LINEAR_FATOR_US },
    { Item: 'Km linear excedente (US)', Valor: +c.us.toFixed(6) },
    ...r.alertas.map(a => ({ Item: 'Atenção', Valor: a.texto })),
  ];
  const abaResumo = X.utils.json_to_sheet(resumo);
  abaResumo['!cols'] = [{ wch: 40 }, { wch: 90 }];
  const abaPosicoes = X.utils.json_to_sheet(linhasAuditoria(r, selecionados));
  abaPosicoes['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 28 }, { wch: 11 }, { wch: 12 }, { wch: 13 }, { wch: 16 }, { wch: 18 }, { wch: 40 }];
  X.utils.book_append_sheet(wb, abaResumo, 'Resumo');
  X.utils.book_append_sheet(wb, abaPosicoes, 'Posições');
  if (r.atendimentos.length) {
    const abaAcion = X.utils.json_to_sheet(r.atendimentos.map(a => ({
      'Nº': a.n, 'A caminho': `${formatarDia(r.dia)} ${formatarHora(a.saida.ts)}`,
      'Encerrou': `${formatarDia(r.dia)} ${formatarHora(a.fim.ts)}`, 'Encerrou com': a.chegou ? 'Trabalhando' : nomeStatus(a.interrompidoPor),
      'Minutos': Math.round((a.fim.ts - a.saida.ts) / 60_000), 'km percorrido': +a.kmPercorrido.toFixed(3), 'Linha reta (km)': +a.kmLinhaReta.toFixed(3),
    })));
    abaAcion['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 9 }, { wch: 14 }, { wch: 15 }];
    X.utils.book_append_sheet(wb, abaAcion, 'Acionamentos (apoio)');
  }
  X.writeFile(wb, `km-equipe-${r.agente}-${r.placa}-${r.dia}.xlsx`);
}
