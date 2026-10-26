import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { conferirServicoFat, desconferirServicoFat, linhasServicoFat, type LinhaServicoFat, type ServicoFat } from '@/lib/faturamentoServicos';
import { fraseServico, MOTIVOS_FAT, notaCalculo, usFat } from '@/lib/faturamentoTexto';
import { TIPOS_TURMA_FAT } from '@/lib/faturamentoPlanilhas';
import { erroFat } from '@/lib/faturamento';
import { JanelaModal } from '@/components/faturamento/JanelaModal';
import { SeloSituacao } from './SeloSituacao';

const rotulo = 'text-[11px] font-bold tracking-wide text-aco uppercase';

/** Janela com tudo de um serviço: frase, cálculo, equipe, linhas, glosas e a conferência manual. */
export function DetalheServico({ servico, aberto, onFechar, onAlterado }: {
  servico: ServicoFat; aberto: boolean; onFechar: () => void; onAlterado: () => void;
}) {
  const [linhas, setLinhas] = useState<LinhaServicoFat[] | null>(null);
  const [obs, setObs] = useState(servico.observacao_manual ?? '');
  const [erro, setErro] = useState(''), [salvando, setSalvando] = useState(false);
  const conferido = servico.situacao === 'CONFERIDO';

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setLinhas(null); setErro(''); setObs(servico.observacao_manual ?? '');
    linhasServicoFat(servico.fatura, servico.numserv).then(l => { if (vivo) setLinhas(l); }).catch(e => { if (vivo) setErro(erroFat(e)); });
    return () => { vivo = false; };
  }, [aberto, servico.fatura, servico.numserv, servico.observacao_manual]);

  async function salvar() {
    if (!conferido && obs.trim().length < 3) { setErro('Escreva uma observação com pelo menos 3 letras.'); return; }
    setSalvando(true); setErro('');
    try {
      if (conferido) await desconferirServicoFat(servico.fatura, servico.numserv);
      else await conferirServicoFat(servico.fatura, servico.numserv, obs.trim());
      onAlterado(); onFechar();
    } catch (e) { setErro(erroFat(e)); } finally { setSalvando(false); }
  }

  const glosas = (linhas ?? []).filter(l => Number(l.glosa) !== 0);
  return (
    <JanelaModal aberta={aberto} onFechar={onFechar} largura="lg"
      titulo={<span className="flex flex-wrap items-center gap-2">Serviço <span className="font-codigo">{servico.numserv}</span>
        <SeloSituacao situacao={servico.situacao} />{servico.motivo && <span className="text-xs font-semibold text-aco">{MOTIVOS_FAT[servico.motivo]}</span>}</span>}
      rodape={<button type="button" onClick={() => void salvar()} disabled={salvando}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${conferido ? 'bg-aco hover:bg-tinta' : 'bg-sinal hover:bg-sinal-forte'}`}>
        {salvando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{conferido ? 'Desfazer conferência' : 'Marcar como conferido'}
      </button>}>
      <div className="space-y-4 text-sm">
        <section className="rounded-xl border border-sinal/30 bg-sinal-fundo p-3">
          <p className={rotulo}>O que aconteceu</p>
          <p className="mt-1 font-semibold text-tinta">{fraseServico(servico)}</p>
          <p className="mt-1 text-xs text-aco">{notaCalculo(servico, servico.codigos)}{servico.tabela === 'MISTO' ? ' Serviço mistura Tabela 11 e 12: soma por linha, conferir.' : ''}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[['Deveria', usFat(servico.devido), ''], ['Pagou', usFat(servico.pago_comparado), ''], ['Diferença', usFat(servico.diferenca), (servico.diferenca ?? 0) < 0 ? 'text-erro' : (servico.diferenca ?? 0) > 0 ? 'text-pendente' : 'text-concluido']].map(([r, v, c]) => (
              <div key={r} className="rounded-lg bg-white px-2 py-1.5"><dt className="text-[11px] text-aco">{r}</dt><dd className={`font-codigo font-bold ${c}`}>{v}</dd></div>
            ))}
          </dl>
        </section>

        <section>
          <p className={rotulo}>Equipe</p>
          <p className="mt-1">{TIPOS_TURMA_FAT[servico.tipo_turma ?? ''] ?? 'Não identificada'} · frota <span className="font-codigo">{servico.numvei ?? '—'}</span> · turma <span className="font-codigo">{servico.ident_turma ?? '—'}</span> · {servico.cidade ?? '—'}</p>
          <p className="text-xs text-aco">Serviço da Fatura Completa × US_Turma da Fatura Resumida. Fator aplicado: {servico.fator_aplicado ?? '—'}{servico.moto ? ' Moto' : ''}.</p>
        </section>

        <section>
          <p className={rotulo}>Linhas do serviço</p>
          {!linhas ? (erro ? null : <p className="mt-2 flex items-center gap-2 text-xs text-aco"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Buscando as linhas…</p>) : (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-[11px] text-aco"><tr>
                  <th className="py-1.5 pr-2">Código</th><th className="pr-2">Tabela</th><th className="pr-2 text-right">Urbano</th><th className="pr-2 text-right">Rural</th>
                  <th className="pr-2 text-right">Creditado</th><th className="pr-2 text-right">Glosa</th><th className="text-right">Devido CSC · COD · Moto</th>
                </tr></thead>
                <tbody>{linhas.map(l => (
                  <tr key={l.id} className="border-t border-linha">
                    <td className="py-1.5 pr-2 font-codigo font-bold">{l.codserv}</td><td className="pr-2">{l.tabela ?? 'fora'}</td>
                    <td className="pr-2 text-right font-codigo">{l.urbano}</td><td className="pr-2 text-right font-codigo">{l.rural}</td>
                    <td className="pr-2 text-right font-codigo">{usFat(l.creditado)}</td>
                    <td className={`pr-2 text-right font-codigo ${Number(l.glosa) < 0 ? 'text-erro' : ''}`}>{Number(l.glosa) ? usFat(l.glosa) : '—'}</td>
                    <td className="text-right font-codigo text-aco">{usFat(l.devido_csc)} · {usFat(l.devido_cod)} · {usFat(servico.fator_aplicado === 'COD' ? l.moto_cod : l.moto_csc)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        {glosas.length > 0 && <section className="rounded-xl border border-erro/20 bg-erro-fundo p-3">
          <p className={rotulo}>Glosas (fora do saldo)</p>
          <p className="text-xs text-aco">Multas {usFat(servico.multas)} · estorno {usFat(servico.estorno)}</p>
          <ul className="mt-1 space-y-1 text-xs">{glosas.map(l => (
            <li key={l.id}><b className="font-codigo">{l.codserv}</b> {usFat(l.glosa)}: {l.justificativa || 'sem justificativa na planilha'}</li>
          ))}</ul>
        </section>}

        <section>
          <label htmlFor="obs-servico" className={rotulo}>Observação</label>
          {servico.revisao_desatualizada && <p className="mt-1 rounded-lg bg-pendente-fundo px-2 py-1 text-xs text-pendente">Os dados mudaram depois da última conferência. Confira de novo.</p>}
          <textarea id="obs-servico" data-autofoco value={obs} onChange={e => setObs(e.target.value)} rows={3} disabled={conferido}
            placeholder="Ex.: conferido com a CEMIG, cobrar na próxima fatura"
            className="mt-1 w-full rounded-lg border border-linha p-2 text-sm focus:border-sinal focus:outline-none disabled:bg-nevoa" />
          {conferido && servico.conferido_em && <p className="text-xs text-aco">Conferido em {new Date(servico.conferido_em).toLocaleString('pt-BR')}. Conferido sai do saldo e da exportação.</p>}
          {erro && <p role="alert" className="mt-1 text-xs text-erro">{erro}</p>}
        </section>
      </div>
    </JanelaModal>
  );
}
