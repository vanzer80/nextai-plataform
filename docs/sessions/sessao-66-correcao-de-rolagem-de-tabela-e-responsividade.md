# Sessão 66 — 13/06/2026 — Correção de Rolagem de Tabela e Responsividade

**Repositório:** `nextai-plataform` (portal)
**Commit:** `76ff605`

### Entregas

#### Correção de Layout e Rolagem das Listas/Tabelas
- **Equipamentos (`EquipmentManagement.tsx`)**:
  - Remoção completa de classes de restrição de altura (`h-full` e `min-h-full`) no contêiner principal da página. Isso garante que a altura seja computada naturalmente pelo conteúdo da tabela, permitindo que a barra de rolagem vertical nativa do layout (`AppLayout.tsx`) seja ativada corretamente no navegador.
  - Adição de um contêiner envolvente com `overflow-x-auto` no elemento `<Table>` para permitir rolagem horizontal em resoluções menores ou dispositivos móveis.
- **Clientes (`ClientsList.tsx`)**, **Suprimentos (`MaterialsList.tsx`)** e **Dashboard (`Dashboard.tsx`)**:
  - Remoção da classe de altura `h-full` e `min-h-full` para permitir o crescimento do layout e rolagem natural nas respectivas telas.
