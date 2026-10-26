import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { exportarNegociacaoFat, listarServicosFat, painelFat, type LadoFat, type LadoResumoFat, type ServicoFat } from '@/lib/faturamentoServicos';
import { fraseServico, MOTIVOS_FAT, SITUACOES_SERVICO_FAT, usFat } from '@/lib/faturamentoTexto';
import { TIPOS_TURMA_FAT } from '@/lib/faturamentoPlanilhas';
import { erroFat } from '@/lib/faturamento';
import { useDadosComCache } from '@/lib/useDadosComCache';
import { CabecalhoFatura } from '@/components/faturamento/CabecalhoFatura';
import { CarregandoNeo } from '@/components/faturamento/CarregandoNeo';
import { AjudaFat, RodapeFat } from '@/components/faturamento/AjudaFat';
import { Pagination } from '@/components/Pagination';
import { DetalheServico } from './DetalheServico';
import { SeloSituacao } from './SeloSituacao';

const POR_PAGINA = 50;
const numero = (n: number) => n.toLocaleString('pt-BR');
const equipe = (s: ServicoFat) => TIPOS_TURMA_FAT[s.tipo_turma ?? ''] ?? 'Equipe não identificada';
const corDiferenca = (d: number | null) => (d ?? 0) < 0 ? 'text-erro' : (d ?? 0) > 0 ? 'text-pendente' : 'text-concluido';
const comSinal = (d: number | null) => d == null ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${usFat(Math.abs(d))}`;
const motivosOrdenados = (l: LadoResumoFat) => Object.entries(l.por_motivo).sort((a, b) => b[1].us - a[1].us);

export default function Conferencia() {
  const [p, setP] = useSearchParams();
  const painel = useDadosComCache('painel', painelFat, []);
  const faturas = painel.dados ?? [];
  const param = p.get('fatura');
  // Uma fatura por vez: somar todas na hora estoura o tempo limite quando houver várias.
  const fatura = param && param !== 'todas' ? param : faturas[0]?.fatura ?? null;
  const pronto = (!!param && param !== 'todas') || painel.dados !== null;
  const totais = faturas.find(f => f.fatura === fatura);
  const visao = p.get('visao') === 'todos' ? 'todos' : 'negociar';
  const lado: Exclude<LadoFat, 'todos'> = p.get('lado') === 'a_mais' ? 'a_mais' : 'a_menos';
  const motivo = p.get('motivo') ?? '';
  const pagina = Math.max(Number(p.get('pagina')) || 1, 1);
  const filtrosTodos = ['situacao', 'tipo_turma', 'codserv', 'codigo_principal', 'cidade', 'q'] as const;
  const filtros: Record<string, string> = Object.fromEntries(Object.entries(visao === 'negociar'
    ? { fatura: fatura ?? '', lado, motivo }
    : { fatura: fatura ?? '', lado: 'todos', ...Object.fromEntries(filtrosTodos.map(k => [k, p.get(k) ?? ''])) }).filter(([, v]) => v));
  const chave = `servicos:${JSON.stringify(filtros)}:${visao === 'todos' ? pagina : 1}`;
  const lista = useDadosComCache(chave, () => listarServicosFat(filtros, visao === 'todos' ? pagina - 1 : 0, POR_PAGINA), [chave], pronto);
  const [mais, setMais] = useState<ServicoFat[]>([]), [carregandoMais, setCarregandoMais] = useState(false);
  const [aberto, setAberto] = useState<ServicoFat | null>(null);
  const [exportando, setExportando] = useState(false), [erroAcao, setErroAcao] = useState('');
  useEffect(() => { setMais([]); }, [chave]);

  const mudar = (n: Record<string, string | null>, manterPagina = false) => {
    const q = new URLSearchParams(p);
    for (const [k, v] of Object.entries(n)) if (v) q.set(k, v); else q.delete(k);
    if (!manterPagina) q.delete('pagina');
    setP(q, { replace: true });
  };
  const recarregar = () => { lista.recarregar(); painel.recarregar(); };
  async function carregarMais() {
    setCarregandoMais(true); setErroAcao('');
    try { const r = await listarServicosFat(filtros, (mais.length + POR_PAGINA) / POR_PAGINA, POR_PAGINA); setMais(m => [...m, ...r.servicos]); }
    catch (e) { setErroAcao(erroFat(e)); } finally { setCarregandoMais(false); }
  }
  async function exportar() {
    if (!fatura) return;
    setExportando(true); setErroAcao('');
    try { await exportarNegociacaoFat(fatura); } catch (e) { setErroAcao(erroFat(e)); } finally { setExportando(false); }
  }

  const r = lista.dados;
  const servicos = [...(r?.servicos ?? []), ...mais];
  const principal = r?.lados[lado], outro = r?.lados[lado === 'a_menos' ? 'a_mais' : 'a_menos'];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span />
        <AjudaFat tema="conferencia" />
      </div>
      <CabecalhoFatura rotulo="Conferência · valores em US" faturas={faturas.map(f => ({ id: f.fatura, inicio: f.inicio, fim: f.fim }))}
        fatura={fatura} periodo={totais ? { de: totais.inicio, ate: totais.fim } : { de: '', ate: '' }}
        salvoEm={lista.salvoEm} atualizando={lista.atualizando || painel.atualizando} onRecarregar={recarregar}
        permitirTodas={false} onFatura={id => mudar({ fatura: id, motivo: null })}
        onPeriodo={x => { const f = faturas.find(f => f.fim >= x.de && f.inicio <= x.ate); if (f) mudar({ fatura: f.fatura, motivo: null }); }}
        acoes={<>
          <button type="button" onClick={() => mudar(visao === 'todos' ? { visao: null, ...Object.fromEntries(filtrosTodos.map(k => [k, null])) } : { visao: 'todos' })}
            className="rounded-xl border border-linha px-3 py-2 text-xs font-bold text-tinta hover:border-sinal hover:text-sinal">
            {visao === 'todos' ? 'Voltar ao que foi pago errado' : 'Ver todos os serviços'}
          </button>
          <button type="button" onClick={() => void exportar()} disabled={!fatura || exportando} title={fatura ? undefined : 'Escolha uma fatura para exportar'}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sinal px-3 py-2 text-xs font-bold text-white hover:bg-sinal-forte disabled:opacity-60">
            {exportando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}Exportar para negociação
          </button>
        </>} />

      {(lista.erro || erroAcao) && <p role="alert" className="rounded-xl border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
        {lista.erro && r ? 'Não foi possível atualizar; mostrando os últimos dados vistos. ' : ''}{erroAcao || lista.erro}
        {lista.erro && <> <button type="button" onClick={recarregar} className="font-bold underline">Tentar de novo</button></>}
      </p>}

      {!r ? (!lista.erro && <CarregandoNeo variante="conferencia" />) : visao === 'negociar' && principal && outro ? (
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <section className={`rounded-2xl border-2 bg-white p-4 ${lado === 'a_menos' ? 'border-erro/60' : 'border-pendente/60'}`}>
            <p className={`text-[11px] font-bold tracking-wide uppercase ${lado === 'a_menos' ? 'text-erro' : 'text-pendente'}`}>{lado === 'a_menos' ? 'A receber · pagou a menos' : 'Pagou a mais'}</p>
            <p className={`font-codigo text-3xl font-extrabold ${lado === 'a_menos' ? 'text-erro' : 'text-pendente'}`}>{usFat(principal.us)} US</p>
            <p className="text-xs text-aco">em {numero(principal.servicos)} serviços · sem os já conferidos</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => mudar({ motivo: null })} aria-pressed={!motivo}
                className={`rounded-full px-3 py-1 text-xs font-bold ${!motivo ? 'bg-tinta text-white' : 'bg-nevoa text-aco hover:text-tinta'}`}>Todos {numero(principal.servicos)}</button>
              {motivosOrdenados(principal).map(([m, v]) => (
                <button key={m} type="button" onClick={() => mudar({ motivo: m })} aria-pressed={motivo === m}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${motivo === m ? 'bg-tinta text-white' : 'bg-nevoa text-aco hover:text-tinta'}`}>{MOTIVOS_FAT[m] ?? m} {numero(v.servicos)}</button>
              ))}
              {(totais?.funil.conferidos ?? 0) > 0 && <button type="button" onClick={() => mudar({ visao: 'todos', situacao: 'CONFERIDO' })}
                className="rounded-full border border-sinal/40 px-3 py-1 text-xs font-bold text-sinal hover:bg-sinal-fundo">Conferidos ({numero(totais!.funil.conferidos)})</button>}
            </div>
            {!servicos.length ? (
              <div className="py-10 text-center">
                <p className="text-base font-bold text-tinta">{lado === 'a_menos' ? 'Nada pago a menos nesta fatura. 🎉' : 'Nada pago a mais nesta fatura.'}</p>
                <button type="button" onClick={() => mudar({ visao: 'todos' })} className="mt-2 text-sm font-bold text-sinal hover:underline">ver todos os serviços</button>
              </div>
            ) : <>
              <ul className="mt-3 divide-y divide-linha">
                {servicos.map(s => (
                  <li key={`${s.fatura}-${s.numserv}`}>
                    <button type="button" onClick={() => setAberto(s)} className="w-full rounded-lg px-2 py-2.5 text-left hover:bg-nevoa focus-visible:outline-2 focus-visible:outline-sinal">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-xs text-aco"><b className="font-codigo text-sm text-tinta">{s.numserv}</b> · {s.codigo_principal ?? s.codigos[0]} · {equipe(s)} · {s.cidade ?? '—'}{!fatura && ` · fatura ${s.fatura}`}</span>
                        <b className={`font-codigo text-sm ${corDiferenca(s.diferenca)}`}>{comSinal(s.diferenca)}</b>
                      </span>
                      <span className="mt-0.5 block text-xs text-tinta">{fraseServico(s)}</span>
                      {s.revisao_desatualizada && <span className="mt-1 inline-block rounded bg-pendente-fundo px-1.5 text-[11px] text-pendente">conferência antiga: rever</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {servicos.length < r.total && <button type="button" onClick={() => void carregarMais()} disabled={carregandoMais}
                className="mt-2 w-full rounded-xl border border-linha py-2 text-sm font-bold text-sinal hover:bg-sinal-fundo disabled:opacity-60">
                {carregandoMais ? 'Carregando…' : `Carregar mais (${numero(r.total - servicos.length)} restantes)`}
              </button>}
            </>}
          </section>
          <aside className="h-fit rounded-2xl border border-linha bg-white p-4">
            <p className={`text-[11px] font-bold tracking-wide uppercase ${lado === 'a_menos' ? 'text-pendente' : 'text-erro'}`}>{lado === 'a_menos' ? 'Pagou a mais' : 'Pagou a menos'}</p>
            <p className="font-codigo text-xl font-extrabold text-tinta">{lado === 'a_menos' ? '+' : '−'}{usFat(outro.us)}</p>
            <p className="text-xs text-aco">{numero(outro.servicos)} serviços</p>
            <ul className="mt-3">
              {motivosOrdenados(outro).map(([m, v]) => (
                <li key={m}><button type="button" onClick={() => mudar({ lado: lado === 'a_menos' ? 'a_mais' : 'a_menos', motivo: m })}
                  className="flex w-full justify-between gap-2 border-t border-linha py-2 text-left text-xs hover:text-sinal">
                  <span>{MOTIVOS_FAT[m] ?? m} <small className="text-aco">{numero(v.servicos)}</small></span><b className="font-codigo">{usFat(v.us)}</b>
                </button></li>
              ))}
            </ul>
            <button type="button" onClick={() => mudar({ lado: lado === 'a_menos' ? 'a_mais' : null, motivo: null })} className="mt-2 text-xs font-bold text-sinal hover:underline">
              {lado === 'a_menos' ? 'ver o que foi pago a mais →' : '← voltar ao que foi pago a menos'}
            </button>
            {lado === 'a_menos' && <p className="mt-3 text-xs text-aco">Pode vir a ser cobrado pela CEMIG depois.</p>}
          </aside>
        </div>
      ) : <TodosServicos servicos={r.servicos} total={r.total} pagina={pagina} p={p} mudar={mudar} abrir={setAberto} variasFaturas={!fatura} />}

      {aberto && <DetalheServico servico={aberto} aberto onFechar={() => setAberto(null)} onAlterado={recarregar} />}
      <RodapeFat />
    </div>
  );
}

