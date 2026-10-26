import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calculator, Link2, Scale, Search, Upload, Wallet } from 'lucide-react';

interface Tema { id: string; pergunta: string; resposta: string; exemplo?: ReactNode; detalhes?: ReactNode }

const linha = 'flex justify-between gap-3 border-t border-linha py-1.5 font-codigo text-xs';
const caixa = 'rounded-xl border border-linha bg-nevoa/60 p-3';
const titulo = 'mb-1 text-[11px] font-bold tracking-wide text-aco uppercase';

const TEMAS: Tema[] = [
  { id: 'planilhas', pergunta: 'Por que preciso importar duas planilhas?',
    resposta: 'A Fatura Resumida traz quanto a CEMIG pagou; a Fatura Completa diz qual equipe fez cada serviço. Sem as duas, não dá para saber se o desconto de Moto estava certo.',
    exemplo: <div className={caixa}><p className={titulo}>Fatura 9844</p>
      <div className={linha}><span>Linhas da Resumida (uma por código)</span><b>27.389</b></div>
      <div className={linha}><span>Serviços (números únicos)</span><b>21.910</b></div></div>,
    detalhes: <p>Um serviço com dois códigos ocupa duas linhas. Por isso 27.389 linhas viram 21.910 serviços, e a conferência é feita por serviço. O número do serviço liga as duas planilhas: o veículo da Completa encontra a frota na aba US_Turma da Resumida.</p> },
  { id: 'rc-codigo', pergunta: 'Por que o RC é pago uma vez só, e o código é pago em cada linha?',
    resposta: 'No pagamento por código, cada linha vale o seu código. No pagamento por RC (RC07, RC08…), vale um RC por atendimento, não importa quantas linhas ele tenha.',
    exemplo: <div className="grid gap-2 sm:grid-cols-2">
      <div className={caixa}><p className={titulo}>Por código · NSSR</p>
        <div className={linha}><span>242861522 · 7.15</span><span className="text-concluido">paga 7.15 ✓</span></div>
        <div className={linha}><span>242861522 · 7.10</span><span className="text-concluido">paga 7.10 ✓</span></div></div>
      <div className={caixa}><p className={titulo}>Por RC · RC07</p>
        <div className={linha}><span>245530193 · 5.14</span><span>0,043010</span></div>
        <div className={linha}><span>245530193 · 7.42</span><span>0,041669</span></div>
        <div className={linha}><span>soma = 1 RC07</span><span className="text-concluido">0,084679 ✓</span></div></div>
    </div>,
    detalhes: <p>No RC, os códigos de fechamento (5.14, 7.42…) só mostram o trabalho feito. A CEMIG pode dividir o valor do RC entre as linhas; o que importa é a soma do serviço. Pelas notas 2 e 3 da Tabela 12, alguns RCs são trocados pelo código de fechamento (por exemplo RC07 → 8.82) e aí valem como código.</p> },
  { id: 'moto', pergunta: 'O que é o fator Moto (0,7, 1 ou 0)?',
    resposta: 'Equipe Moto recebe 70% do valor (fator 0,7) na maioria dos códigos. Alguns códigos pagam o valor cheio (fator 1) e outros não pagam Moto (fator 0).',
    exemplo: <div className={caixa}>
      <div className={linha}><span>5.14 · fator 0,7</span><span>0,094983 × 0,7 = 0,066488</span></div>
      <div className={linha}><span>6.01 · fator 1 (sem desconto)</span><span>0,001065</span></div>
      <div className={linha}><span>9.82 · fator 0</span><span>não paga Moto</span></div></div>,
    detalhes: <p>A coluna "Valor Moto" da Tabela do contrato já mostra a conta pronta. Quando a CEMIG aplica o desconto de Moto numa equipe que não é Moto, o serviço aparece como "Desconto de Moto indevido".</p> },
  { id: 'saldo', pergunta: 'O que quer dizer "saldo a receber" e "pagou a mais"?',
    resposta: 'Saldo a receber é quanto a CEMIG pagou abaixo do contrato, somando os serviços ainda não conferidos. Pagou a mais é o contrário e pode ser cobrado pela CEMIG depois.',
    exemplo: <div className={caixa}>
      <div className={linha}><span>Deveria pagar</span><span>0,023400</span></div>
      <div className={linha}><span>Pagou</span><span>0,016400</span></div>
      <div className={linha}><span>Entra no saldo a receber</span><b className="text-erro">0,007000</b></div></div>,
    detalhes: <ul className="list-disc space-y-1 pl-5">
      <li><b>Multas (glosas)</b> não entram no saldo: aparecem só no cartão de Multas. Multa injusta é contestada à parte, com o detalhe do serviço.</li>
      <li>Um serviço glosado por inteiro (crédito + multa = devido) confere.</li>
      <li>Serviço <b>conferido</b> sai do saldo e da exportação. Use o filtro "Conferidos" para revê-los.</li>
      <li>Código sem fator no contrato fica fora dos dois lados.</li>
    </ul> },
  { id: 'funil', pergunta: 'O que significa cada etapa e cor do funil?',
    resposta: 'O funil mostra quantos serviços passaram em cada checagem. O número ao lado de cada barra é quanto caiu ali; clique nele para ver esses serviços.',
    exemplo: <div className={caixa}>
      <div className={linha}><span>Importados</span><span>todos os serviços</span></div>
      <div className={linha}><span>Equipe identificada</span><span className="text-revisao">sem equipe</span></div>
      <div className={linha}><span>Código no contrato</span><span className="text-pendente">fora do contrato</span></div>
      <div className={linha}><span>Valor confere</span><span className="text-erro">com diferença</span></div></div>,
    detalhes: <p>Verde = confere sem ninguém mexer. Vermelho = pagou a menos ou a mais. Laranja = código que o contrato não tem. Roxo = serviço sem equipe na Fatura Completa.</p> },
  { id: 'conferencia', pergunta: 'Como uso a tela de Conferência?',
    resposta: 'No centro fica o que a CEMIG pagou a menos, com o motivo de cada serviço; ao lado, o que pagou a mais. Clique num serviço para ver tudo e marcar como conferido.',
    detalhes: <ul className="list-disc space-y-1 pl-5">
      <li>Os chips filtram por motivo: Moto indevido, RC não pago, fator menor…</li>
      <li>"Exportar para negociação" baixa um Excel com uma aba para cada lado, pronto para mandar à CEMIG.</li>
      <li>Para conferir, escreva uma observação e clique em "Marcar como conferido". Se os dados mudarem numa reimportação, ele volta a pedir conferência.</li>
      <li>A janela fecha pelo X, por "Cancelar" ou pela tecla Esc.</li>
    </ul> },
  { id: 'importar', pergunta: 'Como importo ou reimporto uma fatura com segurança?',
    resposta: 'Anexe as duas planilhas e confira a prévia. Se a fatura já existe, o sistema mostra o antes e o depois e pede que você digite o número da fatura para substituir.',
    detalhes: <ul className="list-disc space-y-1 pl-5">
      <li>Arquivos idênticos aos já importados: o sistema avisa "Nada mudou" e não reimporta.</li>
      <li>Resumida e Completa de faturas diferentes: a importação é bloqueada.</li>
      <li>Linhas idênticas em todos os campos aparecem como aviso antes de importar. O mesmo serviço com códigos diferentes é normal.</li>
      <li>A gravação é tudo ou nada: se falhar no meio, a versão anterior continua valendo.</li>
    </ul> },
  { id: 'contrato', pergunta: 'O que são as Tabelas 11 e 12 do contrato?',
    resposta: 'A Tabela 11 tem o valor de cada código de fechamento; a Tabela 12 tem o valor de cada RC (atendimento). O sistema usa essas tabelas para calcular quanto deveria ser pago.',
    detalhes: <p>Cada código tem dois valores: CSC/CSI e COD. O sistema escolhe, por serviço, o que bate com o pagamento; se nenhum bate, usa CSC como referência. Só o administrador corrige um fator, e toda correção fica no histórico.</p> },
  { id: 'glossario', pergunta: 'O que é US, glosa, CSC, COD…? (glossário)',
    resposta: 'As palavras que aparecem nas telas, em uma linha cada.',
    exemplo: <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[110px_1fr]">
      {[['US', 'Unidade de Serviço: a "moeda" do contrato com a CEMIG.'], ['Glosa', 'Desconto aplicado pela CEMIG (multa). Glosa positiva é estorno: valor devolvido.'],
        ['Estorno', 'Glosa positiva: a CEMIG devolveu um valor descontado antes.'], ['CSC / CSI', 'Valor do código para o centro de serviço (referência principal).'],
        ['COD', 'Valor alternativo do mesmo código no contrato.'], ['RC', 'Código de atendimento (RC07, RC08…), pago uma vez por atendimento.'],
        ['Tabela 11 / 12', 'Tabela 11: códigos de fechamento. Tabela 12: RCs.'], ['Frota', 'Número do veículo que fez o serviço.'],
        ['Turma', 'Equipe do veículo: Multifuncional, Moto, Umpla ou Quarteto.']].map(([t, d]) => <div key={t} className="contents"><dt className="font-codigo font-bold">{t}</dt><dd className="text-aco">{d}</dd></div>)}
    </dl> },
];

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Como funciona o Faturamento: perguntas com resposta curta e exemplo. Fora da sidebar. */
export default function Documentacao() {
  const { hash } = useLocation();
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(hash ? [hash.slice(1)] : []));
  const visiveis = useMemo(() => {
    const q = normalizar(busca.trim());
    return q ? TEMAS.filter(t => normalizar(`${t.pergunta} ${t.resposta}`).includes(q)) : TEMAS;
  }, [busca]);

  useEffect(() => {
    const id = hash.slice(1);
    if (!id) return;
    setAbertos(a => new Set([...a, id]));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [hash]);

  const passos = [[Upload, 'Importa as 2 planilhas da CEMIG'], [Link2, 'Liga cada serviço à equipe'], [Calculator, 'Calcula quanto deveria ser pago'], [Scale, 'Compara com o que foi pago'], [Wallet, 'Mostra o saldo a receber']] as const;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <Link to="/faturamento" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sinal"><ArrowLeft className="size-4" aria-hidden="true" />Voltar às faturas</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[11px] font-bold tracking-wide text-aco uppercase">Central NEO · Faturamento</p><h1 className="text-2xl font-extrabold text-tinta">Como funciona</h1></div>
        <label className="relative w-full sm:w-72"><span className="sr-only">Buscar dúvida</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-aco-claro" aria-hidden="true" />
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar dúvida…"
            className="w-full rounded-xl border border-linha bg-white py-2 pr-3 pl-9 text-sm focus:border-sinal focus:outline-none" /></label>
      </div>

      <section id="inicio" className="scroll-mt-4 rounded-2xl bg-noite p-5 text-white">
        <h2 className="text-[11px] font-bold tracking-wide text-sinal-claro uppercase">Em 1 minuto</h2>
        <ol className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:items-start sm:gap-1">
          {passos.map(([Icone, texto], i) => (
            <li key={texto} className="flex items-start gap-1 sm:flex-1">
              <div className="flex flex-1 flex-col items-center gap-1.5 text-center text-xs text-linha">
                <span className="grid size-10 place-items-center rounded-full bg-white/10 text-sinal-claro"><Icone className="size-5" aria-hidden="true" /></span>{texto}
              </div>
              {i < passos.length - 1 && <ArrowRight className="mt-3 hidden size-4 shrink-0 text-aco-claro sm:block" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </section>

      {!visiveis.length && <p className="rounded-2xl border border-dashed border-linha bg-white p-6 text-center text-sm text-aco">Nada encontrado para "{busca}". Tente outra palavra, como "Moto" ou "saldo".</p>}
      <div className="space-y-2">
        {visiveis.map(t => (
          <details key={t.id} id={t.id} open={!!busca || abertos.has(t.id)} className="group scroll-mt-4 rounded-2xl border border-linha bg-white"
            onToggle={e => { const aberto = (e.currentTarget as HTMLDetailsElement).open; setAbertos(a => { const n = new Set(a); if (aberto) n.add(t.id); else n.delete(t.id); return n; }); }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-tinta [&::-webkit-details-marker]:hidden">
              {t.pergunta}<span className="text-aco transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            </summary>
            <div className="space-y-3 px-4 pb-4 text-sm">
              <p className="text-tinta">{t.resposta}</p>
              {t.exemplo}
              {t.detalhes && <details className="text-aco"><summary className="cursor-pointer text-xs font-bold text-sinal">ver detalhes</summary><div className="mt-2 text-sm">{t.detalhes}</div></details>}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
