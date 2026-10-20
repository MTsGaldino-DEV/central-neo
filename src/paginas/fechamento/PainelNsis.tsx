import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  X, Copy, Check, Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Ban, RotateCcw,
  AlertTriangle, MapPin, CalendarCheck, FileText, Equal,
} from 'lucide-react';
import EtapaChip from '@/components/fechamento/EtapaChip';
import {
  getNsis, criarItem, atualizarItem, excluirItem, definirSemCobranca, formatarUS, formatarReais, emReais, formatarData, lerNumero, normalizarAP,
  type Nsis, type ItemNsis, type ItemNsisCampos,
} from '@/lib/fechamento';
import { listarContrato, calcularValor, retiradaPar, filtrarCodigos, type CodigoContrato } from '@/lib/contrato';

interface Props {
  servico: string;
  onFechar: () => void;
  /** Avisa a fila que algo mudou (etapa, valores). */
  onAlterado: () => void;
}

export default function PainelNsis({ servico, onFechar, onAlterado }: Props) {
  const [nsis, setNsis] = useState<Nsis | null>(null);
  const [itens, setItens] = useState<ItemNsis[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [novoItem, setNovoItem] = useState(false);

  async function carregar() {
    try {
      const r = await getNsis(servico);
      setNsis(r.nsis);
      setItens(r.itens);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir a NSIS.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    setCarregando(true);
    setNovoItem(false);
    setDetalhes(false);
    carregar();
  }, [servico]);

  useEffect(() => {
    // Esc dentro de um campo (ex.: busca de código) não fecha o painel
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) onFechar();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  async function aposMudanca() {
    await carregar();
    onAlterado();
  }

  function copiar() {
    navigator.clipboard.writeText(servico);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1200);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-tinta/30" onClick={onFechar} />
      <aside className="relative w-full max-w-2xl h-full bg-nevoa shadow-2xl flex flex-col">
        <header className="bg-white border-b border-linha px-5 py-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-aco-claro">NSIS</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="font-codigo text-xl font-bold">{servico}</h2>
              <button onClick={copiar} className="p-1 text-aco-claro hover:text-sinal" title="Copiar número">
                {copiado ? <Check size={15} className="text-concluido" /> : <Copy size={15} />}
              </button>
              {nsis && <EtapaChip etapa={nsis.etapa} />}
            </div>
          </div>
          <button onClick={onFechar} className="p-1.5 text-aco-claro hover:text-tinta rounded-lg hover:bg-nevoa" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {carregando && (
            <div className="flex items-center justify-center gap-2 py-16 text-aco">
              <Loader2 size={18} className="animate-spin" /> Carregando…
            </div>
          )}
          {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3">{erro}</div>}

          {nsis && !carregando && (
            <>
              {/* O que foi feito */}
              <section className="bg-white border border-linha rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-aco-claro mb-2">O que a equipe fez</p>
                {nsis.observacao ? (
                  <p className="text-base font-semibold leading-relaxed">{nsis.observacao}</p>
                ) : nsis.origem === 'HISTORICO' ? (
                  <p className="text-sm text-aco">Veio da planilha de controle: o que foi feito está descrito nos itens de cobrança abaixo.</p>
                ) : (
                  <p className="text-sm font-semibold text-pendente flex items-center gap-1.5">
                    <AlertTriangle size={15} /> Sem observação no GDIS. Abra o serviço lá para ver o que foi feito.
                  </p>
                )}
                {nsis.endereco && (
                  <p className="mt-3 text-sm text-aco flex gap-1.5">
                    <FileText size={15} className="shrink-0 mt-0.5" />
                    <span><span className="font-semibold">Pedido/endereço:</span> {nsis.endereco}</span>
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5"><CalendarCheck size={15} className="text-aco-claro" />
                    <span className="text-aco">DT execução</span> <strong>{formatarData(nsis.termino, true)}</strong></span>
                  <span className="flex items-center gap-1.5"><MapPin size={15} className="text-aco-claro" />
                    <span className="text-aco">Localidade</span> <strong className="font-codigo">{nsis.localidade ?? '—'}</strong></span>
                </div>

                <button onClick={() => setDetalhes((d) => !d)} className="mt-4 flex items-center gap-1 text-xs font-bold text-sinal">
                  {detalhes ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Detalhes da execução
                </button>
                {detalhes && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-nevoa rounded-xl p-4">
                    <Campo rotulo="Matrícula (líder)" valor={nsis.matricula} codigo />
                    <Campo rotulo="Nome" valor={nsis.nome} />
                    <Campo rotulo="Tempo de deslocamento" valor={nsis.tempo_deslocamento} />
                    <Campo rotulo="Tempo de execução" valor={nsis.tempo_execucao} />
                    <Campo rotulo="Pedido em" valor={formatarData(nsis.pedido_em, true)} />
                    <Campo rotulo="Prazo legal" valor={nsis.prazo_legal ? `${nsis.prazo_legal} h` : null} />
                    <Campo rotulo="Referência" valor={nsis.referencia} codigo />
                    <Campo rotulo="Zona" valor={nsis.zona === 'U' ? 'Urbana' : nsis.zona === 'R' ? 'Rural' : nsis.zona} />
                    <Campo rotulo="Origem" valor={{ RELATORIO: 'Relatório GDIS', HISTORICO: 'Planilha de controle', MANUAL: 'Lançada à mão' }[nsis.origem]} />
                    <Campo rotulo="Ref. do local" valor={nsis.referencia_local} />
                    <Campo rotulo="Valor da US na execução" valor={nsis.valor_us_reais !== null ? formatarReais(nsis.valor_us_reais) : nsis.termino ? 'sem valor cadastrado' : 'sem data'} />
                  </dl>
                )}
              </section>

              {/* Cobrança */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-aco-claro">Cobrança à CEMIG</p>
                  {nsis.qtd_itens > 0 && (
                    <p className="text-xs text-aco">
                      Pedido <strong className="text-tinta">{formatarUS(nsis.valor_inicial_total)} US</strong>
                      {nsis.valor_us_reais !== null && <> ({formatarReais(nsis.valor_inicial_reais_total)})</>}
                      {' · '}Pago <strong className="text-tinta">{formatarUS(nsis.valor_final_total)} US</strong>
                      {nsis.valor_us_reais !== null && <> ({formatarReais(nsis.valor_final_reais_total)})</>}
                    </p>
                  )}
                </div>

                {nsis.sem_cobranca ? (
                  <SemCobranca nsis={nsis} onAlterado={aposMudanca} />
                ) : (
                  <div className="space-y-3">
                    {itens.map((it, i) => (
                      <CartaoItem key={it.id} item={it} numero={i + 1} valorUS={nsis.valor_us_reais} onAlterado={aposMudanca} />
                    ))}

                    {novoItem || itens.length === 0 ? (
                      <FormItem
                        titulo={itens.length === 0 ? 'O que deve ser cobrado?' : 'Outro item a cobrar'}
                        equipePadrao={itens[itens.length - 1]?.equipe ?? ''}
                        ruralPadrao={nsis.zona === 'R'}
                        onCancelar={itens.length > 0 ? () => setNovoItem(false) : undefined}
                        onSalvar={async (novos) => {
                          for (const campos of novos) await criarItem(servico, campos);
                          setNovoItem(false);
                          await aposMudanca();
                        }}
                      />
                    ) : (
                      <button onClick={() => setNovoItem(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-linha rounded-2xl text-sm font-semibold text-aco hover:border-sinal hover:text-sinal">
                        <Plus size={16} /> Adicionar outro item a cobrar
                      </button>
                    )}

                    {itens.length === 0 && <MarcarSemCobranca servico={servico} onAlterado={aposMudanca} />}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Campo({ rotulo, valor, codigo }: { rotulo: string; valor: string | null | undefined; codigo?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-aco">{rotulo}</dt>
      <dd className={`font-semibold ${codigo ? 'font-codigo' : ''}`}>{valor || '—'}</dd>
    </div>
  );
}

// ─── Um item de cobrança, com as etapas NSMP → NSPR → fatura ────────────────

function CartaoItem({ item, numero, valorUS, onAlterado }: { item: ItemNsis; numero: number; valorUS: number | null; onAlterado: () => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (editando) {
    return (
      <FormItem
        titulo={`Editar item ${numero}`}
        inicial={item}
        completo
        onCancelar={() => setEditando(false)}
        onSalvar={async ([campos]) => {
          await atualizarItem(item.id, campos);
          setEditando(false);
          await onAlterado();
        }}
      />
    );
  }

  async function salvar(patch: Partial<ItemNsisCampos>) {
    setErro(null);
    try {
      await atualizarItem(item.id, patch);
      await onAlterado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    }
  }

  async function excluir() {
    if (!confirm(`Excluir o item "${item.descricao}"?`)) return;
    setExcluindo(true);
    try {
      await excluirItem(item.id);
      await onAlterado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao excluir.');
      setExcluindo(false);
    }
  }

  const semValorPago = item.nspr !== null && item.valor_final === null;
  const divergente = item.nspr !== null && !semValorPago && item.valor_final !== item.valor_inicial;

  return (
    <div className="bg-white border border-linha rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3 border-b border-linha">
        <span className="size-6 shrink-0 rounded-full bg-sinal-fundo text-sinal text-xs font-bold flex items-center justify-center">{numero}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-snug">{item.descricao}</p>
          <p className="text-xs text-aco mt-0.5">
            Equipe <span className="font-codigo font-semibold text-tinta">{item.equipe || '—'}</span>
            {item.codigo && (
              <> · Cód. <span className="font-codigo font-semibold text-tinta">{item.codigo}</span>
                {' '}({formatarUS(item.fator_unitario, 4)} × {formatarUS(item.quantidade, 0)}{item.rural ? ' × 1,2 rural' : ''})</>
            )}
            {' · '}Pedido <span className="font-bold text-cobre">{formatarUS(item.valor_inicial)} US</span>
            {valorUS !== null && item.valor_inicial !== null && <span className="text-cobre"> = {formatarReais(emReais(item.valor_inicial, valorUS))}</span>}
          </p>
        </div>
        <button onClick={() => setEditando(true)} className="p-1.5 text-aco-claro hover:text-sinal" title="Editar item"><Pencil size={14} /></button>
        <button onClick={excluir} disabled={excluindo} className="p-1.5 text-aco-claro hover:text-erro" title="Excluir item">
          {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>

      <ol className="grid grid-cols-3 divide-x divide-linha text-sm">
        <Etapa titulo="NSMP" feito={!!item.nsmp} valor={item.nsmp}>
          <CampoRapido placeholder="Nº da NSMP" onSalvar={(v) => salvar({ nsmp: v })} />
        </Etapa>
        <Etapa titulo="NSPR · valor pago" feito={!!item.nspr} bloqueado={!item.nsmp}
          valor={item.nspr && (
            <>
              <span className="font-codigo">{item.nspr}</span>
              {semValorPago ? (
                <span className="block mt-1">
                  <span className="block text-[11px] font-bold text-pendente mb-1">Valor pago não informado</span>
                  <CampoRapido placeholder="Valor pago (US)" onSalvar={(v) => salvar({ valor_final: lerNumero(v) })} />
                </span>
              ) : (
                <span className={`block text-xs font-bold mt-0.5 ${divergente ? 'text-erro' : 'text-concluido'}`}>
                  {formatarUS(item.valor_final)} US {divergente && `(pedido ${formatarUS(item.valor_inicial)})`}
                  {valorUS !== null && <span className="block font-semibold">{formatarReais(emReais(item.valor_final, valorUS))}</span>}
                </span>
              )}
            </>
          )}>
          <ConfirmacaoNspr valorPedido={item.valor_inicial} onSalvar={(nspr, valor) => salvar({ nspr, valor_final: valor })} />
        </Etapa>
        <Etapa titulo="Fatura (AP)" feito={!!item.fatura} bloqueado={!item.nspr} valor={item.fatura}>
          <CampoRapido placeholder="Ex.: AP 83809" onSalvar={(v) => salvar({ fatura: normalizarAP(v) })} />
        </Etapa>
      </ol>
      {erro && <p className="px-4 py-2 text-xs text-erro bg-erro-fundo">{erro}</p>}
    </div>
  );
}


function Etapa({ titulo, feito, bloqueado, valor, children }: {
  titulo: string; feito: boolean; bloqueado?: boolean; valor: ReactNode; children: ReactNode;
}) {
  return (
    <li className={`p-3 ${feito ? 'bg-concluido-fundo/40' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-aco-claro mb-1.5 flex items-center gap-1">
        {feito && <Check size={11} className="text-concluido" />} {titulo}
      </p>
      {feito ? (
        <div className="font-semibold">{typeof valor === 'string' ? <span className="font-codigo">{valor}</span> : valor}</div>
      ) : bloqueado ? (
        <p className="text-xs text-aco-claro">Aguardando etapa anterior</p>
      ) : (
        children
      )}
    </li>
  );
}

function CampoRapido({ placeholder, onSalvar }: { placeholder: string; onSalvar: (v: string) => Promise<void> }) {
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!valor.trim()) return;
    setSalvando(true);
    await onSalvar(valor.trim());
    setSalvando(false);
  }
  return (
    <form onSubmit={enviar} className="flex gap-1">
      <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={placeholder}
        className="min-w-0 flex-1 h-8 px-2 text-xs font-codigo border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
      <button type="submit" disabled={salvando || !valor.trim()} className="h-8 px-2 rounded-lg bg-sinal text-white disabled:opacity-40" title="Salvar">
        {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
    </form>
  );
}

function ConfirmacaoNspr({ valorPedido, onSalvar }: { valorPedido: number | null; onSalvar: (nspr: string, valor: number | null) => Promise<void> }) {
  const [nspr, setNspr] = useState('');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nspr.trim()) return;
    setSalvando(true);
    await onSalvar(nspr.trim(), lerNumero(valor));
    setSalvando(false);
  }
  return (
    <form onSubmit={enviar} className="space-y-1">
      <input value={nspr} onChange={(e) => setNspr(e.target.value)} placeholder="Nº da NSPR"
        className="w-full h-8 px-2 text-xs font-codigo border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
      <div className="flex gap-1">
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor pago (US)" inputMode="decimal"
          className="min-w-0 flex-1 h-8 px-2 text-xs border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
        {valorPedido !== null && (
          <button type="button" onClick={() => setValor(formatarUS(valorPedido, 2))} title="Pago igual ao pedido"
            className="h-8 px-2 rounded-lg border border-linha text-aco hover:text-sinal hover:border-sinal">
            <Equal size={13} />
          </button>
        )}
        <button type="submit" disabled={salvando || !nspr.trim()} className="h-8 px-2 rounded-lg bg-sinal text-white disabled:opacity-40" title="Salvar">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
      </div>
    </form>
  );
}

// ─── Formulário de item (novo ou edição completa) ────────────────────────────

type CamposItem = Partial<ItemNsisCampos> & { descricao: string };

function FormItem({ titulo, inicial, completo, equipePadrao, ruralPadrao, onSalvar, onCancelar }: {
  titulo: string;
  inicial?: ItemNsis;
  completo?: boolean;
  equipePadrao?: string;
  ruralPadrao?: boolean;
  /** Mais de um item quando é substituição (instalação + retirada). */
  onSalvar: (itens: CamposItem[]) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [tabela, setTabela] = useState<CodigoContrato[]>([]);
  const [erroTabela, setErroTabela] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<CodigoContrato | null>(null);
  const [semCodigo, setSemCodigo] = useState(!!inicial && !inicial.codigo);
  const [quantidade, setQuantidade] = useState(String(inicial?.quantidade ?? 1).replace('.', ','));
  const [rural, setRural] = useState(inicial?.rural ?? !!ruralPadrao);
  const [substituicao, setSubstituicao] = useState(false);
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [equipe, setEquipe] = useState(inicial?.equipe ?? equipePadrao ?? '');
  const [valorManual, setValorManual] = useState(inicial?.valor_inicial != null ? formatarUS(inicial.valor_inicial) : '');
  const [nsmp, setNsmp] = useState(inicial?.nsmp ?? '');
  const [nspr, setNspr] = useState(inicial?.nspr ?? '');
  const [valorFinal, setValorFinal] = useState(inicial?.valor_final != null ? formatarUS(inicial.valor_final) : '');
  const [usAdicional, setUsAdicional] = useState(inicial?.us_adicional != null ? formatarUS(inicial.us_adicional) : '');
  const [fatura, setFatura] = useState(inicial?.fatura ?? '');
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarContrato()
      .then((lista) => {
        setTabela(lista);
        if (inicial?.codigo) setCodigo(lista.find((c) => c.codigo === inicial.codigo) ?? null);
      })
      .catch((e) => setErroTabela(e instanceof Error ? e.message : 'Falha ao carregar a tabela.'));
  }, []);

  // Na edição o item guarda o valor do código da época do pedido; só usa o
  // valor atual se o código for trocado.
  const mesmoCodigo = !!inicial?.codigo && codigo?.codigo === inicial.codigo;
  const fator = codigo ? (mesmoCodigo && inicial?.fator_unitario != null ? inicial.fator_unitario : codigo.fator_us) : null;
  const qtd = lerNumero(quantidade);
  const valorCalculado = fator !== null && qtd !== null ? calcularValor(fator, qtd, rural) : null;
  const par = codigo && !inicial ? retiradaPar(codigo, tabela) : null;

  function escolher(c: CodigoContrato) {
    setCodigo(c);
    setSubstituicao(false);
    // descrição sugerida a partir do código; quem fecha pode completar
    if (!descricao.trim() || tabela.some((t) => descricao === `${t.operacao} ${t.atividade}`)) {
      setDescricao(`${c.operacao} ${c.atividade}`);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const vazio = (s: string) => (s.trim() ? s.trim() : null);
    const itens: CamposItem[] = [];

    if (semCodigo) {
      if (!descricao.trim()) return setErro('Descreva o que está sendo cobrado.');
      if (valorManual.trim() && lerNumero(valorManual) === null) return setErro('Valor inicial inválido.');
      itens.push({
        descricao: descricao.trim(), equipe: vazio(equipe), codigo: null, quantidade: 1, rural: false,
        fator_unitario: null, valor_inicial: lerNumero(valorManual),
      });
    } else {
      if (!codigo || fator === null) return setErro('Escolha o código da Tabela 03.');
      if (qtd === null || qtd <= 0) return setErro('Informe a quantidade.');
      itens.push({
        descricao: descricao.trim() || `${codigo.operacao} ${codigo.atividade}`, equipe: vazio(equipe),
        codigo: codigo.codigo, quantidade: qtd, rural, fator_unitario: fator, valor_inicial: valorCalculado,
      });
      if (substituicao && par) {
        itens.push({
          descricao: `${par.operacao} ${par.atividade}`, equipe: vazio(equipe), codigo: par.codigo, quantidade: qtd, rural,
          fator_unitario: par.fator_us, valor_inicial: calcularValor(par.fator_us, qtd, rural),
        });
      }
    }

    if (completo) {
      Object.assign(itens[0], {
        nsmp: vazio(nsmp),
        nspr: vazio(nspr),
        valor_final: lerNumero(valorFinal),
        us_adicional: lerNumero(usAdicional),
        fatura: fatura.trim() ? normalizarAP(fatura) : null,
        observacao: vazio(observacao),
      });
    }
    setSalvando(true);
    try {
      await onSalvar(itens);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  const campo = 'w-full h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
  const rotulo = 'block text-[11px] font-semibold text-aco mb-1';
  return (
    <form onSubmit={enviar} className="bg-white border-2 border-sinal/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{titulo}</p>
        <button type="button" onClick={() => { setSemCodigo((v) => !v); setErro(null); }} className="text-[11px] font-semibold text-sinal hover:underline">
          {semCodigo ? 'Usar código da Tabela 03' : 'Lançar sem código'}
        </button>
      </div>
      {erro && <p className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}

      {semCodigo ? (
        <>
          <div>
            <label className={rotulo}>Tipo de serviço cobrado</label>
            <input autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} className={campo}
              placeholder="Ex.: serviço fora da Tabela 03" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={rotulo}>Nº da equipe</label>
              <input value={equipe} onChange={(e) => setEquipe(e.target.value)} className={`${campo} font-codigo`} /></div>
            <div><label className={rotulo}>Valor inicial (US)</label>
              <input value={valorManual} onChange={(e) => setValorManual(e.target.value)} inputMode="decimal" placeholder="0,10" className={campo} /></div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className={rotulo}>Código da Tabela 03</label>
            {erroTabela ? (
              <p className="text-xs text-erro">{erroTabela}</p>
            ) : (
              <SeletorCodigo tabela={tabela} selecionado={codigo} onEscolher={escolher} onLimpar={() => setCodigo(null)} />
            )}
          </div>
          {codigo && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={rotulo}>Quantidade ({(codigo.unidade ?? 'un').toLowerCase()})</label>
                  <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" className={campo} /></div>
                <div><label className={rotulo}>Nº da equipe</label>
                  <input value={equipe} onChange={(e) => setEquipe(e.target.value)} className={`${campo} font-codigo`} /></div>
                <label className="flex items-end gap-2 pb-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={rural} onChange={(e) => setRural(e.target.checked)} className="accent-sinal size-4" />
                  Área rural (+20%)
                </label>
              </div>
              <div>
                <label className={rotulo}>Descrição no pedido</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={campo} />
              </div>
              {par && (
                <label className="flex items-start gap-2 text-sm bg-nevoa rounded-xl px-3 py-2 cursor-pointer select-none">
                  <input type="checkbox" checked={substituicao} onChange={(e) => setSubstituicao(e.target.checked)} className="accent-sinal size-4 mt-0.5" />
                  <span>
                    <strong>Foi substituição</strong>: lançar também a retirada{' '}
                    <span className="font-codigo">{par.codigo}</span> ({formatarUS(par.fator_us, 4)} US)
                    <span className="block text-[11px] text-aco">Pela Tabela 03, substituir = 1 retirada + 1 instalação.</span>
                  </span>
                </label>
              )}
              <div className="flex items-center justify-between bg-cobre-fundo rounded-xl px-3 py-2 text-sm">
                <span className="text-aco">
                  {formatarUS(fator, 4)} × {quantidade || '?'}{rural ? ' × 1,2' : ''}
                  {substituicao && par && <> + retirada {formatarUS(par.fator_us, 4)} × {quantidade || '?'}{rural ? ' × 1,2' : ''}</>}
                </span>
                <strong className="text-cobre">
                  {formatarUS(
                    valorCalculado === null ? null
                      : valorCalculado + (substituicao && par && qtd !== null ? calcularValor(par.fator_us, qtd, rural) : 0),
                    2,
                  )} US
                </strong>
              </div>
              {mesmoCodigo && inicial?.fator_unitario != null && codigo.fator_us !== inicial.fator_unitario && (
                <p className="text-[11px] text-pendente">
                  O valor do código mudou para {formatarUS(codigo.fator_us, 4)} depois do pedido; este item continua com {formatarUS(inicial.fator_unitario, 4)}.
                </p>
              )}
            </>
          )}
        </>
      )}

      {completo && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={rotulo}>NSMP</label>
              <input value={nsmp} onChange={(e) => setNsmp(e.target.value)} className={`${campo} font-codigo`} /></div>
            <div><label className={rotulo}>NSPR</label>
              <input value={nspr} onChange={(e) => setNspr(e.target.value)} className={`${campo} font-codigo`} /></div>
            <div><label className={rotulo}>Valor final pago (US)</label>
              <input value={valorFinal} onChange={(e) => setValorFinal(e.target.value)} inputMode="decimal" className={campo} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={rotulo}>US adicional</label>
              <input value={usAdicional} onChange={(e) => setUsAdicional(e.target.value)} inputMode="decimal" className={campo} /></div>
            <div className="col-span-2"><label className={rotulo}>Apropriação / fatura</label>
              <input value={fatura} onChange={(e) => setFatura(e.target.value)} placeholder="AP 83809" className={`${campo} font-codigo`} /></div>
          </div>
          <div><label className={rotulo}>Observação</label>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} /></div>
        </>
      )}
      <div className="flex justify-end gap-2 pt-1">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="px-4 h-9 text-sm font-semibold text-aco border border-linha rounded-lg hover:bg-nevoa">Cancelar</button>
        )}
        <button type="submit" disabled={salvando} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-2">
          {salvando && <Loader2 size={14} className="animate-spin" />} {substituicao && par ? 'Salvar 2 itens' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

/** Busca na Tabela 03 por código ou palavras da atividade; setas + Enter escolhem. */
function SeletorCodigo({ tabela, selecionado, onEscolher, onLimpar }: {
  tabela: CodigoContrato[];
  selecionado: CodigoContrato | null;
  onEscolher: (c: CodigoContrato) => void;
  onLimpar: () => void;
}) {
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!selecionado) entrada.current?.focus(); }, [selecionado]);

  const opcoes = filtrarCodigos(tabela.filter((c) => c.ativo), termo).slice(0, 30);

  if (selecionado) {
    return (
      <div className="flex items-center gap-3 border border-sinal/40 bg-sinal-fundo rounded-lg px-3 py-2">
        <span className="font-codigo font-bold text-sinal">{selecionado.codigo}</span>
        <span className="flex-1 min-w-0 text-sm">
          <span className="font-semibold">{selecionado.operacao}</span> {selecionado.atividade}
          <span className="block text-[11px] text-aco">{formatarUS(selecionado.fator_us, 4)} US por {(selecionado.unidade ?? 'unidade').toLowerCase()}</span>
        </span>
        <button type="button" onClick={() => { onLimpar(); setTermo(''); }} className="text-xs font-semibold text-sinal hover:underline">Trocar</button>
      </div>
    );
  }

  function teclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, opcoes.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && opcoes[ativo]) { e.preventDefault(); onEscolher(opcoes[ativo]); setAberto(false); }
    else if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); }
  }

  return (
    <div className="relative">
      <input ref={entrada} value={termo} onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
        onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)} onKeyDown={teclar}
        placeholder="Digite o código ou o serviço: poda, espaçador, cruzeta, 704091…"
        className="w-full h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
      {aberto && (
        <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-linha rounded-xl shadow-lg">
          {opcoes.length === 0 && <li className="px-3 py-3 text-sm text-aco">Nenhum código encontrado.</li>}
          {opcoes.map((c, i) => (
            <li key={c.codigo}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onEscolher(c); setAberto(false); }}
                onMouseEnter={() => setAtivo(i)}
                className={`w-full text-left px-3 py-2 flex items-start gap-3 ${i === ativo ? 'bg-sinal-fundo' : ''}`}>
                <span className="font-codigo text-xs font-bold text-sinal pt-0.5">{c.codigo}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm"><span className="font-semibold">{c.operacao}</span> {c.atividade}</span>
                  <span className="block text-[11px] text-aco truncate">{c.descricao}</span>
                </span>
                <span className="text-xs font-bold text-cobre whitespace-nowrap pt-0.5">
                  {formatarUS(c.fator_us, 4)}
                  {c.acertado && <span className="block text-[9px] text-pendente text-right">acertado</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Sem cobrança ────────────────────────────────────────────────────────────

function MarcarSemCobranca({ servico, onAlterado }: { servico: string; onAlterado: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="flex items-center gap-1.5 text-xs font-semibold text-aco hover:text-tinta">
        <Ban size={13} /> Não há nada a cobrar nesta NSIS
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!motivo.trim()) return;
        setSalvando(true);
        await definirSemCobranca(servico, motivo.trim());
        await onAlterado();
      }}
      className="bg-white border border-linha rounded-2xl p-4 space-y-2"
    >
      <label className="block text-xs font-semibold text-aco">Por que não há cobrança?</label>
      <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente solicitou no ponto errado"
        className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setAberto(false)} className="px-3 h-8 text-xs font-semibold text-aco border border-linha rounded-lg">Cancelar</button>
        <button type="submit" disabled={salvando || !motivo.trim()} className="px-3 h-8 text-xs font-bold text-white bg-tinta rounded-lg disabled:opacity-40">
          Fechar sem cobrança
        </button>
      </div>
    </form>
  );
}

function SemCobranca({ nsis, onAlterado }: { nsis: Nsis; onAlterado: () => Promise<void> }) {
  const [salvando, setSalvando] = useState(false);
  return (
    <div className="bg-etapa-sem-fundo border border-linha rounded-2xl p-4 flex items-start gap-3">
      <Ban size={18} className="text-etapa-sem shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-bold">Fechada sem cobrança</p>
        <p className="text-sm text-aco mt-0.5">{nsis.motivo_sem_cobranca}</p>
      </div>
      <button
        disabled={salvando}
        onClick={async () => {
          setSalvando(true);
          await definirSemCobranca(nsis.servico, null);
          await onAlterado();
        }}
        className="flex items-center gap-1.5 text-xs font-semibold text-sinal hover:underline"
      >
        <RotateCcw size={13} /> Reabrir
      </button>
    </div>
  );
}
