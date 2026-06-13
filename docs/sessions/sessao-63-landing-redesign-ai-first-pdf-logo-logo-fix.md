# Sessão 63 — 31/05/2026 — Landing redesign AI-first + PDF logo + Logo fix

**Repositórios:** `nextai-landing` (landing) · `nextai-plataform` (portal)
**Commits landing:** `b6028dc` · `912f0a2` · `39ed8c0` · `2f6817a` · `61a2651` · `349389f`
**Commits portal:** `38c79d5`

---

### Landing Page NextAI — Redesign (3 rodadas)

#### Rodada 1 — Base premium

- `index.css`: design tokens, reveal on-scroll, float animations, gradient text
- Hero: eyebrow pill badge com pulse, headline com gradient primary→ai, multi-glow background
- HeroMock: painel multi-KPI com perspectiva 3D, floating AI card + approval notification
- Pillars: bento layout (1 card featured col-span-2 + 2 menores), accent por pilar
- ProvaRapida: substituída por strip com sector chips + 3 stats com gradient text
- AiStories: primeiro story featured (col-span-2)
- FinalCta: fundo escuro com glow azul em vez de azul sólido
- Flow: accent por step (primary/ai/success)

#### Rodada 2 — AI-first (AiOrb + scan + cenas visuais)

- **AiOrb 3D** (Hero): SVG com 3 anéis orbitais animados (orb-spin 16s / orb-spin-r 22s / lento 32s), ponto luminoso em cada anel via SVG filter, core com radial gradient + orb-drift, 8 partículas com particle-up staggerado. Desktop only (`hidden lg:flex`), posicionada atrás do dashboard (z-0).
- **HeroMock scan**: linha de scan (ciano, scan-sweep 4.5s) varre o painel verticalmente; sonar rings no KPI "SLA em risco" (ring-expand com border, não background); pulse dot no valor 3.
- **AiStories visuais**:
  - `GestorVisual`: mini dashboard com 3 KPIs + dots de status de equipe (pulse animado)
  - `ReceiptVisual`: simulação de recibo com scan-sweep + campos extraídos + AiTag
  - `VoiceVisual`: 16 barras de waveform (wave-bar, items-end, height variável) → seta → campos estruturados + AiTag

#### Rodada 3 — Auditoria profissional (7 fases)

**Fase 1 — Bugs críticos:**
- `VoiceVisual`: wave-bar + transform inline conflitam → usar `height%` + `items-end`, sem transform inline
- `ring-expand`: era retângulo sólido → corrigido para sonar rings com `border rounded-full`
- AiOrb SVG `<g>`: adicionado `transformBox: 'view-box'` para cross-browser (Firefox/Safari)
- AiOrb filter IDs: `useId()` do React para IDs únicos no DOM
- Floating cards HeroMock: `hidden sm:block` para evitar horizontal scroll em mobile

**Fase 2 — Mobile:**
- Headline: `1.95rem → 2.55rem → 3.75rem` progressivo
- `overflow-x-clip lg:overflow-visible` na coluna direita do hero
- Sectors: hover com `scale-105` no ícone + `p-5 sm:p-7`
- Integration: diagrama SVG oculto em mobile (`hidden md:block`)
- AiStories: `minHeight` em vez de height fixo no ReceiptVisual

**Fase 3 — Performance:**
- `will-change` em todas as animation classes (GPU compositing)
- Dead code removido: `.glass`, `.glow-primary`, `.glow-ai`, `data-appear`, `shimmer-move`
- `transform-origin: bottom` no `wave-bar`

**Fase 4 — UX:**
- **Navbar**: botão "Demo grátis" em `sm:hidden` + barra de progresso de scroll (gradient primary→ai, 2px)
- **MobileCtaBar**: novo componente sticky footer mobile, aparece após 420px scroll, `env(safe-area-inset-bottom)` para iOS
- FAQ: `role="region"` + `aria-labelledby`
- Footer: `hover:underline` nos links

**Fase 5 — SEO:**
- OG image → `/og-image.png` (PNG, não SVG)
- JSON-LD `SoftwareApplication` schema markup
- `og:image:width/height`, `og:url`, `twitter:title/description`

---

### portal-mopar — Logo do tenant em todos os PDFs

**Problema:** `gerarPdfOrcamento` e `gerarHolerite` não tinham logo do tenant — inconsistência com OS e PO que já tinham.

**`gerarPdfOrcamento.ts`:**
- Função agora `async` (`Promise<void>`)
- `PdfOrcamentoOptions`: novo campo `tenantLogoUrl?: string | null`
- Cabeçalho azul `#1e3a5f` idêntico ao padrão da OS e PO
- Logo via `urlToDataUrl + detectImageFormat` (mesmo padrão da OS)
- `textX` dinâmico: `marginL + 22` quando logo presente
- `didDrawPage`: cabeçalho repetido em páginas adicionais (autoTable hook)
- Rodapé com numeração multi-página para páginas intermediárias

**`gerarHolerite.ts`:**
- Função agora `async` (`Promise<void>`)
- Novo parâmetro: `companyLogoUrl?: string | null`
- Cabeçalho azul DP `#1e40af` (diferencia visualmente do módulo OS)
- Competência exibida no canto direito do cabeçalho
- Rodapé discreto com identificação do documento

**Call sites:**
- `OrcamentoDetail.tsx`: `void gerarPdfOrcamento(..., { tenantLogoUrl: tenant?.logoUrl, ... })`
- `PayrollDetail.tsx`: `void gerarHolerite(period, entry, name, tenant?.logoUrl)`

---

### Landing — Logo NextAI duplicado (fix)

**Problema:** logo horizontal = símbolo-N + texto "Next" = visual "NNextAI".

**Fix (NextAILogo.tsx):**
- `tspan` alterado de `"Next"` para `"ext"` — símbolo geométrico É o N
- `x` ajustado de `150` para `133` (gap 6u após símbolo, mais integrado)
- `viewBox`: `640 → 572 → 555` (remove advance do N + delta do shift)
- Fórmula: `h * 555/200`
- Altura Navbar/Footer: `24 → 28px`

---

### Documentação atualizada

- `nextai-landing/CLAUDE.md`: seção Logo (estrutura SVG, regra "ext" vs "Next"), sistema de animações, MobileCtaBar, OG image, armadilhas 31–37
- Memória Claude: `project_portalmopar.md`, `pattern_pdf_tenant_logo.md`, `pattern_nextai_logo.md`, `MEMORY.md`
