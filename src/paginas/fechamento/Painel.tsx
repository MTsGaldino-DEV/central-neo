import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { ETAPAS, infoEtapa, formatarUS, formatarReais, formatarData, type Etapa } from '@/lib/fechamento';
import { getPainel, FAIXAS_IDADE, type Painel as DadosPainel, type Par } from '@/lib/painel';

type Unidade = 'reais' | 'us';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ETAPAS_ABERTAS: Etapa[] = ['A_FECHAR', 'AGUARDANDO_NSMP', 'AGUARDANDO_NSPR', 'AGUARDANDO_FATURA'];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "12m" (últimos 12 meses), "2026" (ano) ou "tudo". */
function intervalo(periodo: string): { inicio: string; fim: string; rotulo: string } {
  const hoje = new Date();
  if (/^\d{4}$/.test(periodo)) return { inicio: `${periodo}-01-01`, fim: `${periodo}-12-31`, rotulo: periodo };
  if (periodo === 'tudo') return { inicio: '2000-01-01', fim: '2100-12-31', rotulo: 'todo o histórico' };
  return { inicio: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1)), fim: iso(hoje), rotulo: 'últimos 12 meses' };
}

/** Fila filtrada pela data de execução dentro do mês. */
function linkMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const fim = new Date(a, m, 0).getDate();
  return `/fechamento?etapa=TODAS&de=${mes}-01&ate=${mes}-${String(fim).padStart(2, '0')}`;
}

