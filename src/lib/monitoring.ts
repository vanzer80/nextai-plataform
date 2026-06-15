// Observabilidade de erros (Sentry) — INERTE por padrão: só ativa se
// VITE_SENTRY_DSN estiver definido. O operador provê o DSN = consentimento explícito
// de enviar dados de erro a um serviço externo (implicação LGPD). Lazy: o SDK só é
// baixado quando há DSN, então o bundle inicial não é afetado.

type SentryModule = typeof import('@sentry/browser');

let sentry: SentryModule | null = null;

export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // sem DSN → nada é carregado nem enviado
  try {
    const Sentry = await import('@sentry/browser');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      sendDefaultPii: false, // LGPD: não anexar PII por padrão
    });
    sentry = Sentry;
  } catch {
    /* best-effort: monitoramento nunca pode quebrar o app */
  }
}

export function captureException(error: unknown): void {
  try {
    sentry?.captureException(error);
  } catch {
    /* noop */
  }
}
