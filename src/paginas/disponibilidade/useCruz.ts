import { useCallback, useRef, type MouseEvent } from 'react';

const ALTURA_DICA = 40;
const LARGURA_DICA = 330;

// Cruz e dica da grade do mês. Um mês tem quase 2 mil células, então o movimento do mouse
// mexe direto no DOM: passar por estado do React redesenharia a grade inteira a cada pixel.
export function useCruz() {
  const caixa = useRef<HTMLDivElement>(null);
  const linha = useRef<HTMLDivElement>(null);
  const coluna = useRef<HTMLDivElement>(null);
  const dica = useRef<HTMLDivElement>(null);
  const atual = useRef<HTMLTableCellElement | null>(null);
  const pontas = useRef<Element[]>([]);

  const marcar = useCallback((td: HTMLTableCellElement | null) => {
    atual.current = td;
    pontas.current.forEach(e => e.classList.remove('disp-cruz'));
    pontas.current = [];
    if (!td || !caixa.current || !linha.current || !coluna.current) {
      caixa.current?.classList.remove('com-cruz');
      return;
    }
    // Dia, frota, valor e rodapé ficam presos na rolagem, por cima das faixas: escurecem à parte.
    const tr = td.parentElement as HTMLTableRowElement;
    const tabela = tr.closest('table') as HTMLTableElement;
    pontas.current = [tabela.tHead!.rows[0].cells[td.cellIndex], tabela.tFoot!.rows[0].cells[td.cellIndex], tr.cells[0], tr.cells[tr.cells.length - 1]];
    pontas.current.forEach(e => e.classList.add('disp-cruz'));

    const base = caixa.current.getBoundingClientRect();
    const r = td.getBoundingClientRect();
    linha.current.style.height = `${r.height}px`;
    linha.current.style.transform = `translateY(${r.top - base.top}px)`;
    coluna.current.style.width = `${r.width}px`;
    coluna.current.style.transform = `translateX(${r.left - base.left}px)`;
    caixa.current.classList.add('com-cruz');
  }, []);

  const esconderDica = useCallback(() => dica.current?.classList.remove('visivel'), []);

  const sair = useCallback(() => { marcar(null); esconderDica(); }, [marcar, esconderDica]);

  const mover = useCallback((e: MouseEvent) => {
    const td = (e.target as HTMLElement).closest('td');
    const cel = td?.firstElementChild as HTMLElement | null | undefined;
    const ehCelula = !!cel?.classList.contains('disp-cel');
    if (!ehCelula) return sair();
    if (td !== atual.current) marcar(td);
    if (!dica.current) return;
    // O texto vem da célula a cada movimento: muda quando uma marcação é gravada.
    const texto = cel!.dataset.dica ?? '';
    if (dica.current.textContent !== texto) dica.current.textContent = texto;
    const x = Math.min(e.clientX + 12, innerWidth - LARGURA_DICA);
    const y = Math.min(e.clientY + 14, innerHeight - ALTURA_DICA);
    dica.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    dica.current.classList.add('visivel');
  }, [marcar, sair]);

  return { caixa, linha, coluna, dica, mover, sair, esconderDica };
}
