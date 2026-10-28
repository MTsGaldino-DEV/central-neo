import { useEffect, useState } from 'react';
import { BookOpenText, X } from 'lucide-react';
import { configFat, contratosFat, regrasDespachoFat } from '@/lib/faturamento';
import { usFat } from '@/lib/faturamentoTexto';
import { valorMoto } from '@/lib/faturamentoMoto';
import { TIPOS_TURMA_FAT } from '@/lib/faturamentoPlanilhas';
import { useDadosComCache } from '@/lib/useDadosComCache';
import { AvisoErro } from './AvisoErro';

type Aba = 'codigos' | 'cod' | 'tabela14';
const ABAS: [Aba, string][] = [['codigos', 'Códigos'], ['cod', 'Despachados pelo COD'], ['tabela14', 'Tabela 14']];

/** Botão redondo no canto da Conferência que abre o contrato num painel lateral, sem sair da lista. */
export function ContratoFlutuante() {
  const [aberto, setAberto] = useState(false), [aba, setAba] = useState<Aba>('codigos'), [busca, setBusca] = useState('');
  const contrato = useDadosComCache('contrato', contratosFat, [], aberto, 'Contrato rápido › códigos');
  const regras = useDadosComCache('regras-despacho', regrasDespachoFat, [], aberto, 'Contrato rápido › despacho e Tabela 14');
  const config = useDadosComCache('config', configFat, [], aberto, 'Contrato rápido › configuração');
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setAberto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto]);

  const termo = busca.trim().toLowerCase();
  const codigos = (contrato.dados ?? []).filter(c => c.ativo && `${c.codigo} ${c.descricao}`.toLowerCase().includes(termo));
  const motoUrbano = config.dados?.moto_urbano ?? 0.7;
  const falha = contrato.falha ?? regras.falha;
  const aba1 = 'rounded-full px-3 py-1 text-xs font-bold';

  return <>
    <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto} aria-label="Contrato rápido" title="Contrato rápido"
      className="fixed right-4 bottom-4 z-30 grid size-14 place-items-center rounded-full bg-sinal text-white shadow-lg hover:bg-sinal-forte sm:right-6 sm:bottom-6">
      <BookOpenText className="size-6" aria-hidden="true" />
    </button>
    {aberto && <aside aria-label="Contrato rápido" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-linha bg-white shadow-2xl sm:w-[460px]">
      <div className="flex items-center justify-between border-b border-linha px-4 py-3">
        <div><p className="font-extrabold">Contrato rápido</p><p className="text-xs text-aco">Valores em US. CSC urbano × 1,0; rural ou COD × 1,2; COD rural × 1,4 (homem-hora).</p></div>
        <button type="button" onClick={() => setAberto(false)} aria-label="Fechar contrato rápido" className="rounded-lg p-1.5 text-aco hover:bg-nevoa"><X className="size-5" aria-hidden="true" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">{ABAS.map(([id, rotulo]) =>
        <button key={id} type="button" onClick={() => setAba(id)} className={`${aba1} ${aba === id ? 'bg-sinal text-white' : 'border border-linha text-tinta hover:border-sinal'}`}>{rotulo}</button>)}</div>
      {falha && <div className="px-4 pt-3"><AvisoErro erro={falha} compacto /></div>}
      {aba === 'codigos' && <>
        <div className="px-4 pt-3"><input aria-label="Buscar no contrato" placeholder="Código ou descrição" value={busca} onChange={e => setBusca(e.target.value)} autoFocus
          className="w-full rounded-lg border border-linha p-2 text-sm" /></div>
        <div className="mt-2 flex-1 overflow-auto px-4 pb-4">
          {!contrato.dados ? <p className="py-4 text-sm text-aco">Carregando o contrato…</p> : !codigos.length ? <p className="py-4 text-sm text-aco">Nenhum código encontrado.</p> :
          <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-white text-[11px] text-aco uppercase"><tr>
            <th className="py-1.5 pr-2">Código</th><th className="pr-2 text-right">CSC</th><th className="pr-2 text-right">COD</th><th className="text-right">Moto</th></tr></thead>
            <tbody>{codigos.map(c => { const m = valorMoto(c, motoUrbano); return <tr key={c.tabela + c.codigo} data-codigo={c.codigo} className="border-t border-linha align-top">
              <td className="py-1.5 pr-2"><span className="font-codigo font-bold">{c.codigo}</span> <span className="text-[10px] text-aco">T{c.tabela}</span>
                <span className="block line-clamp-2 text-[11px] text-aco">{c.descricao.split(/\r?\n/)[0]}</span></td>
              {c.remuneracao === 'HOMEM_HORA' ? <td colSpan={3} className="text-right text-[11px] font-bold text-sinal">por hora (Tabela 14)</td> : <>
                <td className="pr-2 text-right font-codigo">{usFat(c.fator_csc)}</td><td className="pr-2 text-right font-codigo">{usFat(c.fator_cod)}</td>
                <td className="text-right font-codigo text-aco">{m.naoPaga ? 'não paga' : usFat(m.csc)}</td></>}
            </tr>; })}</tbody></table>}
        </div></>}
      {aba === 'cod' && <div className="flex-1 overflow-auto p-4">
        <p className="text-sm text-aco">Serviços destes tipos usam o fator COD; os demais, CSC/CSI.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{(regras.dados?.despacho_cod ?? []).map(t =>
          <span key={t} className="rounded-full border border-linha bg-nevoa px-2 py-0.5 font-codigo text-xs font-bold">{t}</span>)}</div>
      </div>}
      {aba === 'tabela14' && <div className="flex-1 overflow-auto p-4">
        <p className="text-sm text-aco">1.62, 1.73, 5.63 e 5.64: horas do acionamento ao término (por minuto) × US/h × 1,0 / 1,2 / 1,4.</p>
        <table className="mt-2 w-full text-left text-sm"><thead className="text-xs text-aco uppercase"><tr><th className="py-1.5">Equipe</th><th>Elementos</th><th className="text-right">US/h</th></tr></thead>
          <tbody>{(regras.dados?.prontidao ?? []).map(p => <tr key={p.tipo_turma} className="border-t border-linha">
            <td className="py-1.5">{TIPOS_TURMA_FAT[p.tipo_turma] ?? p.tipo_turma}<span className="block text-[11px] text-aco">{p.veiculo}</span></td><td>{p.elementos}</td>
            <td className="text-right font-codigo">{Number(p.us_hora).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td></tr>)}</tbody></table>
      </div>}
    </aside>}
  </>;
}
