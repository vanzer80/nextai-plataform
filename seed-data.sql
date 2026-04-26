-- ============================================================================
-- SEED DATA - DADOS DE TESTE PARA DESENVOLVIMENTO
-- Execute isso no Supabase SQL Editor para popular o banco de dados.
-- Aviso: Você precisará substituir os UUIDs dos "tech_id" pelos IDs reais dos seus usuários.
-- ============================================================================

-- 1. Inserir Clientes
INSERT INTO public.clients (id, name, cnpj) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Construtora X', '11.111.111/0001-11'),
  ('c2000000-0000-0000-0000-000000000002', 'Facilities Y', '22.222.222/0001-22')
ON CONFLICT (id) DO NOTHING;

-- 2. Inserir Locais (Sites)
INSERT INTO public.sites (id, client_id, name, address) VALUES
  ('s1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Obra Alpha', 'Av. Paulista, 1000'),
  ('s2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'Sede Coporativa', 'Rua Faria Lima, 3000')
ON CONFLICT (id) DO NOTHING;

-- 3. Inserir Equipamentos
INSERT INTO public.equipments (id, site_id, name, type, serial_number) VALUES
  ('e1000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001', 'Elevador OTIS', 'Transporte Vertical', 'OT-2023-881'),
  ('e2000000-0000-0000-0000-000000000002', 's2000000-0000-0000-0000-000000000002', 'Gerador 50kVA', 'Energia', 'GER-50K-992')
ON CONFLICT (id) DO NOTHING;

/* 
-- 4. Inserir Relatórios de Teste
-- NOTA: Como você precisa de um usuário válido (tech_id), rodar o script abaixo 
-- pode falhar dependendo da ForeignKey para a Auth.users. Se tiver um usuário, 
-- troque o "YOUR_USER_ID_HERE" pelo UUID dele.

INSERT INTO public.service_reports (id, tech_id, client_id, equipment_id, description, status) VALUES
  (
    'r1000000-0000-0000-0000-000000000001', 
    'YOUR_USER_ID_HERE', 
    'c1000000-0000-0000-0000-000000000001', 
    'e1000000-0000-0000-0000-000000000001', 
    'Manutenção preventiva concluída. Lubrificação dos cabos e verificação de painel OK.', 
    'Aprovado'
  ),
  (
    'r2000000-0000-0000-0000-000000000002', 
    'YOUR_USER_ID_HERE', 
    'c2000000-0000-0000-0000-000000000002', 
    'e2000000-0000-0000-0000-000000000002', 
    'Equipamento apresentando falha ao partir em rampa. Necessário troca de placa controladora.', 
    'Revisao'
  ),
  (
    'r3000000-0000-0000-0000-000000000003', 
    'YOUR_USER_ID_HERE', 
    'c1000000-0000-0000-0000-000000000001', 
    null, 
    'Visita técnica para levantamento de pontos de rede no andar 4. Sem materiais aplicados.', 
    'Pendente'
  );
*/
