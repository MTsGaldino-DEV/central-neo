import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { painelFat, type GrupoTotaisFat, type TotaisFat } from '@/lib/faturamentoServicos';
import { somarTotais, valorFat, type UnidadeFat } from '@/lib/faturamentoTexto';
import { TIPOS_TURMA_FAT } from '@/lib/faturamentoPlanilhas';
import { useDadosComCache } from '@/lib/useDadosComCache';
import { tempoRelativo } from '@/lib/cacheTela';
import { useUnidadeFat } from '@/lib/useUnidadeFat';
import { PilulasPeriodo } from '@/components/faturamento/PilulasPeriodo';
import { ChaveUnidade } from '@/components/faturamento/ChaveUnidade';
import { CardsLados } from '@/components/faturamento/CardsLados';
import { AvisoErro } from '@/components/faturamento/AvisoErro';
import { atalhoPeriodo, rotuloPeriodo, type PeriodoFat } from '@/components/faturamento/SeletorPeriodo';
import { CarregandoNeo } from '@/components/faturamento/CarregandoNeo';
import { FunilConferencia } from '@/components/faturamento/FunilConferencia';
import { GraficoFaturas, itemGraficoFat } from '@/components/faturamento/GraficoFaturas';
import { AjudaFat, RodapeFat } from '@/components/faturamento/AjudaFat';

const numero = (n: number) => n.toLocaleString('pt-BR');
const cartao = 'rounded-2xl border border-linha bg-white p-4';

