import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, X, Loader2, CheckCircle2, AlertTriangle, ArrowRight, History, FileSpreadsheet } from 'lucide-react';
import { servicosExistentes, importarRelatorioNsis, importarHistorico, formatarData } from '@/lib/fechamento';
import { lerRelatorioNsis, lerPlanilhaHistorico, type LeituraRelatorio, type LeituraHistorico } from '@/lib/fechamentoPlanilhas';

type Aba = 'relatorio' | 'historico';

export default function ImportarFechamento() {
  const [aba, setAba] = useState<Aba>('relatorio');
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Importar para o fechamento</h2>
        <p className="text-sm text-aco">As NSIS entram na fila "A fechar". Importar de novo o mesmo arquivo não duplica nada.</p>
      </div>
      <div className="flex gap-1 bg-white border border-linha rounded-xl p-1 w-fit">
        <BotaoAba ativa={aba === 'relatorio'} onClick={() => setAba('relatorio')} icone={<FileSpreadsheet size={15} />}>Relatório do GDIS</BotaoAba>
        <BotaoAba ativa={aba === 'historico'} onClick={() => setAba('historico')} icone={<History size={15} />}>Planilha de controle (histórico)</BotaoAba>
      </div>
      {aba === 'relatorio' ? <AbaRelatorio /> : <AbaHistorico />}
    </div>
  );
}

function BotaoAba({ ativa, onClick, icone, children }: { ativa: boolean; onClick: () => void; icone: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${ativa ? 'bg-sinal text-white' : 'text-aco hover:bg-nevoa'}`}>
      {icone}{children}
    </button>
  );
}

function AreaArquivo({ onArquivo, titulo, dica }: { onArquivo: (f: File) => void; titulo: string; dica: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files[0]; if (f) onArquivo(f); }}
      onClick={() => ref.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${arrastando ? 'border-sinal bg-sinal-fundo' : 'border-linha bg-white hover:border-sinal hover:bg-sinal-fundo/40'}`}
    >
      <div className="size-14 rounded-2xl bg-sinal-fundo flex items-center justify-center"><UploadCloud size={28} className="text-sinal" /></div>
      <p className="text-sm font-bold">{titulo}</p>
      <p className="text-xs text-aco">{dica}</p>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.target.value = ''; }} />
    </div>
  );
}

function CabecalhoArquivo({ arquivo, onLimpar, bloqueado }: { arquivo: File; onLimpar: () => void; bloqueado?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-linha bg-nevoa/50">
      <div className="size-10 rounded-xl bg-sinal-fundo flex items-center justify-center"><FileText size={18} className="text-sinal" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{arquivo.name}</p>
        <p className="text-xs text-aco">{(arquivo.size / 1024).toFixed(1)} KB</p>
      </div>
      {!bloqueado && <button onClick={onLimpar} className="p-1.5 text-aco-claro hover:text-erro"><X size={16} /></button>}
    </div>
  );
}

function Numero({ valor, rotulo, cor = 'text-tinta' }: { valor: number; rotulo: string; cor?: string }) {
  return (
    <div className="p-3 bg-nevoa rounded-xl text-center">
      <p className={`text-2xl font-extrabold ${cor}`}>{valor}</p>
      <p className="text-xs font-semibold text-aco">{rotulo}</p>
    </div>
  );
}

// ─── Relatório semanal do GDIS ───────────────────────────────────────────────

