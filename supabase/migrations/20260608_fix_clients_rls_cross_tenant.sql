-- Remove a policy que permitia qualquer usuário autenticado ver clientes de outros tenants.
-- A policy team_isolation (ALL) já cobre SELECT corretamente para membros do mesmo tenant.
-- Sem essa policy: cada tenant vê apenas seus próprios clientes, alinhando com a
-- visibilidade de client_locations (que sempre foi corretamente isolada por team_id).
DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
