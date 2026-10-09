import { describe, it, expect } from "vitest";
import {
  matchingRule,
  ruleChanges,
  alertPreferencesSchema,
  financeAlerts,
  loanRates,
  loanAnalysis,
  simulateNewLoan,
  simulateEarlyPayment,
  convertMoney,
  valuedNetWorth,
  type Ledger,
  type Rule,
  type Debt,
} from "./index";
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const ledger: Ledger = {
  accounts: [
    {
      id,
      name: "Banco",
      currency: "ARS",
      openingMinor: "100000",
      openingDate: "2026-01-01",
    },
  ],
  transactions: [],
};
const rule: Rule = {
  id,
  name: "Pan",
  contains: "panaderia",
  type: "expense",
  categoryId: other,
  priority: 1,
  active: true,
};
const debt: Debt = {
  id,
  accountId: id,
  categoryId: other,
  name: "Préstamo",
  principalMinor: "100000",
  receivedMinor: "100000",
  monthlyRate: "2",
  system: "french",
  count: 12,
  chargesMinor: "0",
  disbursementDate: "2026-01-01",
  firstDate: "2026-02-01",
  active: true,
};
describe("automatización, simulaciones y cotizaciones manuales", () => {
  it("elige reglas activas por prioridad y contempla tildes, cuenta y tipo", () => {
    expect(
      matchingRule([rule], {
        description: "PANADERÍA del barrio",
        accountId: id,
        type: "expense",
      })?.id,
    ).toBe(id);
    expect(
      matchingRule([{ ...rule, accountId: other }], {
        description: "panaderia",
        accountId: id,
        type: "expense",
      }),
    ).toBeUndefined();
    expect(
      matchingRule([rule, { ...rule, id: other, priority: 0 }], {
        description: "panaderia",
        accountId: id,
        type: "expense",
      })?.id,
    ).toBe(other);
  });
  it("no cambia pagos vinculados ni transferencias con las reglas", () => {
    const tx = {
      id,
      accountId: id,
      categoryId: id,
      type: "expense" as const,
      category: "Otra",
      amountMinor: "100",
      date: "2026-01-01",
      description: "Panaderia",
    };
    expect(
      ruleChanges(
        {
          ...ledger,
          transactions: [
            tx,
            { ...tx, id: other, occurrenceKey: "installment:paid" },
          ],
        },
        [rule],
      ),
    ).toHaveLength(1);
  });
  it("calcula alertas sin inventar gastos y respeta preferencias", () => {
    const planning = { recurrences: [], installments: [], debts: [debt] };
    const prefs = alertPreferencesSchema.parse({});
    expect(
      financeAlerts(ledger, planning, [], [], "ARS", "2026-02-02", prefs).some(
        (a) => a.title === "Tenés un pago vencido",
      ),
    ).toBe(true);
    expect(
      financeAlerts(ledger, planning, [], [], "ARS", "2026-02-02", {
        ...prefs,
        due: false,
        negative: false,
      }),
    ).toHaveLength(0);
  });
  it("deriva TNA y TEA desde TEM sin floats monetarios", () => {
    expect(loanRates("2")).toEqual({
      monthly: "2.000000",
      nominalAnnual: "24.000000",
      effectiveAnnual: "26.824179",
    });
    expect(loanRates("24", "nominalAnnual").monthly).toBe("2.000000");
    expect(loanRates("0").effectiveAnnual).toBe("0.000000");
  });
  it("simula desembolso y compromisos sin mutar el ledger", () => {
    const result = simulateNewLoan(
      ledger,
      { recurrences: [], installments: [], debts: [] },
      debt,
      "ARS",
      "2026-01-01",
    );
    expect(result.baseline[0]!.closing).toBe("100000");
    expect(result.scenario[0]!.closing).toBe("200000");
    expect(ledger.transactions).toHaveLength(0);
    expect(BigInt(loanAnalysis(debt).interestMinor)).toBeGreaterThan(0n);
  });
  it("cancelar capital reduce intereses y rechaza cuotas vencidas sin pagar", () => {
    const planning = { recurrences: [], installments: [], debts: [debt] };
    const result = simulateEarlyPayment(
      ledger,
      planning,
      debt,
      "ARS",
      "2026-01-01",
      "100000",
    );
    expect(result.after).toHaveLength(0);
    expect(BigInt(result.interestSavedMinor)).toBeGreaterThan(0n);
    expect(() =>
      simulateEarlyPayment(ledger, planning, debt, "ARS", "2026-02-01", "1000"),
    ).toThrow(/vencidas/);
  });
  it("convierte directo e inverso con precisión y respeta fechas históricas", () => {
    const rates = [
      {
        id,
        base: "USD" as const,
        quote: "ARS" as const,
        rate: "1200.123456",
        date: "2026-01-01",
        source: "Manual",
      },
    ];
    expect(
      convertMoney("100", "USD", "ARS", rates, "2026-01-01")?.amountMinor,
    ).toBe("120012");
    expect(
      convertMoney("120012", "ARS", "USD", rates, "2026-01-01")?.amountMinor,
    ).toBe("100");
    expect(convertMoney("100", "USD", "ARS", rates, "2025-12-31")).toBeNull();
    expect(
      convertMoney("-100", "USD", "ARS", rates, "2026-01-01")?.amountMinor,
    ).toBe("-120012");
  });
  it("indica valuación parcial sin cotizaciones y no cambia importes originales", () => {
    const mixed = {
      ...ledger,
      accounts: [
        ...ledger.accounts,
        {
          id: other,
          name: "USD",
          currency: "USD" as const,
          openingMinor: "100",
          openingDate: "2026-01-01",
        },
      ],
    };
    const result = valuedNetWorth(mixed, [], "ARS", [], "2026-01-01");
    expect(result.complete).toBe(false);
    expect(result.totalMinor).toBe("100000");
    expect(mixed.accounts[1]!.openingMinor).toBe("100");
  });
});
