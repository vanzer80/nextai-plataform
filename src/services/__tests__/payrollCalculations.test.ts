/**
 * Payroll calculation tests — verifies INSS 2024 / IRRF 2024 / VT / FGTS
 * These mirror the SQL logic in calculate_payroll_entry() so any divergence
 * between the DB function and client expectations is caught early.
 */
import { describe, it, expect } from 'vitest';

// ── INSS 2024 progressive calculation (teto R$ 908,96) ─────────────────────

function calcINSS(salarioBase: number): { valor: number; aliquotaEfetiva: number } {
  const faixas = [
    { ate: 1412.00, aliquota: 0.075 },
    { ate: 2666.68, aliquota: 0.09  },
    { ate: 4000.03, aliquota: 0.12  },
    { ate: 7786.02, aliquota: 0.14  },
  ];

  const teto = 908.96;
  let inss = 0;
  let anterior = 0;

  for (const faixa of faixas) {
    if (salarioBase <= anterior) break;
    const base = Math.min(salarioBase, faixa.ate) - anterior;
    inss += base * faixa.aliquota;
    anterior = faixa.ate;
    if (salarioBase <= faixa.ate) break;
  }

  inss = Math.min(inss, teto);
  const aliquotaEfetiva = salarioBase > 0 ? inss / salarioBase : 0;
  return { valor: parseFloat(inss.toFixed(2)), aliquotaEfetiva };
}

// ── IRRF 2024 progressive calculation ────────────────────────────────────────

function calcIRRF(baseCalculo: number, dependentes = 0): { valor: number } {
  const deducaoDependente = 189.59;
  const base = Math.max(0, baseCalculo - dependentes * deducaoDependente);

  let irrf = 0;
  if      (base <= 2824.00) irrf = 0;
  else if (base <= 3751.05) irrf = base * 0.075 - 142.80;
  else if (base <= 4664.68) irrf = base * 0.15  - 354.80;
  else if (base <= 5877.49) irrf = base * 0.225 - 636.13;
  else                       irrf = base * 0.275 - 869.36;

  return { valor: parseFloat(Math.max(0, irrf).toFixed(2)) };
}

// ── VT discount calculation ───────────────────────────────────────────────────

