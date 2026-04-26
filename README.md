# 🏗️ Portal Mopar

## 📖 Sobre o Projeto
O **Portal Mopar** é um sistema completo e moderno para gestão de operações em campo. Ele centraliza ordens de serviço, relatórios técnicos, controle de reembolsos, e a administração de clientes, materiais e níveis de usuários da frota. Possui um robusto sistema de segurança em nuvem via RBAC (Role-Based Access Control) que adapta a interface em conformidade para Técnicos, Gestores e Administradores em tempo real.

## 🛠️ Arquitetura e Stack Tecnológico
- **Frontend / Interface:** React 18 + Vite + TypeScript
- **Estilização Dinâmica:** Tailwind CSS
- **Biblioteca de Componentes:** shadcn/ui (Radix UI primitives) e Lucide Icons
- **Roteamento:** React Router DOM v6
- **Formulários e Modelagem:** React Hook Form e validações Zod
- **Backend-as-a-Service (BaaS):** Supabase (Gestão de Banco de Dados PostgreSQL, Auth Engine em nuvem e Storage Media)

---

## 💻 Configuração do Ambiente Local (VS Code)

Para dar andamento ao desenvolvimento deste projeto em sua máquina, siga os passos abaixo para preparar seu ambiente:

### 1. Instalação das Dependências
Abra o terminal integrado do VS Code na raiz do diretório extraído e execute:
```bash
npm install
```

### 2. Configurando o Backend (Banco e Auth)
Este projeto usa variáveis de ambiente para esconder as strings vitais de conexão do Supabase do Client-Side de terceiros usando Vite config. 
Crie um arquivo com o exato nome **`.env.local`** na raiz do projeto (no mesmo nível do pacote `package.json`).

Preencha ele estritamente no formato abaixo com as informações do Painel Project Settings > API do seu Supabase:
```env
# .env.local
VITE_SUPABASE_URL=https://SEU_PROJETO_AQUI.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...SUA_CHAVE_PUBLICA_ANON_AQUI...
```

### 3. Subindo o Servidor de Desenvolvimento
Após instalar dependências e as chaves ambientais, starte o sistema local do Vite:
```bash
npm run dev
```
O console acusará a inicialização da aplicação (geralmente sob a porta padrão `http://localhost:3000` ou similar).

---

## 🗺️ Mapa de Evolução: Guia de Retomada (Para a IA / Desenvolvedor)

Abaixo estão condensadas as instruções das funções marcadas como "Pendentes na fila de Desenvolvimento" para que você (ou seu Assistant de Code-Pilot) saibam exatamente os trilhos para recomeçar o trabalho:

### 🔧 1. Reativar o "Update" na Edição de Clientes (`src/pages/clients/ClientsList.tsx`)
* **Situação Atual:** A listagem realimenta dados do Supabase. O botão "Editar" de cada linha emite apenas um alerta em vez de modificar os dados.
* **Plano de Execução:** 
  1. No componente, adicione um Estado `const [editingClient, setEditingClient] = useState<any>(null);`.
  2. Modifique o clique em "Editar" para interceptar o cliente clicado: `onClick={() => { setEditingClient(c); reset({ name: c.name }); setIsDialogOpen(true); }}`.
  3. Modifique o trigger do `onSubmit()` do Hook Form para discernir caminhos. Se `editingClient` tiver algo gravado: Dispense a rotina de `.insert()` e chame o Update `await supabase.from('clients').update({ name: data.name }).eq('id', editingClient.id)`. 
  4. Lembre de limpar o estado de edição apontando `null` no fechamento do modal.

### 📦 2. Implementar Módulo de Materiais (`src/pages/materials/MaterialsList.tsx`)
* **Situação Atual:** A rota visual (`/materials`) está configurada junto com seus Guards no Roteador, porém a interface CRUD e sua tabela no BD precisam ser iniciadas.
* **Plano de Execução:**
  1. Primeiro no Editor SQL do **Supabase**: Crie a tabela `materials` com os atributos que as peças requisitam (ex: `id`, `name`, `sku`, `sku_code`, `status`, `base_price_cents`). Implemente a RLS blindando CRUDs para os Perfis Gestor/Comprador e `SELECT` pra Técnico.
  2. Dentro do React local: Clone e adapte o "esqueleto de modelo de página" visto com exatidão no arquivo de clientes (`ClientsList.tsx`). Apenas espelhando suas Tabelas do Radix UI para receber `materials` e adaptando as colunas. 
  3. Amarre as requisições primárias (`.from('materials').select('*')`) logo na rolagem de montagem com `useEffect`.