function TodosServicos({ servicos, total, pagina, p, mudar, abrir, variasFaturas }: {
  servicos: ServicoFat[]; total: number; pagina: number; p: URLSearchParams; variasFaturas: boolean;
  mudar: (n: Record<string, string | null>, manterPagina?: boolean) => void; abrir: (s: ServicoFat) => void;
}) {
  const [texto, setTexto] = useState({ codserv: p.get('codserv') ?? '', cidade: p.get('cidade') ?? '', q: p.get('q') ?? '' });
  const aplicar = (e: FormEvent) => { e.preventDefault(); mudar(texto); };
  const campo = 'mt-1 block w-full rounded-lg border border-linha bg-white px-2 py-1.5 text-sm focus:border-sinal focus:outline-none';
  return (
    <section className="rounded-2xl border border-linha bg-white">
      <form onSubmit={aplicar} className="grid gap-2 border-b border-linha p-3 sm:grid-cols-3 lg:grid-cols-[repeat(5,1fr)_auto] lg:items-end">
        <label className="text-xs font-bold text-aco">Situação
          <select value={p.get('situacao') ?? ''} onChange={e => mudar({ situacao: e.target.value })} className={campo}>
            <option value="">Todas</option>{Object.entries(SITUACOES_SERVICO_FAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="text-xs font-bold text-aco">Equipe
          <select value={p.get('tipo_turma') ?? ''} onChange={e => mudar({ tipo_turma: e.target.value })} className={campo}>
            <option value="">Todas</option>{Object.entries(TIPOS_TURMA_FAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="text-xs font-bold text-aco">Código<input value={texto.codserv} onChange={e => setTexto(t => ({ ...t, codserv: e.target.value }))} placeholder="ex.: 7.15" className={campo} /></label>
        <label className="text-xs font-bold text-aco">Cidade<input value={texto.cidade} onChange={e => setTexto(t => ({ ...t, cidade: e.target.value }))} className={campo} /></label>
        <label className="text-xs font-bold text-aco">Número do serviço<input value={texto.q} onChange={e => setTexto(t => ({ ...t, q: e.target.value }))} inputMode="numeric" className={campo} /></label>
        <button type="submit" className="rounded-lg bg-sinal px-4 py-2 text-sm font-bold text-white hover:bg-sinal-forte">Filtrar</button>
      </form>
      {!servicos.length ? <p className="px-4 py-10 text-center text-sm text-aco">Nenhum serviço com esses filtros.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-[11px] text-aco uppercase"><tr>
              <th className="px-3 py-2">Serviço</th><th className="px-2">Equipe / frota</th><th className="px-2">Códigos</th>
              <th className="px-2 text-right">Deveria</th><th className="px-2 text-right">Pagou</th><th className="px-2 text-right">Diferença</th><th className="px-3">Situação</th>
            </tr></thead>
            <tbody>{servicos.map(s => (
              <tr key={`${s.fatura}-${s.numserv}`} onClick={() => abrir(s)} className="cursor-pointer border-t border-linha hover:bg-nevoa">
                <td className="px-3 py-2"><button type="button" onClick={e => { e.stopPropagation(); abrir(s); }} className="font-codigo font-bold text-tinta hover:text-sinal">{s.numserv}</button>{variasFaturas && <span className="block text-[11px] text-aco">fatura {s.fatura}</span>}</td>
                <td className="px-2">{equipe(s)}<span className="block font-codigo text-[11px] text-aco">{s.numvei ?? '—'}</span></td>
                <td className="px-2 font-codigo">{s.codigos.join(', ')}</td>
                <td className="px-2 text-right font-codigo">{usFat(s.devido)}</td>
                <td className="px-2 text-right font-codigo">{usFat(s.pago_comparado)}</td>
                <td className={`px-2 text-right font-codigo font-bold ${corDiferenca(s.bate ? 0 : s.diferenca)}`}>{s.bate ? '—' : comSinal(s.diferenca)}</td>
                <td className="px-3"><SeloSituacao situacao={s.situacao} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Pagination page={pagina} totalPages={Math.ceil(total / POR_PAGINA)} totalItems={total} pageSize={POR_PAGINA} label="serviços"
        onPageChange={n => mudar({ pagina: n > 1 ? String(n) : null }, true)} />
    </section>
  );
}
