import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Loader2, Search } from 'lucide-react';
import { valoresColunaFat, type FiltrosListaFat } from '@/lib/faturamentoServicos';
import { lerNumeroBr, type ColunaConferencia } from '@/lib/filtrosConferencia';
import type { UnidadeFat } from '@/lib/faturamentoTexto';
import { traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { useFecharFora } from './SeletorPeriodo';
import { AvisoErro } from './AvisoErro';

const VAZIO = '—';
type Modo = 'maior' | 'menor' | 'entre';

/** Botão ▾ do cabeçalho com o menu do Excel: ordenar, pesquisar e marcar valores (ou faixa de números). */
export function FiltroColuna({ coluna, filtrosBase, selecionados, faixa, busca, ordem, ativo, alinharDireita, rotuloValor, unidade, taxa,
  onLista, onFaixa, onBusca, onOrdenar }: {
  coluna: ColunaConferencia; filtrosBase: FiltrosListaFat; ativo: boolean; alinharDireita?: boolean;
  selecionados?: string[]; faixa?: { min?: number; max?: number }; busca?: string | null; ordem: 'asc' | 'desc' | null;
  rotuloValor?: (v: string) => string; unidade: UnidadeFat; taxa: number | null;
  onLista?: (v: string[] | null) => void; onFaixa?: (min?: number, max?: number) => void; onBusca?: (q: string | null) => void;
  onOrdenar: (dir: 'asc' | 'desc') => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => setAberto(false), []);
  useFecharFora(caixa, aberto, fechar);
  const fator = coluna.numero && unidade === 'reais' && taxa ? taxa : 1;
  const textoOrdem = coluna.numero ? ['Do menor para o maior', 'Do maior para o menor'] : ['Ordenar de A a Z', 'Ordenar de Z a A'];

  return (
    <div ref={caixa} className="relative inline-flex">
      <button type="button" aria-label={`Filtrar ${coluna.rotulo}`} aria-haspopup="dialog" aria-expanded={aberto} onClick={() => setAberto(a => !a)}
        className={`ml-1.5 grid size-4 place-items-center rounded border ${ativo ? 'border-sinal bg-sinal text-white' : 'border-linha bg-white text-aco hover:border-sinal'}`}>
        <ChevronDown className="size-3" aria-hidden="true" />
      </button>
      {aberto && (
        <div role="dialog" aria-label={`Filtro de ${coluna.rotulo}`}
          className={`absolute top-6 z-40 w-64 rounded-xl border border-linha bg-white p-2 text-left text-xs font-semibold tracking-normal text-tinta normal-case shadow-xl ${alinharDireita ? 'right-0' : 'left-0'}`}>
          {[['asc', ArrowUpNarrowWide], ['desc', ArrowDownWideNarrow]].map(([dir, Icone], i) => {
            const I = Icone as typeof ArrowUpNarrowWide;
            return <button key={dir as string} type="button" onClick={() => { onOrdenar(dir as 'asc' | 'desc'); setAberto(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-nevoa ${ordem === dir ? 'text-sinal' : ''}`}>
              <I className="size-3.5" aria-hidden="true" />{textoOrdem[i]}</button>;
          })}
          <div className="my-1.5 border-t border-linha" />
          {coluna.lista && onLista && <Lista coluna={coluna} filtrosBase={filtrosBase} selecionados={selecionados} rotuloValor={rotuloValor}
            onAplicar={v => { onLista(v); setAberto(false); }} onCancelar={fechar} />}
          {coluna.faixa && onFaixa && <Faixa faixa={faixa} fator={fator} unidade={coluna.numero ? unidade : 'us'}
            onAplicar={(a, b) => { onFaixa(a, b); setAberto(false); }} onCancelar={fechar} />}
          {coluna.busca && onBusca && <Busca valor={busca ?? ''} onAplicar={q => { onBusca(q); setAberto(false); }} onCancelar={fechar} />}
        </div>
      )}
    </div>
  );
}

function Botoes({ onOk, onCancelar }: { onOk: () => void; onCancelar: () => void }) {
  return (
    <div className="mt-2 flex justify-end gap-1.5">
      <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-1.5 font-bold text-aco hover:bg-nevoa">Cancelar</button>
      <button type="button" onClick={onOk} className="rounded-lg bg-sinal px-3 py-1.5 font-bold text-white hover:bg-sinal-forte">OK</button>
    </div>
  );
}

function Lista({ coluna, filtrosBase, selecionados, rotuloValor, onAplicar, onCancelar }: {
  coluna: ColunaConferencia; filtrosBase: FiltrosListaFat; selecionados?: string[]; rotuloValor?: (v: string) => string;
  onAplicar: (v: string[] | null) => void; onCancelar: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [valores, setValores] = useState<{ valor: string; n: number }[] | null>(null);
  const [erro, setErro] = useState<ErroAmigavel | null>(null);
  // null = todos marcados (sem filtro)
  const [marcados, setMarcados] = useState<Set<string> | null>(selecionados?.length ? new Set(selecionados) : null);
  const chaveFiltros = JSON.stringify(filtrosBase);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      setErro(null);
      valoresColunaFat(filtrosBase, coluna.lista!.coluna, busca.trim() || undefined)
        .then(l => { if (vivo) setValores(l.map(x => ({ valor: x.valor ?? VAZIO, n: x.n }))); })
        .catch(e => { if (vivo) setErro(traduzirErro(e, `Conferência › filtro de ${coluna.rotulo}`)); });
    }, busca ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
    // filtrosBase muda de identidade a cada render; a chave em texto basta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFiltros, busca, coluna.lista?.coluna, coluna.rotulo]);
  const lista = valores ?? [];
  // Lista cortada (200 valores): desmarcar "de todos" esconderia quem não aparece; então marca-se só o que quer ver.
  const truncado = !busca && lista.length >= 200;
  const marcado = (v: string) => marcados ? marcados.has(v) : !truncado;
  const todos = truncado ? !marcados : lista.length > 0 && lista.every(x => marcado(x.valor));
  const alternar = (v: string) => setMarcados(m => {
    const n = new Set(m ?? (truncado ? [] : lista.map(x => x.valor)));
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  });
  const aplicar = () => {
    if (!marcados || (truncado && !marcados.size)) { onAplicar(null); return; }
    if (truncado) { onAplicar([...marcados]); return; }
    const escolhidos = busca ? lista.map(x => x.valor).filter(v => marcados.has(v)) : [...marcados];
    onAplicar(!busca && lista.length && lista.every(x => marcados.has(x.valor)) ? null : escolhidos);
  };
  const rotulo = (v: string) => v === VAZIO ? '(vazio)' : rotuloValor?.(v) ?? v;
  return (
    <div>
      <label className="flex items-center gap-1.5 rounded-lg border border-linha px-2 py-1.5 focus-within:border-sinal">
        <Search className="size-3.5 text-aco-claro" aria-hidden="true" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar" aria-label={`Pesquisar em ${coluna.rotulo}`}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none" />
      </label>
      {erro ? <div className="mt-2"><AvisoErro erro={erro} compacto /></div> : !valores ? (
        <p className="flex items-center gap-2 px-2 py-3 text-aco"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Buscando valores…</p>
      ) : (
        <div className="mt-1.5 max-h-56 overflow-auto">
          {truncado && <p className="px-2 pb-1 text-[11px] font-medium text-aco">Mostrando os 200 mais comuns. Marque os que quer ver ou pesquise.</p>}
          <label className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-nevoa">
            <input type="checkbox" checked={todos} onChange={() => setMarcados(todos ? new Set() : null)} className="accent-sinal" />(Selecionar tudo)
          </label>
          {lista.map(x => (
            <label key={x.valor} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-nevoa">
              <input type="checkbox" checked={marcado(x.valor)} onChange={() => alternar(x.valor)} className="accent-sinal" />
              <span className="min-w-0 flex-1 truncate">{rotulo(x.valor)}</span>
              <span className="font-codigo text-[11px] text-aco-claro">{x.n.toLocaleString('pt-BR')}</span>
            </label>
          ))}
          {!lista.length && <p className="px-2 py-3 text-aco">Nenhum valor.</p>}
        </div>
      )}
      <Botoes onOk={aplicar} onCancelar={onCancelar} />
    </div>
  );
}

function Faixa({ faixa, fator, unidade, onAplicar, onCancelar }: {
  faixa?: { min?: number; max?: number }; fator: number; unidade: UnidadeFat;
  onAplicar: (min?: number, max?: number) => void; onCancelar: () => void;
}) {
  const inicial: Modo = faixa?.min != null && faixa?.max != null ? 'entre' : faixa?.max != null ? 'menor' : 'maior';
  const [modo, setModo] = useState<Modo>(inicial);
  const mostrar = (n?: number) => n == null ? '' : String(+(n * fator).toFixed(fator === 1 ? 6 : 2)).replace('.', ',');
  const [a, setA] = useState(mostrar(modo === 'menor' ? faixa?.max : faixa?.min)), [b, setB] = useState(mostrar(faixa?.max));
  const ler = (s: string) => { const n = lerNumeroBr(s); return n == null ? undefined : n / fator; };
  const campo = 'w-full rounded-lg border border-linha px-2 py-1.5 font-codigo text-xs focus:border-sinal focus:outline-none';
  const sufixo = unidade === 'reais' ? 'em R$' : 'em US';
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1" role="group" aria-label="Tipo de filtro">
        {([['maior', 'maior que'], ['menor', 'menor que'], ['entre', 'entre']] as [Modo, string][]).map(([m, t]) => (
          <button key={m} type="button" onClick={() => setModo(m)} aria-pressed={modo === m}
            className={`flex-1 rounded-lg px-1.5 py-1 font-bold ${modo === m ? 'bg-sinal text-white' : 'bg-nevoa text-aco'}`}>{t}</button>
        ))}
      </div>
      <input value={a} onChange={e => setA(e.target.value)} inputMode="decimal" aria-label={`Valor ${sufixo}`} placeholder={sufixo} className={campo} />
      {modo === 'entre' && <input value={b} onChange={e => setB(e.target.value)} inputMode="decimal" aria-label={`Até ${sufixo}`} placeholder={`até, ${sufixo}`} className={campo} />}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onAplicar(undefined, undefined)} className="text-[11px] font-bold text-sinal hover:underline">Limpar</button>
        <Botoes onCancelar={onCancelar} onOk={() => modo === 'maior' ? onAplicar(ler(a), undefined) : modo === 'menor' ? onAplicar(undefined, ler(a)) : onAplicar(ler(a), ler(b))} />
      </div>
    </div>
  );
}

function Busca({ valor, onAplicar, onCancelar }: { valor: string; onAplicar: (q: string | null) => void; onCancelar: () => void }) {
  const [q, setQ] = useState(valor);
  return (
    <form onSubmit={e => { e.preventDefault(); onAplicar(q.trim() || null); }}>
      <label className="flex items-center gap-1.5 rounded-lg border border-linha px-2 py-1.5 focus-within:border-sinal">
        <Search className="size-3.5 text-aco-claro" aria-hidden="true" />
        <input value={q} onChange={e => setQ(e.target.value)} inputMode="numeric" placeholder="Parte do número" aria-label="Número do serviço"
          className="min-w-0 flex-1 bg-transparent font-codigo text-xs outline-none" />
      </label>
      <Botoes onCancelar={onCancelar} onOk={() => onAplicar(q.trim() || null)} />
    </form>
  );
}
