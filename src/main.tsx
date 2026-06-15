import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from '@/src/components/theme/ThemeProvider';
import { initMonitoring } from '@/src/lib/monitoring';
import { toast } from 'sonner';

// Observabilidade (inerte sem VITE_SENTRY_DSN). Não bloqueia o render. O Sentry
// init instala handlers globais (window.onerror + unhandledrejection), capturando
// erros não tratados — inclusive os de render re-lançados pelo React.
initMonitoring();

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);

// Oferece atualizar quando uma nova versão do app fica pronta (não interrompe o trabalho).
function promptServiceWorkerUpdate(): void {
  toast('Nova versão disponível', {
    description: 'Atualize para carregar as melhorias mais recentes.',
    duration: Infinity,
    action: {
      label: 'Atualizar',
      onClick: () =>
        navigator.serviceWorker
          .getRegistration()
          .then((r) => r?.waiting?.postMessage({ type: 'SKIP_WAITING' })),
    },
  });
}

if ('serviceWorker' in navigator) {
  // Quando o novo SW assume (após o usuário aceitar), recarrega uma única vez.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // 'installed' + já existe controller = ATUALIZAÇÃO (não o primeiro install).
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              promptServiceWorkerUpdate();
            }
          });
        });
      })
      .catch(() => {});
  });
}
