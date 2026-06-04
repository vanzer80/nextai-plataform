-- Migration: tenant_commercial_data
-- Expande a tabela tenants com campos de endereço completo e dados fiscais.
-- Complementa 20260523_tenants_business_fields que adicionou cnpj/phone/website/sector.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS razao_social       text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ie                 text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email_contato      text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_zip        text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_street     text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_number     text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_complement text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_neighborhood text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_city       text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_state      text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_country    text DEFAULT 'Brasil';

COMMENT ON COLUMN public.tenants.razao_social       IS 'Razão social formal (pode diferir do nome fantasia)';
COMMENT ON COLUMN public.tenants.ie                 IS 'Inscrição Estadual';
COMMENT ON COLUMN public.tenants.email_contato      IS 'E-mail comercial de contato';
COMMENT ON COLUMN public.tenants.address_zip        IS 'CEP (formato livre)';
COMMENT ON COLUMN public.tenants.address_street     IS 'Logradouro';
COMMENT ON COLUMN public.tenants.address_number     IS 'Número';
COMMENT ON COLUMN public.tenants.address_complement IS 'Complemento';
COMMENT ON COLUMN public.tenants.address_neighborhood IS 'Bairro';
COMMENT ON COLUMN public.tenants.address_city       IS 'Cidade';
COMMENT ON COLUMN public.tenants.address_state      IS 'Estado (UF, sempre uppercase)';
COMMENT ON COLUMN public.tenants.address_country    IS 'País';
