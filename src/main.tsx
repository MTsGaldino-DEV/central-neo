import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessaoProvider } from '@/contexto/Sessao';
import App from './App';
import './index.css';

// Depois de um deploy, uma aba aberta antes ainda pede os arquivos de tela da versão anterior, que não existem mais.
// Em vez de ficar com a tela branca, recarrega uma vez para buscar a versão nova (no máximo uma vez a cada 10 s).
window.addEventListener('vite:preloadError', (evento) => {
  const CHAVE = 'neo-recarregou-versao';
  try {
    if (Date.now() - Number(sessionStorage.getItem(CHAVE) ?? 0) < 10_000) return;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  evento.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessaoProvider>
        <App />
      </SessaoProvider>
    </BrowserRouter>
  </StrictMode>
);
