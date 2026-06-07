-- Migration: fix_rls_initplan_all_policies
-- Objetivo: envolver auth.uid() em (SELECT auth.uid()) em todas as policies afetadas
-- Evidência: Supabase advisor auth_rls_initplan (65 WARNs), pg_policies snapshot em 20260607_rls_initplan_before.json
-- Regra absoluta: a ÚNICA mudança é o wrap de auth.uid(). Lógica booleana idêntica.
-- Gerado por: gen_rls_migration.mjs a partir do pg_policies vivo
-- Rollback: ver 20260607_rls_initplan_rollback.sql

ALTER POLICY "template_items_all" ON public.checklist_template_items
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role]))))));

ALTER POLICY "template_items_select" ON public.checklist_template_items
  USING (((SELECT auth.uid()) IS NOT NULL));

ALTER POLICY "checklist_templates_delete" ON public.checklist_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role]))))));

ALTER POLICY "checklist_templates_insert" ON public.checklist_templates
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role, 'Gestor'::user_role]))))));

ALTER POLICY "checklist_templates_select" ON public.checklist_templates
  USING (((SELECT auth.uid()) IS NOT NULL));

ALTER POLICY "checklist_templates_update" ON public.checklist_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role]))))));

ALTER POLICY "client_locations_delete" ON public.client_locations
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role, 'Gestor'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "client_locations_insert" ON public.client_locations
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role, 'Gestor'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "client_locations_update" ON public.client_locations
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role, 'Gestor'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "Permitir MODIFICAR clients apenas para Gestão" ON public.clients
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Gestor'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Gestor'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "clients_select_authenticated" ON public.clients
  USING (((SELECT auth.uid()) IS NOT NULL));

ALTER POLICY "users manage own prefs" ON public.dashboard_preferences
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "equipments_managers_all" ON public.equipments
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role]))))));

ALTER POLICY "Managers can manage all requests" ON public.material_requests
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Comprador'::user_role, 'Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "Users can insert their own requests" ON public.material_requests
  WITH CHECK ((tech_id = (SELECT auth.uid())));

ALTER POLICY "Users can update their own requests" ON public.material_requests
  USING ((tech_id = (SELECT auth.uid())));

ALTER POLICY "Users can view their own requests and managers can view all" ON public.material_requests
  USING (((tech_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Comprador'::user_role, 'Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role])))))));

ALTER POLICY "comprador_update_all" ON public.material_requests
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Comprador'::user_role, 'Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Comprador'::user_role, 'Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role]))))));

ALTER POLICY "Users can update their own notifications" ON public.notifications
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "Users can view their own notifications" ON public.notifications
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "notifications_managers_all" ON public.notifications
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role]))))) AND (team_id = get_caller_team_id())))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role]))))) AND (team_id = get_caller_team_id())));

ALTER POLICY "own_notifications_select" ON public.notifications
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "own_notifications_update" ON public.notifications
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "orcamento_itens_delete" ON public.orcamento_itens
  USING ((EXISTS ( SELECT 1
   FROM orcamentos o
  WHERE ((o.id = orcamento_itens.orcamento_id) AND ((o.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role]))))))))));

ALTER POLICY "orcamento_itens_insert" ON public.orcamento_itens
  WITH CHECK ((EXISTS ( SELECT 1
   FROM orcamentos o
  WHERE ((o.id = orcamento_itens.orcamento_id) AND (o.technician_id = (SELECT auth.uid()))))));

ALTER POLICY "orcamento_itens_select" ON public.orcamento_itens
  USING ((EXISTS ( SELECT 1
   FROM orcamentos o
  WHERE ((o.id = orcamento_itens.orcamento_id) AND ((o.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))))))));

ALTER POLICY "orcamentos_delete" ON public.orcamentos
  USING ((((technician_id = (SELECT auth.uid())) AND (status = 'rascunho'::orcamento_status)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role])))))));

ALTER POLICY "orcamentos_insert" ON public.orcamentos
  WITH CHECK ((technician_id = (SELECT auth.uid())));

ALTER POLICY "orcamentos_select" ON public.orcamentos
  USING (((technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role])))))));

ALTER POLICY "orcamentos_update" ON public.orcamentos
  USING ((((technician_id = (SELECT auth.uid())) AND (status = 'rascunho'::orcamento_status)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role])))))));

ALTER POLICY "parts_managers_all" ON public.parts
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Gestor'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Gestor'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "parts_select_authenticated" ON public.parts
  USING (((SELECT auth.uid()) IS NOT NULL));

