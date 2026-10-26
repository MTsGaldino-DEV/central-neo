import type { TotaisFat } from '../../lib/faturamentoServicos';

const numero = (n: number) => n.toLocaleString('pt-BR');

/** Funil compacto: importados → equipe → código no contrato → valor confere, com a perda de cada etapa. */
export function FunilConferencia({ funil, onEtapa }: {
  funil: TotaisFat['funil']; onEtapa?: (etapa: 'fora_contrato' | 'divergente') => void;
}) {
  const semEquipe = funil.importados - funil.equipe_identificada;
  const fora = funil.equipe_identificada - funil.codigo_no_contrato;
  const diverg = funil.codigo_no_contrato - funil.valor_confere;
  const etapas: { rotulo: string; valor: number; largura: number; cor: string; perda?: { texto: string; cor: string; etapa?: 'fora_contrato' | 'divergente' } }[] = [
    { rotulo: 'Importados', valor: funil.importados, largura: 100, cor: 'bg-sinal' },
    { rotulo: 'Equipe identificada', valor: funil.equipe_identificada, largura: 92, cor: 'bg-sinal/90',
      perda: semEquipe > 0 ? { texto: `−${numero(semEquipe)} sem equipe`, cor: 'text-revisao' } : undefined },
    { rotulo: 'Código no contrato', valor: funil.codigo_no_contrato, largura: 84, cor: 'bg-sinal/80',
      perda: { texto: `−${numero(fora)} fora`, cor: 'text-pendente', etapa: 'fora_contrato' } },
    { rotulo: 'Valor confere', valor: funil.valor_confere, largura: 76, cor: 'bg-concluido-marca',
      perda: { texto: `−${numero(diverg)} diverg.`, cor: 'text-erro', etapa: 'divergente' } },
  ];
  const percentual = funil.importados ? funil.valor_confere / funil.importados * 100 : 0;
  return (
    <div>
      <h2 className="mb-3 text-sm font-extrabold text-tinta">Como ficou a conferência</h2>
      <ol className="space-y-1">
        {etapas.map(e => (
          <li key={e.rotulo} className="grid grid-cols-[110px_1fr_84px] items-center gap-1.5 text-[11px]">
            <span className="text-tinta">{e.rotulo}</span>
            <div className={`mx-auto flex h-[22px] items-center justify-center rounded-[5px] font-codigo text-[11px] font-extrabold text-white ${e.cor}`} style={{ width: `${e.largura}%` }}>{numero(e.valor)}</div>
            {e.perda ? (e.perda.etapa && onEtapa
              ? <button type="button" onClick={() => onEtapa(e.perda!.etapa!)} className={`text-left font-bold underline-offset-2 hover:underline ${e.perda.cor}`}>{e.perda.texto}</button>
              : <span className={`font-bold ${e.perda.cor}`}>{e.perda.texto}</span>) : <span />}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-xs text-aco">
        <b className="font-codigo text-concluido">{percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b> conferem sem intervenção
        {funil.conferidos > 0 && <> · {numero(funil.conferidos)} conferidos à mão</>}
      </p>
    </div>
  );
}
