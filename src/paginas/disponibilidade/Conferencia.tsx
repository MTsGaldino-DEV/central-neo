import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ptBR } from 'react-day-picker/locale';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AvisoErro } from '@/components/faturamento/AvisoErro';
import { definirEquipeAtiva, lerConfig, lerEstados, lerFrotas, lerMes, limpar, marcar } from '@/lib/disponibilidade';
import {
  INICIO_CONTROLE, NOMES_MES, agruparEstados, chaveDia, chaveMes, comEstadoEquipe, dataDe, diasDoMes, ehMultavel, equipeDesativada, somarDias,
  type ConfigDisp, type EstadosEquipe, type Frota, type Lancamento,
} from '@/lib/disponibilidadeRegras';
import { traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { GradeMes } from './GradeMes';
import { ListaDia } from './ListaDia';
import './disponibilidade.css';

type MapaMes = Record<string, Lancamento>;
const chaveLinha = (dia: string, frota: number) => `${dia}|${frota}`;
const ONDE = 'Conferência da disponibilidade';

export default function ConferenciaDisp() {
  const [params, setParams] = useSearchParams();
  const hoje = chaveDia(new Date());
  const mesHoje = hoje.slice(0, 7);
  const mesInicio = INICIO_CONTROLE.slice(0, 7);

  // A visão mensal é a principal ao entrar na aba (Matheus, 06/11/2026).
  const visao = params.get('visao') === 'dia' ? 'dia' : 'mes';
  const diaUrl = params.get('dia') ?? '';
  const ontem = somarDias(hoje, -1);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaUrl) && diaUrl >= INICIO_CONTROLE && diaUrl <= hoje ? diaUrl : ontem;
  const mesUrl = params.get('mes') ?? '';
  const mesTexto = /^\d{4}-\d{2}$/.test(mesUrl) && mesUrl >= mesInicio && mesUrl <= mesHoje ? mesUrl : mesHoje;
  const ano = Number(mesTexto.slice(0, 4)), mes = Number(mesTexto.slice(5, 7)) - 1;
  const sup = params.get('sup') ?? 'T';
  const verDia = params.get('ver') ?? 'T';
  const verMes = params.get('frotas') ?? 'T';

  const alterar = useCallback((mudancas: Record<string, string | null>) => {
    setParams(p => {
      const n = new URLSearchParams(p);
      for (const [k, v] of Object.entries(mudancas)) { if (v === null) n.delete(k); else n.set(k, v); }
      return n;
    }, { replace: true });
  }, [setParams]);

  const [frotas, setFrotas] = useState<Frota[] | null>(null);
  const [config, setConfig] = useState<ConfigDisp | null>(null);
  const [estados, setEstados] = useState<EstadosEquipe | null>(null);
  const [porMes, setPorMes] = useState<Record<string, MapaMes>>({});
  const [falha, setFalha] = useState<ErroAmigavel | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [calAberto, setCalAberto] = useState(false);
  const [calMes, setCalMes] = useState<Date>(dataDe(dia));
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([lerFrotas(), lerConfig(), lerEstados()])
      .then(([f, c, e]) => { if (vivo) { setFrotas(f); setConfig(c); setEstados(agruparEstados(e)); } })
      .catch(e => { if (vivo) setFalha(traduzirErro(e, ONDE)); });
    return () => { vivo = false; };
  }, [tentativa]);

  const garantirMes = useCallback((a: number, m: number) => {
    const k = chaveMes(a, m);
    return lerMes(a, m)
      .then(linhas => setPorMes(atual => ({ ...atual, [k]: Object.fromEntries(linhas.map(l => [chaveLinha(l.dia, l.frota), l])) })))
      .catch(e => setFalha(traduzirErro(e, ONDE)));
  }, []);

  // O mês em tela é sempre relido: outra pessoa pode ter marcado.
  const mesDados = visao === 'dia' ? dia.slice(0, 7) : mesTexto;
  useEffect(() => { void garantirMes(Number(mesDados.slice(0, 4)), Number(mesDados.slice(5, 7)) - 1); }, [mesDados, garantirMes, tentativa]);

  const ler = useCallback((d: string, frota: number) => porMes[d.slice(0, 7)]?.[chaveLinha(d, frota)], [porMes]);

  /** Mostra na hora; se o banco recusar, volta como estava e avisa. */
  const aplicar = useCallback(async (alteradas: { dia: string; frota: number; linha: Lancamento | null }[], salvar: () => Promise<void>) => {
    setFalha(null);
    const antes = alteradas.map(a => ({ ...a, linha: ler(a.dia, a.frota) ?? null }));
    const escrever = (lista: typeof alteradas) => setPorMes(atual => {
      const n = { ...atual };
      for (const { dia: d, frota, linha } of lista) {
        const k = d.slice(0, 7), m = { ...(n[k] ?? {}) };
        if (linha) m[chaveLinha(d, frota)] = linha; else delete m[chaveLinha(d, frota)];
        n[k] = m;
      }
      return n;
    });
    escrever(alteradas);
    try { await salvar(); }
    catch (e) { escrever(antes); setFalha(traduzirErro(e, ONDE)); }
  }, [ler]);

  const gravar = useCallback((linhas: Lancamento[]) => { void aplicar(linhas.map(l => ({ dia: l.dia, frota: l.frota, linha: l })), () => marcar(linhas)); }, [aplicar]);
  const desmarcar = useCallback((d: string, frota: number) => { void aplicar([{ dia: d, frota, linha: null }], () => limpar(d, frota)); }, [aplicar]);

  /**
   * Desativa ou reativa a equipe a partir do dia. Mostra na hora; se o banco recusar, volta como estava e avisa.
   * Ao desativar, as marcações dos dias que passam a valer como desativados somem (o banco também as apaga).
   */
  const alterarEquipe = useCallback(async (frota: number, d: string, ativa: boolean) => {
    if (!estados) return;
    setFalha(null);
    const novos = comEstadoEquipe(estados, frota, d, ativa);
    const apagadas: Lancamento[] = [];
    if (!ativa) {
      for (const m of Object.values(porMes)) for (const l of Object.values(m)) {
        if (l.frota === frota && l.dia >= d && equipeDesativada(novos, frota, l.dia)) apagadas.push(l);
      }
    }
    setEstados(novos);
    if (apagadas.length) setPorMes(atual => {
      const n = { ...atual };
      for (const l of apagadas) { const k = l.dia.slice(0, 7), m = { ...(n[k] ?? {}) }; delete m[chaveLinha(l.dia, l.frota)]; n[k] = m; }
      return n;
    });
    try { await definirEquipeAtiva(frota, d, ativa); }
    catch (e) {
      setEstados(estados);
      if (apagadas.length) setPorMes(atual => {
        const n = { ...atual };
        for (const l of apagadas) { const k = l.dia.slice(0, 7); n[k] = { ...(n[k] ?? {}), [chaveLinha(l.dia, l.frota)]: l }; }
        return n;
      });
      setFalha(traduzirErro(e, ONDE));
    }
  }, [estados, porMes]);

  const pronto = !!frotas && !!config && !!estados && !!porMes[mesDados];
  const valor = config?.valor_ocorrencia ?? 0;

  /** Baixa a visão em tela (mês ou dia) com os filtros ativos. exceljs só é carregado aqui. */
  const baixarExcel = async () => {
    if (!frotas || !estados || exportando) return;
    setExportando(true);
    try {
      const { exportarConferenciaMes, exportarConferenciaDia } = await import('@/lib/disponibilidadeExcel');
      if (visao === 'mes') await exportarConferenciaMes({ ano, mes, hoje, frotas, valor, ler, estados, sup, ver: verMes });
      else await exportarConferenciaDia({ dia, frotas, valor, ler, estados, sup, ver: verDia });
    } catch (e) { setFalha(traduzirErro(e, ONDE)); }
    finally { setExportando(false); }
  };

  const mudarMes = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    alterar({ mes: chaveMes(d.getFullYear(), d.getMonth()) });
  };

  // Pontos do mini calendário: conferido, com multa ou em andamento.
  const situacaoDias = useMemo(() => {
    const r = { conferido: [] as Date[], multa: [] as Date[], andamento: [] as Date[] };
    if (!frotas || !estados) return r;
    for (const d of diasDoMes(calMes.getFullYear(), calMes.getMonth())) {
      const k = chaveDia(d);
      // Equipe desativada no dia não precisa de conferência.
      const exigidas = frotas.filter(f => !equipeDesativada(estados, f.frota, k));
      const linhas = exigidas.map(f => porMes[k.slice(0, 7)]?.[chaveLinha(k, f.frota)]).filter(Boolean);
      if (!linhas.length) continue;
      if (linhas.length < exigidas.length) r.andamento.push(d);
      else if (linhas.some(l => ehMultavel(l?.causa))) r.multa.push(d);
      else r.conferido.push(d);
    }
    return r;
  }, [calMes, frotas, estados, porMes]);

  const textoDia = dataDe(dia).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const distancia = Math.round((dataDe(hoje).getTime() - dataDe(dia).getTime()) / 864e5);
  const relativo = distancia === 1 ? 'ontem' : distancia === 0 ? 'hoje' : `há ${distancia} dias`;

  return (
    <div className={`mx-auto w-full px-4 pb-14 pt-5 lg:px-7 ${visao === 'mes' ? 'max-w-[1680px]' : 'max-w-[1240px]'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <h2 className="text-[23px] font-extrabold tracking-tight">{visao === 'mes' ? 'Conferência do mês' : 'Conferência do dia'}</h2>
          <p className="text-aco">{visao === 'mes' ? 'Clique na célula para marcar o dia ou no número da frota para ver o histórico.' : 'Confira no GDIS e marque cada equipe.'}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
          <ToggleGroup type="single" value={visao} aria-label="Visão" onValueChange={(v: string) => {
              if (v === 'dia') alterar({ visao: 'dia', dia });
              // Volta para o mês do dia que estava aberto.
              else if (v === 'mes') alterar({ visao: null, dia: null, mes: dia.slice(0, 7) === mesHoje ? null : dia.slice(0, 7) });
            }}
            className="w-full gap-0.5 rounded-lg bg-[#eaf0f1] p-[3px] md:w-auto">
            <ToggleGroupItem value="mes" className="flex-1 rounded-md px-3.5 font-bold text-aco data-[state=on]:bg-white data-[state=on]:text-tinta data-[state=on]:shadow-sm md:flex-none">Mês inteiro</ToggleGroupItem>
            <ToggleGroupItem value="dia" className="flex-1 rounded-md px-3.5 font-bold text-aco data-[state=on]:bg-white data-[state=on]:text-tinta data-[state=on]:shadow-sm md:flex-none">Dia</ToggleGroupItem>
          </ToggleGroup>

          <Button variant="outline" className="font-bold" disabled={!pronto || exportando} onClick={() => void baixarExcel()}
            title={visao === 'mes' ? 'Baixar o mês em Excel (grade, resumo e ocorrências)' : 'Baixar o dia em Excel'}>
            {exportando ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <FileSpreadsheet />}
            {exportando ? 'Gerando…' : 'Baixar Excel'}
          </Button>

          {visao === 'mes' ? (
            <div className="flex w-full items-center justify-between gap-1 rounded-[10px] border border-linha bg-white p-1 md:w-auto">
              <Button variant="ghost" size="icon" aria-label="Mês anterior" disabled={mesTexto <= mesInicio} onClick={() => mudarMes(-1)}><ChevronLeft /></Button>
              <b className="min-w-[150px] text-center font-bold" data-testid="mes-atual">{NOMES_MES[mes]} de {ano}</b>
              <Button variant="ghost" size="icon" aria-label="Próximo mês" disabled={mesTexto >= mesHoje} onClick={() => mudarMes(1)}><ChevronRight /></Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between gap-1 rounded-[10px] border border-linha bg-white p-1 md:w-auto">
              <Button variant="ghost" size="icon" aria-label="Dia anterior" disabled={dia <= INICIO_CONTROLE} onClick={() => alterar({ dia: somarDias(dia, -1) })}><ChevronLeft /></Button>
              <Popover open={calAberto} onOpenChange={aberto => {
                setCalAberto(aberto);
                if (aberto) { const d = dataDe(dia); setCalMes(d); void garantirMes(d.getFullYear(), d.getMonth()); }
              }}>
                <PopoverTrigger asChild>
                  <button type="button" title="Escolher o dia" className="min-w-0 flex-1 cursor-pointer rounded-md px-3 py-0.5 text-center hover:bg-sinal-fundo md:min-w-[210px]">
                    <b className="block text-sm font-bold first-letter:uppercase" data-testid="dia-atual">{textoDia}</b>
                    <span className="block text-[11.5px] text-aco">{relativo} · trocar</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto rounded-xl p-2 shadow-xl">
                  <Calendar mode="single" locale={ptBR} required
                    selected={dataDe(dia)} month={calMes}
                    onMonthChange={m => { setCalMes(m); void garantirMes(m.getFullYear(), m.getMonth()); }}
                    onSelect={d => { if (d) { alterar({ dia: chaveDia(d) }); setCalAberto(false); } }}
                    startMonth={dataDe(INICIO_CONTROLE)} endMonth={dataDe(hoje)}
                    disabled={[{ before: dataDe(INICIO_CONTROLE) }, { after: dataDe(hoje) }]} showOutsideDays={false}
                    modifiers={situacaoDias}
                    modifiersClassNames={{
                      conferido: 'disp-dia-ponto [--ponto:var(--color-concluido-marca)]',
                      multa: 'disp-dia-ponto [--ponto:var(--color-erro-marca)]',
                      andamento: 'disp-dia-ponto [--ponto:var(--color-pendente-marca)]',
                    }} />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-linha px-2 pb-1 pt-2 text-[11.5px] text-aco">
                    <span className="inline-flex items-center gap-1.5"><i className="size-[7px] rounded-full bg-concluido-marca" />Conferido</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-[7px] rounded-full bg-erro-marca" />Com multa</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-[7px] rounded-full bg-pendente-marca" />Em andamento</span>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" aria-label="Próximo dia" disabled={dia >= hoje} onClick={() => alterar({ dia: somarDias(dia, 1) })}><ChevronRight /></Button>
            </div>
          )}
        </div>
      </div>

      {falha && <div className="mb-4"><AvisoErro erro={falha} contexto="Não foi possível concluir." onTentar={() => { setFalha(null); setTentativa(t => t + 1); }} /></div>}

      {!pronto && !falha && <div className="flex justify-center p-16 text-aco" role="status"><Loader2 size={18} className="animate-spin motion-reduce:animate-none" /><span className="sr-only">Carregando a conferência</span></div>}

      {pronto && frotas && estados && (visao === 'mes' ? (
        <GradeMes ano={ano} mes={mes} hoje={hoje} frotas={frotas} valor={valor} ler={ler} gravar={gravar} desmarcar={desmarcar}
          estados={estados} alterarEquipe={alterarEquipe} sup={sup} setSup={s => alterar({ sup: s === 'T' ? null : s })} ver={verMes} setVer={v => alterar({ frotas: v === 'T' ? null : v })}
          abrirDia={d => alterar({ visao: 'dia', dia: d })} />
      ) : (
        <ListaDia dia={dia} frotas={frotas} valor={valor} ler={ler} gravar={gravar} desmarcar={desmarcar}
          estados={estados} alterarEquipe={alterarEquipe} sup={sup} setSup={s => alterar({ sup: s === 'T' ? null : s })} ver={verDia} setVer={v => alterar({ ver: v === 'T' ? null : v })} />
      ))}
    </div>
  );
}
