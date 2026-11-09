import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

/**
 * Botão ▾ do cabeçalho com o menu estilo Excel (mesmo da lista de Instalações do Visão de Dono):
 * ordenar, pesquisar e marcar valores. O menu vai num portal com position: fixed porque a tabela
 * fica num contêiner com overflow e cortaria o menu.
 */

export interface FiltroColunaProps {
  coluna: { id: string; rotulo: string; numero?: boolean };
  /** null = carregando */
  valores: string[] | null;
  selecionados?: string[];
  ordem: 'asc' | 'desc' | null;
  ativo: boolean;
  onOrdenar: (dir: 'asc' | 'desc') => void;
  onFiltrar: (valores: string[]) => void;
  /** chamado ao abrir o menu (carregar os valores sob demanda) */
  onAbrir?: () => void;
  /** só ordena: não mostra pesquisa nem lista de valores (colunas de valor) */
  semLista?: boolean;
  /** texto exibido de um valor (o valor continua o mesmo no filtro) */
  formatar?: (valor: string) => string;
}

const LARGURA = 264;
const MARGEM = 8;
const MAX_EXIBIDOS = 300;

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CSS = `
.fcn-item:hover { background: #f1f5f9; }
.fcn-limpar:hover { background: #f1f5f9; }
.fcn-ok:hover:not(:disabled) { background: #1e40af; }
`;

const estiloItem: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', border: 'none',
  background: 'transparent', borderRadius: '8px', fontSize: '12px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
};

interface MenuProps extends Omit<FiltroColunaProps, 'ativo' | 'onAbrir'> {
  botao: HTMLElement | null;
  onFechar: () => void;
}

