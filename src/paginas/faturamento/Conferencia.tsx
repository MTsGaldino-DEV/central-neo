import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RotateCw, X } from 'lucide-react';
import { exportarListaFat, exportarNegociacaoFat, listarServicosFat, painelFat, type ServicoFat } from '@/lib/faturamentoServicos';
import { MOTIVOS_FAT, SITUACOES_SERVICO_FAT, valorFat } from '@/lib/faturamentoTexto';
import { TIPOS_TURMA_FAT } from '@/lib/faturamentoPlanilhas';
import { traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { useDadosComCache } from '@/lib/useDadosComCache';
import { useUnidadeFat } from '@/lib/useUnidadeFat';
import { tempoRelativo } from '@/lib/cacheTela';
import { COLUNAS_CONFERENCIA, estadoDaUrl, filtrosAtivos, filtrosDoEstado, urlDoEstado, type AtalhoConferencia, type BotaoFat,
  type ChaveListaFat, type ColunaConferencia, type EstadoConferencia } from '@/lib/filtrosConferencia';
import { rotuloPeriodo } from '@/components/faturamento/SeletorPeriodo';
import { PilulasPeriodo } from '@/components/faturamento/PilulasPeriodo';
import { ChaveUnidade } from '@/components/faturamento/ChaveUnidade';
import { FiltroColuna } from '@/components/faturamento/FiltroColuna';
import { AvisoErro } from '@/components/faturamento/AvisoErro';
import { CarregandoNeo } from '@/components/faturamento/CarregandoNeo';
import { AjudaFat, RodapeFat } from '@/components/faturamento/AjudaFat';
import { Pagination } from '@/components/Pagination';
import { DetalheServico } from './DetalheServico';
import { SeloSituacao } from './SeloSituacao';

const POR_PAGINA = 50;
const numero = (n: number) => n.toLocaleString('pt-BR');
const ROTULO_ATALHO: Record<AtalhoConferencia, string> = {
  todos: 'Todos', a_menos: 'Pagou a menos', a_mais: 'Pagou a mais', fora: 'Fora do contrato', confere: 'Conferem', conferidos: 'Conferidos',
};
const BOTOES: { id: BotaoFat; sim: string; nao: string }[] = [
  { id: 'tem_1ns', sim: 'Contém 1.NS', nao: 'Sem 1.NS' }, { id: 'multado', sim: 'Multado', nao: 'Sem multa' }, { id: 'tem_562', sim: '5.62', nao: 'Sem 5.62' },
];
const rotuloValor: Partial<Record<ChaveListaFat, (v: string) => string>> = {
  situacoes: v => SITUACOES_SERVICO_FAT[v] ?? v, tipos_turma: v => TIPOS_TURMA_FAT[v] ?? v, motivos: v => MOTIVOS_FAT[v] ?? v,
};

export default function Conferencia() {
  const [p, setP] = useSearchParams();
  const painel = useDadosComCache('painel', painelFat, [], true, 'Conferência › totais da fatura');
  const faturas = painel.dados ?? [];
  const e = estadoDaUrl(p);
  // Uma fatura por vez: somar todas na hora estoura o tempo limite quando houver várias.
  const fatura = e.fatura ?? faturas[0]?.fatura ?? null;
  const pronto = !!e.fatura || painel.dados !== null;
  const filtros = filtrosDoEstado({ ...e, fatura });
  const chave = `conferencia:${JSON.stringify(filtros)}:${e.pagina}`;
  const lista = useDadosComCache(chave, () => listarServicosFat(filtros, e.pagina - 1, POR_PAGINA), [chave], pronto && !!fatura,
    'Conferência › lista de serviços › buscar no banco');
  const { unidade, taxa, mudar: mudarUnidade } = useUnidadeFat();
  const totais = faturas.find(f => f.fatura === fatura);
  const [aberto, setAberto] = useState<ServicoFat | null>(null);
  const [exportando, setExportando] = useState<'' | 'lista' | 'negociacao'>(''), [erroAcao, setErroAcao] = useState<ErroAmigavel | null>(null);

  const ir = (n: Partial<EstadoConferencia>) => setP(urlDoEstado({ ...e, pagina: 1, ...n }, p), { replace: true });
  const recarregar = () => { lista.recarregar(); painel.recarregar(); };
  async function exportar(tipo: 'lista' | 'negociacao') {
    if (!fatura) return;
    setExportando(tipo); setErroAcao(null);
    try { await (tipo === 'lista' ? exportarListaFat(filtros, fatura) : exportarNegociacaoFat(fatura)); }
    catch (x) { setErroAcao(traduzirErro(x, `Conferência › exportar ${tipo === 'lista' ? 'para Excel' : 'para negociação'}`)); }
    finally { setExportando(''); }
  }

  const r = lista.dados;
  const servicos = r?.servicos ?? [];
  const contagem: Record<AtalhoConferencia, number | undefined> = {
    todos: totais?.servicos, a_menos: totais?.a_menos.servicos, a_mais: totais?.a_mais.servicos,
    fora: totais?.fora_contrato, confere: totais?.funil.valor_confere, conferidos: totais?.funil.conferidos,
  };
  const ladoTotal = e.atalho === 'a_menos' ? r && -r.lados.a_menos.us : e.atalho === 'a_mais' ? r?.lados.a_mais.us : null;
  const etiquetas = [
    ...COLUNAS_CONFERENCIA.flatMap(c => {
      const sel = c.lista && e.listas[c.lista.chave];
      if (sel?.length) return [{ id: c.rotulo, texto: `${c.rotulo}: ${sel.map(v => v === '—' ? '(vazio)' : rotuloValor[c.lista!.chave]?.(v) ?? v).join(', ')}`,
        limpar: () => { const l = { ...e.listas }; delete l[c.lista!.chave]; ir({ listas: l }); } }];
      const mn = c.faixa && e.faixas[`${c.faixa}_min`], mx = c.faixa && e.faixas[`${c.faixa}_max`];
      if (c.faixa && (mn != null || mx != null)) return [{ id: c.rotulo,
        texto: `${c.rotulo}: ${mn != null && mx != null ? `entre ${valorFat(mn, unidade, taxa)} e ${valorFat(mx, unidade, taxa)}` : mn != null ? `maior que ${valorFat(mn, unidade, taxa)}` : `menor que ${valorFat(mx!, unidade, taxa)}`}`,
        limpar: () => { const f = { ...e.faixas }; delete f[`${c.faixa!}_min`]; delete f[`${c.faixa!}_max`]; ir({ faixas: f }); } }];
      return [];
    }),
    ...(e.q ? [{ id: 'Nº serviço', texto: `Nº serviço contém ${e.q}`, limpar: () => ir({ q: null }) }] : []),
    ...(e.principal ? [{ id: 'Código principal', texto: `Código principal: ${e.principal}`, limpar: () => ir({ principal: null }) }] : []),
  ];
  const semFiltros = !filtrosAtivos(e);

  return (
    <div className="mx-auto max-w-[1400px] space-y-3 p-4 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h1 className="text-xl font-extrabold text-tinta sm:text-2xl">Conferência</h1><AjudaFat tema="conferencia" /></div>
          <p className="text-sm text-aco">{fatura ? `Fatura ${fatura}` : 'Nenhuma fatura'}{totais ? ` · ${rotuloPeriodo({ de: totais.inicio, ate: totais.fim })}` : ''}
            {taxa ? ` · 1 US = ${taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PilulasPeriodo soFatura faturas={faturas.map(f => ({ id: f.fatura, inicio: f.inicio, fim: f.fim }))} fatura={fatura}
            periodo={{ de: '', ate: '' }} referencia="" onPeriodo={() => {}} onFatura={id => ir({ fatura: id })} />
          <ChaveUnidade unidade={unidade} taxa={taxa} mudar={mudarUnidade} mostrarTaxa={false} />
          <button type="button" onClick={() => void exportar('lista')} disabled={!fatura || !!exportando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-2 text-xs font-bold text-tinta hover:border-sinal hover:text-sinal disabled:opacity-60">
            {exportando === 'lista' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="size-4" aria-hidden="true" />}Exportar para Excel
          </button>
          <button type="button" onClick={() => void exportar('negociacao')} disabled={!fatura || !!exportando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sinal px-3 py-2 text-xs font-bold text-white hover:bg-sinal-forte disabled:opacity-60">
            {exportando === 'negociacao' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}Exportar para negociação
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {(['todos', 'a_menos', 'a_mais', 'fora', 'confere', 'conferidos'] as AtalhoConferencia[]).map(a => (
          <button key={a} type="button" aria-pressed={e.atalho === a} onClick={() => ir({ atalho: a })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${e.atalho === a ? 'border-sinal bg-sinal text-white' : 'border-linha bg-white text-tinta hover:border-sinal'}`}>
            {ROTULO_ATALHO[a]}{contagem[a] != null && <span className="font-codigo text-[11px] opacity-75">{numero(contagem[a]!)}</span>}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-linha" aria-hidden="true" />
        {BOTOES.map(b => {
          const v = e.botoes[b.id];
          return (
            <button key={b.id} type="button" aria-pressed={!!v} title="Clique para alternar: contém, não contém, tanto faz"
              onClick={() => ir({ botoes: { ...e.botoes, [b.id]: v === 'sim' ? 'nao' : v === 'nao' ? undefined : 'sim' } })}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${v ? 'border-solid border-revisao bg-revisao-fundo text-revisao' : 'border-dashed border-aco-claro bg-white text-aco hover:text-tinta'}`}>
              {v === 'nao' ? b.nao : b.sim}
            </button>
          );
        })}
      </div>

      {(etiquetas.length > 0 || !semFiltros) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-aco">Filtros:</span>
          {etiquetas.map(x => (
            <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-sinal-fundo py-0.5 pr-1 pl-2.5 text-xs font-semibold text-sinal-forte">
              {x.texto}
              <button type="button" onClick={x.limpar} aria-label={`Remover filtro ${x.id}`} className="rounded-full p-0.5 hover:bg-white/70"><X className="size-3" aria-hidden="true" /></button>
            </span>
          ))}
          <button type="button" onClick={() => ir({ listas: {}, botoes: {}, faixas: {}, q: null, principal: null })} className="text-xs font-bold text-sinal hover:underline">Limpar todos</button>
        </div>
      )}

      {lista.falha && <AvisoErro erro={lista.falha} onTentar={recarregar} contexto={r ? 'Mostrando os últimos dados vistos.' : undefined} />}
      {erroAcao && <AvisoErro erro={erroAcao} />}

      <section className="rounded-2xl border border-linha bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha px-4 py-2.5 text-xs text-aco">
          <span>{r ? <><b className="text-tinta">{numero(r.total)}</b> serviços{ladoTotal != null && <> · diferença <b className={`font-codigo ${e.atalho === 'a_menos' ? 'text-erro' : 'text-concluido'}`}>{valorFat(ladoTotal, unidade, taxa, true)}</b></>}</> : 'Carregando…'}</span>
          <button type="button" onClick={recarregar} disabled={lista.atualizando} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-nevoa disabled:opacity-70">
            {lista.atualizando ? 'atualizando…' : lista.salvoEm ? `atualizado ${tempoRelativo(lista.salvoEm)}` : 'atualizar'}
            <RotateCw className={`size-3.5 ${lista.atualizando ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          </button>
        </div>
        {!r && !lista.falha ? <CarregandoNeo variante="conferencia" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-xs">
              <thead><tr>
                {COLUNAS_CONFERENCIA.map((c, i) => (
                  <Cabecalho key={c.id} coluna={c} e={e} filtros={filtros} ir={ir} unidade={unidade} taxa={taxa} direita={i >= COLUNAS_CONFERENCIA.length - 4} />
                ))}
              </tr></thead>
              <tbody>{servicos.map(s => <Linha key={`${s.fatura}-${s.numserv}`} s={s} unidade={unidade} taxa={taxa} abrir={() => setAberto(s)} />)}</tbody>
            </table>
            {r && !servicos.length && <p className="px-4 py-10 text-center text-sm text-aco">
              {e.atalho === 'a_menos' && semFiltros ? 'Nada pago a menos nesta fatura.' : 'Nenhum serviço com esses filtros.'}</p>}
          </div>
        )}
        {r && r.total > POR_PAGINA && <Pagination page={e.pagina} totalPages={Math.ceil(r.total / POR_PAGINA)} totalItems={r.total} pageSize={POR_PAGINA} label="serviços"
          onPageChange={n => setP(urlDoEstado({ ...e, pagina: n }, p), { replace: true })} />}
      </section>

      {aberto && <DetalheServico servico={aberto} aberto onFechar={() => setAberto(null)} onAlterado={recarregar} />}
      <RodapeFat />
    </div>
  );
}

function Cabecalho({ coluna: c, e, filtros, ir, unidade, taxa, direita }: {
  coluna: ColunaConferencia; e: EstadoConferencia; filtros: ReturnType<typeof filtrosDoEstado>;
  ir: (n: Partial<EstadoConferencia>) => void; unidade: 'reais' | 'us'; taxa: number | null; direita: boolean;
}) {
  const sel = c.lista ? e.listas[c.lista.chave] : undefined;
  const faixa = c.faixa ? { min: e.faixas[`${c.faixa}_min`], max: e.faixas[`${c.faixa}_max`] } : undefined;
  const ativo = !!sel?.length || (faixa && (faixa.min != null || faixa.max != null)) || (c.busca && !!e.q);
  return (
    <th scope="col" className={`sticky top-0 border-r border-b border-linha bg-nevoa/70 px-2.5 py-2 text-[11px] font-extrabold tracking-wide whitespace-nowrap text-aco uppercase last:border-r-0 ${c.numero ? 'text-right' : ''}`}>
      <span className="inline-flex items-center">{c.rotulo}
        <FiltroColuna coluna={c} filtrosBase={filtros} ativo={!!ativo} alinharDireita={direita} unidade={unidade} taxa={taxa}
          selecionados={sel} faixa={faixa} busca={e.q} ordem={e.ordem?.coluna === c.id ? e.ordem.dir : null}
          rotuloValor={c.lista ? rotuloValor[c.lista.chave] : undefined}
          onOrdenar={dir => ir({ ordem: { coluna: c.id, dir } })}
          onLista={c.lista ? v => { const l = { ...e.listas }; if (v) l[c.lista!.chave] = v; else delete l[c.lista!.chave]; ir({ listas: l }); } : undefined}
          onFaixa={c.faixa ? (mn, mx) => { const f = { ...e.faixas }; delete f[`${c.faixa!}_min`]; delete f[`${c.faixa!}_max`];
            if (mn != null) f[`${c.faixa!}_min`] = mn; if (mx != null) f[`${c.faixa!}_max`] = mx; ir({ faixas: f }); } : undefined}
          onBusca={c.busca ? q => ir({ q }) : undefined} />
      </span>
    </th>
  );
}

function Linha({ s, unidade, taxa, abrir }: { s: ServicoFat; unidade: 'reais' | 'us'; taxa: number | null; abrir: () => void }) {
  const fundo = s.situacao === 'A_MENOS' ? 'bg-erro-fundo/60' : s.situacao === 'A_MAIS' ? 'bg-concluido-fundo/60' : '';
  const td = 'border-b border-linha/70 px-2.5 py-2';
  const num = `${td} text-right font-codigo whitespace-nowrap`;
  const v = (n: number | null) => valorFat(n, unidade, taxa);
  return (
    <tr onClick={abrir} className={`cursor-pointer hover:brightness-[0.97] ${fundo}`}>
      <td className={td}><SeloSituacao situacao={s.situacao} />{s.revisao_desatualizada && <span className="mt-1 block text-[10px] font-bold text-pendente">conferência antiga: rever</span>}</td>
      <td className={td}><button type="button" aria-label={`Abrir serviço ${s.numserv}`} onClick={x => { x.stopPropagation(); abrir(); }}
        className="font-codigo font-bold text-tinta hover:text-sinal focus-visible:outline-2 focus-visible:outline-sinal">{s.numserv}</button></td>
      <td className={td}>{s.tipo_serv}</td>
      <td className={td}><span className="flex flex-wrap items-center gap-1">
        {s.codigos.map(c => <span key={c} className={`rounded px-1.5 font-codigo text-[11px] ${c === '1.NS' ? 'bg-revisao-fundo font-bold text-revisao' : c === '5.62' ? 'bg-cobre-fundo font-bold text-cobre' : 'bg-nevoa text-tinta'}`}>{c}</span>)}
        {s.tem_1ns && !s.na_manutencao && <span title="Tem 1.NS e não foi encontrado na Manutenção" role="img" aria-label="Tem 1.NS e não foi encontrado na Manutenção">
          <AlertTriangle className="size-3.5 text-revisao" aria-hidden="true" /></span>}
      </span></td>
      <td className={`${td} font-codigo`}>{s.numvei ?? '—'}</td>
      <td className={td}>{TIPOS_TURMA_FAT[s.tipo_turma ?? ''] ?? '—'}</td>
      <td className={td}>{s.cidade ?? '—'}</td>
      <td className={num}>{v(s.pago_comparado)}</td>
      <td className={num}>{v(s.devido)}</td>
      <td className={`${num} font-bold ${(s.diferenca ?? 0) < 0 && !s.bate ? 'text-erro' : (s.diferenca ?? 0) > 0 && !s.bate ? 'text-concluido' : 'text-aco'}`}>{s.bate || s.diferenca == null ? '—' : valorFat(s.diferenca, unidade, taxa, true)}</td>
      <td className={num}>{s.multas ? v(s.multas) : '—'}</td>
      <td className={td}>{MOTIVOS_FAT[s.motivo ?? ''] ?? '—'}</td>
    </tr>
  );
}
