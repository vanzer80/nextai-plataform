-- Migration: app_health
-- Tabela singleton usada pelo workflow keep-alive do GitHub Actions.
-- RLS habilitado sem policies: anon e authenticated são bloqueados por default (deny-by-default).
-- service_role tem BYPASSRLS no Supabase → única credencial que acessa esta tabela.
-- NÃO usar FORCE ROW LEVEL SECURITY: removeria o bypass do service_role.

CREATE TABLE IF NOT EXISTS public.app_health (
  id        INTEGER      PRIMARY KEY DEFAULT 1,
  last_ping TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT app_health_singleton CHECK (id = 1)
);

-- Linha única: inserir apenas se não existir
INSERT INTO public.app_health (id, last_ping)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_health ENABLE ROW LEVEL SECURITY;