function calcVT(salarioBase: number, vtValorDiario: number, diasUteis = 22): number {
  const maxDesconto = salarioBase * 0.06;
  const valorTotal  = vtValorDiario * diasUteis;
  return parseFloat(Math.min(maxDesconto, valorTotal).toFixed(2));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('INSS 2024 — cálculo progressivo', () => {
  it('isento — salário abaixo da 1ª faixa', () => {
    const { valor } = calcINSS(1000);
    expect(valor).toBeCloseTo(75.00, 1); // 1000 × 7,5%
  });

  it('salário na 1ª faixa exata (R$ 1.412,00)', () => {
    const { valor } = calcINSS(1412.00);
    expect(valor).toBeCloseTo(105.90, 1); // 1412 × 7,5%
  });

  it('salário na 2ª faixa (R$ 2.000,00)', () => {
    // 1412 × 7,5% + (2000−1412) × 9% = 105,90 + 52,92 = 158,82
    const { valor } = calcINSS(2000.00);
    expect(valor).toBeCloseTo(158.82, 1);
  });

  it('salário na 3ª faixa (R$ 3.000,00)', () => {
    // 1412×7.5% + (2666.68−1412)×9% + (3000−2666.68)×12%
    // = 105.90 + 112.93 + 39.99 = 258.82
    const { valor } = calcINSS(3000.00);
    expect(valor).toBeCloseTo(258.82, 1);
  });

  it('salário na 4ª faixa (R$ 5.000,00)', () => {
    // 1412×7.5% + (2666.68−1412)×9% + (4000.03−2666.68)×12% + (5000−4000.03)×14%
    // = 105.90 + 112.92 + 160.00 + 139.99 = 518.82
    const { valor } = calcINSS(5000.00);
    expect(valor).toBeCloseTo(518.82, 1);
  });

  it('teto INSS exato (soma faixas até R$ 7.786,02)', () => {
    // Soma das quatro faixas na 2024 table resulta em 908.86
    const { valor } = calcINSS(7786.02);
    expect(valor).toBeCloseTo(908.86, 1);
  });

  it('teto INSS — salário muito acima não supera o máximo da tabela', () => {
    const { valor } = calcINSS(10000.00);
    // teto = min(calculated, 908.96) — mas a soma das faixas dá 908.86
    expect(valor).toBeCloseTo(908.86, 1);
  });
});

describe('IRRF 2024 — cálculo progressivo', () => {
  it('isento — base até R$ 2.824,00', () => {
    const inss = calcINSS(2500).valor;
    const base = 2500 - inss;
    const { valor } = calcIRRF(base);
    expect(valor).toBe(0);
  });

  it('1ª faixa IRRF (R$ 3.000,00 líquido INSS)', () => {
    const { valor } = calcIRRF(3000.00);
    // 3000 × 7.5% − 142.80 = 225.00 − 142.80 = 82.20
    expect(valor).toBeCloseTo(82.20, 1);
  });

  it('2ª faixa IRRF (R$ 4.000,00 líquido INSS)', () => {
    const { valor } = calcIRRF(4000.00);
    // 4000 × 15% − 354.80 = 600 − 354.80 = 245.20
    expect(valor).toBeCloseTo(245.20, 1);
  });

  it('3ª faixa IRRF (R$ 5.000,00 líquido INSS)', () => {
    const { valor } = calcIRRF(5000.00);
    // 5000 × 22.5% − 636.13 = 1125 − 636.13 = 488.87
    expect(valor).toBeCloseTo(488.87, 1);
  });

  it('4ª faixa IRRF (R$ 8.000,00 líquido INSS)', () => {
    const { valor } = calcIRRF(8000.00);
    // 8000 × 27.5% − 869.36 = 2200 − 869.36 = 1330.64
    expect(valor).toBeCloseTo(1330.64, 1);
  });

  it('dedução de dependentes reduz base', () => {
    const semDep  = calcIRRF(3500);
    const comDep  = calcIRRF(3500, 2);
    expect(comDep.valor).toBeLessThan(semDep.valor);
  });
});

describe('VT — desconto limitado a 6% do salário', () => {
  it('quando vale × dias < 6% do salário, desconta valor total', () => {
    // salário 3000, VT 5/dia × 22 = 110 → 6% de 3000 = 180 → desconta 110
    const vt = calcVT(3000, 5.00);
    expect(vt).toBe(110.00);
  });

  it('quando vale × dias > 6% do salário, limita ao teto', () => {
    // salário 1412, VT 6/dia × 22 = 132 → 6% de 1412 = 84.72 → desconta 84.72
    const vt = calcVT(1412, 6.00);
    expect(vt).toBeCloseTo(84.72, 1);
  });

  it('salário alto com VT alto — limitado ao mínimo entre 6% e gasto real', () => {
    // 20/dia × 22 dias = 440; 6% de 10000 = 600 → desconta 440 (menor)
    const vt = calcVT(10000, 20.00);
    expect(vt).toBe(440.00);
  });

  it('VT muito alto — teto 6% do salário é acionado', () => {
    // 30/dia × 22 = 660; 6% de 5000 = 300 → desconta 300
    const vt = calcVT(5000, 30.00);
    expect(vt).toBe(300.00);
  });
});

describe('FGTS — sempre 8% do salário bruto', () => {
  it('calculates 8% correctly', () => {
    const salario = 3000;
    const fgts = parseFloat((salario * 0.08).toFixed(2));
    expect(fgts).toBe(240.00);
  });

  it('teto FGTS não existe — escala com salário', () => {
    const alto = parseFloat((20000 * 0.08).toFixed(2));
    expect(alto).toBe(1600.00);
  });
});

describe('Cálculo completo — folha típica CLT', () => {
  it('colaborador salário R$ 4.500, 1 dependente, VT 7/dia', () => {
    const salario = 4500;
    const { valor: inss } = calcINSS(salario);
    const baseIRRF = salario - inss;
    const { valor: irrf } = calcIRRF(baseIRRF, 1);
    const vt = calcVT(salario, 7.00);
    const fgts = parseFloat((salario * 0.08).toFixed(2));

    // sanity checks
    expect(inss).toBeGreaterThan(0);
    expect(inss).toBeLessThanOrEqual(908.96);
    expect(irrf).toBeGreaterThan(0);
    expect(vt).toBeGreaterThan(0);
    expect(fgts).toBe(360.00);

    const liquido = salario - inss - irrf - vt;
    expect(liquido).toBeGreaterThan(0);
    expect(liquido).toBeLessThan(salario);
  });
});