function Menu({ botao, coluna, valores, selecionados, ordem, onOrdenar, onFiltrar, onFechar, semLista, formatar }: MenuProps) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; largura: number } | null>(null);
  const [busca, setBusca] = useState('');
  // null = todos marcados (sem filtro)
  const [marcados, setMarcados] = useState<Set<string> | null>(selecionados?.length ? new Set(selecionados) : null);
  // Seleção durante a pesquisa: null = todos os resultados marcados, como no Excel
  const [marcadosBusca, setMarcadosBusca] = useState<Set<string> | null>(null);

  const texto = useCallback((v: string) => (formatar ? formatar(v) : v), [formatar]);

  // Posiciona o menu perto do botão, sem passar das bordas da janela
  useLayoutEffect(() => {
    if (!botao || !caixa.current) return;
    const r = botao.getBoundingClientRect();
    const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM);
    const altura = Math.min(caixa.current.offsetHeight, window.innerHeight - 2 * MARGEM);
    const left = Math.max(MARGEM, Math.min(r.left, window.innerWidth - MARGEM - largura));
    let top = r.bottom + 4;
    if (top + altura > window.innerHeight - MARGEM) {
      const acima = r.top - 4 - altura;
      top = acima >= MARGEM ? acima : Math.max(MARGEM, window.innerHeight - MARGEM - altura);
    }
    setPos({ left, top, largura });
    // reposiciona quando a lista chega (a altura muda)
  }, [botao, valores]);

  // Fecha ao clicar fora, com Esc, ao rolar a página e ao redimensionar
  useEffect(() => {
    const digitando = () => caixa.current?.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT';
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || botao?.contains(alvo)) return;
      onFechar();
    };
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onFechar();
      botao?.focus();
    };
    const lugarInicial = botao?.getBoundingClientRect();
    const aoRolar = (e: Event) => {
      if (caixa.current?.contains(e.target as Node)) return;
      // o botão não saiu do lugar: rolagem de outra coisa
      const r = botao?.getBoundingClientRect();
      if (r && lugarInicial && r.left === lugarInicial.left && r.top === lugarInicial.top) return;
      if (digitando()) return;
      onFechar();
    };
    const larguraInicial = window.innerWidth;
    const aoRedimensionar = () => {
      // teclado virtual muda só a altura da janela
      if (digitando() && window.innerWidth === larguraInicial) return;
      onFechar();
    };
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTecla);
    window.addEventListener('scroll', aoRolar, true);
    window.addEventListener('resize', aoRedimensionar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTecla);
      window.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('resize', aoRedimensionar);
    };
  }, [botao, onFechar]);

  const lista = valores ?? [];
  const termo = semAcento(busca.trim());
  const visiveis = termo ? lista.filter((v) => semAcento(texto(v)).includes(termo)) : lista;
  const exibidos = visiveis.slice(0, MAX_EXIBIDOS);
  const selecaoAtual = termo ? marcadosBusca : marcados;
  const marcado = (v: string) => (selecaoAtual ? selecaoAtual.has(v) : true);
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every(marcado);

  const pesquisar = (t: string) => { setBusca(t); setMarcadosBusca(null); };

  const alternar = (v: string) => {
    const definir = termo ? setMarcadosBusca : setMarcados;
    definir((m) => {
      const n = new Set(m ?? visiveis);
      if (n.has(v)) n.delete(v); else n.add(v);
      return n;
    });
  };

  const alternarTudo = () => (termo ? setMarcadosBusca : setMarcados)(todosVisiveisMarcados ? new Set() : null);

  // Com pesquisa, o filtro é o que está marcado entre os resultados
  const escolhidos = termo || marcados ? visiveis.filter(marcado) : lista;
  const semNada = lista.length > 0 && escolhidos.length === 0;

  const aplicar = () => {
    if (semNada) return;
    // tudo marcado = sem filtro
    onFiltrar(escolhidos.length === lista.length ? [] : escolhidos);
    onFechar();
  };

  const textoOrdem = coluna.numero ? ['Do menor para o maior', 'Do maior para o menor'] : ['Ordenar de A a Z', 'Ordenar de Z a A'];

  return createPortal(
    <div ref={caixa} role="dialog" aria-label={`Filtro de ${coluna.rotulo}`} onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', zIndex: 100, left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.largura ?? LARGURA,
        visibility: pos ? 'visible' : 'hidden', maxHeight: `calc(100vh - ${2 * MARGEM}px)`, overflowY: 'auto', boxSizing: 'border-box',
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 20px 40px -8px rgba(15,23,42,0.35)',
        padding: '8px', fontSize: '12px', fontWeight: 500, color: '#0f172a', textAlign: 'left', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal',
      }}>
      <style>{CSS}</style>
      {(['asc', 'desc'] as const).map((dir, i) => (
        <button key={dir} type="button" className="fcn-item" onClick={() => { onOrdenar(dir); onFechar(); }}
          style={{ ...estiloItem, color: ordem === dir ? '#1d4ed8' : '#0f172a', fontWeight: ordem === dir ? 700 : 600 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {dir === 'asc' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
          </svg>
          {textoOrdem[i]}
        </button>
      ))}
      {!semLista && (
        <>
          <div style={{ margin: '6px 0', borderTop: '1px solid #e2e8f0' }} />
          <input type="text" value={busca} onChange={(e) => pesquisar(e.target.value)} placeholder="Pesquisar" aria-label={`Pesquisar em ${coluna.rotulo}`}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } }}
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 500, outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#fff' }} />
          <div style={{ marginTop: '6px', maxHeight: '224px', overflow: 'auto' }}>
            {valores === null ? (
              <p style={{ margin: 0, padding: '12px 8px', color: '#64748b' }}>Carregando…</p>
            ) : (
              <>
                <label className="fcn-item" style={estiloItem}>
                  <input type="checkbox" checked={todosVisiveisMarcados} onChange={alternarTudo} />
                  {termo ? 'Selecionar resultados' : 'Selecionar todos'}
                </label>
                {exibidos.map((v) => (
                  <label key={v} className="fcn-item" style={estiloItem}>
                    <input type="checkbox" checked={marcado(v)} onChange={() => alternar(v)} />
                    <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={texto(v)}>{texto(v)}</span>
                  </label>
                ))}
                {visiveis.length > MAX_EXIBIDOS && (
                  <p style={{ margin: 0, padding: '6px 8px', color: '#64748b' }}>
                    Mostrando {MAX_EXIBIDOS} de {visiveis.length.toLocaleString('pt-BR')} valores: refine a pesquisa.
                  </p>
                )}
                {visiveis.length === 0 && <p style={{ margin: 0, padding: '12px 8px', color: '#64748b' }}>Nenhum valor.</p>}
              </>
            )}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button type="button" className="fcn-limpar" onClick={() => { onFiltrar([]); onFechar(); }}
              style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Limpar
            </button>
            <button type="button" className="fcn-ok" onClick={aplicar} disabled={semNada || valores === null}
              style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: '#1d4ed8', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: semNada || valores === null ? 'not-allowed' : 'pointer', opacity: semNada || valores === null ? 0.5 : 1, fontFamily: 'inherit' }}>
              Aplicar
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

export default function FiltroColuna({ coluna, valores, selecionados, ordem, ativo, onOrdenar, onFiltrar, onAbrir, semLista, formatar }: FiltroColunaProps) {
  const [aberto, setAberto] = useState(false);
  const [botao, setBotao] = useState<HTMLButtonElement | null>(null);
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <>
      <button ref={setBotao} type="button" aria-label={`Filtrar ${coluna.rotulo}`} aria-haspopup="dialog" aria-expanded={aberto}
        onClick={(e) => {
          e.stopPropagation();
          if (!aberto) onAbrir?.();
          setAberto((a) => !a);
        }}
        style={{
          display: 'grid', placeItems: 'center', width: '16px', height: '16px', padding: 0, borderRadius: '4px', cursor: 'pointer', flexShrink: 0,
          border: `1px solid ${ativo || ordem ? '#1d4ed8' : '#e2e8f0'}`, background: ativo ? '#1d4ed8' : '#fff', color: ativo ? '#fff' : ordem ? '#1d4ed8' : '#64748b',
        }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {aberto && (
        <Menu botao={botao} coluna={coluna} valores={valores} selecionados={selecionados} ordem={ordem}
          onOrdenar={onOrdenar} onFiltrar={onFiltrar} onFechar={fechar} semLista={semLista} formatar={formatar} />
      )}
    </>
  );
}
