import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, FileSpreadsheet, Link2, Loader2, UploadCloud, X, AlertTriangle } from 'lucide-react';
import { lerFatura, lerFaturaCompleta, cruzarFaturas, hashArquivo, linhasDuplicadas, resumoImportacao, TIPOS_TURMA_FAT, type LeituraFat, type LeituraCompletaFat } from '@/lib/faturamentoPlanilhas';
import { painelFat, type TotaisFat } from '@/lib/faturamentoServicos';
import { JanelaModal } from '@/components/faturamento/JanelaModal';
import { AjudaFat } from '@/components/faturamento/AjudaFat';
import { traduzirErro, type ErroAmigavel } from '@/lib/erros';
import { AvisoErro } from '@/components/faturamento/AvisoErro';
import { importarFat, faturasFat, usFat, type FaturaFat } from '@/lib/faturamento';

const numero = (n: number) => n.toLocaleString('pt-BR');
const data = (s: string) => s.split('-').reverse().join('/');

type ArquivoLido<T> = { arquivo: File; dados: T; hash: string };
export default function Importar() {
  const [resumida, setResumida] = useState<ArquivoLido<LeituraFat> | null>(null);
  const [completa, setCompleta] = useState<ArquivoLido<LeituraCompletaFat> | null>(null);
  const [faturas, setFaturas] = useState<FaturaFat[]>([]);
  const [lendo, setLendo] = useState(''), [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroAmigavel | null>(null), [mensagem, setMensagem] = useState('');
  const [percentual, setPercentual] = useState(0), [concluida, setConcluida] = useState(false);
  const ocupado = !!lendo || enviando;
  // Sem a lista de faturas não dá para saber se a importação substitui uma existente: bloqueia até carregar.
  const [faturasOk, setFaturasOk] = useState(false), [erroFaturas, setErroFaturas] = useState<ErroAmigavel | null>(null);
  const carregarFaturas = () => { setErroFaturas(null); faturasFat().then(l => { setFaturas(l); setFaturasOk(true); }).catch(e => { setFaturasOk(false); setErroFaturas(traduzirErro(e, 'Importar fatura › conferir faturas já importadas')); }); };
  useEffect(carregarFaturas, []);
  const previa = useMemo(() => {
    if (!resumida || !completa) return null;
    try { return { dados: cruzarFaturas(resumida.dados, completa.dados), erro: null }; }
    catch (e) { return { dados: null, erro: traduzirErro(e, 'Importar fatura › cruzar as duas planilhas') }; }
  }, [resumida, completa]);
  const cruzamento = previa?.dados;
  const anterior = faturas.find(f => f.id === resumida?.dados.fatura);
  const existente = !!anterior;
  const identico = !!anterior && !!resumida && !!completa && anterior.hash_resumida === resumida.hash && anterior.hash_completa === completa.hash;
  const duplicadas = useMemo(() => resumida ? linhasDuplicadas(resumida.dados.abas.US_Servico) : [], [resumida]);
  const [confirmar, setConfirmar] = useState(false);
  async function ler(f: File, tipo: 'resumida' | 'completa') {
    if (ocupado) return;
    setLendo(tipo); setErro(null); setConcluida(false); setMensagem(''); setPercentual(0);
    if (tipo === 'resumida') setResumida(null); else setCompleta(null);
    try {
      if (!/\.xlsx$/i.test(f.name)) throw Error('Selecione uma planilha Excel no formato .xlsx.');
      // Deixa o navegador desenhar o estado de leitura antes de processar o Excel.
      await new Promise(resolve => setTimeout(resolve, 40));
      const buffer = await f.arrayBuffer();
      const hash = await hashArquivo(buffer);
      if (tipo === 'resumida') setResumida({ arquivo: f, dados: lerFatura(buffer), hash });
      else setCompleta({ arquivo: f, dados: lerFaturaCompleta(buffer), hash });
    } catch (e) { setErro(traduzirErro(e, `Importar fatura › ler ${f.name}`)); } finally { setLendo(''); }
  }
  // Confere de novo no servidor: outra pessoa pode ter importado a mesma fatura depois que a tela abriu.
  async function iniciar() {
    if (!resumida) return;
    if (existente) { setConfirmar(true); return; }
    try {
      const lista = await faturasFat(); setFaturas(lista);
      if (lista.some(f => f.id === resumida.dados.fatura)) { setConfirmar(true); return; }
    } catch (e) { setFaturasOk(false); setErroFaturas(traduzirErro(e, 'Importar fatura › conferir faturas já importadas')); return; }
    await importar(false);
  }
  async function importar(substituir: boolean) {
    if (!resumida || !completa || !cruzamento || ocupado || identico) return;
    setConfirmar(false); setEnviando(true); setErro(null); setMensagem('Preparando a importação…'); setPercentual(0);
    try {
      await importarFat(resumida.dados, resumida.arquivo.name, completa.dados, completa.arquivo.name, (s, p) => { setMensagem(s); setPercentual(p); }, { resumida: resumida.hash, completa: completa.hash }, substituir);
      setConcluida(true); faturasFat().then(setFaturas).catch(() => {});
    } catch (e) { setErro(traduzirErro(e, `Importar fatura › enviar (${mensagem || 'início'})`)); setMensagem('Não foi possível confirmar a conclusão. Você pode tentar novamente; a mesma fatura não será duplicada.'); }
    finally { setEnviando(false); }
  }
  function limpar(tipo: 'resumida' | 'completa') {
    if (tipo === 'resumida') setResumida(null); else setCompleta(null);
    setConcluida(false); setErro(null); setMensagem(''); setPercentual(0);
  }
  return <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-sinal mb-2">Faturamento · Importação</p><h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">Uma fatura. As duas origens.</h2><p className="mt-2 text-sm text-aco max-w-2xl leading-relaxed">Anexe o resumo para conferir os valores e o relatório completo para identificar a equipe de cada serviço.</p></div>
      <div className="flex items-center gap-3"><AjudaFat pagina="importar" /><Link to="/faturamento" className="text-sm font-semibold text-sinal flex items-center gap-2 py-2">Ver faturas <ArrowRight size={16}/></Link></div>
    </header>
    <ol className="flex flex-wrap gap-x-6 gap-y-3 text-sm border-b border-linha pb-5" aria-label="Etapas da importação">
      {['Selecionar arquivos', 'Revisar cruzamento', 'Conferir fatura'].map((s, i) => <li key={s} className={'flex items-center gap-2 ' + ((concluida ? 2 : cruzamento ? 1 : 0) >= i ? 'text-sinal font-bold' : 'text-aco')}><span className={'size-6 rounded-full flex items-center justify-center text-xs ' + ((concluida ? 2 : cruzamento ? 1 : 0) >= i ? 'bg-sinal text-white' : 'bg-linha')}>{concluida || (cruzamento && i === 0) ? <Check size={14}/> : i + 1}</span>{s}</li>)}
    </ol>
    {erroFaturas && <AvisoErro erro={erroFaturas} onTentar={carregarFaturas} contexto="A importação fica bloqueada até conferir as faturas já importadas." />}
    {(erro || previa?.erro) && <AvisoErro erro={(erro || previa?.erro)!} />}
    <div className="grid md:grid-cols-2 gap-5">
      <AreaArquivo titulo="Fatura Resumida" subtitulo="Valores e turmas da fatura" numero="01" dica="Planilha Resumo_Fat, com US_Servico e US_Turma." arquivo={resumida?.arquivo} detalhe={resumida ? numero(resumida.dados.abas.US_Servico.length) + ' linhas de faturamento' : ''} ocupado={ocupado} lendo={lendo === 'resumida'} onArquivo={f => void ler(f, 'resumida')} onLimpar={() => limpar('resumida')}/>
      <AreaArquivo titulo="Fatura Completa" subtitulo="Serviços e veículos que executaram" numero="02" dica="Relatório completo, com as abas Serviço e Apropriação." arquivo={completa?.arquivo} detalhe={completa ? numero(completa.dados.vinculos.length) + ' serviços identificados' : ''} ocupado={ocupado} lendo={lendo === 'completa'} onArquivo={f => void ler(f, 'completa')} onLimpar={() => limpar('completa')}/>
    </div>
    {cruzamento && resumida && completa ? <section className="rounded-2xl border border-linha bg-white overflow-hidden">
      <div className="p-5 lg:p-6 flex flex-wrap items-center justify-between gap-3 border-b border-linha"><div className="flex items-center gap-3"><span className="rounded-xl bg-sinal-fundo text-sinal p-3"><Link2 size={22}/></span><div><h3 className="font-extrabold text-lg">Fatura {resumida.dados.fatura}</h3><p className="text-xs text-aco mt-1">{data(completa.dados.inicio)} a {data(completa.dados.fim)}</p></div></div><span className="inline-flex items-center gap-1.5 bg-concluido-fundo text-concluido rounded-full px-3 py-1.5 text-xs font-bold"><CheckCircle2 size={14}/> Arquivos da mesma fatura</span></div>
      <div className="p-5 lg:p-6 space-y-6">
        <dl className="grid sm:grid-cols-3 gap-4"><Indicador titulo="Serviços únicos" valor={numero(cruzamento.servicos)}/><Indicador titulo="Total creditado" valor={usFat(resumida.dados.creditado)} unidade="US"/><Indicador titulo="Glosas e estornos · saldo" valor={usFat(resumida.dados.glosa)} unidade="US"/></dl>
        <div><div className="flex flex-wrap justify-between gap-2 mb-3"><h4 className="text-sm font-bold">Equipes identificadas</h4><p className="text-xs text-aco">Serviço → veículo → turma</p></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(TIPOS_TURMA_FAT).map(([tipo, nome]) => <div key={tipo} className="rounded-xl border border-linha p-4"><p className="text-xs font-semibold text-aco">{nome}</p><p className="text-2xl font-extrabold tracking-tight mt-2">{numero(cruzamento.porTipo[tipo])}</p><div className="h-1 rounded-full bg-nevoa mt-3 overflow-hidden"><div className="h-full rounded-full bg-sinal" style={{ width: (cruzamento.porTipo[tipo] / cruzamento.servicos * 100) + '%' }}/></div></div>)}</div></div>
        {cruzamento.semVinculo + cruzamento.ambiguos > 0 ? <p className="bg-pendente-fundo text-pendente rounded-xl p-4 text-sm">{numero(cruzamento.semVinculo)} serviços sem equipe identificada e {numero(cruzamento.ambiguos)} com mais de um tipo possível. Eles permanecem sem equipe confirmada; coincidências exclusivas com moto serão sinalizadas como moto provável.</p> : <p className="text-concluido text-sm flex gap-2 items-center"><CheckCircle2 size={17}/> Todos os serviços têm uma equipe identificada.</p>}
        {duplicadas.length > 0 && <details className="rounded-xl bg-pendente-fundo p-4 text-sm text-pendente"><summary className="cursor-pointer font-bold">{numero(duplicadas.length)} grupos de linhas idênticas na US_Servico. Confira com a CEMIG antes de importar.</summary>
          <ul className="mt-2 max-h-48 overflow-auto font-codigo text-xs">{duplicadas.map((g, i) => <li key={i}>{String(g[0].numserv)} · {String(g[0].codserv)} · crédito {usFat(Number(g[0].ustotal))} · {g.length}×</li>)}</ul></details>}
        {identico && !concluida && <p role="status" className="flex items-center gap-2 rounded-xl bg-concluido-fundo p-4 text-sm font-semibold text-concluido"><CheckCircle2 size={17}/> Estes arquivos são idênticos aos já importados da fatura {resumida.dados.fatura}. Nada mudou.</p>}
        {existente && !identico && !concluida && <p className="text-sm text-aco border-t border-linha pt-4">A fatura {resumida.dados.fatura} já existe. Antes de gravar, você vai revisar o antes e o depois e confirmar digitando o número da fatura.</p>}
      </div>
      <div className="bg-nevoa/60 border-t border-linha p-5 lg:px-6">
        {concluida ? <div role="status" className="flex flex-wrap justify-between items-center gap-4"><div className="flex gap-3 text-concluido items-center"><CheckCircle2 size={24}/><div><p className="font-bold">Fatura importada e equipes vinculadas</p><p className="text-sm mt-1">Os valores já estão disponíveis para conferência.</p></div></div><Link to={'/faturamento/painel?fatura=' + resumida.dados.fatura} className="bg-sinal text-white rounded-xl px-5 py-3 text-sm font-bold inline-flex items-center gap-2">Conferir fatura <ArrowRight size={16}/></Link></div> : <div className="space-y-3"><div className="flex flex-wrap justify-between items-center gap-4"><p className="text-xs text-aco max-w-lg">Os valores e os vínculos são publicados juntos, após a validação de todos os registros.</p><button disabled={ocupado || identico || !faturasOk} onClick={() => void iniciar()} className="bg-sinal hover:bg-sinal-forte text-white rounded-xl px-5 py-3 font-bold text-sm flex items-center gap-2 disabled:opacity-50">{enviando ? <Loader2 size={17} className="animate-spin"/> : <UploadCloud size={17}/>} {enviando ? 'Importando…' : identico ? 'Nada mudou' : existente ? 'Revisar e substituir…' : 'Importar fatura e equipes'}</button></div>{mensagem && <div role="status" className="text-sm text-aco">{mensagem}{enviando && <div role="progressbar" aria-label="Progresso da importação" aria-valuenow={percentual} aria-valuemin={0} aria-valuemax={100} className="h-1.5 mt-3 bg-linha rounded-full overflow-hidden"><div className="bg-sinal h-full transition-all" style={{ width: percentual + '%' }}/></div>}</div>}</div>}
      </div>
      {confirmar && anterior && <ConfirmarSubstituicao fatura={anterior.id} depois={resumoImportacao(resumida.dados, completa.dados)} onFechar={() => setConfirmar(false)} onConfirmar={() => void importar(true)} />}
    </section> : <section className="rounded-2xl bg-sinal-fundo/60 border border-sinal/10 p-5 flex items-start gap-3"><Link2 size={21} className="text-sinal shrink-0 mt-0.5"/><div><h3 className="font-bold text-sm text-sinal">O cruzamento acontece aqui</h3><p className="text-sm text-aco leading-relaxed mt-1">O número do serviço liga as duas planilhas. O veículo da aba Serviço encontra a frota em US_Turma e identifica Multifuncional, Moto, Umpla ou Quarteto. Não é preciso copiar abas no Excel.</p></div></section>}
  </div>;
}

