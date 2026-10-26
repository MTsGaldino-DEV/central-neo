import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { avaliarDocFat } from '@/lib/faturamentoServicos';
import { traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { AvisoErro } from '@/components/faturamento/AvisoErro';
import { PAGINAS_DOC, TEMA_ANTIGO, textoDoBloco, type BlocoDoc, type PaginaDoc } from './documentacaoPaginas';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** **negrito** → <b>; o resto é texto. */
const marcar = (t: string): ReactNode => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <b key={i} className="font-bold text-tinta">{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>);

function Bloco({ b }: { b: BlocoDoc }) {
  if (b.tipo === 'texto') return <p className="text-[15px] leading-relaxed text-tinta/90">{marcar(b.texto)}</p>;
  if (b.tipo === 'lista') return <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-tinta/90">{b.itens.map((x, i) => <li key={i}>{marcar(x)}</li>)}</ul>;
  if (b.tipo === 'nota' || b.tipo === 'importante') return (
    <div className={`rounded-r-xl border-l-4 px-4 py-3 text-sm leading-relaxed ${b.tipo === 'nota' ? 'border-sinal bg-sinal-fundo' : 'border-pendente-marca bg-pendente-fundo'}`}>
      <p className="mb-0.5 text-[11px] font-extrabold tracking-wide uppercase">{b.tipo === 'nota' ? 'Nota' : 'Importante'}</p>{marcar(b.texto)}
    </div>
  );
  if (b.tipo === 'tabela') return (
    <div className="overflow-x-auto rounded-xl border border-linha">
      <table className="w-full text-left text-sm">
        <thead className="bg-nevoa text-xs text-aco"><tr>{b.cabecalho.map(c => <th key={c} className="px-3 py-2 font-bold">{c}</th>)}</tr></thead>
        <tbody>{b.linhas.map((l, i) => <tr key={i} className="border-t border-linha align-top">{l.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? 'font-semibold whitespace-nowrap' : 'text-tinta/90'}`}>{marcar(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  if (b.tipo !== 'exemplo') return null;
  return (
    <div className="rounded-xl bg-noite px-4 py-3 font-codigo text-xs leading-relaxed text-linha">
      <p className="mb-1.5 font-sans text-[11px] font-extrabold tracking-wide text-sinal-claro uppercase">{b.titulo}</p>
      {b.linhas.map(([a, v], i) => <div key={i} className="flex justify-between gap-4 border-t border-white/5 py-1 first:border-0"><span>{a}</span><span className="text-white">{v}</span></div>)}
    </div>
  );
}

/** Documentação do Faturamento: uma página por aba, no layout dos guias do Mercado Livre. */
export default function Documentacao() {
  const { pagina: id } = useParams();
  const { hash } = useLocation();
  const navegar = useNavigate();
  const antigo = !id && hash ? TEMA_ANTIGO[hash.slice(1)] : undefined;
  const pagina = PAGINAS_DOC.find(p => p.id === id);
  const [busca, setBusca] = useState('');
  const [visivel, setVisivel] = useState<string | null>(null);
  const [avaliou, setAvaliou] = useState<string | null>(null), [erro, setErro] = useState<ErroAmigavel | null>(null);

  const resultados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (q.length < 2) return [];
    return PAGINAS_DOC.flatMap(p => p.secoes.filter(s => normalizar(`${p.titulo} ${s.titulo} ${s.blocos.map(textoDoBloco).join(' ')}`).includes(q)).map(s => ({ p, s }))).slice(0, 8);
  }, [busca]);

  useEffect(() => {
    if (!pagina) return;
    setAvaliou(null); setErro(null); setVisivel(pagina.secoes[0]?.id ?? null);
    const alvo = hash.slice(1);
    if (alvo) requestAnimationFrame(() => document.getElementById(alvo)?.scrollIntoView({ block: 'start' }));
    else window.scrollTo?.(0, 0);
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(es => { const e = es.find(x => x.isIntersecting); if (e) setVisivel(e.target.id); }, { rootMargin: '0px 0px -70% 0px' });
    pagina.secoes.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [pagina, hash]);

  if (antigo) return <Navigate to={`/faturamento/documentacao/${antigo[0]}${antigo[1] ? `#${antigo[1]}` : ''}`} replace />;
  if (!pagina) return <Navigate to="/faturamento/documentacao/visao-geral" replace />;

  const indice = PAGINAS_DOC.indexOf(pagina);
  const anterior = PAGINAS_DOC[indice - 1], proxima = PAGINAS_DOC[indice + 1];
  async function avaliar(util: boolean) {
    setErro(null);
    try { await avaliarDocFat(pagina!.id, util); setAvaliou(pagina!.id); }
    catch (e) { setErro(traduzirErro(e, 'Documentação › avaliar a página')); }
  }
  const grupos = ['Faturamento', 'Referência'] as const;

  return (
    <div className="min-h-full bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-linha px-4 py-3 lg:px-6">
        <Link to="/faturamento/documentacao/visao-geral" className="text-sm font-extrabold text-tinta">Documentação</Link>
        <span className="text-xs text-aco">Faturamento</span>
        <div className="relative ml-auto w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-aco-claro" aria-hidden="true" />
          <input type="search" role="searchbox" aria-label="Buscar na documentação" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na documentação"
            className="w-full rounded-xl border border-linha bg-white py-2 pr-3 pl-9 text-sm focus:border-sinal focus:outline-none" />
          {busca.trim().length >= 2 && (
            <ul role="listbox" aria-label="Resultados da busca" className="absolute right-0 left-0 z-30 mt-1 max-h-80 overflow-auto rounded-xl border border-linha bg-white p-1 shadow-lg">
              {resultados.map(({ p, s }) => (
                <li key={`${p.id}-${s.id}`} role="option" aria-selected={false}>
                  <button type="button" onClick={() => { setBusca(''); navegar(`/faturamento/documentacao/${p.id}#${s.id}`); }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-sinal-fundo">
                    <span className="font-bold text-tinta">{s.titulo}</span><span className="block text-xs text-aco">{p.titulo}</span>
                  </button>
                </li>
              ))}
              {!resultados.length && <li className="px-3 py-2 text-sm text-aco">Nada encontrado para "{busca}".</li>}
            </ul>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] lg:grid-cols-[220px_minmax(0,1fr)_190px]">
        <nav aria-label="Páginas da documentação" className="hidden border-r border-linha bg-nevoa/40 px-2.5 py-5 text-sm lg:block">
          {grupos.map(g => (
            <div key={g} className="mb-3">
              <p className="px-2.5 pb-1 text-[10.5px] font-extrabold tracking-wider text-aco-claro uppercase">{g}</p>
              {PAGINAS_DOC.filter(p => p.grupo === g).map(p => (
                <div key={p.id}>
                  <Link to={`/faturamento/documentacao/${p.id}`} aria-current={p.id === pagina.id ? 'page' : undefined}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${p.id === pagina.id ? 'bg-sinal-fundo font-extrabold text-sinal-forte shadow-[inset_3px_0_0_var(--color-sinal)]' : 'text-tinta/80 hover:bg-white'}`}>
                    {p.titulo}{p.id === pagina.id && <ChevronDown className="size-3.5" aria-hidden="true" />}
                  </Link>
                  {p.id === pagina.id && p.secoes.map(s => <a key={s.id} href={`#${s.id}`} className="block py-1 pr-2 pl-6 text-xs text-aco hover:text-sinal">{s.titulo}</a>)}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <main className="min-w-0 px-4 py-6 sm:px-8 lg:px-10">
          <label className="mb-4 block lg:hidden"><span className="sr-only">Escolher página</span>
            <select value={pagina.id} onChange={e => navegar(`/faturamento/documentacao/${e.target.value}`)} className="w-full rounded-xl border border-linha bg-white px-3 py-2 text-sm font-bold">
              {PAGINAS_DOC.map(p => <option key={p.id} value={p.id}>{p.grupo} · {p.titulo}</option>)}
            </select></label>
          <nav aria-label="Trilha" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-aco">
            <Link to="/faturamento/documentacao/visao-geral" className="hover:text-sinal">Documentação</Link><ChevronRight className="size-3" aria-hidden="true" />
            <span>{pagina.grupo}</span><ChevronRight className="size-3" aria-hidden="true" /><span className="font-bold text-sinal">{pagina.titulo}</span>
          </nav>
          <h1 className="text-3xl font-extrabold text-tinta">{pagina.titulo}</h1>
          <p className="mt-1 text-xs text-aco-claro">Última atualização em {pagina.atualizada}</p>
          <p className="mt-4 text-[15px] leading-relaxed text-tinta/90">{pagina.resumo}</p>
          {pagina.secoes.map(s => (
            <section key={s.id} id={s.id} className="mt-8 scroll-mt-4 space-y-3">
              <h2 className="text-lg font-extrabold text-tinta">{s.titulo}</h2>
              {s.blocos.map((b, i) => <Bloco key={i} b={b} />)}
            </section>
          ))}

          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-linha pt-5 text-sm text-aco">
            {avaliou === pagina.id ? <p className="font-semibold text-concluido">Obrigado!</p> : <>
              Esta página foi útil?
              <button type="button" onClick={() => void avaliar(true)} className="rounded-lg border border-linha px-3 py-1 font-bold text-tinta hover:border-sinal">Sim</button>
              <button type="button" onClick={() => void avaliar(false)} className="rounded-lg border border-linha px-3 py-1 font-bold text-tinta hover:border-sinal">Não</button>
            </>}
          </div>
          {erro && <div className="mt-2"><AvisoErro erro={erro} compacto /></div>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {anterior ? <Link to={`/faturamento/documentacao/${anterior.id}`} className="rounded-xl border border-linha px-4 py-3 hover:border-sinal">
              <span className="flex items-center gap-1 text-[11px] text-aco-claro"><ChevronLeft className="size-3" aria-hidden="true" />Anterior</span><span className="font-bold text-tinta">{anterior.titulo}</span></Link> : <span />}
            {proxima && <Link to={`/faturamento/documentacao/${proxima.id}`} className="rounded-xl border border-linha px-4 py-3 text-right hover:border-sinal">
              <span className="flex items-center justify-end gap-1 text-[11px] text-aco-claro">Próxima<ChevronRight className="size-3" aria-hidden="true" /></span><span className="font-bold text-tinta">{proxima.titulo}</span></Link>}
          </div>
        </main>

        <aside className="hidden border-l border-linha px-4 py-6 text-[13px] lg:block">
          <nav aria-label="Nesta página" className="sticky top-4">
            <p className="mb-2 text-[10.5px] font-extrabold tracking-wider text-aco-claro uppercase">Nesta página</p>
            {pagina.secoes.map(s => <a key={s.id} href={`#${s.id}`} className={`block border-l-2 py-1 pl-3 ${visivel === s.id ? 'border-sinal font-bold text-sinal' : 'border-linha text-aco hover:text-tinta'}`}>{s.titulo}</a>)}
          </nav>
        </aside>
      </div>
    </div>
  );
}

export type { PaginaDoc };
