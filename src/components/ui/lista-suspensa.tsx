import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search, type LucideIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface OpcaoLista { valor: string; rotulo: string; /** Texto menor, à direita (ex.: uma contagem). */ detalhe?: string }

interface Props {
  valor: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoLista[];
  /** Nome do campo para leitor de tela (a etiqueta visual fica por conta da tela). */
  rotulo: string;
  /** Texto do botão quando nenhuma opção está escolhida, e do botão de ação. */
  placeholder?: string;
  icone?: LucideIcon;
  /** Filtro aplicado: o botão ganha a cor do tom. */
  ativo?: boolean;
  tom?: 'sinal' | 'cobre';
  /** Menu de ação: escolher dispara onChange, mas o botão continua mostrando o placeholder e nada fica marcado. */
  acao?: boolean;
  /** Caixa de busca no topo da lista. Padrão: só quando há mais de 8 opções. */
  buscavel?: boolean;
  desabilitado?: boolean;
  className?: string;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const TOM = {
  sinal: 'border-sinal bg-sinal-fundo text-sinal',
  cobre: 'border-cobre bg-cobre-fundo text-cobre',
} as const;

/**
 * Lista suspensa dos filtros: no lugar do <select> do navegador. Botão que destaca quando há filtro aplicado, painel com
 * animação, opção escolhida com check, setas/Enter/Esc, busca nas listas longas e digitação da inicial para pular de opção.
 */
export function ListaSuspensa({ valor, onChange, opcoes, rotulo, placeholder, icone: Icone, ativo, tom = 'sinal', acao, buscavel, desabilitado, className }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [ativa, setAtiva] = useState(0);
  const idLista = useId();
  const lista = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const comBusca = buscavel ?? opcoes.length > 8;

  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    return q ? opcoes.filter(o => semAcento(o.rotulo).includes(q)) : opcoes;
  }, [opcoes, busca]);

  const escolhida = acao ? undefined : opcoes.find(o => o.valor === valor);
  const texto = escolhida?.rotulo ?? placeholder ?? '';

  // Ao abrir, a opção escolhida já vem destacada; ao filtrar, a primeira.
  useEffect(() => {
    if (!aberto) return;
    const i = visiveis.findIndex(o => o.valor === valor);
    setAtiva(busca || acao || i < 0 ? 0 : i);
  }, [aberto, busca, visiveis, valor, acao]);

  useEffect(() => {
    if (aberto) lista.current?.querySelector('[data-ativa="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [aberto, ativa]);

  const abrirOuFechar = (a: boolean) => { setAberto(a); if (a) setBusca(''); };
  const escolher = (o: OpcaoLista) => { onChange(o.valor); setAberto(false); };

  function teclado(e: KeyboardEvent) {
    if (!visiveis.length) return;
    const ultimo = visiveis.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtiva(i => Math.min(i + 1, ultimo)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtiva(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setAtiva(0); }
    else if (e.key === 'End') { e.preventDefault(); setAtiva(ultimo); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = visiveis[ativa]; if (o) escolher(o); }
    else if (!comBusca && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Sem caixa de busca: a inicial pula para a próxima opção que começa com a letra.
      const letra = semAcento(e.key);
      const ordem = [...visiveis.keys()].map(k => (k + ativa + 1) % visiveis.length);
      const achou = ordem.find(k => semAcento(visiveis[k].rotulo).startsWith(letra));
      if (achou !== undefined) setAtiva(achou);
    }
  }

  return (
    <Popover open={aberto} onOpenChange={abrirOuFechar}>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={aberto} aria-haspopup="listbox" aria-controls={aberto ? idLista : undefined} aria-label={rotulo}
          disabled={desabilitado}
          className={cn(
            'group inline-flex h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium outline-none transition-[color,border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none',
            'hover:border-aco-claro focus-visible:border-sinal focus-visible:ring-2 focus-visible:ring-sinal/30 disabled:cursor-not-allowed disabled:opacity-50',
            ativo ? TOM[tom] : acao || !escolhida ? 'border-linha text-aco' : 'border-linha text-tinta',
            aberto && 'border-sinal ring-2 ring-sinal/20',
            className,
          )}>
          {Icone && <Icone size={14} className="shrink-0 opacity-70" aria-hidden="true" />}
          <span className={cn('min-w-0 flex-1 truncate text-left', ativo && 'font-semibold')}>{texto}</span>
          <ChevronDown size={15} aria-hidden="true"
            className={cn('shrink-0 text-aco-claro transition-transform duration-200 motion-reduce:transition-none', aberto && 'rotate-180 text-sinal')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} collisionPadding={12}
        onOpenAutoFocus={e => { e.preventDefault(); (campoBusca.current ?? lista.current)?.focus(); }}
        onKeyDown={teclado}
        className="w-max min-w-[max(var(--radix-popover-trigger-width),12rem)] max-w-[min(26rem,calc(100vw-24px))] overflow-hidden rounded-xl border-linha p-0 shadow-xl">
        {comBusca && (
          <div className="relative border-b border-linha p-1.5">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aco-claro" />
            <input ref={campoBusca} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" aria-label={`Buscar em ${rotulo}`}
              className="h-8 w-full rounded-md bg-nevoa pl-8 pr-2 text-sm outline-none placeholder:text-aco-claro focus:ring-2 focus:ring-sinal/30" />
          </div>
        )}
        <div ref={lista} id={idLista} role="listbox" aria-label={rotulo} tabIndex={-1} className="max-h-64 overflow-y-auto p-1.5 outline-none">
          {!visiveis.length && <p className="px-3 py-4 text-center text-sm text-aco">Nada encontrado.</p>}
          {visiveis.map((o, i) => {
            const marcada = !acao && o.valor === valor;
            return (
              <button key={o.valor} type="button" role="option" aria-selected={marcada} tabIndex={-1} data-ativa={i === ativa}
                onClick={() => escolher(o)} onMouseMove={() => { if (ativa !== i) setAtiva(i); }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100 motion-reduce:transition-none',
                  i === ativa && 'bg-nevoa',
                  marcada && 'bg-sinal-fundo font-semibold text-sinal-forte',
                )}>
                <span className="min-w-0 flex-1 break-words">{o.rotulo}</span>
                {o.detalhe && <span className="shrink-0 text-xs tabular-nums text-aco">{o.detalhe}</span>}
                <Check size={15} aria-hidden="true" className={cn('shrink-0 text-sinal', marcada ? 'opacity-100' : 'opacity-0')} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
