import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Power, PowerOff } from 'lucide-react';
import {
  SUPERVISORES, brlNegativo, dataDe, desativadaDesde, ehMultavel, equipeDesativada,
  type EstadosEquipe, type Frota, type Lancamento,
} from '@/lib/disponibilidadeRegras';
import { FaixaResumo, ItemResumo, Pilula } from './Comuns';
import { Motivos } from './Motivos';

export interface PropsVisao {
  frotas: Frota[];
  valor: number;
  ler: (dia: string, frota: number) => Lancamento | undefined;
  gravar: (linhas: Lancamento[]) => void;
  desmarcar: (dia: string, frota: number) => void;
  /** Mudanças de estado das equipes: quem está desativada em cada dia. */
  estados: EstadosEquipe;
  /** Desativa (`ativa` falso) ou reativa a equipe a partir do dia. */
  alterarEquipe: (frota: number, dia: string, ativa: boolean) => void;
  sup: string;
  setSup: (s: string) => void;
}

const regiaoDe = (frotas: Frota[], s: string) => frotas.find(f => f.supervisor === s)?.regiao ?? '';

export function ListaDia({ dia, frotas, valor, ler, gravar, desmarcar, estados, alterarEquipe, sup, setSup, ver, setVer }: PropsVisao & { dia: string; ver: string; setVer: (v: string) => void }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const visiveis = frotas.filter(f => sup === 'T' || f.supervisor === sup);
  const linhas = frotas.map(f => ler(dia, f.frota));
  const cadastraram = linhas.filter(l => l?.situacao === 'CADASTROU').length;
  const multaveis = linhas.filter(l => ehMultavel(l?.causa)).length;
  const contestaveis = linhas.filter(l => l?.situacao === 'OCORRENCIA' && !ehMultavel(l.causa)).length;
  const feitas = cadastraram + multaveis + contestaveis;
  const off = (f: Frota) => equipeDesativada(estados, f.frota, dia);
  const ativas = frotas.filter(f => !off(f)).length;
  // Equipe desativada não precisa de conferência.
  const faltam = visiveis.filter(f => !ler(dia, f.frota) && !off(f));

  const passa = (f: Frota) => {
    const l = ler(dia, f.frota);
    return ver === 'F' ? !l && !off(f) : ver === 'M' ? l?.situacao === 'OCORRENCIA' : true;
  };
  const cadastrou = (frota: number) => { setAberto(null); gravar([{ dia, frota, situacao: 'CADASTROU', causa: null, observacao: null }]); };

  const grupos = SUPERVISORES.filter(s => sup === 'T' || s === sup).map(s => ({ s, todas: frotas.filter(f => f.supervisor === s), itens: frotas.filter(f => f.supervisor === s && passa(f)) })).filter(g => g.itens.length);

  return (
    <>
      <FaixaResumo>
        <ItemResumo largo rotulo="Conferidas" valor={`${feitas} de ${ativas}`} barra={ativas ? feitas / ativas : 0} nota={ativas < frotas.length ? `${frotas.length - ativas} ${frotas.length - ativas === 1 ? 'equipe desativada' : 'equipes desativadas'}` : undefined} />
        <ItemResumo rotulo="Cadastraram" valor={cadastraram} nota="sem ocorrência" />
        <ItemResumo rotulo="Multáveis" valor={brlNegativo(multaveis * valor)} cor="text-erro" nota={`${multaveis} ${multaveis === 1 ? 'ocorrência' : 'ocorrências'}`} />
        <ItemResumo rotulo="Contestáveis" valor={contestaveis} cor="text-pendente" nota="R$ 0 na conta" />
      </FaixaResumo>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Pilula ativa={sup === 'T'} onClick={() => setSup('T')}>Todas</Pilula>
        {SUPERVISORES.map(s => <Pilula key={s} ativa={sup === s} onClick={() => setSup(s)}>{s}</Pilula>)}
        <span className="mx-1 hidden h-5 w-px bg-linha sm:block" aria-hidden="true" />
        <Pilula ativa={ver === 'T'} onClick={() => setVer('T')}>Todas as situações</Pilula>
        <Pilula ativa={ver === 'F'} onClick={() => setVer('F')}>Falta conferir</Pilula>
        <Pilula ativa={ver === 'M'} onClick={() => setVer('M')}>Com motivo</Pilula>
        <Button disabled={!faltam.length} className="w-full font-bold sm:ml-auto sm:w-auto"
          onClick={() => { setAberto(null); gravar(faltam.map(f => ({ dia, frota: f.frota, situacao: 'CADASTROU', causa: null, observacao: null }))); }}>
          {faltam.length ? `Marcar ${faltam.length} que ${faltam.length === 1 ? 'falta' : 'faltam'} como cadastrou` : 'Nada a marcar'}
        </Button>
      </div>

      {!grupos.length && <div className="rounded-xl border border-dashed border-linha bg-white p-6 text-center text-aco">Nenhuma equipe nesta seleção.</div>}
      {grupos.map(({ s, todas, itens }) => {
        const conferidas = todas.filter(f => ler(dia, f.frota)).length;
        const exigidas = todas.filter(f => !off(f)).length;
        const v = todas.filter(f => ehMultavel(ler(dia, f.frota)?.causa)).length * valor;
        return (
          <section key={s} className="mb-3.5 overflow-hidden rounded-xl border border-linha bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-linha bg-[#fbfcfc] px-4 py-2.5">
              <h3 className="text-sm font-extrabold">{s} · {regiaoDe(frotas, s)}</h3>
              <span className="text-right text-[12.5px] text-aco">{conferidas} de {exigidas} conferidas{v > 0 && <> · <b className="text-erro">{brlNegativo(v)}</b></>}</span>
            </div>
            {itens.map(f => {
              const l = ler(dia, f.frota);
              const estaAberto = aberto === f.frota;
              const multa = ehMultavel(l?.causa);
              const desde = desativadaDesde(estados, f.frota, dia);
              return (
                <div key={f.frota} data-frota={f.frota} data-desativada={desde ? 'sim' : undefined} className={`grid grid-cols-[62px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-0.5 border-t border-[#edf2f3] px-4 py-2 first:border-t-0 lg:grid-cols-[62px_98px_62px_138px_minmax(120px,1fr)_300px] ${desde ? 'bg-[#f6f8f9]' : l ? '' : 'bg-[#fffdf6]'}`}>
                  <span className="font-codigo font-semibold">{f.frota}</span>
                  <span className="font-codigo text-[12.5px] text-aco">{f.placa}</span>
                  <span className="hidden text-[13px] text-aco lg:block">{f.escala}</span>
                  <span className="col-span-2 text-[13px] text-aco lg:col-span-1">{f.horario}</span>
                  <span className="col-span-2 truncate text-[13px] text-aco lg:col-span-1" title={f.local}>{f.local}</span>
                  <div className="col-span-2 mt-1.5 flex flex-wrap items-center gap-1.5 lg:col-span-1 lg:mt-0 lg:justify-end">
                    {desde ? (
                      <>
                        <span title={`Desativada desde ${dataDe(desde).toLocaleDateString('pt-BR')}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-linha bg-white px-2.5 py-1.5 text-[12.5px] font-bold text-aco">
<PowerOff className="size-3.5" aria-hidden="true" />Desativada desde {dataDe(desde).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <Button variant="outline" size="sm" aria-label="Reativar equipe" onClick={() => alterarEquipe(f.frota, dia, true)}><Power />Reativar</Button>
                      </>
                    ) : l?.situacao === 'OCORRENCIA' && !estaAberto ? (
                      <>
                        <span title={l.observacao ?? undefined} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[12.5px] font-bold ${multa ? 'border-[#ffc7ce] bg-[#ffc7ce]/25 text-[#9c0006]' : 'border-[#f5d76e] bg-[#ffeb9c]/40 text-[#7a4600]'}`}>
                          {l.causa} <small className="font-semibold opacity-85">{multa ? brlNegativo(valor) : 'R$ 0'}</small>
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setAberto(f.frota)}>Trocar</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" aria-pressed={l?.situacao === 'CADASTROU'} onClick={() => cadastrou(f.frota)}
                          className={l?.situacao === 'CADASTROU' ? 'border-concluido-marca bg-concluido-fundo text-concluido hover:bg-concluido-fundo hover:text-concluido' : 'text-aco'}>Cadastrou</Button>
                        <Button variant="outline" size="sm" aria-expanded={estaAberto} onClick={() => setAberto(estaAberto ? null : f.frota)}
                          className={estaAberto ? 'border-erro-marca bg-erro-fundo text-erro hover:bg-erro-fundo hover:text-erro' : 'text-aco'}>Não cadastrou</Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Desativar a equipe ${f.frota}`} title="Desativar equipe" className="text-aco-claro hover:text-aco"
                          onClick={() => {
                            const quando = dataDe(dia).toLocaleDateString('pt-BR');
                            if (!window.confirm(`Desativar a equipe ${f.frota} a partir de ${quando}?

Os dias seguintes ficam como desativada até alguém reativar, e as marcações dela a partir desta data serão apagadas.`)) return;
                            setAberto(null); alterarEquipe(f.frota, dia, false);
                          }}><PowerOff /></Button>
                      </>
                    )}
                  </div>
                  {estaAberto && (
                    <div className="col-span-full mb-1.5 mt-1 rounded-[10px] border border-linha bg-nevoa p-3">
                      <Motivos valor={valor} causa={l?.causa} observacao={l?.observacao}
                        onEscolher={(causa, observacao) => { setAberto(null); gravar([{ dia, frota: f.frota, situacao: 'OCORRENCIA', causa, observacao }]); }}
                        onLimpar={l ? () => { setAberto(null); desmarcar(dia, f.frota); } : undefined} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