function Indicador({ titulo, valor, unidade }: { titulo: string; valor: string; unidade?: string }) {
  return <div className="rounded-xl bg-nevoa p-4 min-w-0"><dt className="text-xs font-semibold text-aco">{titulo}</dt><dd className="text-xl lg:text-2xl font-extrabold mt-2 tracking-tight tabular-nums">{valor} {unidade && <span className="text-xs font-semibold text-aco">{unidade}</span>}</dd></div>;
}

function AreaArquivo({ titulo, subtitulo, numero, dica, arquivo, detalhe, ocupado, lendo, onArquivo, onLimpar }: { titulo: string; subtitulo: string; numero: string; dica: string; arquivo?: File; detalhe: string; ocupado: boolean; lendo: boolean; onArquivo: (f: File) => void; onLimpar: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  return <section className="bg-white rounded-2xl border border-linha p-5 lg:p-6 min-w-0">
    <div className="flex gap-3 items-center mb-5"><span className="text-xs font-codigo font-bold text-sinal bg-sinal-fundo rounded-lg size-9 flex items-center justify-center">{numero}</span><div><h3 className="font-extrabold">{titulo}</h3><p className="text-xs text-aco mt-1">{subtitulo}</p></div></div>
    <input ref={input} type="file" accept=".xlsx" aria-label={titulo} className="hidden" disabled={ocupado} onChange={e => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.target.value = ''; }}/>
    {arquivo ? <div className="rounded-xl bg-sinal-fundo/40 border border-sinal/20 min-h-44 p-4 flex flex-col justify-between gap-4"><div className="flex gap-3 items-start"><FileSpreadsheet size={24} className="text-sinal shrink-0"/><p className="text-sm font-semibold break-all flex-1">{arquivo.name}</p><button aria-label={'Remover ' + titulo} disabled={ocupado} onClick={onLimpar} className="text-aco hover:text-erro p-1 rounded disabled:opacity-40"><X size={16}/></button></div><div><p className="text-xs text-aco">{(arquivo.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB · {detalhe}</p><p className="text-xs font-bold text-concluido flex items-center gap-1.5 mt-3"><CheckCircle2 size={15}/> Leitura concluída</p></div></div> : <button type="button" disabled={ocupado} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); if (!ocupado) setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={e => { e.preventDefault(); setArrastando(false); if (!ocupado && e.dataTransfer.files[0]) onArquivo(e.dataTransfer.files[0]); }} className={'w-full min-h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-sinal ' + (arrastando ? 'border-sinal bg-sinal-fundo' : 'border-linha hover:border-sinal hover:bg-sinal-fundo/30')}>
      {lendo ? <Loader2 size={27} className="text-sinal animate-spin"/> : <UploadCloud size={27} className="text-sinal"/>}<span className="text-sm font-bold mt-1">{lendo ? 'Lendo planilha…' : 'Arraste o arquivo ou selecione'}</span><span className="text-xs text-aco text-center leading-relaxed">{dica}</span>
    </button>}
  </section>;
}

function ConfirmarSubstituicao({ fatura, depois, onFechar, onConfirmar }: {
  fatura: string; depois: { linhas: number; servicos: number; creditado: number; multas: number }; onFechar: () => void; onConfirmar: () => void;
}) {
  const [antes, setAntes] = useState<TotaisFat | null | undefined>(undefined), [digitado, setDigitado] = useState('');
  useEffect(() => { painelFat().then(p => setAntes(p.find(t => t.fatura === fatura) ?? null)).catch(() => setAntes(null)); }, [fatura]);
  const linhas: [string, number | undefined, number, (n: number) => string][] = [
    ['Linhas', antes?.linhas, depois.linhas, numero], ['Serviços', antes?.servicos, depois.servicos, numero],
    ['Crédito (US)', antes?.creditado, depois.creditado, usFat], ['Multas (US)', antes?.multas, depois.multas, usFat],
  ];
  return (
    <JanelaModal aberta titulo={`Substituir a fatura ${fatura}?`} onFechar={onFechar}
      rodape={<button type="button" disabled={digitado.trim() !== fatura} onClick={onConfirmar}
        className="rounded-lg bg-erro px-4 py-2 text-sm font-bold text-white hover:bg-erro/90 disabled:opacity-40">Substituir fatura</button>}>
      <p className="text-sm text-aco">A versão atual será substituída pelos arquivos novos. Confira o que muda:</p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-[11px] text-aco uppercase"><tr><th className="py-1 text-left"></th><th className="text-right">Antes</th><th className="text-right">Depois</th></tr></thead>
        <tbody>{linhas.map(([r, a, d, f]) => (
          <tr key={r} className="border-t border-linha"><td className="py-1.5">{r}</td>
            <td className="text-right font-codigo">{antes === undefined ? '…' : a == null ? '—' : f(a)}</td>
            <td className={`text-right font-codigo font-bold ${a != null && Math.abs(a - d) > 1e-6 ? 'text-pendente' : ''}`}>{f(d)}</td></tr>
        ))}</tbody>
      </table>
      <p className="mt-3 rounded-lg bg-pendente-fundo px-3 py-2 text-sm text-pendente">{numero(antes?.funil.conferidos ?? 0)} serviços conferidos serão reabertos se os dados deles mudarem.</p>
      <label className="mt-4 block text-sm font-bold text-tinta">Digite o número da fatura para confirmar
        <input data-autofoco value={digitado} onChange={e => setDigitado(e.target.value)} inputMode="numeric" placeholder={fatura}
          className="mt-1 block w-full rounded-lg border border-linha px-3 py-2 font-codigo focus:border-sinal focus:outline-none" /></label>
    </JanelaModal>
  );
}
