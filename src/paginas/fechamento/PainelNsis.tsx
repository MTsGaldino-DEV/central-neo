import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Copy, Check, Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Ban, RotateCcw,
  AlertTriangle, MapPin, CalendarCheck, FileText, Equal,
} from 'lucide-react';
import EtapaChip from '@/components/fechamento/EtapaChip';
import { JanelaModal } from '@/components/faturamento/JanelaModal';
import {
  getNsis, criarItens, atualizarItem, atualizarItens, confirmarPago, excluirItem, definirSemCobranca,
  formatarUS, formatarReais, emReais, formatarData, lerNumero, normalizarAP,
  type Nsis, type ItemNsis, type ItemNsisCampos,
} from '@/lib/fechamento';
import { listarContrato, type CodigoContrato } from '@/lib/contrato';
import { agruparLancamentos, calcularValor, fatorPadrao, textoFator, type Lancamento } from '@/lib/fechamentoCobranca';
import {
  ROTULO_SECAO, CAMPO, ROTULO_CAMPO, impedirEnvioPeloEnter, EditorCodigos, SeletorCodigo, SeletorFator, valorDaLinha, type LinhaLancamento,
} from './ComponentesLancamento';
import JanelaFluxo from './JanelaFluxo';

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
  // Códigos escolhidos e ainda não salvos: fechar a janela pede confirmação
  const [rascunho, setRascunho] = useState(false);
  const [avisoSair, setAvisoSair] = useState(false);

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
    setRascunho(false);
    setAvisoSair(false);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico]);

  async function aposMudanca() {
    await carregar();
    onAlterado();
  }

  function copiar() {
    navigator.clipboard.writeText(servico);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1200);
  }

  function pedirFechar() {
    if (avisoSair) setAvisoSair(false);
    else if (rascunho) setAvisoSair(true);
    else onFechar();
  }

  const lancamentos = agruparLancamentos(itens);
  const pendente = lancamentos.find((l) => l.nsmp === null);

  return (
    <JanelaModal aberta onFechar={pedirFechar} largura="lg" rotuloCancelar={avisoSair ? 'Continuar lançando' : 'Fechar'}
      titulo={(
        <span className="flex w-full flex-wrap items-start justify-between gap-3 pr-2">
          <span>
            <span className={`block ${ROTULO_SECAO}`}>NSIS</span>
            <span className="flex items-center gap-2 mt-0.5">
              <span className="font-codigo text-2xl font-extrabold">{servico}</span>
              <button type="button" onClick={copiar} className="p-1 text-aco-claro hover:text-sinal" title="Copiar número" aria-label="Copiar número">
                {copiado ? <Check size={15} className="text-concluido" /> : <Copy size={15} />}
              </button>
            </span>
          </span>
          {nsis && <EtapaChip etapa={nsis.etapa} />}
        </span>
      )}
      rodape={avisoSair && (
        <>
          <span className="-order-1 mr-auto text-sm font-semibold text-pendente">Os códigos escolhidos ainda não foram salvos.</span>
          <button type="button" onClick={onFechar} className="rounded-lg bg-erro px-4 py-2 text-sm font-bold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-erro">
            Descartar e fechar
          </button>
        </>
      )}>
      <div className="space-y-5">
        {carregando && (
          <div className="flex items-center justify-center gap-2 py-16 text-aco">
            <Loader2 size={18} className="animate-spin" /> Carregando…
          </div>
        )}
        {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3">{erro}</div>}

        {nsis && !carregando && (
          <>
            {/* O que foi feito */}
            <section className="bg-nevoa rounded-xl p-4">
              <p className={`${ROTULO_SECAO} mb-2`}>O que a equipe fez</p>
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
                <span><span className="text-aco">Supervisor</span> <strong>{nsis.supervisor ?? '—'}</strong></span>
                <span><span className="text-aco">Tipo</span> <strong>{nsis.tipo_serv}</strong></span>
              </div>

              <button type="button" onClick={() => setDetalhes((d) => !d)} className="mt-4 flex items-center gap-1 text-xs font-bold text-sinal">
                {detalhes ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Detalhes da execução
              </button>
              {detalhes && (
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-white border border-linha rounded-xl p-4">
                  <Campo rotulo="Matrícula (líder)" valor={nsis.matricula} codigo />
                  <Campo rotulo="Nome" valor={nsis.nome} />
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
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
                <p className={ROTULO_SECAO}>Cobrança à CEMIG</p>
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
              ) : nsis.fluxo_novo ? (
                <div className="space-y-3">
                  <JanelaFluxo nsis={nsis} itens={itens} onAlterado={aposMudanca}
                    onRascunho={(tem) => { setRascunho(tem); if (!tem) setAvisoSair(false); }} />
                  {itens.length === 0 && <MarcarSemCobranca servico={servico} onAlterado={aposMudanca} />}
                </div>
              ) : (
                <div className="space-y-3">
                  {lancamentos.map((l) => (
                    <CartaoLancamento key={l.chave} lancamento={l} primeiroNumero={1 + itens.indexOf(l.itens[0])} valorUS={nsis.valor_us_reais} onAlterado={aposMudanca} />
                  ))}

                  {novoItem || itens.length === 0 ? (
                    <FormLancamento
                      titulo={itens.length === 0 ? 'O que deve ser cobrado?' : pendente ? 'Mais códigos neste lançamento' : 'Novo lançamento'}
                      zona={nsis.zona}
                      equipePadrao={itens[itens.length - 1]?.equipe ?? ''}
                      fatorInicial={pendente?.itens[0].fator ?? fatorPadrao(nsis.zona)}
                      valorUS={nsis.valor_us_reais}
                      onRascunho={(tem) => { setRascunho(tem); if (!tem) setAvisoSair(false); }}
                      onCancelar={itens.length > 0 ? () => { setNovoItem(false); setRascunho(false); setAvisoSair(false); } : undefined}
                      onSalvar={async (novos) => {
                        await criarItens(servico, novos);
                        setNovoItem(false);
                        setRascunho(false);
                        setAvisoSair(false);
                        await aposMudanca();
                      }}
                    />
                  ) : (
                    <button type="button" onClick={() => setNovoItem(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-linha rounded-xl text-sm font-semibold text-aco hover:border-sinal hover:text-sinal">
                      <Plus size={16} /> {pendente ? 'Adicionar mais códigos a este lançamento' : 'Novo lançamento, com outra NSMP'}
                    </button>
                  )}

                  {itens.length === 0 && <MarcarSemCobranca servico={servico} onAlterado={aposMudanca} />}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </JanelaModal>
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

// ─── Um lançamento: os códigos da mesma NSMP, com as etapas NSMP → NSPR → fatura ─

function CartaoLancamento({ lancamento, primeiroNumero, valorUS, onAlterado }: {
  lancamento: Lancamento<ItemNsis>; primeiroNumero: number; valorUS: number | null; onAlterado: () => Promise<void>;
}) {
  const { itens, nsmp, nspr, fatura, pedido, pago, semValorPago, divergente } = lancamento;
  const [erro, setErro] = useState<string | null>(null);
  const varios = itens.length > 1;
  const ids = itens.map((it) => it.id);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    try {
      await acao();
      await onAlterado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    }
  }

  return (
    <div className="bg-white border border-linha rounded-xl overflow-hidden">
      <ul className="divide-y divide-linha border-b border-linha">
        {itens.map((it, i) => (
          <LinhaItem key={it.id} item={it} numero={primeiroNumero + i} valorUS={valorUS} onAlterado={onAlterado} onErro={setErro} />
        ))}
      </ul>
      {varios && (
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 bg-cobre-fundo px-4 py-2 text-xs border-b border-linha">
          <span className="text-aco">Total do lançamento, {itens.length} códigos</span>
          <span>
            <strong className="text-cobre text-sm">{formatarUS(pedido)} US</strong>
            {valorUS !== null && <span className="text-cobre"> = {formatarReais(emReais(pedido, valorUS))}</span>}
          </span>
        </p>
      )}

      <ol className="grid grid-cols-1 divide-y divide-linha text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Etapa titulo="NSMP" feito={!!nsmp} valor={nsmp}>
          <CampoRapido placeholder="Nº da NSMP" onSalvar={(v) => executar(() => atualizarItens(ids, { nsmp: v }))} />
        </Etapa>
        <Etapa titulo="NSPR · valor pago" feito={!!nspr} bloqueado={!nsmp}
          valor={nspr && (
            <>
              <span className="font-codigo">{nspr}</span>
              {semValorPago ? (
                <span className="block mt-1">
                  <span className="block text-[11px] font-bold text-pendente mb-1">Valor pago não informado</span>
                  <CampoRapido placeholder={varios ? 'Valor pago total (US)' : 'Valor pago (US)'} onSalvar={(v) => executar(() => confirmarPago(itens, nspr, lerNumero(v)))} />
                </span>
              ) : (
                <span className={`block text-xs font-bold mt-0.5 ${divergente ? 'text-erro' : 'text-concluido'}`}>
                  {formatarUS(pago)} US {divergente && `(pedido ${formatarUS(pedido)})`}
                  {valorUS !== null && <span className="block font-semibold">{formatarReais(emReais(pago, valorUS))}</span>}
                  {divergente && varios && <span className="block font-normal text-[11px] text-aco">Dividido na proporção do pedido</span>}
                </span>
              )}
            </>
          )}>
          <ConfirmacaoNspr valorPedido={pedido} varios={varios} onSalvar={(n, v) => executar(() => confirmarPago(itens, n, v))} />
        </Etapa>
        <Etapa titulo="Fatura (AP)" feito={!!fatura} bloqueado={!nspr} valor={fatura}>
          <CampoRapido placeholder="Ex.: AP 83809" onSalvar={(v) => executar(() => atualizarItens(ids, { fatura: normalizarAP(v) }))} />
        </Etapa>
      </ol>
      {erro && <p className="px-4 py-2 text-xs text-erro bg-erro-fundo">{erro}</p>}
    </div>
  );
}

function LinhaItem({ item, numero, valorUS, onAlterado, onErro }: {
  item: ItemNsis; numero: number; valorUS: number | null; onAlterado: () => Promise<void>; onErro: (m: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  if (editando) {
    return (
      <li className="p-3">
        <FormEdicao
          titulo={`Editar item ${numero}`}
          inicial={item}
          onCancelar={() => setEditando(false)}
          onSalvar={async (campos) => {
            await atualizarItem(item.id, campos);
            setEditando(false);
            await onAlterado();
          }}
        />
      </li>
    );
  }

  async function excluir() {
    if (!confirm(`Excluir o item "${item.descricao}"?`)) return;
    setExcluindo(true);
    onErro(null);
    try {
      await excluirItem(item.id);
      await onAlterado();
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Falha ao excluir.');
      setExcluindo(false);
    }
  }

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span className="size-6 shrink-0 rounded-full bg-sinal-fundo text-sinal text-xs font-bold flex items-center justify-center">{numero}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug">{item.descricao}</p>
        <p className="text-xs text-aco mt-0.5">
          Equipe <span className="font-codigo font-semibold text-tinta">{item.equipe || '—'}</span>
          {item.codigo && (
            <> · Cód. <span className="font-codigo font-semibold text-tinta">{item.codigo}</span>
              {' '}({formatarUS(item.fator_unitario, 4)} × {formatarUS(item.quantidade, 0)}{item.fator !== 1 ? ` × ${textoFator(item.fator)}` : ''})</>
          )}
          {' · '}Pedido <span className="font-bold text-cobre">{formatarUS(item.valor_inicial)} US</span>
          {valorUS !== null && item.valor_inicial !== null && <span className="text-cobre"> = {formatarReais(emReais(item.valor_inicial, valorUS))}</span>}
        </p>
      </div>
      <button type="button" onClick={() => setEditando(true)} className="p-1.5 text-aco-claro hover:text-sinal" title="Editar item" aria-label={`Editar item ${numero}`}><Pencil size={14} /></button>
      <button type="button" onClick={excluir} disabled={excluindo} className="p-1.5 text-aco-claro hover:text-erro" title="Excluir item" aria-label={`Excluir item ${numero}`}>
        {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </li>
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
      <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="min-w-0 flex-1 h-8 px-2 text-xs font-codigo border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
      <button type="submit" disabled={salvando || !valor.trim()} className="h-8 px-2 rounded-lg bg-sinal text-white disabled:opacity-40" title="Salvar" aria-label="Salvar">
        {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
    </form>
  );
}

function ConfirmacaoNspr({ valorPedido, varios, onSalvar }: { valorPedido: number; varios: boolean; onSalvar: (nspr: string, valor: number | null) => Promise<void> }) {
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
      <input value={nspr} onChange={(e) => setNspr(e.target.value)} placeholder="Nº da NSPR" aria-label="Nº da NSPR"
        className="w-full h-8 px-2 text-xs font-codigo border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
      <div className="flex gap-1">
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={varios ? 'Pago total (US)' : 'Valor pago (US)'} aria-label={varios ? 'Valor pago total em US' : 'Valor pago em US'} inputMode="decimal"
          className="min-w-0 flex-1 h-8 px-2 text-xs border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
        {valorPedido > 0 && (
          <button type="button" onClick={() => setValor(String(valorPedido).replace('.', ','))} title="Pago igual ao pedido" aria-label="Pago igual ao pedido"
            className="h-8 px-2 rounded-lg border border-linha text-aco hover:text-sinal hover:border-sinal">
            <Equal size={13} />
          </button>
        )}
        <button type="submit" disabled={salvando || !nspr.trim()} className="h-8 px-2 rounded-lg bg-sinal text-white disabled:opacity-40" title="Salvar" aria-label="Salvar">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
      </div>
    </form>
  );
}

// ─── Lançamento: vários códigos que saem na mesma NSMP ───────────────────────

type CamposItem = Partial<ItemNsisCampos> & { descricao: string };

function FormLancamento({ titulo, zona, equipePadrao, fatorInicial, valorUS, onRascunho, onSalvar, onCancelar }: {
  titulo: string;
  zona: string | null;
  equipePadrao: string;
  fatorInicial: number;
  valorUS: number | null;
  onRascunho: (tem: boolean) => void;
  onSalvar: (itens: CamposItem[]) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [tabela, setTabela] = useState<CodigoContrato[]>([]);
  const [erroTabela, setErroTabela] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [fator, setFator] = useState(fatorInicial);
  const [equipe, setEquipe] = useState(equipePadrao);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarContrato().then(setTabela).catch((e) => setErroTabela(e instanceof Error ? e.message : 'Falha ao carregar a tabela.'));
  }, []);
  useEffect(() => { onRascunho(linhas.length > 0); }, [linhas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Math.round(linhas.reduce((soma, l) => soma + (valorDaLinha(l, fator) ?? 0), 0) * 10000) / 10000;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (linhas.length === 0) return setErro('Escolha pelo menos um código.');
    const nomeEquipe = equipe.trim() || null;
    const itens: CamposItem[] = [];
    for (const l of linhas) {
      if (l.codigo) {
        const qtd = lerNumero(l.quantidade);
        if (qtd === null || qtd <= 0) return setErro(`Informe a quantidade do código ${l.codigo.codigo}.`);
        itens.push({
          descricao: l.descricao.trim() || `${l.codigo.operacao} ${l.codigo.atividade}`, equipe: nomeEquipe, codigo: l.codigo.codigo,
          quantidade: qtd, fator, fator_unitario: l.codigo.fator_us, valor_inicial: calcularValor(l.codigo.fator_us, qtd, fator),
        });
      } else {
        if (!l.descricao.trim()) return setErro('Descreva o item sem código.');
        if (l.valorManual.trim() && lerNumero(l.valorManual) === null) return setErro(`Valor inválido em "${l.descricao.trim()}".`);
        itens.push({
          descricao: l.descricao.trim(), equipe: nomeEquipe, codigo: null,
          quantidade: 1, fator: 1, fator_unitario: null, valor_inicial: lerNumero(l.valorManual),
        });
      }
    }
    setSalvando(true);
    try {
      await onSalvar(itens);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} onKeyDown={impedirEnvioPeloEnter} aria-label={titulo} className="bg-white border-2 border-sinal/40 rounded-xl p-4 space-y-4">
      <p className="text-sm font-bold">{titulo}</p>
      {erro && <p role="alert" className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}

      <EditorCodigos tabela={tabela} erroTabela={erroTabela} linhas={linhas} onLinhas={setLinhas} fator={fator} />

      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <div>
          <label htmlFor="equipe-lancamento" className={ROTULO_CAMPO}>Nº da equipe</label>
          <input id="equipe-lancamento" value={equipe} onChange={(e) => setEquipe(e.target.value)} className={`${CAMPO} font-codigo`} />
        </div>
        <SeletorFator valor={fator} zona={zona} onMudar={setFator} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
        <p className="text-sm">
          <span className="text-aco">{linhas.length === 1 ? '1 código' : `${linhas.length} códigos`} · Total </span>
          <strong className="text-base text-cobre">{formatarUS(total, 4)} US</strong>
          {valorUS !== null && <span className="text-cobre"> = {formatarReais(emReais(total, valorUS))}</span>}
        </p>
        <div className="flex gap-2">
          {onCancelar && (
            <button type="button" onClick={onCancelar} className="px-4 h-9 text-sm font-semibold text-aco border border-linha rounded-lg hover:bg-nevoa">Cancelar</button>
          )}
          <button type="submit" disabled={salvando || linhas.length === 0} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-2">
            {salvando && <Loader2 size={14} className="animate-spin" />} {linhas.length > 1 ? `Salvar ${linhas.length} códigos` : 'Salvar'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Edição completa de um item já lançado ───────────────────────────────────

function FormEdicao({ titulo, inicial, onSalvar, onCancelar }: {
  titulo: string;
  inicial: ItemNsis;
  onSalvar: (campos: CamposItem) => Promise<void>;
  onCancelar: () => void;
}) {
  const [tabela, setTabela] = useState<CodigoContrato[]>([]);
  const [erroTabela, setErroTabela] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<CodigoContrato | null>(null);
  const [semCodigo, setSemCodigo] = useState(!inicial.codigo);
  const [quantidade, setQuantidade] = useState(String(inicial.quantidade).replace('.', ','));
  const [fatorItem, setFatorItem] = useState(inicial.fator);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [equipe, setEquipe] = useState(inicial.equipe ?? '');
  const [valorManual, setValorManual] = useState(inicial.valor_inicial != null ? String(inicial.valor_inicial).replace('.', ',') : '');
  const [nsmp, setNsmp] = useState(inicial.nsmp ?? '');
  const [nspr, setNspr] = useState(inicial.nspr ?? '');
  const [valorFinal, setValorFinal] = useState(inicial.valor_final != null ? String(inicial.valor_final).replace('.', ',') : '');
  const [usAdicional, setUsAdicional] = useState(inicial.us_adicional != null ? String(inicial.us_adicional).replace('.', ',') : '');
  const [fatura, setFatura] = useState(inicial.fatura ?? '');
  const [observacao, setObservacao] = useState(inicial.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarContrato()
      .then((lista) => {
        setTabela(lista);
        if (inicial.codigo) setCodigo(lista.find((c) => c.codigo === inicial.codigo) ?? null);
      })
      .catch((e) => setErroTabela(e instanceof Error ? e.message : 'Falha ao carregar a tabela.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O item guarda o valor do código da época do pedido; só usa o valor atual se o código for trocado.
  const mesmoCodigo = !!inicial.codigo && codigo?.codigo === inicial.codigo;
  const fatorCodigo = codigo ? (mesmoCodigo && inicial.fator_unitario != null ? inicial.fator_unitario : codigo.fator_us) : null;
  const qtd = lerNumero(quantidade);
  const valorCalculado = fatorCodigo !== null && qtd !== null ? calcularValor(fatorCodigo, qtd, fatorItem) : null;

  function escolher(c: CodigoContrato) {
    setCodigo(c);
    // descrição sugerida a partir do código; quem fecha pode completar
    if (!descricao.trim() || tabela.some((t) => descricao === `${t.operacao} ${t.atividade}`)) {
      setDescricao(`${c.operacao} ${c.atividade}`);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const vazio = (s: string) => (s.trim() ? s.trim() : null);
    const etapas = {
      nsmp: vazio(nsmp),
      nspr: vazio(nspr),
      valor_final: lerNumero(valorFinal),
      us_adicional: lerNumero(usAdicional),
      fatura: fatura.trim() ? normalizarAP(fatura) : null,
      observacao: vazio(observacao),
    };
    let campos: CamposItem;
    if (semCodigo) {
      if (!descricao.trim()) return setErro('Descreva o que está sendo cobrado.');
      if (valorManual.trim() && lerNumero(valorManual) === null) return setErro('Valor inicial inválido.');
      campos = {
        descricao: descricao.trim(), equipe: vazio(equipe), codigo: null, quantidade: 1, fator: 1,
        fator_unitario: null, valor_inicial: lerNumero(valorManual), ...etapas,
      };
    } else {
      if (!codigo || fatorCodigo === null) return setErro('Escolha o código da Tabela 03.');
      if (qtd === null || qtd <= 0) return setErro('Informe a quantidade.');
      campos = {
        descricao: descricao.trim() || `${codigo.operacao} ${codigo.atividade}`, equipe: vazio(equipe),
        codigo: codigo.codigo, quantidade: qtd, fator: fatorItem, fator_unitario: fatorCodigo, valor_inicial: valorCalculado, ...etapas,
      };
    }
    setSalvando(true);
    try {
      await onSalvar(campos);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="bg-white border-2 border-sinal/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{titulo}</p>
        <button type="button" onClick={() => { setSemCodigo((v) => !v); setErro(null); }} className="text-[11px] font-semibold text-sinal hover:underline">
          {semCodigo ? 'Usar código da Tabela 03' : 'Lançar sem código'}
        </button>
      </div>
      {erro && <p role="alert" className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}

      {semCodigo ? (
        <>
          <div>
            <label className={ROTULO_CAMPO}>Tipo de serviço cobrado</label>
            <input autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} className={CAMPO}
              placeholder="Ex.: serviço fora da Tabela 03" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={ROTULO_CAMPO}>Nº da equipe</label>
              <input value={equipe} onChange={(e) => setEquipe(e.target.value)} className={`${CAMPO} font-codigo`} /></div>
            <div><label className={ROTULO_CAMPO}>Valor inicial (US)</label>
              <input value={valorManual} onChange={(e) => setValorManual(e.target.value)} inputMode="decimal" placeholder="0,10" className={CAMPO} /></div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className={ROTULO_CAMPO}>Código da Tabela 03</label>
            {erroTabela ? (
              <p className="text-xs text-erro">{erroTabela}</p>
            ) : (
              <SeletorCodigo tabela={tabela} selecionado={codigo} onEscolher={escolher} onLimpar={() => setCodigo(null)} />
            )}
          </div>
          {codigo && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ROTULO_CAMPO}>Quantidade ({(codigo.unidade ?? 'un').toLowerCase()})</label>
                  <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" className={CAMPO} /></div>
                <div><label className={ROTULO_CAMPO}>Nº da equipe</label>
                  <input value={equipe} onChange={(e) => setEquipe(e.target.value)} className={`${CAMPO} font-codigo`} /></div>
              </div>
              <SeletorFator valor={fatorItem} onMudar={setFatorItem} />
              <div>
                <label className={ROTULO_CAMPO}>Descrição no pedido</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={CAMPO} />
              </div>
              <div className="flex items-center justify-between bg-cobre-fundo rounded-lg px-3 py-2 text-sm">
                <span className="text-aco">{formatarUS(fatorCodigo, 4)} × {quantidade || '?'} × {textoFator(fatorItem)}</span>
                <strong className="text-cobre">{formatarUS(valorCalculado, 4)} US</strong>
              </div>
              {mesmoCodigo && inicial.fator_unitario != null && codigo.fator_us !== inicial.fator_unitario && (
                <p className="text-[11px] text-pendente">
                  O valor do código mudou para {formatarUS(codigo.fator_us, 4)} depois do pedido; este item continua com {formatarUS(inicial.fator_unitario, 4)}.
                </p>
              )}
            </>
          )}
        </>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div><label className={ROTULO_CAMPO}>NSMP</label>
          <input value={nsmp} onChange={(e) => setNsmp(e.target.value)} className={`${CAMPO} font-codigo`} /></div>
        <div><label className={ROTULO_CAMPO}>NSPR</label>
          <input value={nspr} onChange={(e) => setNspr(e.target.value)} className={`${CAMPO} font-codigo`} /></div>
        <div><label className={ROTULO_CAMPO}>Valor final pago (US)</label>
          <input value={valorFinal} onChange={(e) => setValorFinal(e.target.value)} inputMode="decimal" className={CAMPO} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={ROTULO_CAMPO}>US adicional</label>
          <input value={usAdicional} onChange={(e) => setUsAdicional(e.target.value)} inputMode="decimal" className={CAMPO} /></div>
        <div className="col-span-2"><label className={ROTULO_CAMPO}>Apropriação / fatura</label>
          <input value={fatura} onChange={(e) => setFatura(e.target.value)} placeholder="AP 83809" className={`${CAMPO} font-codigo`} /></div>
      </div>
      <div><label className={ROTULO_CAMPO}>Observação</label>
        <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={CAMPO} /></div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancelar} className="px-4 h-9 text-sm font-semibold text-aco border border-linha rounded-lg hover:bg-nevoa">Cancelar</button>
        <button type="submit" disabled={salvando} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-2">
          {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
        </button>
      </div>
    </form>
  );
}

// ─── Sem cobrança ────────────────────────────────────────────────────────────

function MarcarSemCobranca({ servico, onAlterado }: { servico: string; onAlterado: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="flex items-center gap-1.5 text-xs font-semibold text-aco hover:text-tinta">
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
      className="bg-white border border-linha rounded-xl p-4 space-y-2"
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
    <div className="bg-etapa-sem-fundo border border-linha rounded-xl p-4 flex items-start gap-3">
      <Ban size={18} className="text-etapa-sem shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-bold">Fechada sem cobrança</p>
        <p className="text-sm text-aco mt-0.5">{nsis.motivo_sem_cobranca}</p>
      </div>
      <button
        type="button"
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