function AbaRelatorio() {
  const navigate = useNavigate();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<LeituraRelatorio | null>(null);
  const [existentes, setExistentes] = useState<Set<string> | null>(null);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ novas: number; atualizadas: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function ler(f: File) {
    setArquivo(f); setLeitura(null); setExistentes(null); setResultado(null); setErro(null);
    try {
      const l = lerRelatorioNsis(await f.arrayBuffer());
      setLeitura(l);
      if (!l.erro && l.linhas.length) setExistentes(await servicosExistentes(l.linhas.map((x) => x.servico)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ler o arquivo.');
    }
  }

  function limpar() {
    setArquivo(null); setLeitura(null); setExistentes(null); setResultado(null); setErro(null);
  }

  async function importar() {
    if (!leitura) return;
    setImportando(true); setErro(null);
    try {
      const r = await importarRelatorioNsis(leitura.linhas, (f, t) => setProgresso(`${f} de ${t}`));
      setResultado(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setImportando(false); setProgresso(null);
    }
  }

  const novas = leitura && existentes ? leitura.linhas.filter((l) => !existentes.has(l.servico)).length : 0;
  const jaNaBase = leitura && existentes ? leitura.linhas.length - novas : 0;

  if (!arquivo) {
    return (
      <>
        <AreaArquivo onArquivo={ler} titulo="Arraste o relatório do GDIS aqui ou clique" dica='"Serviços Executados - Completo" · .xlsx, .xls ou .csv' />
        <div className="p-4 bg-sinal-fundo rounded-xl text-xs text-sinal-forte space-y-1">
          <p className="font-bold">O que entra</p>
          <p>• Só linhas com <strong>Tipo de Serv. = NSIS</strong> e <strong>Resp. = CONTRATADA</strong>. NSRI, CEMIG e MULTIFUNCIONAL ficam de fora.</p>
          <p>• Localidade = 4 primeiros dígitos da Referência. DT execução = Término.</p>
          <p>• Matrícula, nome e tempos ficam guardados nos detalhes da NSIS.</p>
          <p>• NSIS já importada tem os dados do GDIS atualizados, sem perder o que já foi lançado no fechamento.</p>
        </div>
      </>
    );
  }

  return (
    <div className="bg-white border border-linha rounded-2xl overflow-hidden">
      <CabecalhoArquivo arquivo={arquivo} onLimpar={limpar} bloqueado={importando} />
      <div className="p-4 space-y-4">
        {erro && <p className="text-sm text-erro bg-erro-fundo rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{erro}</p>}
        {leitura?.erro && <p className="text-sm text-erro bg-erro-fundo rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{leitura.erro}</p>}
        {!leitura && !erro && <p className="flex items-center gap-2 text-sm text-aco"><Loader2 size={15} className="animate-spin" /> Lendo arquivo…</p>}

        {leitura && !leitura.erro && (
          <>
            {leitura.periodo && <p className="text-sm text-aco">Período do relatório: <strong className="text-tinta">{leitura.periodo}</strong></p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Numero valor={leitura.totalLinhas} rotulo="Linhas no relatório" />
              <Numero valor={leitura.linhas.length} rotulo="NSIS da contratada" cor="text-sinal" />
              <Numero valor={novas} rotulo="Novas na fila" cor="text-concluido" />
              <Numero valor={jaNaBase} rotulo="Já na base (atualiza)" cor="text-aco" />
            </div>
            {leitura.ignoradas.length > 0 && (
              <div className="text-xs text-aco bg-nevoa rounded-xl p-3">
                <p className="font-bold mb-1">Ignoradas</p>
                {leitura.ignoradas.map((i) => <p key={i.motivo}>• {i.motivo}: {i.qtd}</p>)}
              </div>
            )}
            {leitura.linhas.length > 0 && (
              <div className="overflow-x-auto border border-linha rounded-xl">
                <table className="w-full text-xs">
                  <thead><tr className="bg-nevoa text-left text-aco">
                    <th className="px-3 py-2">Serviço</th><th className="px-3 py-2">Loc.</th><th className="px-3 py-2">Término</th><th className="px-3 py-2">Observação</th><th className="px-3 py-2"></th>
                  </tr></thead>
                  <tbody>
                    {leitura.linhas.slice(0, 8).map((l) => (
                      <tr key={l.servico} className="border-t border-linha">
                        <td className="px-3 py-2 font-codigo font-semibold">{l.servico}</td>
                        <td className="px-3 py-2 font-codigo">{l.localidade}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatarData(l.termino, true)}</td>
                        <td className="px-3 py-2">{l.observacao ?? <span className="text-pendente">sem observação</span>}</td>
                        <td className="px-3 py-2 text-[10px] font-bold">{existentes?.has(l.servico) ? <span className="text-aco-claro">JÁ NA BASE</span> : <span className="text-concluido">NOVA</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leitura.linhas.length > 8 && <p className="text-[11px] text-aco-claro text-right px-3 py-1.5">+ {leitura.linhas.length - 8} NSIS</p>}
              </div>
            )}

            {resultado ? (
              <div className="flex items-center gap-3 p-4 bg-concluido-fundo border border-emerald-200 rounded-xl">
                <CheckCircle2 size={20} className="text-concluido" />
                <p className="flex-1 text-sm"><strong>{resultado.novas}</strong> NSIS novas na fila · <strong>{resultado.atualizadas}</strong> atualizadas</p>
                <button onClick={() => navigate('/fechamento?etapa=A_FECHAR')} className="h-9 px-4 rounded-lg bg-sinal text-white text-sm font-bold flex items-center gap-1.5">
                  Ir para a fila <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={limpar} disabled={importando} className="flex-1 h-10 border border-linha rounded-xl text-sm font-semibold text-aco hover:bg-nevoa disabled:opacity-50">Cancelar</button>
                <button onClick={importar} disabled={importando || leitura.linhas.length === 0}
                  className="flex-1 h-10 bg-sinal hover:bg-sinal-forte text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {importando ? <><Loader2 size={15} className="animate-spin" /> Importando {progresso}</> : <>Importar {leitura.linhas.length} NSIS <ArrowRight size={15} /></>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Planilha de controle (histórico) ───────────────────────────────────────

function AbaHistorico() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<LeituraHistorico | null>(null);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ nsisCriadas: number; itensCriados: number; itensJaExistentes: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function ler(f: File) {
    setArquivo(f); setLeitura(null); setResultado(null); setErro(null);
    try {
      setLeitura(lerPlanilhaHistorico(await f.arrayBuffer()));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ler o arquivo.');
    }
  }

  function limpar() {
    setArquivo(null); setLeitura(null); setResultado(null); setErro(null);
  }

  async function importar() {
    if (!leitura) return;
    setImportando(true); setErro(null);
    try {
      setResultado(await importarHistorico(leitura.linhas, (f, t) => setProgresso(`${f} de ${t}`)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setImportando(false); setProgresso(null);
    }
  }

  if (!arquivo) {
    return (
      <>
        <AreaArquivo onArquivo={ler} titulo='Arraste a planilha "controle de nsmc" aqui ou clique' dica='Usa a aba "MANUTENÇÃO - 211 NSIS"' />
        <div className="p-4 bg-cobre-fundo rounded-xl text-xs text-tinta space-y-1">
          <p className="font-bold">Para trazer o histórico uma vez e parar de usar a planilha</p>
          <p>• Cada linha com NSMP ou valor vira um item de cobrança da NSIS, com NSPR, valor final e AP.</p>
          <p>• Linha só com o serviço e o texto vira uma NSIS "a fechar", e o texto vira a observação.</p>
          <p>• Não sobrescreve nada que já esteja na NEO. Reimportar não duplica: o item é reconhecido pelo serviço + NSMP.</p>
          <p>• O "-ok" do número da equipe é removido.</p>
        </div>
      </>
    );
  }

  return (
    <div className="bg-white border border-linha rounded-2xl overflow-hidden">
      <CabecalhoArquivo arquivo={arquivo} onLimpar={limpar} bloqueado={importando} />
      <div className="p-4 space-y-4">
        {erro && <p className="text-sm text-erro bg-erro-fundo rounded-xl p-3">{erro}</p>}
        {leitura?.erro && <p className="text-sm text-erro bg-erro-fundo rounded-xl p-3">{leitura.erro}</p>}
        {!leitura && !erro && <p className="flex items-center gap-2 text-sm text-aco"><Loader2 size={15} className="animate-spin" /> Lendo arquivo…</p>}
        {leitura && !leitura.erro && (
          <>
            <p className="text-sm text-aco">Aba lida: <strong className="text-tinta">{leitura.aba}</strong></p>
            <div className="grid grid-cols-3 gap-3">
              <Numero valor={leitura.nsisDistintas} rotulo="NSIS distintas" cor="text-sinal" />
              <Numero valor={leitura.comItem} rotulo="Itens de cobrança" />
              <Numero valor={leitura.aFechar} rotulo="Ainda a fechar" cor="text-pendente" />
            </div>
            {resultado ? (
              <div className="flex items-center gap-3 p-4 bg-concluido-fundo border border-emerald-200 rounded-xl text-sm">
                <CheckCircle2 size={20} className="text-concluido" />
                <p><strong>{resultado.nsisCriadas}</strong> NSIS criadas · <strong>{resultado.itensCriados}</strong> itens criados · {resultado.itensJaExistentes} itens já existiam</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={limpar} disabled={importando} className="flex-1 h-10 border border-linha rounded-xl text-sm font-semibold text-aco hover:bg-nevoa disabled:opacity-50">Cancelar</button>
                <button onClick={importar} disabled={importando}
                  className="flex-1 h-10 bg-sinal hover:bg-sinal-forte text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {importando ? <><Loader2 size={15} className="animate-spin" /> Importando {progresso}</> : <>Importar histórico <ArrowRight size={15} /></>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
