/* ============================================================
   ATENÇÃO: ESTE ARQUIVO ESTÁ DESATUALIZADO (última atualização: ~Sprint 1)
   NÃO USAR PARA RESTORE OU REFERÊNCIA.

   Use: supabase/schema-atual.sql (gerado em 2026-04-25)
   Auditoria: 11 - Auditoria 2026-04-25
   ============================================================ */

-- ENUMS
CREATE TYPE user_role AS ENUM ('Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Comprador', 'Admin');
CREATE TYPE report_status AS ENUM ('Pendente', 'Aprovado', 'Revisao');
CREATE TYPE reimbursement_status AS ENUM ('Pendente', 'Aprovado', 'Rejeitado');
CREATE TYPE user_status AS ENUM ('Ativo', 'Inativo');
CREATE TYPE urgency_level AS ENUM ('Alta', 'Média', 'Baixa');
CREATE TYPE material_status AS ENUM ('Pendente', 'Comprado', 'Entregue');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users Table (Extended from auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'Tecnico',
  team_id UUID,
  status user_status DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients Table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites Table
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipments Table
CREATE TABLE public.equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  serial_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service Reports Table
CREATE TABLE public.service_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES public.equipments(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status report_status DEFAULT 'Pendente',
  signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reimbursements Table
CREATE TABLE public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status reimbursement_status DEFAULT 'Pendente',
  receipt_url TEXT,
  
  -- Novos campos de detalhamento de reembolso
  description TEXT,
  maintenance_type TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  branch TEXT,
  budget TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material Requests Table
CREATE TABLE public.material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  quantity TEXT NOT NULL,
  urgency urgency_level NOT NULL DEFAULT 'Baixa',
  reason TEXT NOT NULL,
  status material_status DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if current user is an Admin, Gestor, or Supervisor
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
  current_role public.user_role;
BEGIN
  SELECT role INTO current_role FROM public.users WHERE id = auth.uid();
  RETURN current_role IN ('Gestor', 'Admin', 'Supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users RLS
CREATE POLICY "Users can view their own profile" 
  ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update their own profile" 
  ON public.users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Managers and Admins can view all users" 
  ON public.users FOR SELECT USING (public.is_manager_or_admin());
CREATE POLICY "Managers and Admins can manage all users" 
  ON public.users FOR ALL USING (public.is_manager_or_admin());

-- Clients, Sites, Equipments RLS
CREATE POLICY "Everyone authenticated can view clients" 
  ON public.clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can manage clients" 
  ON public.clients FOR ALL USING (public.is_manager_or_admin());

CREATE POLICY "Everyone authenticated can view sites" 
  ON public.sites FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can manage sites" 
  ON public.sites FOR ALL USING (public.is_manager_or_admin());

CREATE POLICY "Everyone authenticated can view equipments" 
  ON public.equipments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can manage equipments" 
  ON public.equipments FOR ALL USING (public.is_manager_or_admin());

-- Service Reports RLS
CREATE POLICY "Techs can view their own reports and managers can view all" 
  ON public.service_reports FOR SELECT USING (tech_id = auth.uid() OR public.is_manager_or_admin());
CREATE POLICY "Techs can insert their own reports" 
  ON public.service_reports FOR INSERT WITH CHECK (tech_id = auth.uid());
CREATE POLICY "Techs can update their own reports" 
  ON public.service_reports FOR UPDATE USING (tech_id = auth.uid());
CREATE POLICY "Managers can manage all reports" 
  ON public.service_reports FOR ALL USING (public.is_manager_or_admin());

-- Reimbursements RLS
CREATE POLICY "Users can view their own reimbursements and managers can view all" 
  ON public.reimbursements FOR SELECT USING (user_id = auth.uid() OR public.is_manager_or_admin());
CREATE POLICY "Users can insert their own reimbursements" 
  ON public.reimbursements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own reimbursements" 
  ON public.reimbursements FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Managers can manage all reimbursements" 
  ON public.reimbursements FOR ALL USING (public.is_manager_or_admin());

-- Notifications RLS
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" 
  ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Managers can insert and manage all notifications" 
  ON public.notifications FOR ALL USING (public.is_manager_or_admin());

-- Material Requests RLS
CREATE POLICY "Users can view their own requests and managers can view all" 
  ON public.material_requests FOR SELECT USING (tech_id = auth.uid() OR public.is_manager_or_admin());
CREATE POLICY "Users can insert their own requests" 
  ON public.material_requests FOR INSERT WITH CHECK (tech_id = auth.uid());
CREATE POLICY "Users can update their own requests" 
  ON public.material_requests FOR UPDATE USING (tech_id = auth.uid());
CREATE POLICY "Managers can manage all requests" 
  ON public.material_requests FOR ALL USING (public.is_manager_or_admin());

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function to handle new user signup from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'Tecnico' -- Default role for new signups
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically insert a public.user when auth.user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
