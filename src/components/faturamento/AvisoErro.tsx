import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import type { ErroAmigavel } from '@/lib/erros';

/** ADMIN da NEO vê o botão "Ver mais detalhes" nos erros. */
export function useAdminNeo(): boolean {
  return useSessao().acesso?.papel === 'ADMIN';
}

/** Uma linha com o que fazer; o administrador abre o que houve, onde e o detalhe técnico. */
export function AvisoErro({ erro, onTentar, contexto, compacto = false }: {
  erro: ErroAmigavel; onTentar?: () => void; contexto?: string; compacto?: boolean;
}) {
  const admin = useAdminNeo();
  const [aberto, setAberto] = useState(false), [copiado, setCopiado] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(`${erro.mensagem}\n${erro.oQueHouve}\n${erro.tecnico}`); setCopiado(true); }
    catch { setCopiado(false); }
  }
  return (
    <div role="alert" className={`rounded-xl border border-erro/30 border-l-4 border-l-erro-marca bg-white ${compacto ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <XCircle className="size-4 shrink-0 text-erro-marca" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-tinta">{contexto && <>{contexto} </>}<b className="font-bold text-erro">{erro.mensagem}</b></p>
        {admin && <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto}
          className="text-xs font-bold text-sinal hover:underline">{aberto ? 'Ver menos' : 'Ver mais detalhes'}</button>}
        {onTentar && erro.acao === 'tentar' && <button type="button" onClick={onTentar}
          className="rounded-lg bg-sinal px-3 py-1.5 text-xs font-bold text-white hover:bg-sinal-forte">Tentar de novo</button>}
      </div>
      {admin && aberto && <div className="mt-2 space-y-1.5 border-t border-erro/15 pt-2 text-xs">
        <p><b className="text-aco uppercase">O que houve</b> <span className="text-tinta">{erro.oQueHouve}</span></p>
        {erro.onde && <p><b className="text-aco uppercase">Onde</b> <span className="text-tinta">{erro.onde}</span></p>}
        <pre className="overflow-x-auto rounded-lg bg-noite p-2.5 font-codigo text-[11px] leading-relaxed whitespace-pre-wrap text-linha">{erro.tecnico}</pre>
        <button type="button" onClick={() => void copiar()} className="rounded-lg border border-linha px-2.5 py-1 font-bold text-tinta hover:border-sinal">
          {copiado ? 'Copiado' : 'Copiar detalhes'}</button>
      </div>}
    </div>
  );
}
