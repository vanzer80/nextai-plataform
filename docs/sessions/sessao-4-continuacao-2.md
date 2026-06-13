# Sessão 4 — continuação 2

### Feature — Edição de solicitação pelo técnico solicitante

**Arquivos alterados:**
- `src/pages/materials/NewMaterialRequest.tsx` — modo duplo (criar / editar)
- `src/pages/materials/MaterialsList.tsx` — botão Editar nos cards
- `src/App.tsx` — nova rota `/materials/:id/edit`

**Comportamento:**
- Botão **Editar** (ícone lápis) aparece somente em cards com status `Pendente`
- Clicar navega para `/materials/:id/edit`
- Form carrega os dados existentes do banco e popula todos os campos
- Foto existente é mantida se o usuário não selecionar uma nova ("Foto atual mantida")
- Ao salvar: `supabase.update()` + notificação via `notify_compradores` RPC
- Comprador recebe: atualização em tempo real no painel (via `postgres_changes`) + sino com mensagem "Solicitação editada"

**RLS:** policy `"Users can update their own requests"` (`tech_id = auth.uid()`) já existia — nenhuma migration necessária

**Restrição de negócio:** edição bloqueada para status `Em Análise`, `Comprado`, `Entregue`, `Cancelado` — o Comprador já está processando
