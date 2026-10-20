/**
 * Ponte entre as telas portadas do TraceOne (escritas para o Next.js) e o
 * React Router da Central NEO. As telas continuam chamando useRouter().push.
 */
import { useNavigate, useLocation } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (rota: string) => navigate(rota),
    replace: (rota: string) => navigate(rota, { replace: true }),
    back: () => navigate(-1),
  };
}

export function usePathname(): string {
  return useLocation().pathname;
}

/** URL do TraceOne web, para telas que só existem lá (colaboradores, usuários, duplicidade). */
export const TRACEONE_URL = (import.meta.env.VITE_TRACEONE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function abrirNoTraceOne(rota: string) {
  if (!TRACEONE_URL) {
    alert('Essa tela fica no TraceOne. Abra o TraceOne para continuar.');
    return;
  }
  window.open(`${TRACEONE_URL}${rota}`, '_blank', 'noopener');
}
