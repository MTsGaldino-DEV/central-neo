import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, RotateCw } from 'lucide-react';
import { painelFat, type TotaisFat } from '@/lib/faturamentoServicos';
import { usFat, variacao } from '@/lib/faturamentoTexto';
import { useDadosComCache } from '@/lib/useDadosComCache';
import { tempoRelativo } from '@/lib/cacheTela';
import { CarregandoNeo } from '@/components/faturamento/CarregandoNeo';
import { GraficoFaturas } from '@/components/faturamento/GraficoFaturas';
import { MiniBarras } from '@/components/faturamento/MiniBarras';
import { AjudaFat, RodapeFat } from '@/components/faturamento/AjudaFat';
import { AvisoErro } from '@/components/faturamento/AvisoErro';

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesFatura = (f: TotaisFat) => `${MESES[Number(f.inicio.slice(5, 7)) - 1]}/${f.inicio.slice(0, 4)}`;
const dataCurta = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Entrada do Faturamento. Links antigos (/faturamento?fatura=…) seguem para a Conferência. */
export default function Faturas() {
  const [p] = useSearchParams();
  if (p.has('fatura') || p.has('situacao') || p.has('q')) return <Navigate to={`/faturamento/conferencia?${p}`} replace />;
  return <ListaFaturas />;
}

function Tendencia({ valores, cor }: { valores: number[]; cor: string }) {
  const max = Math.max(...valores), min = Math.min(...valores), faixa = max - min || 1;
  const pontos = valores.length < 2 ? '0,14 120,14'
    : valores.map((v, i) => `${i / (valores.length - 1) * 120},${24 - (v - min) / faixa * 20}`).join(' ');
  return (
    <svg viewBox="0 0 120 28" preserveAspectRatio="none" className="mt-1 h-7 w-full" aria-hidden="true">
      <polyline points={pontos} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className={cor} />
    </svg>
  );
}

