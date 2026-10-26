// Erros em português: uma frase com o que fazer para todos; os detalhes técnicos ficam para o
// administrador ("Ver mais detalhes"). Sem React aqui, para testar em Node.
export interface ErroAmigavel {
  mensagem: string;
  oQueHouve: string;
  acao: 'tentar' | 'avisar' | 'corrigir';
  codigo: string | null;
  onde: string | null;
  tecnico: string;
}

/** Mensagem escrita pelo próprio sistema, em português, que já diz o que fazer. */
export class ErroNeo extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = 'ErroNeo'; }
}

const GENERICA = 'Algo deu errado. Tente de novo; se repetir, avise o administrador.';
const campo = (e: unknown, k: string) => (e && typeof e === 'object' && k in e ? String((e as Record<string, unknown>)[k] ?? '') : '');

/** Traduz um erro do Supabase, do navegador ou do próprio sistema. `onde`: tela › parte › etapa. */
export function traduzirErro(e: unknown, onde?: string): ErroAmigavel {
  const codigo = campo(e, 'code') || null;
  const msg = e instanceof Error ? e.message : campo(e, 'message') || (typeof e === 'string' ? e : '');
  let r: Pick<ErroAmigavel, 'mensagem' | 'oQueHouve' | 'acao'>;
  if (codigo === '57014' || /statement timeout/i.test(msg))
    r = { mensagem: 'Não foi possível carregar os dados. Aguarde alguns segundos e tente de novo.',
      oQueHouve: 'O banco de dados demorou mais de 8 segundos e cancelou a consulta.', acao: 'tentar' };
  else if (codigo === '42501' || /^Sem acesso/i.test(msg))
    r = { mensagem: 'Você não tem permissão para isso. Peça a um administrador.', oQueHouve: msg || 'Acesso negado pelo banco de dados.', acao: 'avisar' };
  else if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(msg))
    r = { mensagem: 'Sem conexão com o servidor. Verifique a internet e tente de novo.', oQueHouve: 'O navegador não conseguiu falar com o servidor.', acao: 'tentar' };
  else if ((codigo === 'P0001' || e instanceof ErroNeo || (e instanceof Error && e.name === 'ErroNeo')) && msg)
    // Mensagens escritas pelo próprio sistema (planilha, fatura já existe, regras do banco): já dizem o que fazer.
    // Um Error qualquer (biblioteca, navegador) cai na frase genérica; o texto dele fica no detalhe técnico.
    r = { mensagem: msg, oQueHouve: msg, acao: 'corrigir' };
  else r = { mensagem: GENERICA, oQueHouve: msg || 'Erro sem descrição.', acao: 'tentar' };
  const local = typeof location !== 'undefined' ? `${location.pathname}${location.search}` : '';
  const tecnico = [
    onde && `onde: ${onde}`, local && `tela: ${local}`, codigo && `código: ${codigo}`, msg && `mensagem: ${msg}`,
    campo(e, 'details') && `detalhes: ${campo(e, 'details')}`, campo(e, 'hint') && `dica: ${campo(e, 'hint')}`,
    `quando: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n');
  return { ...r, codigo, onde: onde ?? null, tecnico };
}