function Grupo({ titulo, itens, rotulo, link, unidade, taxa }: {
  titulo: string; itens: GrupoTotaisFat[]; rotulo: (v: string | null) => string; link: (v: string | null) => string;
  unidade: UnidadeFat; taxa: number | null;
}) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, 6);
  return (
    <section className={cartao}>
      <h2 className="mb-2 text-sm font-extrabold text-tinta">{titulo}</h2>
      <ul className={todos ? 'max-h-96 overflow-auto' : ''}>
        {visiveis.map(g => (
          <li key={g.valor ?? '—'}>
            <Link to={link(g.valor)} className="flex items-baseline justify-between gap-2 border-t border-linha py-2 text-xs hover:text-sinal">
              <span className="min-w-0 truncate">{rotulo(g.valor)} <small className="text-aco">{numero(g.servicos)}</small></span>
              <span className="text-right">
                <span className="font-codigo">{valorFat(g.creditado, unidade, taxa)}</span>
                {(g.saldo ?? 0) > 0 && <span className="block font-codigo text-[11px] text-erro">a receber {valorFat(g.saldo ?? 0, unidade, taxa)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {itens.length > 6 && <button type="button" onClick={() => setTodos(t => !t)} className="mt-2 text-xs font-bold text-sinal hover:underline">
        {todos ? 'mostrar menos' : `ver todos (${itens.length}) →`}
      </button>}
    </section>
  );
}

export default function Painel() {
  const [p, setP] = useSearchParams();
  const navegar = useNavigate();
  const { dados, erro, falha, atualizando, salvoEm, recarregar } = useDadosComCache('painel', painelFat, [], true, 'Faturamento › Painel › carregar os totais');
  const { unidade, taxa, mudar: mudarUnidade } = useUnidadeFat();
  const faturas = dados ?? [];
  const fatura = p.get('fatura');
  const escolhida = fatura ? faturas.find(f => f.fatura === fatura) : undefined;
  const periodo: PeriodoFat = escolhida ? { de: escolhida.inicio, ate: escolhida.fim }
    : p.get('de') && p.get('ate') ? { de: p.get('de')!, ate: p.get('ate')! }
    : faturas[0] ? atalhoPeriodo('3m', faturas[0].fim) : { de: '', ate: '' };
  const doPeriodo = faturas.filter(f => f.fim >= periodo.de && f.inicio <= periodo.ate);
  const t: TotaisFat | null = escolhida ?? (doPeriodo.length ? somarTotais(doPeriodo) : null);
  // Com período de várias faturas, os links abrem a mais recente do período (a Conferência é de uma por vez).
  const alvo = escolhida?.fatura ?? doPeriodo[0]?.fatura;
  const base = new URLSearchParams(alvo ? { fatura: alvo } : {});
  const conferencia = (extra: Record<string, string>) => `/faturamento/conferencia?${new URLSearchParams({ ...Object.fromEntries(base), ...extra })}`;
  const mudar = (n: Record<string, string | null>) => {
    const q = new URLSearchParams(p);
    for (const [k, v] of Object.entries(n)) if (v) q.set(k, v); else q.delete(k);
    setP(q, { replace: true });
  };
  const referencia = faturas[0]?.fim ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h1 className="text-xl font-extrabold text-tinta sm:text-2xl">Painel do faturamento</h1><AjudaFat tema="funil" /></div>
          <p className="text-sm text-aco">{escolhida ? `Fatura ${escolhida.fatura} · ${rotuloPeriodo(periodo)}` : rotuloPeriodo(periodo)}{taxa ? ` · 1 US = ${taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ' · valores em US'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PilulasPeriodo faturas={faturas.map(f => ({ id: f.fatura, inicio: f.inicio, fim: f.fim }))} fatura={escolhida?.fatura ?? null}
            periodo={periodo} referencia={referencia} onFatura={id => mudar({ fatura: id, de: null, ate: null })}
            onPeriodo={x => mudar({ fatura: null, de: x.de, ate: x.ate })} />
          <ChaveUnidade unidade={unidade} taxa={taxa} mudar={mudarUnidade} mostrarTaxa={false} />
          <button type="button" onClick={recarregar} disabled={atualizando} title="Atualizar agora"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-aco hover:bg-white disabled:opacity-70">
            {atualizando ? 'atualizando…' : salvoEm ? `atualizado ${tempoRelativo(salvoEm)}` : 'atualizar'}
            <RotateCw className={`size-3.5 ${atualizando ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </header>

      {falha && <AvisoErro erro={falha} onTentar={recarregar} contexto={dados ? 'Mostrando os últimos dados vistos.' : undefined} />}

      {!dados && !erro ? <CarregandoNeo variante="resumo" /> : dados && !faturas.length ? (
        <div className={`${cartao} py-10 text-center`}><p className="font-bold">Nenhuma fatura importada ainda.</p>
          <Link to="/faturamento/importar" className="mt-3 inline-flex rounded-xl bg-sinal px-4 py-2 text-sm font-bold text-white">Importar a primeira fatura</Link></div>
      ) : dados && !t ? (
        <div className={`${cartao} py-10 text-center`}><p className="font-bold">Nenhuma fatura neste período.</p>
          <p className="mt-1 text-sm text-aco">Escolha outro período ou uma fatura no título.</p></div>
      ) : t && <>
        <CardsLados totais={t} unidade={unidade} taxa={taxa}
          onVer={lado => navegar(conferencia(lado === 'a_mais' ? { atalho: 'a_mais' } : {}))} />

        <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]">
          <section className={cartao}>
            <FunilConferencia totais={t} unidade={unidade} taxa={taxa}
              onEtapa={e => navegar(conferencia(e === 'fora_contrato' ? { atalho: 'fora' } : e === 'a_mais' ? { atalho: 'a_mais' } : {}))} />
          </section>
          <section className={cartao}>
            <GraficoFaturas unidade={unidade} taxa={taxa} itens={[...faturas].reverse().slice(-8).map(f => itemGraficoFat(f, rotuloPeriodo({ de: f.inicio, ate: f.fim })))}
              destaque={escolhida?.fatura ?? faturas[0]?.fatura} />
          </section>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Grupo titulo="Por tipo de equipe" itens={t.grupos.tipo_turma} rotulo={v => v ? TIPOS_TURMA_FAT[v] ?? v : 'Sem equipe'} unidade={unidade} taxa={taxa}
            link={v => conferencia({ visao: 'todos', ...(v ? { tipo_turma: v } : {}) })} />
          <Grupo titulo="Por código" itens={t.grupos.codserv} rotulo={v => v ?? '—'} unidade={unidade} taxa={taxa} link={v => conferencia({ visao: 'todos', ...(v ? { codigo_principal: v } : {}) })} />
          <Grupo titulo="Por cidade" itens={t.grupos.cidade} rotulo={v => v ?? 'Sem cidade'} unidade={unidade} taxa={taxa} link={v => conferencia({ visao: 'todos', ...(v ? { cidade: v } : {}) })} />
        </div>

        <section className={cartao}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-extrabold text-tinta">Ajustes da fatura (fora da conferência)</h2>
            <p className="text-xs text-aco">débito <b className="font-codigo text-erro">{valorFat(-t.ajustes.debito, unidade, taxa, true)}</b> · crédito <b className="font-codigo">{valorFat(t.ajustes.credito, unidade, taxa, true)}</b></p>
          </div>
          {t.ajustes.itens.length ? <div className="mt-2 max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[11px] text-aco uppercase"><tr><th className="py-2 pr-2">Tipo</th><th className="py-2 pr-2">Observação</th><th className="py-2 text-right">{unidade === 'us' ? 'US' : 'R$'}</th></tr></thead>
              <tbody>{t.ajustes.itens.map((a, i) => (
                <tr key={i} className="border-t border-linha">
                  <td className="py-1.5 pr-2">{a.tipo === 'D' ? 'Débito' : a.tipo === 'C' ? 'Crédito' : a.tipo}</td>
                  <td className="py-1.5 pr-2">{a.observacao}</td>
                  <td className={`py-1.5 text-right font-codigo ${a.tipo === 'D' ? 'text-erro' : ''}`}>{valorFat(a.tipo === 'D' ? -a.valor : a.valor, unidade, taxa, true)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div> : <p className="mt-2 text-sm text-aco">Sem ajustes nesta fatura.</p>}
        </section>
      </>}
      <RodapeFat />
    </div>
  );
}
