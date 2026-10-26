import { useEffect, useState } from 'react';
import { gravarCache, lerCache } from './cacheTela';
import { erroFat } from './faturamento';

/** Mostra o cache na hora, busca de novo e guarda o resultado. Em erro, mantém o que já havia. */
export function useDadosComCache<T>(chave: string, carregar: () => Promise<T>, deps: unknown[]) {
  const [estado, setEstado] = useState<{ chave: string; dados: T | null; salvoEm: number | null }>(() => {
    const c = lerCache<T>(chave);
    return { chave, dados: c?.dados ?? null, salvoEm: c?.salvoEm ?? null };
  });
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado(e => {
      if (e.chave === chave) return e;
      const c = lerCache<T>(chave);
      return { chave, dados: c?.dados ?? null, salvoEm: c?.salvoEm ?? null };
    });
    setAtualizando(true); setErro('');
    carregar()
      .then(dados => { if (!vivo) return; gravarCache(chave, dados); setEstado({ chave, dados, salvoEm: Date.now() }); })
      .catch(e => { if (vivo) setErro(erroFat(e)); })
      .finally(() => { if (vivo) setAtualizando(false); });
    return () => { vivo = false; };
    // carregar muda a cada render; quem chama declara as dependências reais em deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao, ...deps]);

  const atual = estado.chave === chave ? estado : { dados: null, salvoEm: null };
  return { dados: atual.dados, erro, atualizando, salvoEm: atual.salvoEm, recarregar: () => setVersao(v => v + 1) };
}