function Cartao({ rotulo, valor, cor, dica, valores, corLinha, destaque }: {
  rotulo: string; valor: string; cor: string; dica: string; valores: number[]; corLinha: string; destaque?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${destaque ? 'border-erro/40 ring-1 ring-erro/20' : 'border-linha'}`}>
      <p className="text-[11px] font-bold tracking-wide text-aco uppercase">{rotulo}</p>
      <p className={`mt-1 font-codigo text-2xl font-extrabold ${cor}`}>{valor}</p>
      <Tendencia valores={valores} cor={corLinha} />
      <p className="text-xs text-aco">{dica}</p>
    </div>
  );
}

function BarraConferencia({ f }: { f: TotaisFat }) {
  const { importados, equipe_identificada, codigo_no_contrato, valor_confere, conferidos } = f.funil;
  const partes = [
    [valor_confere, 'bg-concluido-marca', 'conferem'], [conferidos, 'bg-sinal', 'conferidos à mão'],
    [Math.max(codigo_no_contrato - valor_confere - conferidos, 0), 'bg-erro-marca', 'com diferença'],
    [equipe_identificada - codigo_no_contrato, 'bg-pendente-marca', 'fora do contrato'], [importados - equipe_identificada, 'bg-revisao-marca', 'sem equipe'],
  ] as const;
  return (
    <div className="mt-1 flex h-1.5 w-28 overflow-hidden rounded-full bg-linha" role="img"
      aria-label={partes.filter(([n]) => n > 0).map(([n, , t]) => `${n.toLocaleString('pt-BR')} ${t}`).join(', ')}>
      {partes.map(([n, cor], i) => n > 0 && <div key={i} className={cor} style={{ width: `${n / (importados || 1) * 100}%` }} />)}
    </div>
  );
}

function LinhaFatura({ f, atual, maximo }: { f: TotaisFat; atual?: boolean; maximo: number }) {
  return (
    <Link to={`/faturamento/resumo?fatura=${encodeURIComponent(f.fatura)}`}
      className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3 hover:bg-sinal-fundo/50 focus-visible:outline-2 focus-visible:outline-sinal sm:grid-cols-[minmax(140px,1.2fr)_auto_1fr_auto_auto] ${atual ? 'rounded-2xl border-2 border-sinal bg-white py-4' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <b className={`font-codigo ${atual ? 'text-2xl' : 'text-base'} font-extrabold text-tinta`}>{f.fatura}</b>
          {atual && <span className="rounded-full bg-sinal px-2 py-0.5 text-[11px] font-bold text-white">Atual</span>}
        </div>
        <p className="text-xs text-aco">{mesFatura(f)}{atual && f.importado_em ? ` · importada em ${dataCurta(f.importado_em)}` : ''}</p>
      </div>
      <div className="hidden sm:block"><MiniBarras pago={f.creditado} devido={f.devido} multas={f.multas} maximo={maximo} /></div>
      <div className="hidden sm:block">
        <p className="text-[11px] font-bold tracking-wide text-aco uppercase">Conferência</p>
        <p className="text-sm"><b className="font-codigo">{pct(f.servicos ? f.funil.valor_confere / f.servicos * 100 : 0)}</b> <span className="text-xs text-aco">conferem</span></p>
        <BarraConferencia f={f} />
      </div>
      <div className="text-right">
        <p className="text-[11px] font-bold tracking-wide text-erro uppercase">Saldo a receber</p>
        <b className={`font-codigo ${atual ? 'text-xl' : 'text-sm'} font-extrabold ${f.saldo_a_receber > 0 ? 'text-erro' : 'text-concluido'}`}>{usFat(f.saldo_a_receber)}</b>
        <p className="text-[11px] text-aco">{f.a_menos.servicos.toLocaleString('pt-BR')} serviços</p>
      </div>
      <ChevronRight className="hidden size-5 text-aco-claro sm:block" aria-hidden="true" />
    </Link>
  );
}

function ListaFaturas() {
  const { dados, erro, falha, atualizando, salvoEm, recarregar } = useDadosComCache('painel', painelFat, [], true, 'Faturamento › Faturas › carregar o painel');
  const faturas = dados ?? [];
  const [atual, anterior] = faturas;
  const antigas = [...faturas].reverse();
  const soma = (k: 'creditado' | 'saldo_a_receber' | 'multas') => faturas.reduce((s, f) => s + f[k], 0);
  const maiorSaldo = faturas.reduce<TotaisFat | null>((m, f) => !m || f.saldo_a_receber > m.saldo_a_receber ? f : m, null);
  const v = atual && anterior ? variacao(atual.creditado, anterior.creditado) : null;
  const maximo = Math.max(...faturas.flatMap(f => [f.creditado, f.devido, f.multas]), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-wide text-aco uppercase">Faturamento · valores em US</p>
          <h1 className="text-2xl font-extrabold text-tinta">Faturas da CEMIG</h1>
        </div>
        <button type="button" onClick={recarregar} disabled={atualizando} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-aco hover:bg-nevoa">
          {atualizando ? 'atualizando…' : salvoEm ? `atualizado ${tempoRelativo(salvoEm)}` : 'atualizar'}
          <RotateCw className={`size-3.5 ${atualizando ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        </button>
        <AjudaFat tema="inicio" />
        <Link to="/faturamento/importar" className="inline-flex items-center gap-1.5 rounded-xl bg-sinal px-4 py-2 text-sm font-bold text-white hover:bg-sinal-forte">
          <Plus className="size-4" aria-hidden="true" />Importar nova fatura
        </Link>
      </div>

      {falha && <AvisoErro erro={falha} onTentar={recarregar} contexto={dados ? 'Mostrando os últimos dados vistos.' : undefined} />}

      {!dados && !erro ? <CarregandoNeo variante="lista" /> : dados && !faturas.length ? (
        <div className="rounded-2xl border border-dashed border-linha bg-white px-6 py-12 text-center">
          <p className="text-base font-bold text-tinta">Nenhuma fatura importada ainda.</p>
          <p className="mt-1 text-sm text-aco">Importe a Fatura Resumida e a Fatura Completa da CEMIG para começar.</p>
          <Link to="/faturamento/importar" className="mt-4 inline-flex rounded-xl bg-sinal px-4 py-2 text-sm font-bold text-white hover:bg-sinal-forte">Importar a primeira fatura</Link>
        </div>
      ) : dados && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Cartao rotulo={`Pago pela CEMIG · ${faturas.length} ${faturas.length === 1 ? 'fatura' : 'faturas'}`} valor={usFat(soma('creditado'))} cor="text-tinta"
            valores={antigas.map(f => f.creditado)} corLinha="text-sinal"
            dica={v == null ? `${faturas.length} fatura importada` : `${v >= 0 ? '+' : ''}${pct(v)} na ${atual.fatura} contra a ${anterior.fatura}`} />
          <Cartao rotulo="Pago a menos · soma dos saldos" valor={usFat(soma('saldo_a_receber'))} cor="text-erro" destaque
            valores={antigas.map(f => f.saldo_a_receber)} corLinha="text-erro-marca"
            dica={maiorSaldo ? `maior saldo: ${maiorSaldo.fatura} (${usFat(maiorSaldo.saldo_a_receber)})` : ''} />
          <Cartao rotulo={`Multas aplicadas · ${faturas.length} ${faturas.length === 1 ? 'fatura' : 'faturas'}`} valor={`−${usFat(soma('multas'))}`} cor="text-tinta"
            valores={antigas.map(f => f.multas)} corLinha="text-cobre"
            dica={`média de ${pct(soma('creditado') ? soma('multas') / soma('creditado') * 100 : 0)} do pago`} />
        </div>
        <section className="rounded-2xl border border-linha bg-white p-4">
          <GraficoFaturas itens={antigas.slice(-8).map(f => ({ fatura: f.fatura, pago: f.creditado, devido: f.devido, multas: f.multas }))} destaque={atual.fatura} />
        </section>
        <LinhaFatura f={atual} atual maximo={maximo} />
        {faturas.length > 1 && <section>
          <h2 className="mb-2 mt-6 text-[11px] font-bold tracking-wide text-aco uppercase">Histórico</h2>
          <div className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-white">
            {faturas.slice(1).map(f => <LinhaFatura key={f.fatura} f={f} maximo={maximo} />)}
          </div>
        </section>}
      </>}
      <RodapeFat />
    </div>
  );
}