function rotuloMes(mes: string) {
  const [a, m] = mes.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

export default function Painel() {
  const [params, setParams] = useSearchParams();
  const periodo = params.get('periodo') ?? '12m';
  const unidade: Unidade = params.get('unidade') === 'us' ? 'us' : 'reais';
  const [dados, setDados] = useState<DadosPainel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const faixa = intervalo(periodo);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await getPainel(faixa.inicio, faixa.fim));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [periodo]);

  function mudar(chave: string, valor: string | null) {
    const p = new URLSearchParams(params);
    if (valor === null) p.delete(chave); else p.set(chave, valor);
    setParams(p, { replace: true });
  }

  const anos = useMemo(() => {
    const ini = Number(dados?.periodoDisponivel.inicio?.slice(0, 4) ?? new Date().getFullYear());
    const fim = new Date().getFullYear();
    const l: number[] = [];
    for (let a = fim; a >= ini; a--) l.push(a);
    return l;
  }, [dados?.periodoDisponivel.inicio]);

  const v = (p: Par) => (unidade === 'reais' ? p.reais : p.us);
  const fmt = (x: number, compacto = false) => (unidade === 'reais' ? formatarReais(x, compacto) : `${formatarUS(x)} US`);
  const outro = (p: Par) => (unidade === 'reais' ? `${formatarUS(p.us)} US` : formatarReais(p.reais));

  const t = dados?.totais;
  const diferenca = t ? v(t.pagoConfirmado) - v(t.pedidoConfirmado) : 0;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-xl font-extrabold tracking-tight">Painel do fechamento</h2>
          <p className="text-sm text-aco">NSIS executadas em <strong>{faixa.rotulo}</strong>, pela data de execução.</p>
        </div>
        <select value={periodo} onChange={(e) => mudar('periodo', e.target.value === '12m' ? null : e.target.value)}
          className="h-9 px-2 text-sm border border-linha rounded-lg bg-white">
          <option value="12m">Últimos 12 meses</option>
          {anos.map((a) => <option key={a} value={String(a)}>{a}</option>)}
          <option value="tudo">Todo o histórico</option>
        </select>
        <div className="flex gap-1 bg-white border border-linha rounded-xl p-1">
          {(['reais', 'us'] as Unidade[]).map((u) => (
            <button key={u} onClick={() => mudar('unidade', u === 'reais' ? null : u)}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${unidade === u ? 'bg-sinal text-white' : 'text-aco hover:bg-nevoa'}`}>
              {u === 'reais' ? 'R$' : 'US'}
            </button>
          ))}
        </div>
        <button onClick={carregar} className="h-9 w-9 flex items-center justify-center border border-linha rounded-lg bg-white text-aco hover:text-sinal" title="Atualizar">
          <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
        </button>
      </div>

      {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{erro}</div>}

      {!dados ? (
        !erro && <div className="py-20 flex items-center justify-center gap-2 text-aco"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
      ) : (
        <div className={`space-y-5 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <Avisos dados={dados} unidade={unidade} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Cartao rotulo="NSIS executadas" valor={dados.totais.nsis.toLocaleString('pt-BR')}
              detalhe={<>{dados.totais.faturadas.toLocaleString('pt-BR')} faturadas · {dados.totais.semCobranca} sem cobrança</>} />
            <Cartao rotulo="Pedido à CEMIG" valor={fmt(v(dados.totais.pedido))} detalhe={`${outro(dados.totais.pedido)} · NSMP geradas`} cor="text-cobre" />
            <Cartao rotulo="Pago pela CEMIG" valor={fmt(v(dados.totais.pago))}
              detalhe={<>
                {outro(dados.totais.pago)} · pago − pedido{' '}
                <span className={Math.abs(diferenca) < 0.005 ? '' : diferenca < 0 ? 'text-erro font-bold' : 'text-concluido font-bold'}>
                  {diferenca > 0 ? '+' : ''}{fmt(diferenca)}
                </span>
              </>}
              cor="text-sinal" />
            <Cartao rotulo="Aguardando a CEMIG" valor={fmt(v(dados.totais.aguardando))}
              detalhe={<>NSMP sem NSPR{v(dados.totais.aPedir) > 0 && <> · {fmt(v(dados.totais.aPedir))} ainda sem NSMP</>}</>}
              cor="text-etapa-nspr" />
          </div>

          <Bloco titulo="Pedido × pago por mês" subtitulo="Mês da execução. Pedido = NSMP gerada; pago = valor confirmado na NSPR.">
            <BarrasMes dados={dados} unidade={unidade} />
          </Bloco>

          <Contratos dados={dados} unidade={unidade} />

          <div className="grid lg:grid-cols-2 gap-5">
            <Bloco titulo="Onde estão as NSIS do período" subtitulo="Etapa atual de cada NSIS executada no período.">
              <Etapas dados={dados} fmt={fmt} v={v} periodo={periodo === 'tudo' ? '' : `&de=${faixa.inicio}&ate=${faixa.fim}`} />
            </Bloco>
            <Bloco titulo="Pendências por idade" subtitulo="Hoje, todas as NSIS ainda não faturadas, por dias desde a execução.">
              <Idade dados={dados} />
            </Bloco>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Bloco titulo="O que mais pedimos" subtitulo="Serviços com maior valor pedido no período.">
              <Ranking itens={dados.servicos.map((s) => ({
                chave: s.codigo ?? s.descricao,
                rotulo: <>{s.codigo && <span className="font-codigo text-aco mr-1">{s.codigo}</span>}{s.descricao || 'sem descrição'}</>,
                valor: v(s.pedido), detalhe: `${s.itens} ${s.itens === 1 ? 'item' : 'itens'}`,
              }))} fmt={fmt} cor="bg-cobre" />
            </Bloco>
            <Bloco titulo="Equipes" subtitulo="Valor pedido por equipe no período.">
              <Ranking itens={dados.equipes.map((e) => ({
                chave: e.equipe, rotulo: <span className="font-codigo">{e.equipe}</span>,
                valor: v(e.pedido), detalhe: `${e.nsis} NSIS`,
              }))} fmt={fmt} cor="bg-sinal" />
            </Bloco>
            <Bloco titulo="Localidades" subtitulo="Valor pedido por localidade (4 primeiros dígitos da referência).">
              {dados.localidades.every((l) => l.localidade === '—') ? (
                <p className="text-sm text-aco py-6 text-center">
                  O histórico da planilha não traz localidade. Ela aparece nas NSIS importadas do relatório do GDIS.
                </p>
              ) : (
                <Ranking itens={dados.localidades.filter((l) => l.localidade !== '—').map((l) => ({
                  chave: l.localidade, rotulo: <span className="font-codigo">{l.localidade}</span>,
                  valor: v(l.pedido), detalhe: `${l.nsis} NSIS`,
                }))} fmt={fmt} cor="bg-etapa-fatura" />
              )}
            </Bloco>
          </div>
        </div>
      )}
    </div>
  );
}

