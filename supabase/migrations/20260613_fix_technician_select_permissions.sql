-- Migration: fix_technician_select_permissions
-- Data: 2026-06-13
-- Objetivo: Garantir permissão de SELECT para usuários autenticados nas tabelas clients, client_locations e equipments.
-- O isolamento de dados por tenant (team_id) continua sendo garantido pela policy team_isolation (RESTRICTIVE).

-- 1. Permissão de SELECT em public.clients
DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
CREATE POLICY "clients_select_authenticated" ON public.clients
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) IS NOT NULL));

-- 2. Permissão de SELECT em public.client_locations
DROP POLICY IF EXISTS "client_locations_select_authenticated" ON public.client_locations;
CREATE POLICY "client_locations_select_authenticated" ON public.client_locations
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) IS NOT NULL));

-- 3. Permissão de SELECT em public.equipments
DROP POLICY IF EXISTS "equipments_select_authenticated" ON public.equipments;
CREATE POLICY "equipments_select_authenticated" ON public.equipments
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) IS NOT NULL));
