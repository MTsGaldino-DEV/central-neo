import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { painelFat, type GrupoTotaisFat, type TotaisFat } from '@/lib/faturamentoServicos';
import { somarTotais, usFat } from '@/lib/faturamentoTexto';
import { TIPOS_TURMA_FAT } from '@/lib/faturamentoPlanilhas';
import { useDadosComCache } from '@/lib/useDadosComCache';
import { CabecalhoFatura } from '@/components/faturamento/CabecalhoFatura';
import { atalhoPeriodo, type PeriodoFat } from '@/components/faturamento/SeletorPeriodo';
import { CarregandoNeo } from '@/components/faturamento/CarregandoNeo';
import { FunilConferencia } from '@/components/faturamento/FunilConferencia';
import { GraficoFaturas } from '@/components/faturamento/GraficoFaturas';
import { AlternarFatura } from '@/components/faturamento/AlternarFatura';
import { AjudaFat, RodapeFat } from '@/components/faturamento/AjudaFat';

const numero = (n: number) => n.toLocaleString('pt-BR');
const comSinal = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${usFat(Math.abs(n))}`;
const cartao = 'rounded-2xl border border-linha bg-white p-4';

function Apoio({ rotulo, dica, valor, cor = 'text-tinta' }: { rotulo: string; dica: string; valor: string; cor?: string }) {
  return (
    <div className={`${cartao} flex items-center justify-between gap-3`}>
      <div className="min-w-0"><p className="text-[11px] font-bold tracking-wide text-aco uppercase">{rotulo}</p><p className="text-xs text-aco">{dica}</p></div>
      <p className={`font-codigo text-lg font-extrabold ${cor}`}>{valor}</p>
    </div>
  );
}

function Grupo({ titulo, itens, rotulo, link }: {
  titulo: string; itens: GrupoTotaisFat[]; rotulo: (v: string | null) => string; link: (v: string | null) => string;
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
                <span className="font-codigo">{usFat(g.creditado)}</span>
                {(g.saldo ?? 0) > 0 && <span className="block font-codigo text-[11px] text-erro">a receber {usFat(g.saldo)}</span>}
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

export default function Resumo() {
  const [p, setP] = useSearchParams();
  const navegar = useNavigate();
  const { dados, erro, atualizando, salvoEm, recarregar } = useDadosComCache('painel', painelFat, []);
  const faturas = dados ?? [];
  const fatura = p.get('fatura');
  const escolhida = fatura ? faturas.find(f => f.fatura === fatura) : undefined;
  const periodo: PeriodoFat = escolhida ? { de: escolhida.inicio, ate: escolhida.fim }
    : p.get('de') && p.get('ate') ? { de: p.get('de')!, ate: p.get('ate')! }
    : faturas[0] ? atalhoPeriodo('3m', faturas[0].fim) : { de: '', ate: '' };
  const doPeriodo = faturas.filter(f => f.fim >= periodo.de && f.inicio <= periodo.ate);
  const t: TotaisFat | null = escolhida ?? (doPeriodo.length ? somarTotais(doPeriodo) : null);
  const base = new URLSearchParams(fatura ? { fatura } : {});
  const conferencia = (extra: Record<string, string>) => `/faturamento/conferencia?${new URLSearchParams({ ...Object.fromEntries(base), ...extra })}`;
  const mudar = (n: Record<string, string | null>) => {
    const q = new URLSearchParams(p);
    for (const [k, v] of Object.entries(n)) if (v) q.set(k, v); else q.delete(k);
    setP(q, { replace: true });
  };
  const liquido = t ? t.creditado - t.multas + t.estorno : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AlternarFatura atual="resumo" />
        <AjudaFat tema="funil" />
      </div>
      <CabecalhoFatura rotulo="Resumo do faturamento · valores em US" faturas={faturas.map(f => ({ id: f.fatura, inicio: f.inicio, fim: f.fim }))}
        fatura={escolhida?.fatura ?? null} periodo={periodo} salvoEm={salvoEm} atualizando={atualizando} onRecarregar={recarregar}
        onFatura={id => mudar({ fatura: id, de: null, ate: null })} onPeriodo={x => mudar({ fatura: null, de: x.de, ate: x.ate })} />

      {erro && <p role="alert" className="rounded-xl border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
        {dados ? 'Não foi possível atualizar; mostrando os últimos dados vistos. ' : ''}{erro} <button type="button" onClick={recarregar} className="font-bold underline">Tentar de novo</button>
      </p>}

      {!dados && !erro ? <CarregandoNeo variante="resumo" /> : dados && !faturas.length ? (
        <div className={`${cartao} py-10 text-center`}><p className="font-bold">Nenhuma fatura importada ainda.</p>
          <Link to="/faturamento/importar" className="mt-3 inline-flex rounded-xl bg-sinal px-4 py-2 text-sm font-bold text-white">Importar a primeira fatura</Link></div>
      ) : dados && !t ? (
        <div className={`${cartao} py-10 text-center`}><p className="font-bold">Nenhuma fatura neste período.</p>
          <p className="mt-1 text-sm text-aco">Escolha outro período ou uma fatura no título.</p></div>
      ) : t && <>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl bg-noite p-5 text-white">
            <p className="text-[11px] font-bold tracking-wide text-aco-claro uppercase">Diferença · pago − devido</p>
            <p className="mt-1 font-codigo text-3xl font-extrabold text-sinal-claro sm:text-4xl">{comSinal(t.diferenca)} US</p>
            <p className="mt-2 text-sm text-linha">A CEMIG pagou <b>{usFat(t.pago_com_fator)}</b> e o contrato prevê <b>{usFat(t.devido)}</b>.</p>
            {t.sem_fator_servicos > 0 && <p className="mt-2 text-xs text-aco-claro">⚠ {numero(t.sem_fator_servicos)} serviços sem fator no contrato ficaram de fora do devido{t.parciais > 0 ? `; ${numero(t.parciais)} serviços contam só a parte com fator` : ''}.</p>}
            <Link to={conferencia({})} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">
              A receber: <span className="font-codigo text-erro-marca">{usFat(t.saldo_a_receber)}</span> em {numero(t.a_menos.servicos)} serviços <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
          <div className="grid gap-3">
            <Apoio rotulo="Serviços analisados" dica={`${numero(t.linhas)} linhas da planilha`} valor={numero(t.servicos)} />
            <Apoio rotulo="US pagos" dica={`crédito ${usFat(t.creditado)} · estorno ${usFat(t.estorno)}`} valor={usFat(liquido)} />
            <Apoio rotulo="Multas (glosas)" dica="descontos aplicados pela CEMIG" valor={`−${usFat(t.multas)}`} cor="text-erro" />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]">
          <section className={cartao}>
            <FunilConferencia funil={t.funil} onEtapa={e => navegar(e === 'fora_contrato' ? conferencia({ visao: 'todos', situacao: 'FORA_CONTRATO' }) : conferencia({}))} />
          </section>
          <section className={cartao}>
            <GraficoFaturas itens={[...faturas].reverse().slice(-8).map(f => ({ fatura: f.fatura, pago: f.creditado, devido: f.devido, multas: f.multas }))}
              destaque={escolhida?.fatura ?? faturas[0]?.fatura} />
          </section>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Grupo titulo="Por tipo de equipe" itens={t.grupos.tipo_turma} rotulo={v => v ? TIPOS_TURMA_FAT[v] ?? v : 'Sem equipe'}
            link={v => conferencia({ visao: 'todos', ...(v ? { tipo_turma: v } : {}) })} />
          <Grupo titulo="Por código" itens={t.grupos.codserv} rotulo={v => v ?? '—'} link={v => conferencia({ visao: 'todos', ...(v ? { codserv: v } : {}) })} />
          <Grupo titulo="Por cidade" itens={t.grupos.cidade} rotulo={v => v ?? 'Sem cidade'} link={v => conferencia({ visao: 'todos', ...(v ? { cidade: v } : {}) })} />
        </div>

        <section className={cartao}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-extrabold text-tinta">Ajustes da fatura (fora da conferência)</h2>
            <p className="text-xs text-aco">débito <b className="font-codigo text-erro">−{usFat(t.ajustes.debito)}</b> · crédito <b className="font-codigo">+{usFat(t.ajustes.credito)}</b></p>
          </div>
          {t.ajustes.itens.length ? <div className="mt-2 max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[11px] text-aco uppercase"><tr><th className="py-2 pr-2">Tipo</th><th className="py-2 pr-2">Observação</th><th className="py-2 text-right">US</th></tr></thead>
              <tbody>{t.ajustes.itens.map((a, i) => (
                <tr key={i} className="border-t border-linha">
                  <td className="py-1.5 pr-2">{a.tipo === 'D' ? 'Débito' : a.tipo === 'C' ? 'Crédito' : a.tipo}</td>
                  <td className="py-1.5 pr-2">{a.observacao}</td>
                  <td className={`py-1.5 text-right font-codigo ${a.tipo === 'D' ? 'text-erro' : ''}`}>{a.tipo === 'D' ? '−' : '+'}{usFat(a.valor)}</td>
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
