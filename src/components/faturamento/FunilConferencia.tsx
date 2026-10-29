import type { TotaisFat } from '../../lib/faturamentoServicos';
import { valorFat, type UnidadeFat } from '../../lib/faturamentoTexto';
import { DicaInfo } from './DicaInfo';

const numero = (n: number) => n.toLocaleString('pt-BR');
export type EtapaFunilFat = 'fora_contrato' | 'divergente' | 'a_menos' | 'a_mais' | 'glosados';
const LARGURAS = [100, 90, 80, 68, 56, 44];

/** Funil de verdade: cada etapa mais estreita que a de cima, até os que pagaram a mais, a menos e os glosados. */
export function FunilConferencia({ totais, unidade, taxa, onEtapa }: {
  totais: TotaisFat; unidade: UnidadeFat; taxa: number | null; onEtapa?: (etapa: EtapaFunilFat) => void;
}) {
  const { funil } = totais;
  const fora = totais.fora_contrato ?? funil.importados - funil.codigo_no_contrato;
  const diverg = Math.max(funil.codigo_no_contrato - funil.valor_confere, 0);
  const semEquipe = funil.importados - funil.equipe_identificada;
  const lados = ([
    { etapa: 'a_mais' as const, rotulo: 'Pagou a mais', n: totais.a_mais.servicos, us: totais.a_mais.us ?? totais.pago_a_mais, barra: 'bg-concluido', texto: 'text-concluido', sinal: 1 },
    { etapa: 'a_menos' as const, rotulo: 'Pagou a menos', n: totais.a_menos.servicos, us: totais.a_menos.us ?? totais.saldo_a_receber, barra: 'bg-erro-marca', texto: 'text-erro', sinal: -1 },
    { etapa: 'glosados' as const, rotulo: 'Glosados', n: totais.glosados?.servicos ?? 0, us: totais.glosados?.us ?? 0, barra: 'bg-glosa-marca', texto: 'text-glosa', sinal: -1 },
  ]).filter(l => l.etapa !== 'glosados' || l.n > 0).sort((a, b) => b.n - a.n);
  const percentual = funil.importados ? funil.valor_confere / funil.importados * 100 : 0;
  const linha = 'grid grid-cols-[112px_1fr_170px] items-center gap-2 text-[12px]';
  const barra = (largura: number, cor: string, valor: number, etapa: string) => (
    <div data-etapa={etapa} className={`mx-auto flex h-6 items-center justify-center rounded-md font-codigo text-[11px] font-extrabold text-white ${cor}`} style={{ width: `${largura}%` }}>{numero(valor)}</div>
  );
  const clique = (etapa: EtapaFunilFat, conteudo: React.ReactNode, cor: string) => onEtapa
    ? <button type="button" onClick={() => onEtapa(etapa)} className={`text-left font-bold underline-offset-2 hover:underline ${cor}`}>{conteudo}</button>
    : <span className={`font-bold ${cor}`}>{conteudo}</span>;
  return (
    <div>
      <h2 className="mb-3 text-sm font-extrabold text-tinta">Como ficou a conferência</h2>
      <ol className="space-y-1.5">
        <li className={linha}><span className="text-tinta">Serviços na fatura</span>{barra(LARGURAS[0], 'bg-sinal', funil.importados, 'servicos')}<span /></li>
        <li className={linha}><span className="text-tinta">Código no contrato</span>{barra(LARGURAS[1], 'bg-sinal/80', funil.codigo_no_contrato, 'contrato')}
          <span className="flex items-center">{clique('fora_contrato', `−${numero(fora)} fora do contrato`, 'text-pendente')}
            <DicaInfo rotulo="fora do contrato">Serviços com código que não tem valor na tabela do contrato. Sem esse valor não dá para saber quanto a CEMIG deveria pagar, por isso ficam fora da conta.</DicaInfo></span></li>
        <li className={linha}><span className="text-tinta">Valor confere</span>{barra(LARGURAS[2], 'bg-concluido-marca', funil.valor_confere, 'confere')}
          <span className="flex items-center">{clique('divergente', `−${numero(diverg)} divergentes`, 'text-erro')}
            <DicaInfo rotulo="divergentes">Serviços em que a CEMIG pagou diferente do que o contrato prevê. Logo abaixo: quantos ela <b className="font-bold text-concluido-marca">pagou a mais</b>, quantos <b className="font-bold text-erro-marca">pagou a menos</b> e quantos <b className="font-bold text-glosa">glosou</b> (código G.xx, não serão pagos).</DicaInfo></span></li>
        {lados.map((l, i) => (
          <li key={l.etapa} className={linha}>
            {clique(l.etapa, l.rotulo, l.texto)}
            {barra(LARGURAS[3 + i], l.barra, l.n, l.etapa)}
            <span className={`font-codigo text-[11px] font-bold ${l.texto}`}>{valorFat(l.sinal * l.us, unidade, taxa, true)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-xs text-aco">
        <b className="font-codigo text-concluido">{percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b> conferem sem intervenção · clique numa etapa para abrir a lista
        {funil.conferidos > 0 && <> · {numero(funil.conferidos)} conferidos à mão</>}
        {semEquipe > 0 && <> · {numero(semEquipe)} sem equipe identificada</>}
      </p>
    </div>
  );
}
