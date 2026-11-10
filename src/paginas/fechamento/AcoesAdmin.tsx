import { useState } from 'react';
import { Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import { ETAPAS_DE_DESTINO, excluirNsis, infoEtapa, moverEtapa, type Etapa, type Nsis } from '@/lib/fechamento';
import { ROTULO_SECAO } from './ComponentesLancamento';

/** Posição de cada etapa do fluxo novo; "Concluída" fica depois da última. */
const POSICAO: Partial<Record<Etapa, number>> = {
  A_FECHAR: 0, AGUARDANDO_NSPR: 1, AGUARDANDO_SALESFORCE: 2, AGUARDANDO_APROPRIACAO: 3, FATURADA: 4,
};

/** O que é apagado ao voltar para a etapa (NSRI não tem NSPR; o valor pago dela nasce na etapa 1). */
function oQueApaga(destino: Etapa, nsri: boolean): string {
  if (destino === 'A_FECHAR') return 'todos os códigos, a equipe, a NSMP, a NSPR, o valor pago, a data do Salesforce e a apropriação';
  if (destino === 'AGUARDANDO_NSPR') return 'a NSPR, o valor pago, a data do Salesforce e a apropriação';
  if (destino === 'AGUARDANDO_SALESFORCE') return 'a data do Salesforce e a apropriação';
  return 'a apropriação';
}

interface Props {
  nsis: Nsis;
  qtdItens: number;
  /** A NSIS segue o fluxo novo: só ela pode ser movida de etapa. */
  fluxoNovo: boolean;
  /** Recarrega a NSIS e a fila. */
  onAlterado: () => void | Promise<void>;
  /** A NSIS foi excluída: fecha a janela e atualiza a fila. */
  onExcluida: () => void;
}

/** Excluir NSIS e voltar de etapa. Só aparece para ADMIN; o banco confere o papel de novo. */
export default function AcoesAdmin({ nsis, qtdItens, fluxoNovo, onAlterado, onExcluida }: Props) {
  const { acesso } = useSessao();
  const [destino, setDestino] = useState<Etapa | ''>('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (acesso?.papel !== 'ADMIN') return null;

  const nsri = nsis.tipo_serv === 'NSRI';
  const posAtual = POSICAO[nsis.etapa];
  const podeMover = fluxoNovo && !nsis.sem_cobranca && posAtual !== undefined;
  const destinos = podeMover
    ? ETAPAS_DE_DESTINO.filter((e) => (POSICAO[e] ?? 99) < posAtual && !(nsri && e === 'AGUARDANDO_NSPR'))
    : [];

  async function executar(acao: () => Promise<void>, depois: () => void | Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      await depois();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao executar a ação.');
    } finally {
      setOcupado(false);
    }
  }

  function mover() {
    if (!destino) return;
    const nome = infoEtapa(destino).nome;
    if (!confirm(`Mover a NSIS ${nsis.servico} para "${nome}"?\n\nSerá apagado: ${oQueApaga(destino, nsri)}.\nUma cópia fica guardada no registro de ações.`)) return;
    executar(() => moverEtapa(nsis.servico, destino), async () => { setDestino(''); await onAlterado(); });
  }

  function excluir() {
    const itens = qtdItens === 0 ? 'sem códigos lançados' : qtdItens === 1 ? '1 código lançado' : `${qtdItens} códigos lançados`;
    if (!confirm(`Excluir a NSIS ${nsis.servico} (${itens}) da fila?\n\nOs códigos lançados vão junto. Uma cópia fica guardada no registro de ações.`)) return;
    executar(() => excluirNsis(nsis.servico), onExcluida);
  }

  return (
    <section aria-label="Ações de administrador" className="rounded-xl border border-dashed border-erro/40 bg-erro-fundo/30 p-4">
      <p className={`${ROTULO_SECAO} mb-3 flex items-center gap-1.5`}><ShieldAlert size={14} className="text-erro" /> Somente administrador</p>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {destinos.length > 0 && (
          <div>
            <label htmlFor="mover-etapa" className="mb-1 block text-[11px] font-semibold text-aco">Voltar para a etapa</label>
            <div className="flex gap-2">
              <select id="mover-etapa" value={destino} onChange={(e) => setDestino(e.target.value as Etapa | '')} disabled={ocupado}
                className="h-9 rounded-lg border border-linha bg-white px-2 text-sm">
                <option value="">Escolher…</option>
                {destinos.map((e) => <option key={e} value={e}>{infoEtapa(e).nome}</option>)}
              </select>
              <button type="button" onClick={mover} disabled={!destino || ocupado}
                className="flex h-9 items-center gap-2 rounded-lg border border-linha bg-white px-3 text-sm font-semibold hover:border-sinal hover:text-sinal disabled:opacity-50">
                {ocupado && <Loader2 size={14} className="animate-spin" />} Mover
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={excluir} disabled={ocupado}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-erro px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          <Trash2 size={14} /> Excluir NSIS
        </button>
      </div>

      {!podeMover && (
        <p className="mt-3 text-xs text-aco">
          {nsis.sem_cobranca ? 'Sem cobrança: reabra a NSIS para poder mudar de etapa.'
            : !fluxoNovo ? 'NSIS do histórico: a etapa vem dos dados e não pode ser movida por aqui.' : null}
        </p>
      )}
      {erro && <p role="alert" className="mt-3 rounded-lg bg-erro-fundo px-3 py-2 text-xs text-erro">{erro}</p>}
    </section>
  );
}
