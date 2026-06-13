# Sessão 5 — 20/04/2026

### Bug 9 — PurchaseDetailModal comprimido (sm:max-w-sm sobrescrevia max-w-4xl)

**Sintoma:** Ao abrir o modal de compras como Comprador, a coluna esquerda (detalhes) ficava com ~64px de largura mostrando apenas "LOC. & SERI.", enquanto o painel de ação à direita ocupava quase todo o modal.

**Causa raiz:** O componente base `DialogContent` (Base UI) tem a classe `sm:max-w-sm` (24rem = 384px). Ao adicionar `max-w-4xl` no override, o `tailwind-merge` não resolve esse conflito porque trata `sm:max-w-sm` e `max-w-4xl` como grupos diferentes (prefixo responsivo vs sem prefixo). O CSS cascade faz a media query `sm:max-w-sm` ganhar. Com o modal em ~384px e o painel direito fixo em `w-[320px]`, sobravam apenas ~64px para a coluna esquerda.

**Correção:** Adicionar `sm:max-w-4xl` ao className do `DialogContent`. O `tailwind-merge` reconhece `sm:max-w-sm` e `sm:max-w-4xl` como mesmo grupo (mesmo prefixo + mesma propriedade) e o último ganha.

```tsx
// Antes
<DialogContent className="w-[95vw] max-w-4xl p-0 ...">
// Depois
<DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl p-0 ...">
```

**Armadilha aprendida:** Ao usar `shadcn/ui` ou `Base UI` com `cn()`, sempre verificar se o componente base tem classes responsivas (`sm:`, `md:`, `lg:`). O `tailwind-merge` não resolve conflitos entre prefixos diferentes — é necessário sobrescrever com o mesmo prefixo.

**Estrutura final do modal (que funciona):**
```
DialogContent (bg-transparent, sem layout próprio — delega para div interna)
  └── div.bg-white.rounded-2xl.flex.flex-col.max-h-[92vh]
        ├── div.shrink-0  (header fixo)
        └── div.flex-1.min-h-0.flex.flex-col.lg:flex-row
              ├── div.flex-1.overflow-y-auto  (detalhes — rola)
              └── div.w-[320px].shrink-0.flex.flex-col  (painel comprador — rola internamente)
```

---

### Bug 10 — Role do usuário muda para 'Tecnico' após alguns segundos/minutos

**Sintoma:** Usuário logado como Luis (Comprador) — após alguns momentos o perfil mudava para Técnico, alterando acesso aos módulos.

**Causa raiz real (race condition no startup):**
O `AuthContext` tem DUAS fontes que chamam `fetchUserData` no startup:
1. `initializeAuth()` via `supabase.auth.getSession()`
2. `onAuthStateChange` com evento `INITIAL_SESSION`

Ambas rodam em paralelo. A chamada (1) resolve rapidamente e define `role: Comprador` ✓. A chamada (2) inicia query com timeout de 30s — se o banco Supabase (hobby tier, hiberna) demorar, o timeout estoura e `setUser(defaultProfile)` grava `role: 'Tecnico'` sobrescrevendo o Comprador. Resultado: usuário vê a role correta por ~30s depois troca.

**Causa secundária (confirmada anteriormente mas incompleta):** `TOKEN_REFRESHED` a cada ~60min também chamava `fetchUserData` com mesmo risco.

**Correção completa (duas frentes):**

1. Ignorar `INITIAL_SESSION` no listener (já tratado por `initializeAuth`):
```typescript
if (_event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
  if (_event === 'TOKEN_REFRESHED') {
    setUser(prev => prev && currentSession?.user
      ? { ...currentSession.user, role: prev.role, full_name: prev.full_name, team_id: prev.team_id, setup_pending: prev.setup_pending }
      : prev);
  }
  return;
}
```

2. No handler de timeout de `fetchUserData`, preservar role já em memória:
```typescript
// Antes
setUser(defaultProfile); // sobrescrevia role correto com 'Tecnico'

// Depois
setUser(prev => (prev?.id === authUser.id && prev?.role) ? prev : defaultProfile);
// Se outro fetch já resolveu com o role correto → mantém; senão usa fallback
```

**Arquivo:** `src/contexts/AuthContext.tsx`

**Armadilha:** Supabase dispara tanto `INITIAL_SESSION` no `onAuthStateChange` quanto precisa de `getSession()` para inicialização. Usar os dois em paralelo cria race condition se o DB for lento. Nunca chamar `fetchUserData` para `INITIAL_SESSION` no listener quando `initializeAuth` já o trata.

**Verificado:** ✅ Testado pelo usuário — role do Comprador mantido corretamente após vários minutos sem troca.
