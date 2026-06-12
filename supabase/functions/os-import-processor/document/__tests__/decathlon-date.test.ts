import { describe, expect, it, vi } from "vitest";
import { decathlonChamadoParser } from "../parsers/decathlon-chamado.ts";

// A cadeia de IA é mockada simulando o pior caso: o provider lê a data ambígua
// como D/M (errado para o locale EN-US da Decathlon) com a confiança fixa 0.78.
vi.mock("../ai-provider-chain.ts", () => ({
  extractViaAiChain: vi.fn(async () => ({
    provider: "gemini" as const,
    fields: {
      service_date: { value: "2026-08-04", confidence: 0.78, source: "ai" as const },
    },
  })),
}));

import { processDocument } from "../pipeline.ts";

// Texto sintético no layout do chamado Decathlon (duas colunas intercaladas)
function sampleChamado(dateStr: string): string {
  return [
    "Detalhes do Chamado",
    "Chamado Nº 673261",
    "IGUASPORT LTDA",
    "Criado em",
    `${dateStr} 2:31 PM`,
    "Tipo de Serviço",
    "Manutenção Corretiva",
    "Fornecedor",
    "Técnico",
    "MOPAR ENGENHARIA",
    "João da Silva",
    "Local: Loja Porto Alegre",
    "Prioridade: alta",
    "Observações de criação",
    "Porta automática não abre",
    "Observações de conclusão",
    "Trocado sensor e testado",
    "Imagens de conclusão",
    "Resolução da Avaria",
    "Sensor substituído",
  ].join("\n");
}

describe("decathlonChamadoParser — datas EN-US (M/D/YYYY)", () => {
  it("detecta o template do chamado", () => {
    expect(decathlonChamadoParser.detect(sampleChamado("4/8/2026"))).toBe(true);
  });

  it("data ambígua usa o locale do template (M/D) com confiança reduzida", () => {
    // Regressão do chamado 673261: "4/8/2026" foi lido como 4 de agosto (D/M)
    const fields = decathlonChamadoParser.parse(sampleChamado("4/8/2026"));
    expect(fields.service_date.value).toBe("2026-04-08");
    expect(fields.service_date.value).not.toBe("2026-08-04");
    expect(fields.service_date.confidence).toBeLessThan(0.7);
  });

  it("dia > 12 na segunda posição é M/D inequívoco com confiança alta", () => {
    const fields = decathlonChamadoParser.parse(sampleChamado("4/28/2026"));
    expect(fields.service_date.value).toBe("2026-04-28");
    expect(fields.service_date.confidence).toBe(0.97);
  });

  it("dia > 12 na primeira posição é D/M inequívoco com confiança alta", () => {
    const fields = decathlonChamadoParser.parse(sampleChamado("28/4/2026"));
    expect(fields.service_date.value).toBe("2026-04-28");
    expect(fields.service_date.confidence).toBe(0.97);
  });

  it("ambos os componentes > 12 é data inválida", () => {
    const fields = decathlonChamadoParser.parse(sampleChamado("13/13/2026"));
    expect(fields.service_date.value).toBeNull();
    expect(fields.service_date.confidence).toBe(0);
  });

  it("dia inexistente no mês é data inválida", () => {
    const fields = decathlonChamadoParser.parse(sampleChamado("2/30/2026"));
    expect(fields.service_date.value).toBeNull();
    expect(fields.service_date.confidence).toBe(0);
  });
});

describe("processDocument — data ambígua força revisão e resiste ao merge da IA", () => {
  const env = { GEMINI_API_KEY_1: "test-key" };

  it("mantém a data do template no merge e marca requires_review", async () => {
    const result = await processDocument("", env, sampleChamado("4/8/2026"));

    // A IA mockada devolveu 2026-08-04 com 0.78 — o template deve prevalecer
    expect(result.fields.service_date.value).toBe("2026-04-08");
    expect(result.fields.service_date.confidence).toBeLessThan(0.7);
    expect(result.requires_review).toBe(true);
    expect(result.method).toBe("hybrid");
    expect(result.template_id).toBe("decathlon-chamado");
  });

  it("data inequívoca vence a IA pela confiança e não força revisão", async () => {
    const result = await processDocument("", env, sampleChamado("4/28/2026"));

    expect(result.fields.service_date.value).toBe("2026-04-28");
    expect(result.fields.service_date.confidence).toBe(0.97);
    expect(result.requires_review).toBe(false);
  });
});
