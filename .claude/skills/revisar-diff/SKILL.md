---
description: Review do diff atual contra as armadilhas críticas do NextAI + TypeScript check
---

Revise as mudanças pendentes no NextAI sistematicamente.

## Passo 1 — Obter diff

Em `/c/dev/portal-mopar`:

- `git diff HEAD` — mudanças não commitadas
- `git diff --staged` — mudanças em stage

## Passo 2 — TypeScript check

Execute `npx tsc --noEmit`. Reporte o resultado antes de continuar.

## Passo 3 — Checklist de armadilhas críticas

Para cada item abaixo, verifique se o diff viola a regra. Marque ✅ (ok), ⚠️ (atenção) ou ❌ (violação):

1. `withTimeout` + Supabase builder → cast explícito para o tipo esperado?
2. React 19 — `key` em componente → usando `<Fragment key={id}><Comp /></Fragment>`?
3. `.single()` → substituído por `.maybeSingle()`?
4. `setState` durante render → movido para `useEffect`?
5. Storage bucket privado → usando `createSignedUrls()`, nunca `getPublicUrl()`?
6. Edge Function guard → verificando `Authorization Bearer`, não comparando `apikey`?
7. Sidebar → usando `bg-sidebar-*` / `text-sidebar-*`, nunca `bg-background` / `border-border`?
8. `DialogContent` max-width → usando `sm:max-w-*`, nunca `max-w-*` sem prefixo responsivo?
9. Zod v4 → sem `invalid_type_error`, sem `.default()` em campos com `zodResolver`?
10. `useOfflineSync` → instanciado apenas em `AppLayout`, nunca em páginas filhas?
11. Status enum `service_reports` → apenas `draft | pending_review | returned | approved | rejected`?
12. KPIs Dashboard → sem fallback numérico hardcoded (ex: `88%`, `85%`)?
13. `jsPDF` 4.x → sem `setLineDash()` — usando `setLineWidth()` + `line()`?
14. Auth race condition → role inicializado só após `AUTH_STATE_CHANGE`, nunca no `INITIAL_SESSION`?
15. Branding → nenhum texto novo usa "Portal Mopar" ou "Mopar" como nome do produto/sistema? (Mopar Engenharia é apenas um tenant/cliente)

## Passo 4 — Relatório

Apresente resumo:
- Itens ✅ aprovados
- Itens ⚠️ que merecem atenção
- Itens ❌ que violam regras do projeto (bloqueiam o commit)
