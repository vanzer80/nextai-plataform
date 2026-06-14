# Sessão 72 — 14/06/2026 — Correção do SelectValue (Fallback para ID)

## Commits Realizados
- `a ser gerado` fix: select de equipamento exibe o nome corretamente ao invés do UUID

## O que foi implementado/resolvido
- Solucionado o bug em que o dropdown de "Equipamento / Ativo" na Etapa 2 de Ordem de Serviço exibia o código (UUID) ao invés do nome humano do equipamento após a seleção.
- A causa raiz estava na forma como o Radix/Base UI extrai texto quando o `SelectItem` possui uma hierarquia DOM modificada (devido às classes recém-inseridas para wrap-text).
- Passamos o texto explicitamente (explicit children) no componente `SelectValue` buscando o registro via `find()` ou validando a constante de preenchimento manual (`MANUAL_SENTINEL`), garantindo total estabilidade na exibição e paridade com o formato robusto já utilizado no Select de Cliente.

## Pendências para a próxima sessão
- Nenhuma.
