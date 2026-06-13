# Sessão 9 — 20/04/2026 — Planejamento: IA Foto-First (Fase 5.5)

### O que foi discutido

**Ideia proposta pelo usuário:** inverter o fluxo de entrada dos formulários — em vez de o usuário abrir o formulário e preencher campos, a primeira tela seria de captura de imagem (câmera, galeria ou arquivo, até 4 fotos). A IA analisa as imagens e devolve o formulário pré-preenchido. O usuário só valida e completa o que a IA não conseguiu extrair.

**Módulos contemplados:**
- **Reembolsos:** foto da NF/recibo → IA extrai categoria, valor, data, favorecido, CNPJ, descrição
- **Compras:** foto do produto, etiqueta ou ficha técnica → IA extrai nome, especificação, quantidade, tipo
- **Entrada por voz:** microfone → transcrição → Gemini interpreta → preenche formulário

### Viabilidade confirmada

| Ponto | Status |
|---|---|
| Gemini suporta múltiplas imagens por request | ✅ Nativo |
| Compressão de imagens client-side | ✅ canvas API, sem dependência |
| Voz via Web Speech API | ✅ Chrome/Android/Edge/Safari (sem Firefox) |
| Componente `CaptureStep` reutilizável entre módulos | ✅ Design confirmado |

### Plano documentado

- `05 - Roadmap de Implementação.md` — Fase 5.5 adicionada com 5 etapas de execução
- `09 - Visão de Produto e Roadmap NextIA.md` — Fase 5.5 inserida no roadmap estratégico
- `03 - Integrações (Gemini AI e Supabase).md` — seção de IA atualizada com nota da evolução planejada

### Próximo passo

Implementar Sub-fase A (Reembolsos Foto-First) — começar pelo componente `CaptureStep` e pela adaptação do `aiService.ts` para múltiplas imagens.
