import { createPortal } from 'react-dom';
import { Rocket } from 'lucide-react';

interface WelcomeModalProps {
  tenantName: string;
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ tenantName, onStart, onSkip }: WelcomeModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="welcome-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onSkip}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 fill-mode-backwards">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Rocket className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 id="welcome-title" className="text-xl font-bold text-foreground">
              Bem-vindo ao {tenantName}!
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Quer um tour rápido pelas funcionalidades? Vamos mostrar tudo o que você pode fazer — leva menos de 3 minutos.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onStart}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Fazer tour agora
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
          >
            Pular por enquanto
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
