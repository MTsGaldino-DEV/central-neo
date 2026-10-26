import { useEffect, useState } from 'react';
import { gravarCache, lerCache } from './cacheTela';
import { traduzirErro, type ErroAmigavel } from './erros';

/** Mostra o cache na hora, busca de novo e guarda o resultado. Em erro, mantém o que já havia. `ativo=false` adia a busca.
 * `onde` entra nos detalhes do erro para o administrador. */
export function useDadosComCache<T>(chave: string, carregar: () => Promise<T>, deps: unknown[], ativo = true, onde?: string) {
  const [estado, setEstado] = useState<{ chave: string; dados: T | null; salvoEm: number | null }>(() => {
    const c = lerCache<T>(chave);
    return { chave, dados: c?.dados ?? null, salvoEm: c?.salvoEm ?? null };
  });
  const [falha, setFalha] = useState<ErroAmigavel | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    if (!ativo) return;
    setEstado(e => {
      if (e.chave === chave) return e;
      const c = lerCache<T>(chave);
      return { chave, dados: c?.dados ?? null, salvoEm: c?.salvoEm ?? null };
    });
    setAtualizando(true); setFalha(null);
    carregar()
      .then(dados => { if (!vivo) return; gravarCache(chave, dados); setEstado({ chave, dados, salvoEm: Date.now() }); })
      .catch(e => { if (vivo) setFalha(traduzirErro(e, onde)); })
      .finally(() => { if (vivo) setAtualizando(false); });
    return () => { vivo = false; };
    // carregar muda a cada render; quem chama declara as dependências reais em deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao, ativo, ...deps]);

  const atual = estado.chave === chave ? estado : { dados: null, salvoEm: null };
  return { dados: atual.dados, erro: falha?.mensagem ?? '', falha, atualizando, salvoEm: atual.salvoEm, recarregar: () => setVersao(v => v + 1) };
}
