import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AvisoErro } from '@/components/faturamento/AvisoErro';
import { useSessao } from '@/contexto/Sessao';
import { lerAno, lerConfig, lerFrotas, salvarMeta } from '@/lib/disponibilidade';
import {
  NOMES_MES, SUPERVISORES, brlNegativo, chaveDia, estadoValor, mesesDoAno, resumoPainel,
  type ConfigDisp, type Estado, type Frota, type Ocorrencia,
} from '@/lib/disponibilidadeRegras';
import { traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { SeloEstado } from './Comuns';
import './disponibilidade.css';

const ONDE = 'Painel da disponibilidade';
// Duas cores validadas pela ferramenta de gráficos (daltonismo e contraste); a Petróleo pura reprova por parecer cinza.
const COR_FROTA = '#0889a3', COR_OPERACAO = 'var(--color-cobre)';

function Painelzinho({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <Card className="min-w-0 gap-0 border-linha px-4 py-3.5 shadow-none">
      <h3 className="mb-2.5 text-[14.5px] font-extrabold">{titulo}{nota && <small className="ml-1.5 text-xs font-medium text-aco">{nota}</small>}</h3>
      {children}
    </Card>
  );
}

function Kpi({ rotulo, valor, nota, escuro = false, cor = '' }: { rotulo: string; valor: ReactNode; nota?: ReactNode; escuro?: boolean; cor?: string }) {
  return (
    <Card className={`min-w-0 gap-0 px-4 py-3.5 shadow-none ${escuro ? 'col-span-2 border-noite-alto bg-noite-alto text-white lg:col-span-1' : 'border-linha'}`}>
      <p className={`mb-1 text-xs font-semibold ${escuro ? 'text-[#b9cdd2]' : 'text-aco'}`}>{rotulo}</p>
      <div className={`whitespace-nowrap text-[22px] font-extrabold leading-tight tabular-nums lg:text-2xl ${cor}`}>{valor}</div>
      {nota && <p className={`mt-0.5 text-xs ${escuro ? 'text-[#b9cdd2]' : 'text-aco'}`}>{nota}</p>}
    </Card>
  );
}

const Barrinha = ({ fracao, cor = 'bg-sinal' }: { fracao: number; cor?: string }) => (
  <div className="h-1.5 min-w-[50px] rounded bg-[#edf2f3]"><i className={`block h-full rounded ${cor}`} style={{ width: `${fracao * 100}%` }} /></div>
);
const celulaBarra = 'hidden w-[24%] md:table-cell';

export default function PainelDisp() {
  const { acesso } = useSessao();
  const admin = acesso?.papel === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const meses = mesesDoAno(ano);
  const mesUrl = Number(params.get('mes'));
  const mes = params.has('mes') && meses.includes(mesUrl) ? mesUrl : hoje.getMonth();
  const sup = params.get('sup') ?? 'T';
  const alterar = (k: string, v: string | null) => setParams(p => { const n = new URLSearchParams(p); if (v === null) n.delete(k); else n.set(k, v); return n; }, { replace: true });

  const [frotas, setFrotas] = useState<Frota[] | null>(null);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[] | null>(null);
  const [config, setConfig] = useState<ConfigDisp | null>(null);
  const [metaTexto, setMetaTexto] = useState('');
  const [falha, setFalha] = useState<ErroAmigavel | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [dica, setDica] = useState<{ texto: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([lerFrotas(), lerAno(ano), lerConfig()])
      .then(([f, o, c]) => { if (!vivo) return; setFrotas(f); setOcorrencias(o); setConfig(c); setMetaTexto(c.meta_mensal.toLocaleString('pt-BR')); })
      .catch(e => { if (vivo) setFalha(traduzirErro(e, ONDE)); });
    return () => { vivo = false; };
  }, [ano, tentativa]);

  const r = useMemo(() => (frotas && ocorrencias && config ? resumoPainel(frotas, ocorrencias, ano, mes, sup, config) : null), [frotas, ocorrencias, config, ano, mes, sup]);

  async function gravarMeta() {
    if (!config) return;
    const v = parseInt(metaTexto.replace(/\D/g, ''), 10);
    const nova = Number.isNaN(v) ? config.meta_mensal : v;
    setMetaTexto(nova.toLocaleString('pt-BR'));
    if (nova === config.meta_mensal) return;
    const anterior = config;
    setConfig({ ...config, meta_mensal: nova });
    try { await salvarMeta(nova); setFalha(null); }
    catch (e) { setConfig(anterior); setMetaTexto(anterior.meta_mensal.toLocaleString('pt-BR')); setFalha(traduzirErro(e, ONDE)); }
  }

  const meta = config?.meta_mensal ?? 0;
  const estadoMes: Estado = !r ? { tom: 'ok', texto: '' } : r.valor === 0 ? { tom: 'ok', texto: 'Perfeito' } : estadoValor(r.valor, meta);
  const totalCausas = r?.qtdOcorrencias ?? 0;
  const maxCausa = r ? Math.max(1, ...r.causasMultaveis.map(c => c.qtd), ...r.causasContestaveis.map(c => c.qtd)) : 1;
  const maxRank = r ? Math.max(1, ...r.ranking.map(x => x.valor)) : 1;

  // Escala do gráfico: passo redondo que cobre o maior mês e a meta.
  const topo = r ? Math.max(meta, ...r.serie.map(s => s.valor), 1) : 1;
  const passo = topo > 40000 ? 20000 : topo > 20000 ? 10000 : topo > 8000 ? 5000 : 2000;
  const escala = Math.ceil(topo / passo) * passo;
  const ALTURA = 222, BASE = 242;
  const yDe = (v: number) => BASE - v / escala * ALTURA;
  const marcasEixo = Array.from({ length: Math.round(escala / passo) + 1 }, (_, i) => i * passo);
  const futuro = (m: number) => new Date(ano, m, 1) > new Date(chaveDia(hoje) + 'T23:59:59');
  const fo = r?.frotaOperacao, totalFo = fo ? fo.frota + fo.operacao : 0;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-5 lg:px-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h2 className="text-[23px] font-extrabold tracking-tight">Painel de indisponibilidades</h2>
          <p className="text-aco">Gestão de frota {ano}</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2.5 sm:w-auto sm:grid-cols-[136px_136px_128px]">
          <div>
            <label className="mb-1 block text-[11.5px] font-bold text-aco" id="rotulo-mes">Mês</label>
            <Select value={String(mes)} onValueChange={v => alterar('mes', v)}>
              <SelectTrigger aria-labelledby="rotulo-mes" className="w-full bg-white font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>{meses.map(m => <SelectItem key={m} value={String(m)}>{NOMES_MES[m]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11.5px] font-bold text-aco" id="rotulo-sup">Supervisão</label>
            <Select value={sup} onValueChange={v => alterar('sup', v === 'T' ? null : v)}>
              <SelectTrigger aria-labelledby="rotulo-sup" className="w-full bg-white font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="T">Todas</SelectItem>
                {SUPERVISORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="meta-mes" className="mb-1 block text-[11.5px] font-bold text-aco">Meta do mês (R$)</label>
            {admin ? (
              <Input id="meta-mes" inputMode="numeric" value={metaTexto} onChange={e => setMetaTexto(e.target.value)} onBlur={gravarMeta}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} className="bg-white font-semibold tabular-nums" />
            ) : (
              <div id="meta-mes" data-testid="meta-leitura" title="Só o administrador altera a meta" className="flex h-9 items-center gap-1.5 rounded-md border border-linha bg-[#eef3f4] px-3 font-bold tabular-nums text-aco">
                <Lock size={13} aria-hidden="true" />{meta.toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      </div>

      {falha && <div className="mb-4"><AvisoErro erro={falha} contexto="Não foi possível concluir." onTentar={() => { setFalha(null); setTentativa(t => t + 1); }} /></div>}
      {!r && !falha && <div className="flex justify-center p-16 text-aco" role="status"><Loader2 size={18} className="animate-spin motion-reduce:animate-none" /><span className="sr-only">Carregando o painel</span></div>}

      {r && (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="kpis">
            <Kpi escuro rotulo="Total do mês" valor={brlNegativo(r.valor)} nota={`${NOMES_MES[mes]} · ${r.qtdMultaveis} ${r.qtdMultaveis === 1 ? 'ocorrência' : 'ocorrências'}`} />
            <Kpi rotulo="Frotas com multa" valor={r.frotasComMulta} nota={`de ${r.baseFrotas} frotas`} />
            <Kpi rotulo="Total anual" valor={brlNegativo(r.totalAno)} cor="text-erro" nota={NOMES_MES[meses[0]] + ` a ${NOMES_MES[hoje.getMonth()].toLowerCase()}`} />
            <Kpi rotulo="Comparado ao mês anterior" cor={r.comparacao.pct === null ? '' : r.comparacao.pct > 0 ? 'text-erro' : r.comparacao.pct < 0 ? 'text-concluido' : ''}
              valor={r.comparacao.pct === null ? 'N/A' : `${r.comparacao.pct > 0 ? '+' : ''}${r.comparacao.pct}%`} nota={r.comparacao.texto} />
            <Kpi rotulo="Status da meta" valor={<SeloEstado estado={estadoMes} grande />} nota={`Meta ${brlNegativo(meta)}`} />
          </div>

          <div className="mb-3.5 grid gap-3.5 lg:grid-cols-2">
            <Painelzinho titulo="Ranking por supervisão">
              <Table data-testid="ranking">
                <TableHeader><TableRow><TableHead>Supervisor</TableHead><TableHead className="text-right">Frotas</TableHead><TableHead className="text-right">Multas</TableHead><TableHead className={celulaBarra} aria-hidden="true" /><TableHead>Situação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {r.ranking.map(x => (
                    <TableRow key={x.supervisor}><TableCell className="font-bold">{x.supervisor}</TableCell><TableCell className="text-right tabular-nums">{x.frotas}</TableCell>
                      <TableCell className={`text-right tabular-nums ${x.valor ? 'text-erro' : ''}`}>{brlNegativo(x.valor)}</TableCell>
                      <TableCell className={celulaBarra} aria-hidden="true"><Barrinha fracao={x.valor / maxRank} /></TableCell><TableCell><SeloEstado estado={x.estado} /></TableCell></TableRow>
                  ))}
                  <TableRow className="font-extrabold"><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{r.ranking.reduce((t, x) => t + x.frotas, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums text-erro">{brlNegativo(r.ranking.reduce((t, x) => t + x.valor, 0))}</TableCell><TableCell className={celulaBarra} /><TableCell /></TableRow>
                </TableBody>
              </Table>
            </Painelzinho>

            <Painelzinho titulo="Causas de indisponibilidade">
              <Table data-testid="causas">
                <TableHeader><TableRow><TableHead>Causa</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">%</TableHead><TableHead className={celulaBarra} aria-hidden="true" /><TableHead>Situação</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="border-0 hover:bg-transparent"><TableCell colSpan={5} className="pb-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#9c0006]">Multável</TableCell></TableRow>
                  {r.causasMultaveis.map(c => (
                    <TableRow key={c.nome}><TableCell className="whitespace-normal">{c.nome}</TableCell><TableCell className="text-right tabular-nums">{c.qtd}</TableCell><TableCell className="text-right tabular-nums">{totalCausas ? Math.round(c.qtd / totalCausas * 100) : 0}%</TableCell>
                      <TableCell className={celulaBarra} aria-hidden="true"><Barrinha fracao={c.qtd / maxCausa} cor="bg-erro-marca" /></TableCell><TableCell><SeloEstado estado={c.estado} /></TableCell></TableRow>
                  ))}
                  <TableRow className="border-0 hover:bg-transparent"><TableCell colSpan={5} className="pb-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#006100]">Contestável</TableCell></TableRow>
                  {r.causasContestaveis.map(c => (
                    <TableRow key={c.nome}><TableCell className="whitespace-normal">{c.nome}</TableCell><TableCell className="text-right tabular-nums">{c.qtd}</TableCell><TableCell className="text-right tabular-nums">{totalCausas ? Math.round(c.qtd / totalCausas * 100) : 0}%</TableCell>
                      <TableCell className={celulaBarra} aria-hidden="true"><Barrinha fracao={c.qtd / maxCausa} cor="bg-concluido-marca" /></TableCell><TableCell className="text-aco">R$ 0</TableCell></TableRow>
                  ))}
                  <TableRow className="font-extrabold"><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{totalCausas}</TableCell><TableCell className="text-right tabular-nums">{totalCausas ? '100%' : '0%'}</TableCell><TableCell className={celulaBarra} /><TableCell /></TableRow>
                </TableBody>
              </Table>
            </Painelzinho>
          </div>

          <div className="mb-3.5">
            <Painelzinho titulo="Evolução mensal das multas" nota="clique em um mês para ver os detalhes">
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(250px,1fr)]">
                <div className="relative h-[266px] pl-[50px] lg:pl-[62px]" role="img" aria-label="Multas por mês, com a linha da meta" data-testid="grafico">
                  {marcasEixo.map(g => (
                    <div key={g} className={`absolute left-[50px] right-0 h-px lg:left-[62px] ${g ? 'bg-[#edf2f3]' : 'bg-aco-claro'}`} style={{ top: yDe(g) }}>
                      <span className="absolute right-[calc(100%+8px)] -top-2 whitespace-nowrap text-[11px] tabular-nums text-aco">{g ? `${g / 1000} mil` : 'R$ 0'}</span>
                    </div>
                  ))}
                  {meta > 0 && <div className="pointer-events-none absolute left-[50px] right-0 z-[2] border-t-2 border-dashed border-aco lg:left-[62px]" style={{ top: yDe(meta) }}>
                    <b className="absolute right-0 -top-[19px] bg-white/85 px-1 text-[11px] font-bold text-aco">Meta {brlNegativo(meta)}</b>
                  </div>}
                  <div className="absolute inset-y-0 bottom-6 left-[50px] right-0 z-[1] flex lg:left-[62px]" style={{ height: BASE }}>
                    {r.serie.map(s => {
                      const sel = s.mes === mes;
                      return (
                        <button key={s.mes} type="button" data-mes={s.mes} aria-pressed={sel} aria-label={`${NOMES_MES[s.mes]}: ${brlNegativo(s.valor)}`} onClick={() => alterar('mes', String(s.mes))}
                          onMouseMove={e => setDica({ texto: `${NOMES_MES[s.mes]}: ${brlNegativo(s.valor)}`, x: Math.min(e.clientX + 12, innerWidth - 170), y: e.clientY + 14 })} onMouseLeave={() => setDica(null)}
                          className="relative min-w-0 flex-1 cursor-pointer rounded-md hover:bg-nevoa">
                          <i className={`absolute bottom-0 left-1/2 w-[min(30px,62%)] -translate-x-1/2 rounded-t ${sel ? 'bg-sinal' : 'bg-[#8fc2cc]'}`} style={{ height: s.valor / escala * ALTURA }} />
                          {sel && s.valor > 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11.5px] font-extrabold tabular-nums text-erro" style={{ bottom: s.valor / escala * ALTURA + 4 }}>{brlNegativo(s.valor)}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="absolute bottom-0 left-[50px] right-0 flex lg:left-[62px]">
                    {r.serie.map(s => <span key={s.mes} className={`flex-1 text-center text-[11.5px] ${s.mes === mes ? 'font-extrabold text-tinta' : 'font-semibold text-aco'}`}>{NOMES_MES[s.mes].slice(0, 3)}</span>)}
                  </div>
                </div>
                <Table data-testid="evolucao">
                  <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.serie.map(s => (
                      <TableRow key={s.mes} className={`cursor-pointer ${s.mes === mes ? 'bg-sinal-fundo font-bold hover:bg-sinal-fundo' : ''}`} onClick={() => alterar('mes', String(s.mes))}>
                        <TableCell>{NOMES_MES[s.mes]}</TableCell>
                        <TableCell className={`text-right tabular-nums ${s.valor ? 'text-erro' : ''}`}>{futuro(s.mes) ? '—' : brlNegativo(s.valor)}</TableCell>
                        <TableCell>{!futuro(s.mes) && <SeloEstado estado={estadoValor(s.valor, meta)} />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Painelzinho>
          </div>

          <div className="mb-3.5">
            <Painelzinho titulo="Impacto da frota">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="impacto">
                {[
                  ['Veículo quebrado', r.impacto.qtd],
                  ['% das ocorrências', `${Math.round(r.impacto.pct * 100)}%`],
                  ['Valor', <span key="v" className={r.impacto.valor ? 'text-erro' : ''}>{brlNegativo(r.impacto.valor)}</span>],
                  ['Supervisor crítico', r.impacto.criticos.join(' e ') || 'Nenhum'],
                  ['Criticidade', <SeloEstado key="c" estado={r.impacto.criticidade} />],
                ].map(([rotulo, valor]) => (
                  <div key={String(rotulo)}><p className="mb-0.5 text-xs font-semibold text-aco">{rotulo}</p><div className="text-lg font-extrabold tabular-nums">{valor}</div></div>
                ))}
              </div>
            </Painelzinho>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <Painelzinho titulo="Top 5 frotas mais críticas">
              {!r.top.length ? <p className="text-sm text-aco">Nenhuma frota com multa neste mês.</p> : (
                <Table data-testid="top">
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Frota</TableHead><TableHead className="hidden md:table-cell">Placa</TableHead><TableHead>Supervisor</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.top.map((t, i) => (
                      <TableRow key={t.frota}><TableCell className="tabular-nums">{i + 1}º</TableCell><TableCell className="font-codigo font-bold">{t.frota}</TableCell><TableCell className="hidden font-codigo text-[12.5px] text-aco md:table-cell">{t.placa}</TableCell>
                        <TableCell>{t.supervisor}</TableCell><TableCell className="text-right tabular-nums">{t.qtd}</TableCell><TableCell className="text-right tabular-nums text-erro">{brlNegativo(t.valor)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Painelzinho>

            <Painelzinho titulo="Frota x operação">
              {fo && (
                <>
                  <div className={`mb-2 flex h-3.5 gap-0.5 overflow-hidden rounded ${totalFo ? '' : 'bg-[#edf2f3]'}`} role="img" aria-label={`Frota ${fo.frota}, operação ${fo.operacao}`}>
                    {totalFo > 0 && <><i style={{ width: `${fo.frota / totalFo * 100}%`, background: COR_FROTA }} /><i style={{ width: `${fo.operacao / totalFo * 100}%`, background: COR_OPERACAO }} /></>}
                  </div>
                  <Table data-testid="frota-operacao">
                    <TableHeader><TableRow><TableHead>Área</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">%</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {([['Frota (veículo quebrado)', fo.frota, COR_FROTA], ['Operação (atraso e descadastramento)', fo.operacao, COR_OPERACAO]] as const).map(([nome, q, cor]) => (
                        <TableRow key={nome}><TableCell className="whitespace-normal"><i className="mr-1.5 inline-block size-[9px] rounded-sm" style={{ background: cor }} aria-hidden="true" />{nome}</TableCell>
                          <TableCell className="text-right tabular-nums">{q}</TableCell><TableCell className="text-right tabular-nums">{totalFo ? Math.round(q / totalFo * 100) : 0}%</TableCell>
                          <TableCell className="text-right tabular-nums text-erro">{brlNegativo(q * (config?.valor_ocorrencia ?? 0))}</TableCell></TableRow>
                      ))}
                      <TableRow className="font-extrabold"><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{totalFo}</TableCell><TableCell className="text-right tabular-nums">{totalFo ? '100%' : '0%'}</TableCell>
                        <TableCell className="text-right tabular-nums text-erro">{brlNegativo(totalFo * (config?.valor_ocorrencia ?? 0))}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                  <p className="mt-2 text-xs text-aco">Fora da conta: {fo.contestaveis} {fo.contestaveis === 1 ? 'contestável' : 'contestáveis'}, com valor R$ 0.</p>
                </>
              )}
            </Painelzinho>
          </div>
        </>
      )}
      {dica && <div className="disp-dica" style={{ left: dica.x, top: dica.y }}>{dica.texto}</div>}
    </div>
  );
}
