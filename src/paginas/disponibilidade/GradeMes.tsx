import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  CONTESTAVEIS, INICIO_CONTROLE, MULTAVEIS, NOMES_MES, SIGLAS, SUPERVISORES, brlNegativo, chaveDia, dataDe, desativadaDesde, diasDoMes, ehMultavel, equipeDesativada,
  type Frota,
} from '@/lib/disponibilidadeRegras';
import { FaixaResumo, ItemResumo, Pilula } from './Comuns';
import type { PropsVisao } from './ListaDia';
import { Motivos } from './Motivos';
import { useCruz } from './useCruz';

const LETRA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const curta = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function GradeMes({ ano, mes, hoje, frotas, valor, ler, gravar, desmarcar, estados, alterarEquipe, sup, setSup, ver, setVer, abrirDia }: PropsVisao & {
  ano: number; mes: number; hoje: string; ver: string; setVer: (v: string) => void; abrirDia: (dia: string) => void;
}) {
  const dias = useMemo(() => diasDoMes(ano, mes), [ano, mes]);
  const chaves = useMemo(() => dias.map(chaveDia), [dias]);
  // toLocaleDateString é lento: uma vez por dia do mês, não uma vez por célula.
  const datas = useMemo(() => dias.map(curta), [dias]);
  const [alvo, setAlvo] = useState<{ frota: number; dia: string; rect: DOMRect } | null>(null);
  const [historico, setHistorico] = useState<Frota | null>(null);
  const ancora = useRef({ getBoundingClientRect: () => new DOMRect() });
  const cruz = useCruz();

  const foraDoPeriodo = (k: string) => k < INICIO_CONTROLE || k > hoje;
  const visiveis = frotas.filter(f => sup === 'T' || f.supervisor === sup);
  const validos = chaves.filter(k => !foraDoPeriodo(k));
  // Equipe desativada no dia não precisa de conferência.
  const conferidos = validos.filter(k => visiveis.every(f => ler(k, f.frota) || equipeDesativada(estados, f.frota, k))).length;

  let multaveis = 0, contestaveis = 0;
  const comMulta = new Set<number>();
  for (const f of visiveis) for (const k of chaves) {
    const l = ler(k, f.frota);
    if (l?.situacao !== 'OCORRENCIA') continue;
    if (ehMultavel(l.causa)) { multaveis++; comMulta.add(f.frota); } else contestaveis++;
  }

  const passa = (f: Frota) => ver === 'T' || chaves.some(k => {
    const l = ler(k, f.frota);
    return l?.situacao === 'OCORRENCIA' && (ver === 'O' || ehMultavel(l.causa));
  });
  const grupos = SUPERVISORES.filter(s => sup === 'T' || s === sup)
    .map(s => ({ s, regiao: frotas.find(f => f.supervisor === s)?.regiao ?? '', itens: frotas.filter(f => f.supervisor === s && passa(f)) }))
    .filter(g => g.itens.length);

  // Um mês tem quase 2 mil células: um único tratador na tabela em vez de um por botão.
  function clicar(e: MouseEvent) {
    const alvoEl = (e.target as HTMLElement).closest('button');
    if (!alvoEl || alvoEl.disabled) return;
    const { frota, dia, frotaHist, irDia } = alvoEl.dataset;
    if (irDia) return abrirDia(irDia);
    if (frotaHist) return setHistorico(frotas.find(f => f.frota === Number(frotaHist)) ?? null);
    if (frota && dia) {
      const rect = alvoEl.getBoundingClientRect();
      ancora.current = { getBoundingClientRect: () => rect };
      cruz.esconderDica();
      setAlvo({ frota: Number(frota), dia, rect });
    }
  }

  const lancAlvo = alvo ? ler(alvo.dia, alvo.frota) : undefined;
  const frotaAlvo = alvo ? frotas.find(f => f.frota === alvo.frota) : undefined;
  const desdeAlvo = alvo ? desativadaDesde(estados, alvo.frota, alvo.dia) : null;
  const textoAlvo = alvo ? dataDe(alvo.dia).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '';

  const desativar = () => {
    if (!alvo) return;
    const temMarcas = chaves.some(k => k >= alvo.dia && ler(k, alvo.frota));
    const quando = dataDe(alvo.dia).toLocaleDateString('pt-BR');
    if (temMarcas && !window.confirm(`As marcações desta equipe a partir de ${quando} serão apagadas. Continuar?`)) return;
    alterarEquipe(alvo.frota, alvo.dia, false);
    setAlvo(null);
  };
  const reativar = () => { if (!alvo) return; alterarEquipe(alvo.frota, alvo.dia, true); setAlvo(null); };

  return (
    <>
      <FaixaResumo>
        <ItemResumo largo rotulo="Dias conferidos" valor={`${conferidos} de ${validos.length}`} barra={validos.length ? conferidos / validos.length : 0} />
        <ItemResumo rotulo="Total do mês" valor={brlNegativo(multaveis * valor)} cor="text-erro" nota={`${multaveis} ${multaveis === 1 ? 'ocorrência multável' : 'ocorrências multáveis'}`} />
        <ItemResumo rotulo="Frotas com multa" valor={comMulta.size} nota={`de ${visiveis.length} frotas`} />
        <ItemResumo rotulo="Contestáveis" valor={contestaveis} cor="text-pendente" nota="R$ 0 na conta" />
      </FaixaResumo>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pilula ativa={sup === 'T'} onClick={() => setSup('T')}>Todas</Pilula>
        {SUPERVISORES.map(s => <Pilula key={s} ativa={sup === s} onClick={() => setSup(s)}>{s}</Pilula>)}
        <span className="mx-1 hidden h-5 w-px bg-linha sm:block" aria-hidden="true" />
        <Pilula ativa={ver === 'T'} onClick={() => setVer('T')}>Todas as frotas</Pilula>
        <Pilula ativa={ver === 'O'} onClick={() => setVer('O')}>Só com ocorrência</Pilula>
        <Pilula ativa={ver === 'M'} onClick={() => setVer('M')}>Só com multa</Pilula>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-aco">
        {MULTAVEIS.map(c => <span key={c} className="inline-flex items-center gap-1.5"><code className="disp-sigla m">{SIGLAS[c]}</code>{c}</span>)}
        {CONTESTAVEIS.map(c => <span key={c} className="inline-flex items-center gap-1.5"><code className="disp-sigla c">{SIGLAS[c]}</code>{c}</span>)}
        <span className="inline-flex items-center gap-1.5"><code className="disp-sigla p">&nbsp;&nbsp;</code>Falta conferir</span>
        <span className="inline-flex items-center gap-1.5"><code className="disp-sigla ok">&nbsp;&nbsp;</code>Cadastrou</span>
        <span className="inline-flex items-center gap-1.5"><code className="disp-sigla d">&nbsp;&nbsp;</code>Equipe desativada</span>
      </div>

      <div className="disp-rolo">
        {grupos.length === 0 ? <div className="p-8 text-center text-aco">Nenhuma frota nesta seleção.</div> : (
          <div className="disp-grade-caixa" ref={cruz.caixa}>
          <div className="disp-cruz-h" ref={cruz.linha} aria-hidden="true" />
          <div className="disp-cruz-v" ref={cruz.coluna} aria-hidden="true" />
          <table className="disp-grade" onClick={clicar} onMouseMove={cruz.mover} onMouseLeave={cruz.sair}>
            <colgroup><col style={{ width: 60 }} />{dias.map(d => <col key={d.getDate()} />)}<col style={{ width: 84 }} /></colgroup>
            <thead>
              <tr>
                <th className="disp-fixa">Frota</th>
                {dias.map((d, i) => (
                  <th key={i} className={`${d.getDay() % 6 === 0 ? 'disp-fds' : ''} ${chaves[i] === hoje ? 'disp-hoje' : ''}`}>
                    <button type="button" data-ir-dia={chaves[i]} disabled={foraDoPeriodo(chaves[i])} title="Abrir este dia na lista">{d.getDate()}<small>{LETRA_SEMANA[d.getDay()]}</small></button>
                  </th>
                ))}
                <th className="disp-valor">Valor</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(({ s, regiao, itens }) => {
                const vs = frotas.filter(f => f.supervisor === s).reduce((t, f) => t + chaves.filter(k => ehMultavel(ler(k, f.frota)?.causa)).length, 0) * valor;
                return [
                  <tr key={s} className="disp-grupo"><td colSpan={dias.length + 1}>{s} · {regiao}</td><td className={`disp-valor ${vs ? 'text-erro' : ''}`}>{brlNegativo(vs)}</td></tr>,
                  ...itens.map(f => {
                    let v = 0;
                    const celulas = dias.map((d, i) => {
                      const k = chaves[i], l = ler(k, f.frota), fora = foraDoPeriodo(k);
                      const inicio = `${f.frota} · ${datas[i]} · `;
                      let cl = '', sigla = '', dicaTxt = inicio + 'fora do período';
                      // Desativada vale até alguém reativar, mas o ícone só aparece nos dias já liberados (até hoje):
                      // dia fora do período fica listrado, sem ícone, e ganha o ícone sozinho quando a agenda abrir.
                      if (!fora && equipeDesativada(estados, f.frota, k)) { cl = 'd'; dicaTxt = inicio + 'equipe desativada'; }
                      else if (!fora) {
                        if (!l) { cl = 'p'; dicaTxt = inicio + 'falta conferir'; }
                        else if (l.situacao === 'CADASTROU') { cl = 'ok'; dicaTxt = inicio + 'cadastrou'; }
                        else {
                          const m = ehMultavel(l.causa);
                          if (m) v += valor;
                          cl = m ? 'm' : 'c';
                          sigla = SIGLAS[l.causa ?? ''] ?? '?';
                          dicaTxt = `${inicio}${l.causa} · ${m ? brlNegativo(valor) : 'R$ 0'}${l.observacao ? ` · ${l.observacao}` : ''}`;
                        }
                      }
                      return (
                        <td key={k} className={d.getDay() % 6 === 0 ? 'disp-fds' : ''}>
                          <button type="button" className={`disp-cel ${cl}`} data-frota={f.frota} data-dia={k} data-dica={dicaTxt} aria-label={dicaTxt} disabled={fora}>{sigla}</button>
                        </td>
                      );
                    });
                    return (
                      <tr key={f.frota}>
                        <td className="disp-fixa"><button type="button" className="disp-frota" data-frota-hist={f.frota} title={`${f.placa} · ${f.horario} · ${f.local}`}>{f.frota}</button></td>
                        {celulas}
                        <td className={`disp-valor ${v ? 'text-erro' : 'text-aco-claro'}`}>{v ? brlNegativo(v) : '—'}</td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="disp-fixa">Multas</td>
                {chaves.map(k => { const n = visiveis.filter(f => ehMultavel(ler(k, f.frota)?.causa)).length; return <td key={k}>{n || ''}</td>; })}
                <td className="disp-valor text-erro">{brlNegativo(multaveis * valor)}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>

      <div className="disp-dica" ref={cruz.dica} />

      <Popover open={!!alvo} onOpenChange={aberto => { if (!aberto) setAlvo(null); }}>
        <PopoverAnchor virtualRef={ancora} />
        <PopoverContent align="start" collisionPadding={12} className="w-[min(350px,calc(100vw-24px))] rounded-xl p-3.5 shadow-xl">
          {alvo && frotaAlvo && (
            <div key={`${alvo.dia}|${alvo.frota}`}>
              <h3 className="font-codigo text-sm font-extrabold">Frota {alvo.frota}</h3>
              <p className="mb-2.5 text-xs text-aco first-letter:uppercase">{textoAlvo} · {frotaAlvo.horario}</p>
              {desdeAlvo ? (
                <>
                  <p className="mb-3 flex items-start gap-2 text-[13px] leading-snug text-aco"><PowerOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span>Equipe desativada desde <b className="text-tinta">{dataDe(desdeAlvo).toLocaleDateString('pt-BR')}</b>. Esses dias não entram na conta.</span></p>
                  <Button variant="outline" size="sm" className="w-full font-bold" onClick={reativar}><Power />Reativar a equipe</Button>
                  <p className="mt-2 text-[11.5px] leading-snug text-aco">A partir de {dataDe(alvo.dia).toLocaleDateString('pt-BR')} o quadradinho fica sem dados e a equipe volta a contar.</p>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="mb-3 border-concluido-marca bg-concluido-fundo text-concluido hover:bg-concluido-fundo hover:text-concluido"
                    onClick={() => { gravar([{ dia: alvo.dia, frota: alvo.frota, situacao: 'CADASTROU', causa: null, observacao: null }]); setAlvo(null); }}>Cadastrou</Button>
                  <Motivos valor={valor} causa={lancAlvo?.causa} observacao={lancAlvo?.observacao}
                    onEscolher={(causa, observacao) => { gravar([{ dia: alvo.dia, frota: alvo.frota, situacao: 'OCORRENCIA', causa, observacao }]); setAlvo(null); }}
                    onLimpar={lancAlvo ? () => { desmarcar(alvo.dia, alvo.frota); setAlvo(null); } : undefined} />
                  <div className="mt-3 border-t border-linha pt-3">
                    <Button variant="outline" size="sm" className="w-full font-bold text-aco" onClick={desativar}><PowerOff />Desativar equipe</Button>
                    <p className="mt-2 text-[11.5px] leading-snug text-aco">A partir de {dataDe(alvo.dia).toLocaleDateString('pt-BR')} a equipe fica desativada, todo dia, até alguém reativar. Apaga as marcações dela daqui em diante.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Sheet open={!!historico} onOpenChange={aberto => { if (!aberto) setHistorico(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-sm">
          {historico && <HistoricoFrota frota={historico} chaves={chaves} mes={mes} valor={valor} ler={ler} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function HistoricoFrota({ frota: f, chaves, mes, valor, ler }: { frota: Frota; chaves: string[]; mes: number; valor: number; ler: PropsVisao['ler'] }) {
  const eventos = chaves.map(k => ({ k, l: ler(k, f.frota) })).filter(e => e.l?.situacao === 'OCORRENCIA');
  const multas = eventos.filter(e => ehMultavel(e.l?.causa)).length;
  return (
    <>
      <SheetHeader className="pb-0">
        <SheetTitle className="font-codigo text-xl font-bold">{f.frota}</SheetTitle>
        <SheetDescription>{NOMES_MES[mes]}: o que aconteceu com esta frota.</SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-6">
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-aco">Placa</dt><dd className="font-codigo font-semibold">{f.placa}</dd>
          <dt className="text-aco">Supervisor</dt><dd className="font-semibold">{f.supervisor}</dd>
          <dt className="text-aco">Escala</dt><dd className="font-semibold">{f.escala}</dd>
          <dt className="text-aco">Horário</dt><dd className="font-semibold">{f.horario}</dd>
          <dt className="text-aco">Local</dt><dd className="font-semibold">{f.local}</dd>
        </dl>
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-lg bg-nevoa px-3 py-2.5"><p className="text-[11.5px] text-aco">Multas no mês</p><p className={`text-lg font-extrabold tabular-nums ${multas ? 'text-erro' : ''}`}>{brlNegativo(multas * valor)}</p></div>
          <div className="rounded-lg bg-nevoa px-3 py-2.5"><p className="text-[11.5px] text-aco">Ocorrências</p><p className="text-lg font-extrabold tabular-nums">{eventos.length}</p></div>
        </div>
        <h4 className="mb-1.5 text-[13px] font-extrabold">O que aconteceu</h4>
        {!eventos.length && <p className="text-sm text-aco">Nenhuma ocorrência neste mês.</p>}
        {eventos.map(({ k, l }) => {
          const d = dataDe(k), m = ehMultavel(l?.causa);
          return (
            <div key={k} className="border-t border-[#edf2f3] py-2 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap tabular-nums">{curta(d)} <span className="text-aco">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span></span>
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold ${m ? 'border-[#ffc7ce] bg-[#ffc7ce]/25 text-[#9c0006]' : 'border-[#f5d76e] bg-[#ffeb9c]/40 text-[#7a4600]'}`}>{l?.causa} <small className="font-semibold opacity-85">{m ? brlNegativo(valor) : 'R$ 0'}</small></span>
              </div>
              {l?.observacao && <p className="mt-1 text-xs text-aco">{l.observacao}</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
