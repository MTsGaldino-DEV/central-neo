import { useId, useMemo, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, CopyCheck, Download, FileText, Info, Loader2, MapPin, Route, Truck, UploadCloud, X,
} from 'lucide-react';
import {
  calcular, formatarDia, formatarHora, formatarKm, haversine, linhasAuditoria, LIMITE_LINHAS, NOME_MOTIVO,
  REPETICOES_FANTASMA, SALTO_KM, VELOCIDADE_IMPOSSIVEL, type ResultadoKm, type RelatorioKm, type TipoAlerta,
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
  'Antes do primeiro status': 'var(--color-linha)',
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
  const kmFalsos = r.kmBruto - r.kmLimpo;
  const inicio = r.pontos[0], fim = r.pontos[r.pontos.length - 1];

  async function copiar() {
    try { await navigator.clipboard.writeText(resumoTexto(r)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setCopiado(false); }
  }
  async function baixar() {
    setBaixando(true);
    try { await baixarAuditoria(r); } finally { setBaixando(false); }
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
        <div className="p-5 lg:p-6 lg:border-r border-b lg:border-b-0 border-linha">
          <Tracado r={r} />
        </div>
        <div className="p-5 lg:p-6 flex flex-col gap-6">
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
          <PorStatus r={r} />
        </div>
      </div>

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
        <p className="text-xs text-aco max-w-lg leading-relaxed">A planilha traz todas as posições do dia, o km de cada trecho, o acumulado e o motivo de cada ponto descartado, para quem quiser refazer a conta.</p>
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

function PorStatus({ r }: { r: ResultadoKm }) {
  const total = r.kmPorStatus.reduce((s, x) => s + x.km, 0) || 1;
  const visiveis = r.kmPorStatus.filter(s => s.km >= 0.05);
  return (
    <div>
      <h4 className="text-sm font-bold mb-3">km por status da equipe</h4>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-nevoa" aria-hidden="true">
        {visiveis.map(s => <span key={s.status} style={{ width: `${(s.km / total) * 100}%`, background: corStatus(s.status) }} className="h-full first:rounded-l-full last:rounded-r-full border-r-2 border-white last:border-r-0" />)}
      </div>
      <ul className="mt-3 space-y-1.5">
        {visiveis.map(s => (
          <li key={s.status} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: corStatus(s.status) }} />
            <span className="flex-1 min-w-0 truncate">{nomeStatus(s.status)}</span>
            <span className="font-semibold tabular-nums">{formatarKm(s.km)} km</span>
            <span className="w-10 text-right text-xs text-aco tabular-nums">{Math.round((s.km / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-aco-claro mt-2.5 leading-relaxed">Cada trecho conta para o status que a equipe tinha marcado quando ele começou.</p>
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

// ─── Traçado ─────────────────────────────────────────────────────────────────

const LARGURA = 640, ALTURA = 400, MARGEM = 30;
const KM_POR_GRAU = 111.195;
const ESCALAS = [0.5, 1, 2, 5, 10, 20, 50, 100];

/** Desenho do percurso (projeção simples, suficiente para dezenas de km). Pontos descartados em vermelho. */
function Tracado({ r }: { r: ResultadoKm }) {
  const reduzir = useReducedMotion();
  const idGrade = 'grade' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const desenho = useMemo(() => {
    const latMedia = r.pontos.reduce((s, p) => s + p.lat, 0) / r.pontos.length;
    const kx = Math.cos((latMedia * Math.PI) / 180);
    const xs = r.pontos.map(p => p.lon * kx), ys = r.pontos.map(p => -p.lat);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const escala = Math.min((LARGURA - 2 * MARGEM) / Math.max(x1 - x0, 1e-4), (ALTURA - 2 * MARGEM) / Math.max(y1 - y0, 1e-4));
    const dx = (LARGURA - (x1 - x0) * escala) / 2, dy = (ALTURA - (y1 - y0) * escala) / 2;
    const proj = (p: { lat: number; lon: number }) => [dx + (p.lon * kx - x0) * escala, dy + (-p.lat - y0) * escala] as const;
    const caminho = r.pontos.map((p, i) => `${i ? 'L' : 'M'}${proj(p).map(n => n.toFixed(1)).join(' ')}`).join('');
    // Cada ponto descartado sai do último ponto bom antes dele: mostra o salto que teria entrado na conta.
    const saltos = r.descartados.map(d => {
      const antes = [...r.pontos].reverse().find(p => p.ts < d.ponto.ts) ?? r.pontos[0];
      return { de: proj(antes), ate: proj(d.ponto), d };
    });
    const pxPorKm = escala / KM_POR_GRAU;
    const km = ESCALAS.find(k => k * pxPorKm >= 70) ?? ESCALAS[ESCALAS.length - 1];
    return { caminho, saltos, inicio: proj(r.pontos[0]), fim: proj(r.pontos[r.pontos.length - 1]), barra: { km, px: km * pxPorKm } };
  }, [r]);

  const juntos = haversine(r.pontos[0], r.pontos[r.pontos.length - 1]) < 0.3;
  return (
    <figure className="m-0">
      <div className="relative rounded-xl bg-nevoa overflow-hidden">
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full h-auto block" role="img"
          aria-label={`Traçado do percurso: ${r.pontos.length} posições consideradas e ${r.descartados.length} descartadas.`}>
          <defs>
            <pattern id={idGrade} width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--color-sinal)" opacity="0.12" />
            </pattern>
          </defs>
          <rect width={LARGURA} height={ALTURA} fill={`url(#${idGrade})`} />
          {desenho.saltos.map(({ de, ate, d }) => (
            <g key={d.ponto.ts} className="text-erro-marca">
              <line x1={de[0]} y1={de[1]} x2={ate[0]} y2={ate[1]} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
              <circle cx={ate[0]} cy={ate[1]} r="4" fill="white" stroke="currentColor" strokeWidth="2">
                <title>{`${d.ponto.hora.slice(6)} · ${NOME_MOTIVO[d.motivo]}`}</title>
              </circle>
            </g>
          ))}
          <path d={desenho.caminho} fill="none" stroke="white" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
          <motion.path d={desenho.caminho} fill="none" stroke="var(--color-sinal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            initial={reduzir ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
          <circle cx={desenho.inicio[0]} cy={desenho.inicio[1]} r="7" fill="var(--color-concluido-marca)" stroke="white" strokeWidth="2.5" />
          <circle cx={desenho.fim[0]} cy={desenho.fim[1]} r={juntos ? 11 : 7} fill="none" stroke="var(--color-tinta)" strokeWidth="2.5" />
          <g transform={`translate(${LARGURA - MARGEM - desenho.barra.px} ${ALTURA - 16})`}>
            <rect x="-10" y="-24" width={desenho.barra.px + 20} height="34" rx="8" fill="white" opacity="0.85" />
            <line x1="0" x2={desenho.barra.px} y1="0" y2="0" stroke="var(--color-aco)" strokeWidth="2" />
            <line x1="0" x2="0" y1="-4" y2="4" stroke="var(--color-aco)" strokeWidth="2" />
            <line x1={desenho.barra.px} x2={desenho.barra.px} y1="-4" y2="4" stroke="var(--color-aco)" strokeWidth="2" />
            <text x={desenho.barra.px / 2} y="-8" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-aco)">{formatarKm(desenho.barra.km, desenho.barra.km < 1 ? 1 : 0)} km</text>
          </g>
        </svg>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-aco">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-concluido-marca" /> Início {formatarHora(r.pontos[0].ts)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-tinta" /> Fim {formatarHora(r.pontos[r.pontos.length - 1].ts)}</span>
        <span className="inline-flex items-center gap-1.5"><Route size={13} className="text-sinal" /> Trajeto considerado</span>
        {r.descartados.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-erro-marca" /> Salto descartado</span>}
      </figcaption>
    </figure>
  );
}

// ─── Método ──────────────────────────────────────────────────────────────────

function ComoFunciona({ aberto = false }: { aberto?: boolean }) {
  const passos = [
    ['Junta os relatórios', 'Posições da mesma equipe e do mesmo dia entram num único percurso, em ordem de horário. Uma posição que aparece em dois relatórios conta uma vez só.'],
    ['Descarta os pontos falsos do GPS', `Posição presa: parada (0 km/h), na mesma coordenada exata ${REPETICOES_FANTASMA} ou mais vezes no dia e longe da rota (mais de ${SALTO_KM} km ou acima de ${VELOCIDADE_IMPOSSIVEL} km/h dos vizinhos). Vai e volta: o ponto sai da rota e o seguinte volta para perto do anterior, num salto impossível. Paradas reais, como a equipe na base, ficam.`],
    ['Soma a distância entre os pontos', 'Mede a linha reta entre cada posição e a seguinte pela fórmula de Haversine, a mesma dos GPS e do Google Maps, e soma tudo. Como a linha reta corta as curvas, o odômetro tende a marcar alguns por cento a mais.'],
  ];
  return (
    <details open={aberto} className="group rounded-2xl bg-sinal-fundo/60 border border-sinal/10">
      <summary className="cursor-pointer list-none p-5 flex items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-sinal">
        <Info size={20} className="text-sinal shrink-0" />
        <span className="font-bold text-sm text-sinal flex-1">Como o cálculo é feito</span>
        <ChevronDown size={16} className="text-sinal transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <ol className="px-5 pb-5 grid md:grid-cols-3 gap-4">
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

function resumoTexto(r: ResultadoKm): string {
  const inicio = r.pontos[0], fim = r.pontos[r.pontos.length - 1];
  return [
    `Equipe ${r.agente} (${r.placa}) — ${formatarDia(r.dia)}, das ${formatarHora(inicio.ts)} às ${formatarHora(fim.ts)}`,
    `km rodados: ${formatarKm(r.kmLimpo)} km`,
    `Leitura bruta: ${formatarKm(r.kmBruto)} km, com ${r.descartados.length} ponto(s) falso(s) de GPS descartado(s) (− ${formatarKm(r.kmBruto - r.kmLimpo)} km)`,
    `Linha reta do primeiro ao último ponto: ${formatarKm(r.kmLinhaReta)} km`,
    ...r.alertas.filter(a => a.tipo !== 'SALTO').map(a => `Atenção: ${a.texto}`),
    'Cálculo: soma da distância em linha reta (Haversine) entre posições consecutivas do rastreador. Central NEO › Ferramentas › Cálculo de KM.',
  ].join('\n');
}

async function baixarAuditoria(r: ResultadoKm) {
  const X = await import('xlsx');
  const wb = X.utils.book_new();
  const resumo = [
    { Item: 'Equipe', Valor: r.agente }, { Item: 'Placa', Valor: r.placa }, { Item: 'Dia', Valor: formatarDia(r.dia) },
    { Item: 'Relatórios', Valor: r.arquivos.join(', ') },
    { Item: 'Posições lidas', Valor: r.pontosLidos }, { Item: 'Posições descartadas', Valor: r.descartados.length },
    { Item: 'Leitura bruta (km)', Valor: +r.kmBruto.toFixed(3) },
    { Item: 'km rodados', Valor: +r.kmLimpo.toFixed(3) },
    { Item: 'Linha reta início → fim (km)', Valor: +r.kmLinhaReta.toFixed(3) },
    ...r.kmPorStatus.map(s => ({ Item: `km com status ${s.status}`, Valor: +s.km.toFixed(3) })),
    ...r.alertas.map(a => ({ Item: 'Atenção', Valor: a.texto })),
  ];
  const abaResumo = X.utils.json_to_sheet(resumo);
  abaResumo['!cols'] = [{ wch: 30 }, { wch: 90 }];
  const abaPosicoes = X.utils.json_to_sheet(linhasAuditoria(r));
  abaPosicoes['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 28 }, { wch: 11 }, { wch: 12 }, { wch: 13 }, { wch: 40 }];
  X.utils.book_append_sheet(wb, abaResumo, 'Resumo');
  X.utils.book_append_sheet(wb, abaPosicoes, 'Posições');
  X.writeFile(wb, `km-equipe-${r.agente}-${r.placa}-${r.dia}.xlsx`);
}