function Avisos({ dados, unidade }: { dados: DadosPainel; unidade: Unidade }) {
  const avisos: ReactNode[] = [];
  if (unidade === 'reais' && dados.totais.itensSemValorUS > 0) {
    avisos.push(<>
      <strong>{dados.totais.itensSemValorUS.toLocaleString('pt-BR')} itens</strong> do período ficaram fora dos valores em R$: a execução é anterior a{' '}
      {dados.qualidade.primeiraVigencia ? formatarData(dados.qualidade.primeiraVigencia) : 'qualquer valor de US'} ou não tem data.
      {' '}Cadastre os valores da US dos anos anteriores em <Link to="/fechamento/tabela" className="underline font-semibold">Tabela de valores</Link>.
    </>);
  }
  if (dados.qualidade.semData > 0) {
    avisos.push(<><strong>{dados.qualidade.semData} NSIS sem data de execução</strong> não entram no painel por período.</>);
  }
  if (dados.qualidade.dataFutura > 0) {
    avisos.push(<><strong>{dados.qualidade.dataFutura} NSIS com data de execução no futuro</strong>: provavelmente dia e mês invertidos na planilha.</>);
  }
  if (!avisos.length) return null;
  return (
    <div className="bg-pendente-fundo border border-amber-200 rounded-2xl px-4 py-3 text-xs text-pendente space-y-1">
      {avisos.map((a, i) => <p key={i} className="flex gap-2"><Info size={14} className="shrink-0 mt-px" /><span>{a}</span></p>)}
    </div>
  );
}

function Cartao({ rotulo, valor, detalhe, cor = 'text-tinta', marca }: { rotulo: string; valor: string; detalhe: ReactNode; cor?: string; marca?: string }) {
  return (
    <div className="bg-white border border-linha rounded-2xl px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-aco flex items-center gap-1.5">
        {marca && <span className={`size-2.5 rounded-sm ${marca}`} />}{rotulo}
      </p>
      <p className={`text-2xl font-extrabold tracking-tight mt-1 ${cor}`}>{valor}</p>
      <p className="text-[11px] text-aco-claro mt-0.5">{detalhe}</p>
    </div>
  );
}

function Bloco({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <section className="bg-white border border-linha rounded-2xl p-4 lg:p-5 min-w-0">
      <h3 className="text-sm font-extrabold">{titulo}</h3>
      <p className="text-[11px] text-aco mb-4">{subtitulo}</p>
      {children}
    </section>
  );
}

/** Escala "redonda" para as linhas de grade: 1, 2, 2,5 ou 5 × 10^n. */
function topoEscala(max: number) {
  if (max <= 0) return 1;
  const pot = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pot >= max) return m * pot;
  return 10 * pot;
}

