-- os-import-processor v8: fotos embutidas no PDF importado viram anexos da OS.
-- Importações via X-API-Key não têm usuário autenticado — uploaded_by aceita NULL.
-- Policies de SELECT/DELETE de report_attachments não dependem de uploaded_by NOT NULL
-- (SELECT é via join no service_reports; DELETE exige dono OU Admin/Master).
ALTER TABLE public.report_attachments ALTER COLUMN uploaded_by DROP NOT NULL;