ALTER POLICY "own_push_subs_delete" ON public.push_subscriptions
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "own_push_subs_insert" ON public.push_subscriptions
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "own_push_subs_select" ON public.push_subscriptions
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "reimbursement_history_select" ON public.reimbursement_history
  USING (((reimbursement_id IN ( SELECT reimbursements.id
   FROM reimbursements
  WHERE (reimbursements.user_id = (SELECT auth.uid())))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role])))))));

ALTER POLICY "Users can update their own reimbursements" ON public.reimbursements
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "reimbursements_insert" ON public.reimbursements
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "reimbursements_managers_all" ON public.reimbursements
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role]))))));

ALTER POLICY "reimbursements_select" ON public.reimbursements
  USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role])))))));

ALTER POLICY "report_attachments_delete" ON public.report_attachments
  USING (((uploaded_by = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role])))))));

ALTER POLICY "report_attachments_insert" ON public.report_attachments
  WITH CHECK (((uploaded_by = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_attachments.report_id) AND ((r.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Financeiro'::user_role])))))))))));

ALTER POLICY "report_attachments_select" ON public.report_attachments
  USING ((EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_attachments.report_id) AND ((r.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Financeiro'::user_role]))))))))));

ALTER POLICY "checklist_items_insert" ON public.report_checklist_items
  WITH CHECK ((EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_checklist_items.report_id) AND (r.technician_id = (SELECT auth.uid()))))));

ALTER POLICY "checklist_items_select" ON public.report_checklist_items
  USING ((EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_checklist_items.report_id) AND ((r.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Financeiro'::user_role]))))))))));

ALTER POLICY "checklist_items_update" ON public.report_checklist_items
  USING ((EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_checklist_items.report_id) AND (r.technician_id = (SELECT auth.uid()))))));

ALTER POLICY "report_signatures_insert" ON public.report_signatures
  WITH CHECK (((EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_signatures.report_id) AND (r.technician_id = (SELECT auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role])))))));

ALTER POLICY "report_signatures_select" ON public.report_signatures
  USING ((EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_signatures.report_id) AND ((r.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role]))))))))));

ALTER POLICY "report_history_insert" ON public.report_status_history
  WITH CHECK (((changed_by = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_status_history.report_id) AND ((r.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Financeiro'::user_role])))))))))));

ALTER POLICY "report_history_select" ON public.report_status_history
  USING ((EXISTS ( SELECT 1
   FROM service_reports r
  WHERE ((r.id = report_status_history.report_id) AND ((r.technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Financeiro'::user_role]))))))))));

ALTER POLICY "reports_delete" ON public.service_reports
  USING (((status = 'draft'::report_status) AND ((technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Master'::user_role]))))))));

ALTER POLICY "reports_insert" ON public.service_reports
  WITH CHECK ((technician_id = (SELECT auth.uid())));

ALTER POLICY "reports_select" ON public.service_reports
  USING (((technician_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Financeiro'::user_role])))))));

ALTER POLICY "reports_update" ON public.service_reports
  USING ((((technician_id = (SELECT auth.uid())) AND (status = ANY (ARRAY['draft'::report_status, 'returned'::report_status]))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Supervisor'::user_role, 'Admin'::user_role, 'Master'::user_role])))))));

ALTER POLICY "admin_all" ON public.service_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Master'::user_role, 'Admin'::user_role, 'Supervisor'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Master'::user_role, 'Admin'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "sites_managers_all" ON public.sites
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Gestor'::user_role, 'Admin'::user_role, 'Master'::user_role, 'Supervisor'::user_role, 'Financeiro'::user_role]))))));

ALTER POLICY "suppliers_managers_all" ON public.suppliers
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Gestor'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (SELECT auth.uid())) AND (users.role = ANY (ARRAY['Admin'::user_role, 'Gestor'::user_role, 'Master'::user_role, 'Supervisor'::user_role]))))));

ALTER POLICY "suppliers_select_authenticated" ON public.suppliers
  USING (((SELECT auth.uid()) IS NOT NULL));

ALTER POLICY "Users can update their own profile" ON public.users
  USING ((id = (SELECT auth.uid())));

ALTER POLICY "Users can view their own profile" ON public.users
  USING ((id = (SELECT auth.uid())));

ALTER POLICY "users_select" ON public.users
  USING (((id = (SELECT auth.uid())) OR (get_auth_role() = ANY (ARRAY['Comprador'::text, 'Gestor'::text, 'Admin'::text, 'Master'::text, 'Supervisor'::text]))));

ALTER POLICY "users_update" ON public.users
  USING (((id = (SELECT auth.uid())) OR (get_auth_role() = ANY (ARRAY['Admin'::text, 'Gestor'::text, 'Master'::text]))));
