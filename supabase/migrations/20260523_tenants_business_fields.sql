-- Migration: tenants_business_fields
-- Adiciona campos de negócio à tabela tenants para cadastro completo da empresa cliente.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cnpj    text,
  ADD COLUMN IF NOT EXISTS phone   text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS sector  text;

COMMENT ON COLUMN public.tenants.cnpj    IS 'CNPJ da empresa (formato livre, ex: 00.000.000/0001-00)';
COMMENT ON COLUMN public.tenants.phone   IS 'Telefone principal da empresa';
COMMENT ON COLUMN public.tenants.website IS 'Site da empresa';
COMMENT ON COLUMN public.tenants.sector  IS 'Segmento de mercado (valor controlado pelo frontend: SECTORS[]  em PlatformTenants.tsx)';
