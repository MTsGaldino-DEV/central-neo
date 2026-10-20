import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search, Loader2, Pencil, History, RotateCcw, Plus, X, AlertTriangle, Info, Check, EyeOff, Eye, Trash2, Banknote } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import { formatarUS, formatarReais, formatarData, lerNumero } from '@/lib/fechamento';
import { listarValoresUS, salvarValorUS, excluirValorUS, type ValorUS } from '@/lib/painel';
import {
  listarContrato, filtrarCodigos, acertarFator, definirAtivo, criarCodigo, getHistorico,
  type CodigoContrato, type AcertoContrato,
} from '@/lib/contrato';

/**
 * Tabela 03 do contrato CEMIG (manutenção em linha morta), que dá o valor de
 * cada código pedido no fechamento. O valor publicado fica guardado; quando a
 * CEMIG acerta um código, o ADMIN registra o novo valor com o motivo.
 */
export default function TabelaValores() {
  const { acesso } = useSessao();
  const admin = acesso?.papel === 'ADMIN';
  const [lista, setLista] = useState<CodigoContrato[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [operacao, setOperacao] = useState('');
  const [somenteAcertados, setSomenteAcertados] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [historico, setHistorico] = useState<CodigoContrato | null>(null);
  const [novo, setNovo] = useState(false);

  async function carregar() {
    try {
      setLista(await listarContrato(true));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }
  useEffect(() => { carregar(); }, []);

  const operacoes = useMemo(() => [...new Set((lista ?? []).map((c) => c.operacao))].sort(), [lista]);
  const filtrados = useMemo(() => {
    let l = filtrarCodigos(lista ?? [], busca);
    if (operacao) l = l.filter((c) => c.operacao === operacao);
    if (somenteAcertados) l = l.filter((c) => c.acertado || c.fator_original === null);
    if (!mostrarInativos) l = l.filter((c) => c.ativo);
    return l;
  }, [lista, busca, operacao, somenteAcertados, mostrarInativos]);
  const qtdAcertados = (lista ?? []).filter((c) => c.acertado).length;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-xl font-extrabold tracking-tight">Tabela de valores</h2>
          <p className="text-sm text-aco">
            Contrato CEMIG · Anexo VI · <strong>Tabela 03</strong>: manutenção em rede desenergizada (linha morta).
            {lista && <> {lista.length} códigos{qtdAcertados > 0 && <>, <span className="text-pendente font-semibold">{qtdAcertados} com valor acertado</span></>}.</>}
          </p>
        </div>
        {admin && (
          <button onClick={() => setNovo(true)} className="h-9 px-3 rounded-lg border border-linha bg-white text-sm font-semibold flex items-center gap-1.5 hover:border-sinal hover:text-sinal">
            <Plus size={15} /> Novo código
          </button>
        )}
      </div>

      <SecaoValorUS admin={admin} />

      <div className="bg-sinal-fundo rounded-2xl p-4 text-xs text-sinal-forte grid sm:grid-cols-2 gap-x-6 gap-y-1">
        <p className="sm:col-span-2 font-bold flex items-center gap-1.5"><Info size={14} /> Regras da Tabela 03, já aplicadas no cálculo do pedido</p>
        <p>• O valor do serviço é a soma dos fatores das atividades executadas.</p>
        <p>• Substituição = 1 retirada + 1 instalação.</p>
        <p>• Área rural: acréscimo de 20%.</p>
        <p>• Abertura de dispositivo no ASTA não é paga à parte.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aco-claro" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou serviço: poda, cruzeta, 704091…"
            className="w-full h-9 pl-9 pr-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
        </div>
        <select value={operacao} onChange={(e) => setOperacao(e.target.value)} className="h-9 px-2 text-sm border border-linha rounded-lg bg-white">
          <option value="">Todas as operações</option>
          {operacoes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <label className="flex items-center gap-2 h-9 px-3 text-sm border border-linha rounded-lg bg-white cursor-pointer select-none">
          <input type="checkbox" checked={somenteAcertados} onChange={(e) => setSomenteAcertados(e.target.checked)} className="accent-sinal" />
          Só acertados
        </label>
        <label className="flex items-center gap-2 h-9 px-3 text-sm border border-linha rounded-lg bg-white cursor-pointer select-none">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="accent-sinal" />
          Mostrar desativados
        </label>
      </div>

      {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{erro}</div>}

      <div className="bg-white border border-linha rounded-2xl overflow-hidden">
        {!lista ? (
          <div className="py-12 flex items-center justify-center gap-2 text-aco"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-aco border-b border-linha bg-nevoa/60">
                  <th className="px-4 py-3 font-bold">Código</th>
                  <th className="px-3 py-3 font-bold">Operação</th>
                  <th className="px-3 py-3 font-bold w-[42%]">Atividade</th>
                  <th className="px-3 py-3 font-bold">Unidade</th>
                  <th className="px-3 py-3 font-bold text-right">Contrato</th>
                  <th className="px-3 py-3 font-bold text-right">Em vigor</th>
                  <th className="px-3 py-3 font-bold text-right">Usos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-aco">Nenhum código encontrado.</td></tr>
                )}
                {filtrados.map((c) => (
                  editando === c.codigo ? (
                    <LinhaAcerto key={c.codigo} codigo={c} onCancelar={() => setEditando(null)}
                      onSalvo={async () => { setEditando(null); await carregar(); }} />
                  ) : (
                    <tr key={c.codigo} className={`border-b border-linha last:border-0 align-top ${c.ativo ? '' : 'opacity-50'}`}>
                      <td className="px-4 py-3 font-codigo font-semibold">{c.codigo}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{c.operacao}</td>
                      <td className="px-3 py-3">
                        <span className="font-semibold">{c.atividade}</span>
                        {c.descricao && <span className="block text-[11px] text-aco mt-0.5 line-clamp-2">{c.descricao}</span>}
                      </td>
                      <td className="px-3 py-3 text-aco whitespace-nowrap">{c.unidade ?? '—'}</td>
                      <td className="px-3 py-3 text-right text-aco whitespace-nowrap">{c.fator_original === null ? <span className="text-[11px]">fora da tabela</span> : formatarUS(c.fator_original, 4)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className={`font-bold ${c.acertado ? 'text-pendente' : 'text-cobre'}`}>{formatarUS(c.fator_us, 4)}</span>
                        {c.acertado && <span className="block text-[10px] font-bold text-pendente">acertado {c.ultimo_acerto ? formatarData(c.ultimo_acerto) : ''}</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-aco">{c.qtd_usos || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {admin && (
                            <button onClick={() => setEditando(c.codigo)} title="Acertar valor" className="p-1.5 rounded-lg text-aco-claro hover:text-sinal hover:bg-sinal-fundo"><Pencil size={14} /></button>
                          )}
                          {(c.acertado || c.ultimo_acerto) && (
                            <button onClick={() => setHistorico(c)} title="Histórico de acertos" className="p-1.5 rounded-lg text-aco-claro hover:text-sinal hover:bg-sinal-fundo"><History size={14} /></button>
                          )}
                          {admin && (
                            <button title={c.ativo ? 'Desativar (não aparece mais para escolher)' : 'Reativar'}
                              onClick={async () => { await definirAtivo(c.codigo, !c.ativo); await carregar(); }}
                              className="p-1.5 rounded-lg text-aco-claro hover:text-tinta hover:bg-nevoa">
                              {c.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!admin && <p className="text-xs text-aco-claro">Só administradores da NEO acertam valores. Os pedidos já feitos guardam o valor da época.</p>}

      {historico && <ModalHistorico codigo={historico} onFechar={() => setHistorico(null)} />}
      {novo && <ModalNovoCodigo onFechar={() => setNovo(false)} onCriado={async () => { setNovo(false); await carregar(); }} />}
    </div>
  );
}

function LinhaAcerto({ codigo, onCancelar, onSalvo }: { codigo: CodigoContrato; onCancelar: () => void; onSalvo: () => Promise<void> }) {
  const [valor, setValor] = useState(formatarUS(codigo.fator_us, 4));
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(novoValor: number | null, motivoFinal: string) {
    setErro(null);
    if (novoValor === null || novoValor < 0) return setErro('Valor inválido.');
    if (!motivoFinal.trim()) return setErro('Informe o motivo do acerto.');
    setSalvando(true);
    try {
      await acertarFator(codigo.codigo, novoValor, motivoFinal.trim());
      await onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    salvar(lerNumero(valor), motivo);
  }

  return (
    <tr className="border-b border-linha bg-sinal-fundo/50">
      <td colSpan={8} className="px-4 py-3">
        <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <p className="text-sm"><span className="font-codigo font-bold">{codigo.codigo}</span> · {codigo.operacao} {codigo.atividade}</p>
            <p className="text-[11px] text-aco">Contrato: {codigo.fator_original === null ? '—' : formatarUS(codigo.fator_original, 4)} · Em vigor: {formatarUS(codigo.fator_us, 4)}</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-aco mb-1">Novo valor (US)</label>
            <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal"
              className="w-28 h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[11px] font-semibold text-aco mb-1">Motivo</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: acerto CEMIG ofício nº…"
              className="w-full h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
          </div>
          <div className="flex gap-2">
            {codigo.acertado && codigo.fator_original !== null && (
              <button type="button" disabled={salvando} onClick={() => salvar(codigo.fator_original, motivo || 'Restaurado o valor do contrato')}
                className="h-9 px-3 text-xs font-semibold text-aco border border-linha rounded-lg bg-white flex items-center gap-1.5 hover:text-tinta">
                <RotateCcw size={13} /> Voltar ao contrato
              </button>
            )}
            <button type="button" onClick={onCancelar} className="h-9 px-3 text-sm font-semibold text-aco border border-linha rounded-lg bg-white">Cancelar</button>
            <button type="submit" disabled={salvando} className="h-9 px-4 text-sm font-bold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-1.5">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar acerto
            </button>
          </div>
          {erro && <p className="w-full text-xs text-erro">{erro}</p>}
          <p className="w-full text-[11px] text-aco">O novo valor vale para os próximos pedidos. Itens já lançados mantêm o valor da época.</p>
        </form>
      </td>
    </tr>
  );
}

function ModalHistorico({ codigo, onFechar }: { codigo: CodigoContrato; onFechar: () => void }) {
  const [acertos, setAcertos] = useState<AcertoContrato[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    getHistorico(codigo.codigo).then(setAcertos).catch((e) => setErro(e instanceof Error ? e.message : 'Falha.'));
  }, [codigo.codigo]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-linha">
          <div>
            <h3 className="font-bold">Histórico de acertos</h3>
            <p className="text-xs text-aco"><span className="font-codigo">{codigo.codigo}</span> · {codigo.operacao} {codigo.atividade}</p>
          </div>
          <button onClick={onFechar} className="text-aco-claro hover:text-tinta"><X size={16} /></button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {erro && <p className="text-sm text-erro">{erro}</p>}
          {!acertos && !erro && <p className="flex items-center gap-2 text-sm text-aco"><Loader2 size={14} className="animate-spin" /> Carregando…</p>}
          {acertos?.length === 0 && <p className="text-sm text-aco">Nenhum acerto registrado.</p>}
          <ol className="space-y-3">
            {acertos?.map((a) => (
              <li key={a.id} className="border-l-2 border-sinal pl-3">
                <p className="text-sm font-semibold">
                  {formatarUS(a.fator_anterior, 4)} → <span className="text-pendente">{formatarUS(a.fator_novo, 4)}</span> US
                </p>
                <p className="text-xs text-aco">{formatarData(a.alterado_em, true)}{a.alterado_por_nome && <> · {a.alterado_por_nome}</>}</p>
                {a.motivo && <p className="text-xs mt-0.5">{a.motivo}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function ModalNovoCodigo({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => Promise<void> }) {
  const [codigo, setCodigo] = useState('');
  const [operacao, setOperacao] = useState('Instalar');
  const [atividade, setAtividade] = useState('');
  const [unidade, setUnidade] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const fator = lerNumero(valor);
    if (!codigo.trim() || !atividade.trim()) return setErro('Informe o código e a atividade.');
    if (fator === null || fator < 0) return setErro('Informe um valor válido.');
    setSalvando(true);
    try {
      await criarCodigo({
        codigo: codigo.trim(), operacao: operacao.trim(), atividade: atividade.trim().toUpperCase(),
        unidade: unidade.trim() || null, descricao: descricao.trim() || null, fator_us: fator,
      });
      await onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao criar.');
      setSalvando(false);
    }
  }

  const campo = 'w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
  const rotulo = 'block text-[11px] font-semibold text-aco mb-1';
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Novo código</h3>
          <button type="button" onClick={onFechar} className="text-aco-claro hover:text-tinta"><X size={16} /></button>
        </div>
        <p className="text-xs text-aco">Para um código que não está na Tabela 03 publicada (aditivo ou código novo da CEMIG).</p>
        {erro && <p className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}
        <div className="grid grid-cols-3 gap-3">
          <div><label className={rotulo}>Código SAP</label><input autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} className={`${campo} font-codigo`} /></div>
          <div><label className={rotulo}>Operação</label><input value={operacao} onChange={(e) => setOperacao(e.target.value)} className={campo} /></div>
          <div><label className={rotulo}>Valor (US)</label><input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={campo} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><label className={rotulo}>Atividade</label><input value={atividade} onChange={(e) => setAtividade(e.target.value)} className={campo} /></div>
          <div><label className={rotulo}>Unidade</label><input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Poste, Vão…" className={campo} /></div>
        </div>
        <div><label className={rotulo}>Descrição</label><input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={campo} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 h-9 text-sm font-semibold text-aco border border-linha rounded-lg">Cancelar</button>
          <button type="submit" disabled={salvando} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg disabled:opacity-50">Criar</button>
        </div>
      </form>
    </div>
  );
}

// ─── Valor da US em reais (apostilamento) ───────────────────────────────────

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function diaAnterior(d: string) {
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia - 1)).toISOString().slice(0, 10);
}

const dataBR = (d: string) => d.split('-').reverse().join('/');

/**
 * O contrato paga em US; o valor da US em reais muda por apostilamento.
 * Cada NSIS usa o valor vigente na sua data de execução.
 */
function SecaoValorUS({ admin }: { admin: boolean }) {
  const [valores, setValores] = useState<ValorUS[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null); // 'novo' ou a data de início

  async function carregar() {
    try {
      setValores(await listarValoresUS());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }
  useEffect(() => { carregar(); }, []);

  const hoje = hojeISO();
  // a lista vem da mais nova para a mais antiga: o fim de cada uma é o dia anterior ao início da seguinte
  const vigente = valores?.find((v) => v.vigencia_inicio <= hoje);

  async function excluir(v: ValorUS) {
    if (!confirm(`Excluir o valor da US de ${formatarReais(v.valor_reais)} (a partir de ${dataBR(v.vigencia_inicio)})?`)) return;
    try {
      await excluirValorUS(v.vigencia_inicio);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao excluir.');
    }
  }

  const aoSalvar = async () => { setEditando(null); await carregar(); };

  return (
    <section className="bg-white border border-linha rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-linha">
        <span className="size-8 rounded-xl bg-cobre-fundo text-cobre flex items-center justify-center"><Banknote size={16} /></span>
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-extrabold">Valor da US em reais (apostilamento)</h3>
          <p className="text-[11px] text-aco">R$ do item = US × valor da US vigente na <strong>data de execução</strong> da NSIS.</p>
        </div>
        {vigente && (
          <p className="text-right">
            <span className="block text-[10px] uppercase tracking-wider font-bold text-aco">Em vigor hoje</span>
            <span className="text-lg font-extrabold text-cobre">{formatarReais(vigente.valor_reais)}</span>
          </p>
        )}
        {admin && editando !== 'novo' && (
          <button onClick={() => setEditando('novo')} className="h-9 px-3 rounded-lg border border-linha bg-white text-sm font-semibold flex items-center gap-1.5 hover:border-sinal hover:text-sinal">
            <Plus size={15} /> Novo valor
          </button>
        )}
      </div>
      {erro && <p className="px-4 py-2 text-xs text-erro bg-erro-fundo">{erro}</p>}
      {!valores ? (
        <div className="py-6 flex items-center justify-center gap-2 text-aco text-sm"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {editando === 'novo' && <FormValorUS onCancelar={() => setEditando(null)} onSalvo={aoSalvar} />}
              {valores.length === 0 && editando !== 'novo' && (
                <tr><td className="px-4 py-4 text-sm text-pendente">Nenhum valor cadastrado: os valores em R$ não aparecem.</td></tr>
              )}
              {valores.map((v, i) => {
                const fim = i > 0 ? diaAnterior(valores[i - 1].vigencia_inicio) : null;
                if (editando === v.vigencia_inicio) {
                  return <FormValorUS key={v.vigencia_inicio} inicial={v} onCancelar={() => setEditando(null)} onSalvo={aoSalvar} />;
                }
                return (
                  <tr key={v.vigencia_inicio} className={`border-b border-linha last:border-0 ${v === vigente ? 'bg-cobre-fundo/40' : ''}`}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {fim ? <>{dataBR(v.vigencia_inicio)} a {dataBR(fim)}</> : <>A partir de {dataBR(v.vigencia_inicio)}</>}
                      {v === vigente && <span className="ml-2 text-[10px] font-bold uppercase text-cobre">em vigor</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">{formatarReais(v.valor_reais)}</td>
                    <td className="px-3 py-2.5 text-xs text-aco w-full">{v.descricao}</td>
                    <td className="px-4 py-2.5">
                      {admin && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setEditando(v.vigencia_inicio)} title="Alterar" className="p-1.5 rounded-lg text-aco-claro hover:text-sinal hover:bg-sinal-fundo"><Pencil size={14} /></button>
                          <button onClick={() => excluir(v)} title="Excluir" className="p-1.5 rounded-lg text-aco-claro hover:text-erro hover:bg-erro-fundo"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {valores && valores.length > 0 && (
        <p className="px-4 py-2 text-[11px] text-aco-claro border-t border-linha">
          NSIS executadas antes de {dataBR(valores[valores.length - 1].vigencia_inicio)} ficam sem valor em R$ até o valor da época ser cadastrado.
          {!admin && ' Só administradores da NEO alteram estes valores.'}
        </p>
      )}
    </section>
  );
}

function FormValorUS({ inicial, onCancelar, onSalvo }: { inicial?: ValorUS; onCancelar: () => void; onSalvo: () => Promise<void> }) {
  const [inicio, setInicio] = useState(inicial?.vigencia_inicio ?? '');
  const [valor, setValor] = useState(inicial ? inicial.valor_reais.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = lerNumero(valor);
    if (!inicio) return setErro('Informe a data de início da vigência.');
    if (v === null || v <= 0) return setErro('Informe o valor da US em reais.');
    setSalvando(true);
    try {
      await salvarValorUS({ vigencia_inicio: inicio, valor_reais: v, descricao: descricao.trim() || null }, inicial?.vigencia_inicio);
      await onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  const campo = 'h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
  return (
    <tr className="border-b border-linha bg-sinal-fundo/50">
      <td colSpan={4} className="px-4 py-3">
        <form onSubmit={salvar} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-aco mb-1">Vale a partir de</label>
            <input type="date" autoFocus value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-aco mb-1">Valor da US (R$)</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="2.964,33" className={`${campo} w-32`} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[11px] font-semibold text-aco mb-1">Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: apostilamento nº…" className={`${campo} w-full`} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancelar} className="h-9 px-3 text-sm font-semibold text-aco border border-linha rounded-lg bg-white">Cancelar</button>
            <button type="submit" disabled={salvando} className="h-9 px-4 text-sm font-bold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-1.5">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar
            </button>
          </div>
          {erro && <p className="w-full text-xs text-erro">{erro}</p>}
          <p className="w-full text-[11px] text-aco">O valor vale até o dia anterior ao próximo valor cadastrado. Os valores em R$ são recalculados na hora.</p>
        </form>
      </td>
    </tr>
  );
}
