/**
 * Peças da janela da NSIS que a janela antiga (PainelNsis) e a do fluxo novo (JanelaFluxo) usam juntas:
 * busca na Tabela 03, lista de códigos do lançamento e seletor de fator.
 */
import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import { Check, FilePlus2, Repeat2, Trash2 } from 'lucide-react';
import { formatarUS, lerNumero } from '@/lib/fechamento';
import { retiradaPar, filtrarCodigos, type CodigoContrato } from '@/lib/contrato';
import { FATORES, calcularValor } from '@/lib/fechamentoCobranca';

export const ROTULO_SECAO = 'text-[11px] font-bold uppercase tracking-widest text-aco-claro';
export const CAMPO = 'w-full h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
export const ROTULO_CAMPO = 'block text-[11px] font-semibold text-aco mb-1';

/** Enter num campo do lançamento não grava: a lista pode estar pela metade. Só o botão Salvar grava. */
export function impedirEnvioPeloEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
}

// ─── Fator ───────────────────────────────────────────────────────────────────

interface OpcaoFator { valor: number; rotulo: string; legenda: string }

/** Sem `fatores`, a janela antiga: 1,0, 1,2 ou 1,4. O fluxo novo passa só os dois fatores dele. */
export function SeletorFator({ valor, zona, fatores, onMudar }: {
  valor: number; zona?: string | null; fatores?: OpcaoFator[]; onMudar: (f: number) => void;
}) {
  const grupo = useId();
  const opcoes: OpcaoFator[] = fatores ?? FATORES;
  return (
    <fieldset>
      <legend className={ROTULO_CAMPO}>Fator pago</legend>
      <div className={`grid gap-2 ${opcoes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {opcoes.map((f) => (
          <label key={f.valor} className="cursor-pointer">
            <input type="radio" name={grupo} className="peer sr-only" checked={valor === f.valor} onChange={() => onMudar(f.valor)} />
            <span className="flex h-full flex-col items-center justify-center rounded-lg border border-linha bg-white px-2 py-1.5 text-center transition-colors hover:border-sinal/50 peer-checked:border-sinal peer-checked:bg-sinal-fundo peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sinal">
              <span className={`font-codigo text-sm font-extrabold ${valor === f.valor ? 'text-sinal' : 'text-tinta'}`}>{f.rotulo}</span>
              <span className="text-[11px] leading-tight text-aco">{f.legenda}</span>
            </span>
          </label>
        ))}
      </div>
      {!fatores && zona === 'R' && <p className="mt-1.5 text-[11px] text-aco">Zona rural no GDIS. Se o despacho foi COD, use × 1,4.</p>}
      {!fatores && zona === 'U' && <p className="mt-1.5 text-[11px] text-aco">Zona urbana no GDIS. Se o despacho foi COD, use × 1,2.</p>}
    </fieldset>
  );
}

// ─── Lista de códigos de um lançamento ───────────────────────────────────────

export interface LinhaLancamento {
  chave: string;
  codigo: CodigoContrato | null;
  descricao: string;
  quantidade: string;
  /** só nas linhas sem código */
  valorManual: string;
  /** id do item já gravado (correção da etapa 1) */
  itemId?: string;
}

export function valorDaLinha(l: LinhaLancamento, fator: number): number | null {
  if (!l.codigo) return lerNumero(l.valorManual);
  const qtd = lerNumero(l.quantidade);
  return qtd !== null ? calcularValor(l.codigo.fator_us, qtd, fator) : null;
}

/** Busca na Tabela 03 e a lista de códigos escolhidos, com quantidade e valor de cada um. */
export function EditorCodigos({ tabela, erroTabela, linhas, onLinhas, fator }: {
  tabela: CodigoContrato[];
  erroTabela: string | null;
  linhas: LinhaLancamento[];
  onLinhas: Dispatch<SetStateAction<LinhaLancamento[]>>;
  fator: number;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const proximaChave = useRef(0);
  const codigosNaLista = new Set(linhas.flatMap((l) => (l.codigo ? [l.codigo.codigo] : [])));

  function adicionarCodigo(c: CodigoContrato, quantidade = '1') {
    if (codigosNaLista.has(c.codigo)) {
      setAviso(`${c.codigo} já está na lista. Ajuste a quantidade.`);
      return;
    }
    setAviso(null);
    onLinhas((atual) => [...atual, { chave: c.codigo, codigo: c, descricao: `${c.operacao} ${c.atividade}`, quantidade, valorManual: '' }]);
  }

  function adicionarSemCodigo() {
    setAviso(null);
    proximaChave.current += 1;
    onLinhas((atual) => [...atual, { chave: `manual-${proximaChave.current}`, codigo: null, descricao: '', quantidade: '1', valorManual: '' }]);
  }

  function mudar(chave: string, mudanca: Partial<LinhaLancamento>) {
    onLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)));
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label htmlFor="busca-codigo" className="text-[11px] font-semibold text-aco">Código da Tabela 03</label>
          <button type="button" onClick={adicionarSemCodigo} className="flex items-center gap-1 text-[11px] font-semibold text-sinal hover:underline">
            <FilePlus2 size={12} /> Lançar item sem código
          </button>
        </div>
        {erroTabela ? (
          <p className="text-xs text-erro">{erroTabela}</p>
        ) : (
          <SeletorCodigo tabela={tabela} selecionado={null} naLista={codigosNaLista} entradaId="busca-codigo" onEscolher={adicionarCodigo} onLimpar={() => {}} />
        )}
        {aviso && <p className="mt-1.5 text-[11px] font-semibold text-pendente">{aviso}</p>}
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linha px-3 py-5 text-center text-xs text-aco">
          Busque um código acima. Pode escolher quantos forem necessários: todos saem na mesma NSMP.
        </p>
      ) : (
        <ul className="divide-y divide-linha rounded-lg border border-linha">
          {linhas.map((l) => {
            const par = l.codigo ? retiradaPar(l.codigo, tabela) : null;
            const valor = valorDaLinha(l, fator);
            return (
              <li key={l.chave} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-[1_1_16rem]">
                  <div className="flex items-center gap-2">
                    {l.codigo
                      ? <span className="font-codigo text-sm font-bold text-sinal">{l.codigo.codigo}</span>
                      : <span className="rounded bg-nevoa px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-aco">Sem código</span>}
                    {l.codigo && <span className="text-[11px] text-aco">{formatarUS(l.codigo.fator_us, 4)} US por {(l.codigo.unidade ?? 'unidade').toLowerCase()}</span>}
                  </div>
                  <input value={l.descricao} onChange={(e) => mudar(l.chave, { descricao: e.target.value })} aria-label="Descrição no pedido"
                    placeholder={l.codigo ? 'Descrição no pedido' : 'Tipo de serviço cobrado'}
                    className="mt-1 w-full rounded border border-transparent bg-transparent px-1 py-0.5 -ml-1 text-sm hover:border-linha focus:border-sinal focus:bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30" />
                  {par && !codigosNaLista.has(par.codigo) && (
                    <button type="button" onClick={() => adicionarCodigo(par, l.quantidade)} className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sinal hover:underline">
                      <Repeat2 size={12} /> Foi substituição: incluir a retirada <span className="font-codigo">{par.codigo}</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-1 items-start justify-between gap-3 sm:flex-none">
                  {l.codigo ? (
                    <label className="block w-20">
                      <span className="block text-[11px] text-aco mb-0.5">Qtd ({(l.codigo.unidade ?? 'un').toLowerCase()})</span>
                      <input value={l.quantidade} onChange={(e) => mudar(l.chave, { quantidade: e.target.value })} inputMode="decimal"
                        className="w-full h-8 px-2 text-sm text-right border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
                    </label>
                  ) : (
                    <label className="block w-24">
                      <span className="block text-[11px] text-aco mb-0.5">Valor (US)</span>
                      <input value={l.valorManual} onChange={(e) => mudar(l.chave, { valorManual: e.target.value })} inputMode="decimal" placeholder="0,10"
                        className="w-full h-8 px-2 text-sm text-right border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
                    </label>
                  )}
                  <div className="w-24 text-right">
                    <span className="block text-[11px] text-aco mb-0.5">Pedido</span>
                    <strong className="block h-8 text-sm leading-8 text-cobre">{formatarUS(valor, 4)}</strong>
                  </div>
                  <button type="button" onClick={() => { onLinhas((atual) => atual.filter((x) => x.chave !== l.chave)); setAviso(null); }}
                    className="mt-[18px] grid size-8 place-items-center rounded-lg text-aco-claro hover:bg-erro-fundo hover:text-erro"
                    title="Tirar da lista" aria-label={`Tirar ${l.codigo?.codigo ?? 'item sem código'} da lista`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Busca na Tabela 03 por código ou palavras da atividade; setas + Enter escolhem.
 * Sem `selecionado`, a busca limpa depois de cada escolha para já pedir o próximo código.
 */
export function SeletorCodigo({ tabela, selecionado, naLista, entradaId, onEscolher, onLimpar }: {
  tabela: CodigoContrato[];
  selecionado: CodigoContrato | null;
  naLista?: Set<string>;
  entradaId?: string;
  onEscolher: (c: CodigoContrato) => void;
  onLimpar: () => void;
}) {
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const fechamento = useRef<number | undefined>(undefined);

  useEffect(() => { if (!selecionado) entrada.current?.focus(); }, [selecionado]);
  useEffect(() => () => window.clearTimeout(fechamento.current), []);

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

  function escolher(c: CodigoContrato) {
    onEscolher(c);
    setTermo('');
    setAtivo(0);
    setAberto(false);
  }

  function teclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setAtivo((a) => Math.min(a + 1, opcoes.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      // Enter com a busca vazia não escolhe o primeiro código da tabela por acidente
      e.preventDefault();
      if (opcoes[ativo] && (termo.trim() || (aberto && ativo > 0))) escolher(opcoes[ativo]);
    } else if (e.key === 'Escape' && aberto) { e.stopPropagation(); setAberto(false); }
  }

  return (
    <div className="relative">
      <input ref={entrada} id={entradaId} value={termo} onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
        onClick={() => setAberto(true)}
        onFocus={() => { window.clearTimeout(fechamento.current); if (termo.trim()) setAberto(true); }}
        onBlur={() => { fechamento.current = window.setTimeout(() => setAberto(false), 150); }}
        onKeyDown={teclar}
        placeholder="Digite o código ou o serviço: poda, espaçador, cruzeta, 704091…"
        className={CAMPO} />
      {aberto && (
        <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-linha rounded-xl shadow-lg">
          {opcoes.length === 0 && <li className="px-3 py-3 text-sm text-aco">{tabela.length === 0 ? 'Carregando a tabela…' : 'Nenhum código encontrado.'}</li>}
          {opcoes.map((c, i) => (
            <li key={c.codigo}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(c)}
                onMouseEnter={() => setAtivo(i)}
                className={`w-full text-left px-3 py-2 flex items-start gap-3 ${i === ativo ? 'bg-sinal-fundo' : ''}`}>
                <span className="font-codigo text-xs font-bold text-sinal pt-0.5">{c.codigo}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm"><span className="font-semibold">{c.operacao}</span> {c.atividade}</span>
                  <span className="block text-[11px] text-aco truncate">{c.descricao}</span>
                </span>
                {naLista?.has(c.codigo) ? (
                  <span className="flex items-center gap-1 whitespace-nowrap pt-0.5 text-[11px] font-bold text-concluido"><Check size={12} /> Na lista</span>
                ) : (
                  <span className="text-xs font-bold text-cobre whitespace-nowrap pt-0.5">
                    {formatarUS(c.fator_us, 4)}
                    {c.acertado && <span className="block text-[9px] text-pendente text-right">acertado</span>}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
