import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { conferirServicoFat, desconferirServicoFat, historicoServicoFat, linhasServicoFat, manutencaoServicoFat,
  type EventoFat, type ItemManutencaoFat, type LinhaServicoFat, type ServicoFat } from '@/lib/faturamentoServicos';
import { fraseServico, MOTIVOS_FAT, notaCalculo, outraUnidadeFat, usFat, valorFat } from '@/lib/faturamentoTexto';
import { TIPOS_TURMA_FAT } from '@/lib/faturamentoPlanilhas';
import { baseServicoFat, fatorSobreBaseFat } from '@/lib/faturamentoFator';
import { configFat, contratosFat } from '@/lib/faturamento';
import { traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { useDadosComCache } from '@/lib/useDadosComCache';
import { useUnidadeFat } from '@/lib/useUnidadeFat';
import { JanelaModal } from '@/components/faturamento/JanelaModal';
import { AvisoErro } from '@/components/faturamento/AvisoErro';
import { SeloSituacao } from './SeloSituacao';

const rotulo = 'text-[11px] font-bold tracking-wide text-aco uppercase';
const fator = (n: number | null | undefined) => n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
const quando = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Janela do serviço: quem e o quê em destaque, como o devido foi calculado, o que a CEMIG pagou e o 1.NS da Manutenção. */
export function DetalheServico({ servico, aberto, onFechar, onAlterado }: {
  servico: ServicoFat; aberto: boolean; onFechar: () => void; onAlterado: () => void;
}) {
  const [linhas, setLinhas] = useState<LinhaServicoFat[] | null>(null);
  const [manutencao, setManutencao] = useState<{ existe: boolean; itens: ItemManutencaoFat[] } | null>(null);
  const [historico, setHistorico] = useState<EventoFat[] | null>(null);
  const [obs, setObs] = useState(servico.observacao_manual ?? '');
  const [erro, setErro] = useState<ErroAmigavel | null>(null), [aviso, setAviso] = useState(''), [salvando, setSalvando] = useState(false);
  const contrato = useDadosComCache('contrato', contratosFat, [], aberto, 'Janela do serviço › descrição dos códigos');
  const config = useDadosComCache('config', configFat, [], aberto, 'Janela do serviço › configuração');
  const { unidade, taxa } = useUnidadeFat();
  const conferido = servico.situacao === 'CONFERIDO';
  const rural = config.dados?.rural ?? 1.2;

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setLinhas(null); setManutencao(null); setHistorico(null); setErro(null); setAviso(''); setObs(servico.observacao_manual ?? '');
    const onde = 'Janela do serviço › buscar no banco';
    linhasServicoFat(servico.fatura, servico.numserv).then(l => { if (vivo) setLinhas(l); }).catch(e => { if (vivo) setErro(traduzirErro(e, onde)); });
    if (servico.tem_1ns) manutencaoServicoFat(servico.numserv).then(m => { if (vivo) setManutencao(m); }).catch(e => { if (vivo) setErro(traduzirErro(e, 'Janela do serviço › Manutenção')); });
    historicoServicoFat(servico.fatura, servico.numserv).then(h => { if (vivo) setHistorico(h); }).catch(() => { if (vivo) setHistorico([]); });
    return () => { vivo = false; };
  }, [aberto, servico.fatura, servico.numserv, servico.observacao_manual, servico.tem_1ns]);

  async function salvar() {
    if (!conferido && obs.trim().length < 3) { setAviso('Escreva uma observação com pelo menos 3 letras.'); return; }
    setSalvando(true); setErro(null); setAviso('');
    try {
      if (conferido) await desconferirServicoFat(servico.fatura, servico.numserv);
      else await conferirServicoFat(servico.fatura, servico.numserv, obs.trim());
      onAlterado(); onFechar();
    } catch (e) { setErro(traduzirErro(e, `Janela do serviço › ${conferido ? 'desfazer conferência' : 'marcar como conferido'}`)); } finally { setSalvando(false); }
  }

  const descricao = (l: LinhaServicoFat) => contrato.dados?.find(c => c.codigo === l.codserv && (!l.tabela || c.tabela === l.tabela))?.descricao?.split(/\r?\n/)[0] ?? '—';
  const lista = linhas ?? [];
  const normais = lista.filter(l => l.codserv !== '1.NS'), ns = lista.filter(l => l.codserv === '1.NS');
  // Área pela Fatura Completa (cod_tip_area); homem-hora não tem quantidade urbana/rural.
  const zonaLinha = (l: LinhaServicoFat) => l.area ?? (Number(l.rural) > 0 ? (Number(l.urbano) > 0 ? 'AMBAS' : 'RURAL') : 'URBANO');
  const temUrbano = lista.some(l => ['URBANO', 'AMBAS'].includes(zonaLinha(l))), temRural = lista.some(l => ['RURAL', 'AMBAS'].includes(zonaLinha(l)));
  const zona = temUrbano && temRural ? 'Urbana e rural' : temRural ? 'Rural' : 'Urbana';
  const outros = servico.codigos.filter(c => c !== '1.NS');
  const glosas = lista.filter(l => Number(l.glosa) !== 0);
  const conta = (l: LinhaServicoFat) => {
    const f = contrato.dados?.find(c => c.codigo === l.codserv && c.tabela === l.tabela);
    const fx = servico.fator_aplicado === 'COD' ? f?.fator_cod : f?.fator_csc;
    const devido = servico.moto ? (servico.fator_aplicado === 'COD' ? l.moto_cod : l.moto_csc) : (servico.fator_aplicado === 'COD' ? l.devido_cod : l.devido_csc);
    const homemHora = l.observacoes?.split('; ').find(o => o.startsWith('homem-hora'));
    if (l.horas != null && l.us_hora != null && devido != null) {
      const min = Math.round(Number(l.horas) * 60);
      return `${l.codserv}: ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')} × ${fator(l.us_hora)} US/h × ${fator(l.multiplicador)} (${l.despacho ?? servico.fator_aplicado} ${zonaLinha(l) === 'RURAL' ? 'rural' : 'urbano'}) = ${usFat(devido)} US devido · a CEMIG pagou ${usFat(l.creditado)}`;
    }
    if (devido == null) return homemHora ? `${l.codserv}: ${homemHora}` : null;
    const qtd = [Number(l.urbano) > 0 && `${fator(l.urbano)} urbano`, Number(l.rural) > 0 && `${fator(l.rural)} rural × ${fator(rural)}`].filter(Boolean).join(' + ');
    return `${l.codserv}: fator ${servico.fator_aplicado ?? 'CSC'} ${fator(fx)} × ${qtd || '1'}${servico.moto ? ' (valor Moto)' : ''} = ${usFat(devido)} US devido · a CEMIG pagou ${usFat(l.creditado)}`;
  };
  // Fator sobre a base CSC urbano × 1,0: quanto a CEMIG aplicou e quanto o contrato pede.
  const base = linhas && contrato.dados ? baseServicoFat(normais, contrato.dados, servico.rc_por_atendimento) : null;
  const fatorPago = fatorSobreBaseFat(servico.pago_comparado, base), fatorContrato = fatorSobreBaseFat(servico.devido, base);
  const fatorTexto = (f: number | null) => f == null ? '—' : f.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const etiqueta = 'inline-flex items-center gap-1 rounded-full border border-linha bg-nevoa px-2.5 py-1 text-xs font-semibold text-tinta';
  const dif = servico.diferenca ?? 0;

  return (
    <JanelaModal aberta={aberto} onFechar={onFechar} largura="lg"
      titulo={<span className="flex w-full flex-wrap items-start justify-between gap-3 pr-2">
        <span><span className={`block ${rotulo}`}>Serviço da fatura {servico.fatura}</span>
          <span className="font-codigo text-2xl font-extrabold">{servico.numserv}</span>
          <span className="block text-xs font-normal text-aco">{servico.cidade ?? '—'} · zona {zona.toLowerCase()}</span></span>
        <span className="text-right"><SeloSituacao situacao={servico.situacao} />
          {servico.diferenca != null && !servico.bate && <span className={`block font-codigo text-xl font-extrabold ${dif < 0 ? 'text-erro' : dif > 0 ? 'text-concluido' : 'text-aco'}`}>{valorFat(dif, unidade, taxa, true)}</span>}
          {servico.diferenca != null && !servico.bate && outraUnidadeFat(dif, unidade, taxa) && <span className="block font-codigo text-[11px] font-normal text-aco">{outraUnidadeFat(dif, unidade, taxa)}</span>}</span>
      </span>}
      rodape={<button type="button" onClick={() => void salvar()} disabled={salvando}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${conferido ? 'bg-aco hover:bg-tinta' : 'bg-sinal hover:bg-sinal-forte'}`}>
        {salvando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{conferido ? 'Desfazer conferência' : 'Marcar como conferido'}
      </button>}>
      <div className="space-y-4 text-sm">
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-linha sm:grid-cols-5">
          {[['Nº do serviço', servico.numserv, true], ['Tipo do serviço', servico.tipo_serv, false], ['Nº de frota', servico.numvei ?? '—', true],
            ['Tipo da frota', TIPOS_TURMA_FAT[servico.tipo_turma ?? ''] ?? 'Não identificada', false]].map(([r, v, mono]) => (
            <div key={r as string} className="border-b border-linha px-3 py-2.5 sm:border-r sm:border-b-0 sm:last:border-r-0">
              <dt className={rotulo}>{r}</dt><dd className={`mt-0.5 text-base font-extrabold text-tinta ${mono ? 'font-codigo' : ''}`}>{v}</dd>
            </div>
          ))}
          <div className="col-span-2 px-3 py-2.5 sm:col-span-1" data-fator-pago>
            <dt className={rotulo}>Fator pago</dt>
            <dd className={`mt-0.5 font-codigo text-base font-extrabold ${fatorPago != null && fatorContrato != null && fatorPago !== fatorContrato ? 'text-erro' : 'text-tinta'}`}>
              {!linhas ? '…' : Number(servico.pago_comparado) === 0 && base ? 'não pagou' : `× ${fatorTexto(fatorPago)}`}</dd>
            {fatorContrato != null && <dd className="text-[11px] text-aco">contrato × {fatorTexto(fatorContrato)}</dd>}
          </div>
        </dl>
        {servico.fator_12 && <p className="flex items-start gap-2 rounded-lg bg-revisao-fundo px-3 py-2 text-xs text-revisao">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span><b>Possível fator errado: {servico.fator_12} o previsto.</b> Confira o despacho (CSC/COD) e a zona (urbana/rural).</span></p>}

        <section className="rounded-xl border border-sinal/30 bg-sinal-fundo p-3">
          <p className={rotulo}>O que aconteceu</p>
          <p className="mt-1 font-semibold text-tinta">{fraseServico(servico)}</p>
          {servico.motivo && <p className="text-xs text-aco">{MOTIVOS_FAT[servico.motivo]}</p>}
        </section>

        <section>
          <p className={rotulo}>Como o devido foi calculado</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={etiqueta}>Despacho <b className="text-sinal">{servico.fator_aplicado === 'COD' ? 'COD (lista)' : servico.fator_aplicado ?? '—'}</b></span>
            <span className={etiqueta}>Zona <b className="text-sinal">{temRural ? `Rural × ${fator(rural)}` : 'Urbano'}</b></span>
            <span className={etiqueta}>Tabela <b className="text-sinal">{servico.tabela ?? 'fora'}</b></span>
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs text-aco">
            {servico.rc_por_atendimento ? <p>{notaCalculo(servico, servico.codigos)}</p> : normais.map(l => { const c = conta(l); return c && <p key={l.id} className="font-codigo">{c}</p>; })}
            {servico.tabela === 'MISTO' && <p>Serviço mistura Tabela 11 e 12: soma por linha, conferir.</p>}
          </div>
          {servico.tem_1ns && outros.length > 0 && <p className="mt-2 flex items-start gap-2 rounded-lg bg-revisao-fundo px-3 py-2 text-xs text-revisao">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span><b>Tem {outros.join(', ')} e 1.NS.</b> Parte do pagamento pode vir pela Manutenção.</span></p>}
          {servico.tem_1ns && !servico.na_manutencao && <p className="mt-2 flex items-start gap-2 rounded-lg bg-pendente-fundo px-3 py-2 text-xs text-pendente">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span><b>Não encontrado na Manutenção.</b> A nota deste serviço ainda não foi fechada.</span></p>}
        </section>

        {erro && <AvisoErro erro={erro} compacto />}

        <section>
          <p className={rotulo}>O que a CEMIG pagou na fatura</p>
          {!linhas ? (!erro && <p className="mt-2 flex items-center gap-2 text-xs text-aco"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Buscando as linhas…</p>) : (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="text-[11px] text-aco uppercase"><tr>
                  <th className="py-1.5 pr-2">Código</th><th className="pr-2">Descrição</th><th className="pr-2">Zona</th>
                  <th className="pr-2 text-right">Pago</th><th className="text-right">Multa / estorno</th>
                </tr></thead>
                <tbody>
                  {normais.map(l => (
                    <tr key={l.id} className="border-t border-linha">
                      <td className="py-1.5 pr-2 font-codigo font-bold">{l.codserv}</td><td className="pr-2">{descricao(l)}</td>
                      <td className="pr-2">{({ RURAL: 'Rural', AMBAS: 'Urbana e rural' } as Record<string, string>)[zonaLinha(l)] ?? 'Urbana'}</td>
                      <td className={`pr-2 text-right font-codigo ${Number(l.creditado) === 0 && (servico.devido ?? 0) > 0 ? 'font-bold text-erro' : ''}`}>{usFat(l.creditado)}</td>
                      <td className={`text-right font-codigo ${Number(l.glosa) < 0 ? 'text-erro' : 'text-aco-claro'}`}>{Number(l.glosa) ? usFat(l.glosa) : '—'}</td>
                    </tr>
                  ))}
                  {ns.map(l => (
                    <tr key={l.id} className="border-t border-linha bg-revisao-fundo/50">
                      <td className="py-1.5 pr-2 font-codigo font-bold text-revisao">1.NS</td>
                      <td className="pr-2">NS executada <span className="text-aco">· código informativo, valor pela Manutenção</span></td>
                      <td className="pr-2">{Number(l.rural) > 0 ? 'Rural' : 'Urbana'}</td>
                      <td className="pr-2 text-right font-codigo text-revisao">{usFat(l.creditado)}</td>
                      <td className="text-right font-codigo text-aco-claro">{Number(l.glosa) ? usFat(l.glosa) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {manutencao && manutencao.itens.length > 0 && <section>
          <p className={`${rotulo} text-revisao`}>1.NS · Pago pela Manutenção <span className="font-semibold tracking-normal normal-case text-aco">(não entra na soma)</span></p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-xs">
              <thead className="text-[11px] text-aco uppercase"><tr>
                <th className="py-1.5 pr-2">Código</th><th className="pr-2">Observação do contrato</th><th className="pr-2 text-right">Qtd.</th><th className="text-right">US</th>
              </tr></thead>
              <tbody>{manutencao.itens.map((i, n) => (
                <tr key={n} className="border-t border-linha align-top">
                  <td className="py-1.5 pr-2 font-codigo font-bold text-revisao">{i.codigo ?? <span className="font-sans font-normal text-aco">sem código</span>}</td>
                  <td className="pr-2">{i.codigo ? <><b>{[i.operacao, i.atividade].filter(Boolean).join(' · ')}</b>{i.descricao && <span className="block text-aco">{i.descricao}</span>}</> : '—'}</td>
                  <td className="pr-2 text-right font-codigo">{fator(i.quantidade)}</td>
                  <td className="text-right font-codigo font-bold text-revisao">{usFat(i.valor)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>}

        {glosas.length > 0 && <section className="rounded-xl border border-erro/20 bg-erro-fundo p-3">
          <p className={rotulo}>Glosas (fora do saldo)</p>
          <p className="text-xs text-aco">Multas {usFat(servico.multas)} · estorno {usFat(servico.estorno)}</p>
          <ul className="mt-1 space-y-1 text-xs">{glosas.map(l => (
            <li key={l.id}><b className="font-codigo">{l.codserv}</b> {usFat(l.glosa)}: {l.justificativa || 'sem justificativa na planilha'}</li>
          ))}</ul>
        </section>}

        <section>
          <p className={rotulo}>Histórico</p>
          {!historico ? <p className="mt-1 text-xs text-aco">Carregando…</p> : !historico.length ? <p className="mt-1 text-xs text-aco">Sem registros.</p> : (
            <ul className="mt-1 space-y-1 text-xs">{historico.map((h, n) => (
              <li key={n} className="grid grid-cols-[104px_1fr] gap-2">
                <span className="font-codigo text-aco">{quando(h.data)}</span>
                <span>{h.tipo === 'IMPORTADA' ? `Importado na fatura ${servico.fatura}` : h.tipo === 'CONFERIDO' ? `Conferido: ${h.observacao ?? ''}` : 'Conferência desfeita'}
                  {h.usuario_nome && <span className="text-aco"> · {h.usuario_nome}</span>}</span>
              </li>
            ))}</ul>
          )}
        </section>

        <section>
          <label htmlFor="obs-servico" className={rotulo}>Observação</label>
          {servico.revisao_desatualizada && <p className="mt-1 rounded-lg bg-pendente-fundo px-2 py-1 text-xs text-pendente">Os dados mudaram depois da última conferência. Confira de novo.</p>}
          <textarea id="obs-servico" data-autofoco value={obs} onChange={e => setObs(e.target.value)} rows={3} disabled={conferido}
            placeholder="Ex.: conferido com a CEMIG, cobrar na próxima fatura"
            className="mt-1 w-full rounded-lg border border-linha p-2 text-sm focus:border-sinal focus:outline-none disabled:bg-nevoa" />
          {conferido && servico.conferido_em && <p className="text-xs text-aco">Conferido em {new Date(servico.conferido_em).toLocaleString('pt-BR')}. Conferido sai do saldo e da exportação.</p>}
          {aviso && <p role="alert" className="mt-1 text-xs text-erro">{aviso}</p>}
        </section>
      </div>
    </JanelaModal>
  );
}