function BarrasMes({ dados, unidade }: { dados: DadosPainel; unidade: Unidade }) {
  const [foco, setFoco] = useState<string | null>(null);
  const meses = dados.meses;
  if (!meses.length) return <p className="text-sm text-aco py-10 text-center">Nenhuma NSIS executada no período.</p>;

  const v = (p: Par) => (unidade === 'reais' ? p.reais : p.us);
  const topo = topoEscala(Math.max(...meses.map((m) => Math.max(v(m.pedido), v(m.pago)))));
  const grade = [1, 0.75, 0.5, 0.25];
  const eixo = (x: number) => (unidade === 'reais' ? formatarReais(x, true) : formatarUS(x, x < 10 ? 1 : 0));
  const mesFoco = meses.find((m) => m.mes === foco);

  return (
    <div>
      <div className="flex items-center gap-4 text-[11px] text-aco mb-3">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-cobre" /> Pedido</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sinal" /> Pago</span>
        <span className="flex-1" />
        {mesFoco ? (
          <span className="text-tinta">
            <strong>{rotuloMes(mesFoco.mes)}</strong> · {mesFoco.nsis} NSIS · pedido <strong className="text-cobre">{unidade === 'reais' ? formatarReais(mesFoco.pedido.reais) : `${formatarUS(mesFoco.pedido.us)} US`}</strong>
            {' '}· pago <strong className="text-sinal">{unidade === 'reais' ? formatarReais(mesFoco.pago.reais) : `${formatarUS(mesFoco.pago.us)} US`}</strong>
          </span>
        ) : <span className="text-aco-claro hidden sm:inline">Passe o mouse sobre um mês para ver os valores</span>}
      </div>
      <div className="flex">
        <div className="w-14 shrink-0 relative h-48 text-[10px] text-aco-claro">
          {grade.map((g) => <span key={g} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - g) * 100}%` }}>{eixo(topo * g)}</span>)}
          <span className="absolute right-2 bottom-0 translate-y-1/2">0</span>
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="relative h-48" style={{ minWidth: meses.length * 34 }}>
            {grade.map((g) => <div key={g} className="absolute inset-x-0 border-t border-dashed border-linha" style={{ top: `${(1 - g) * 100}%` }} />)}
            <div className="absolute inset-x-0 bottom-0 border-t border-linha" />
            <div className="absolute inset-0 flex items-end">
              {meses.map((m) => (
                <Link key={m.mes} to={linkMes(m.mes)} onMouseEnter={() => setFoco(m.mes)} onMouseLeave={() => setFoco(null)}
                  title="Ver as NSIS deste mês na fila"
                  className={`flex-1 h-full flex items-end justify-center gap-0.5 px-0.5 rounded-t-md ${foco === m.mes ? 'bg-sinal-fundo/60' : ''}`}>
                  <div className="w-full max-w-4 bg-cobre rounded-t-sm transition-[height] duration-500" style={{ height: `${(v(m.pedido) / topo) * 100}%` }} />
                  <div className="w-full max-w-4 bg-sinal rounded-t-sm transition-[height] duration-500" style={{ height: `${(v(m.pago) / topo) * 100}%` }} />
                </Link>
              ))}
            </div>
          </div>
          <div className="flex" style={{ minWidth: meses.length * 34 }}>
            {meses.map((m) => (
              <div key={m.mes} className={`flex-1 text-center pt-1.5 ${foco === m.mes ? 'text-tinta font-bold' : 'text-aco'}`}>
                <p className="text-[10px] whitespace-nowrap">{rotuloMes(m.mes)}</p>
                <p className="text-[10px] text-aco-claro">{m.nsis}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-aco-claro text-right mt-1">número abaixo do mês = NSIS executadas</p>
    </div>
  );
}

// ─── Contrato 2026 × Tabela CEMIG × Pago ────────────────────────────────────

/** Cores das três séries (paleta validada; o petróleo é um pouco mais vivo que o da marca). */
const SERIES = [
  { chave: 'contrato', nome: 'Contrato 2026', marca: 'bg-revisao' },
  { chave: 'cemig', nome: 'Tabela CEMIG', marca: 'bg-cobre' },
  { chave: 'pago', nome: 'Pago', marca: 'bg-[#0a8aa3]' },
] as const;

function Contratos({ dados, unidade }: { dados: DadosPainel; unidade: Unidade }) {
  const c = dados.contratos;
  const v = (p: Par) => (unidade === 'reais' ? p.reais : p.us);
  const fmt = (x: number) => (unidade === 'reais' ? formatarReais(x) : `${formatarUS(x)} US`);
  const dif = (x: number) => (
    <span className={Math.abs(x) < 0.005 ? '' : x < 0 ? 'text-erro font-bold' : 'text-concluido font-bold'}>
      {x > 0 ? '+' : ''}{fmt(x)}
    </span>
  );
  const t = c.totais;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-extrabold">Contrato 2026 × Tabela CEMIG × Pago</h3>
        <p className="text-[11px] text-aco">
          Itens lançados com código da Tabela 03 e já pagos (NSPR com valor). Contrato 2026 = valor publicado no Anexo VI;
          Tabela CEMIG = valor pedido, com os acertos da Tabela de valores; Pago = valor confirmado na NSPR.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Cartao rotulo="Contrato 2026" marca={SERIES[0].marca} valor={fmt(v(t.contrato))}
          detalhe={<>Anexo VI · {t.itens.toLocaleString('pt-BR')} {t.itens === 1 ? 'item' : 'itens'} de {t.nsis.toLocaleString('pt-BR')} NSIS</>} />
        <Cartao rotulo="Tabela CEMIG" marca={SERIES[1].marca} valor={fmt(v(t.cemig))}
          detalhe={<>pedido · CEMIG − 2026 {dif(v(t.cemig) - v(t.contrato))}</>} />
        <Cartao rotulo="Pago pela CEMIG" marca={SERIES[2].marca} valor={fmt(v(t.pago))}
          detalhe={<>pago − 2026 {dif(v(t.pago) - v(t.contrato))} · pago − CEMIG {dif(v(t.pago) - v(t.cemig))}</>} />
      </div>
      <Bloco titulo="Por mês" subtitulo="Mês da execução. As três barras de cada mês são os mesmos itens.">
        {t.itens === 0 ? (
          <p className="text-sm text-aco py-8 text-center max-w-xl mx-auto">
            Nenhum item pago com código da Tabela 03 neste período.
            {c.semCodigo > 0 && <> Os {c.semCodigo.toLocaleString('pt-BR')} itens do período foram lançados sem código (histórico), então não dá para calcular o contrato 2026 deles.</>}
            {' '}A comparação começa com os itens lançados pelo código.
          </p>
        ) : (
          <BarrasContratos meses={c.meses} unidade={unidade} />
        )}
        {(c.aguardandoPagamento > 0 || (t.itens > 0 && c.semCodigo > 0)) && (
          <p className="text-[10px] text-aco-claro mt-2">
            Fora da comparação:
            {c.aguardandoPagamento > 0 && <> {c.aguardandoPagamento.toLocaleString('pt-BR')} itens com código aguardando pagamento</>}
            {c.aguardandoPagamento > 0 && t.itens > 0 && c.semCodigo > 0 && ' ·'}
            {t.itens > 0 && c.semCodigo > 0 && <> {c.semCodigo.toLocaleString('pt-BR')} itens sem código (histórico)</>}.
          </p>
        )}
      </Bloco>
    </section>
  );
}

function BarrasContratos({ meses, unidade }: { meses: DadosPainel['contratos']['meses']; unidade: Unidade }) {
  const [foco, setFoco] = useState<string | null>(null);
  const v = (p: Par) => (unidade === 'reais' ? p.reais : p.us);
  const fmt = (x: number) => (unidade === 'reais' ? formatarReais(x) : `${formatarUS(x)} US`);
  const topo = topoEscala(Math.max(...meses.map((m) => Math.max(v(m.contrato), v(m.cemig), v(m.pago)))));
  const grade = [1, 0.75, 0.5, 0.25];
  const eixo = (x: number) => (unidade === 'reais' ? formatarReais(x, true) : formatarUS(x, x < 10 ? 1 : 0));
  const mesFoco = meses.find((m) => m.mes === foco);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-aco mb-3">
        {SERIES.map((s) => <span key={s.chave} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${s.marca}`} /> {s.nome}</span>)}
        <span className="flex-1" />
        {mesFoco ? (
          <span className="text-tinta">
            <strong>{rotuloMes(mesFoco.mes)}</strong> · {mesFoco.itens} itens
            {SERIES.map((s) => <span key={s.chave}> · {s.nome.toLowerCase()} <strong>{fmt(v(mesFoco[s.chave]))}</strong></span>)}
          </span>
        ) : <span className="text-aco-claro hidden sm:inline">Passe o mouse sobre um mês para ver os valores</span>}
      </div>
      <div className="flex">
        <div className="w-14 shrink-0 relative h-48 text-[10px] text-aco-claro">
          {grade.map((g) => <span key={g} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - g) * 100}%` }}>{eixo(topo * g)}</span>)}
          <span className="absolute right-2 bottom-0 translate-y-1/2">0</span>
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="relative h-48" style={{ minWidth: meses.length * 44 }}>
            {grade.map((g) => <div key={g} className="absolute inset-x-0 border-t border-dashed border-linha" style={{ top: `${(1 - g) * 100}%` }} />)}
            <div className="absolute inset-x-0 bottom-0 border-t border-linha" />
            <div className="absolute inset-0 flex items-end">
              {meses.map((m) => (
                <Link key={m.mes} to={linkMes(m.mes)} onMouseEnter={() => setFoco(m.mes)} onMouseLeave={() => setFoco(null)}
                  title="Ver as NSIS deste mês na fila"
                  className={`flex-1 h-full flex items-end justify-center gap-0.5 px-0.5 rounded-t-md ${foco === m.mes ? 'bg-sinal-fundo/60' : ''}`}>
                  {SERIES.map((s) => (
                    <div key={s.chave} className={`w-full max-w-4 ${s.marca} rounded-t-sm transition-[height] duration-500`}
                      style={{ height: `${(v(m[s.chave]) / topo) * 100}%` }} />
                  ))}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex" style={{ minWidth: meses.length * 44 }}>
            {meses.map((m) => (
              <div key={m.mes} className={`flex-1 text-center pt-1.5 ${foco === m.mes ? 'text-tinta font-bold' : 'text-aco'}`}>
                <p className="text-[10px] whitespace-nowrap">{rotuloMes(m.mes)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Etapas({ dados, fmt, v, periodo }: { dados: DadosPainel; fmt: (x: number) => string; v: (p: Par) => number; periodo: string }) {
  const total = dados.etapas.reduce((s, e) => s + e.nsis, 0);
  if (!total) return <p className="text-sm text-aco py-6 text-center">Nenhuma NSIS no período.</p>;
  const ordem = ETAPAS.map((e) => ({ info: e, dado: dados.etapas.find((x) => x.etapa === e.id) })).filter((x) => x.dado);
  return (
    <div>
      <div className="flex h-4 rounded-full overflow-hidden bg-nevoa">
        {ordem.map(({ info, dado }) => (
          <div key={info.id} className={info.marca} style={{ width: `${(dado!.nsis / total) * 100}%` }} title={`${info.nome}: ${dado!.nsis}`} />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-linha">
        {ordem.map(({ info, dado }) => (
          <li key={info.id}>
            <Link to={`/fechamento?etapa=${info.id}${periodo}`} className="flex items-center gap-3 py-2 text-sm hover:bg-nevoa -mx-2 px-2 rounded-lg">
              <span className={`size-2.5 rounded-full ${info.marca}`} />
              <span className="flex-1">{info.nome}</span>
              <span className="text-xs text-aco w-24 text-right">{fmt(v(dado!.valor))}</span>
              <span className="font-bold w-16 text-right">{dado!.nsis.toLocaleString('pt-BR')}</span>
              <span className="text-[11px] text-aco-claro w-10 text-right">{Math.round((dado!.nsis / total) * 100)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Idade({ dados }: { dados: DadosPainel }) {
  const linhas = FAIXAS_IDADE.map((faixa) => {
    const partes = ETAPAS_ABERTAS.map((etapa) => ({
      etapa, nsis: dados.pendentes.filter((p) => p.faixa === faixa && p.etapa === etapa).reduce((s, p) => s + p.nsis, 0),
    }));
    return { faixa, partes, total: partes.reduce((s, p) => s + p.nsis, 0) };
  }).filter((l) => l.total > 0);
  if (!linhas.length) return <p className="text-sm text-aco py-6 text-center">Nada pendente. Tudo faturado ou sem cobrança.</p>;
  const max = Math.max(...linhas.map((l) => l.total));

  return (
    <div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-aco mb-3">
        {ETAPAS_ABERTAS.map((e) => {
          const i = infoEtapa(e);
          return <span key={e} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${i.marca}`} />{i.curto}</span>;
        })}
      </div>
      <ul className="space-y-2.5">
        {linhas.map((l) => (
          <li key={l.faixa} className="flex items-center gap-3">
            <span className={`w-28 shrink-0 text-xs ${l.faixa.startsWith('mais') || l.faixa.startsWith('91') ? 'text-erro font-bold' : 'text-aco'}`}>{l.faixa}</span>
            <div className="flex-1 h-5">
              <div className="flex h-full rounded-md overflow-hidden" style={{ width: `${(l.total / max) * 100}%` }}>
                {l.partes.filter((p) => p.nsis > 0).map((p) => (
                  <Link key={p.etapa} to={`/fechamento?etapa=${p.etapa}`} className={`${infoEtapa(p.etapa).marca} h-full hover:opacity-80`}
                    style={{ width: `${(p.nsis / l.total) * 100}%` }} title={`${infoEtapa(p.etapa).nome}: ${p.nsis}`} />
                ))}
              </div>
            </div>
            <span className="w-10 text-right text-sm font-bold">{l.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ItemRanking { chave: string; rotulo: ReactNode; valor: number; detalhe: string }

function Ranking({ itens, fmt, cor }: { itens: ItemRanking[]; fmt: (x: number, compacto?: boolean) => string; cor: string }) {
  if (!itens.length) return <p className="text-sm text-aco py-6 text-center">Sem dados no período.</p>;
  const max = Math.max(...itens.map((i) => i.valor), 0.0001);
  return (
    <ol className="space-y-3">
      {itens.map((i, n) => (
        <li key={i.chave}>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-aco-claro w-4 shrink-0">{n + 1}</span>
            <span className="flex-1 min-w-0 truncate" title={typeof i.rotulo === 'string' ? i.rotulo : undefined}>{i.rotulo}</span>
            <span className="font-bold whitespace-nowrap">{fmt(i.valor)}</span>
          </div>
          <div className="ml-6 mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-nevoa rounded-full overflow-hidden">
              <div className={`h-full ${cor} rounded-full`} style={{ width: `${(i.valor / max) * 100}%` }} />
            </div>
            <span className="text-[10px] text-aco-claro whitespace-nowrap w-14 text-right">{i.detalhe}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
