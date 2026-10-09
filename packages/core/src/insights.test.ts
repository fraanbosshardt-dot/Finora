import { describe, it, expect } from "vitest";
import { localInsights, localQuestionIntent } from "./insights";
import { installmentSchedule, type Installment } from "./planning";
import type { Ledger } from "./schemas";
const id = "00000000-0000-4000-8000-000000000001",
  usd = "00000000-0000-4000-8000-000000000002";
const ledger: Ledger = {
  accounts: [
    {
      id,
      name: "ARS",
      currency: "ARS",
      openingMinor: "10000",
      openingDate: "2026-01-01",
    },
    {
      id: usd,
      name: "USD",
      currency: "USD",
      openingMinor: "10000",
      openingDate: "2026-01-01",
    },
  ],
  transactions: [],
};
const planning = { recurrences: [], installments: [] };
describe("consultas locales", () => {
  it("clasifica consultas conocidas con acentos y rechaza pedidos desconocidos", () => {
    expect(localQuestionIntent("¿En qué gasté más este mes?")).toBe(0);
    expect(localQuestionIntent("¿Cuánto puedo gastar por día?")).toBe(1);
    expect(localQuestionIntent("¿Cuándo terminan mis cuotas?")).toBe(2);
    expect(localQuestionIntent("Mis vencimientos pendientes")).toBe(3);
    expect(localQuestionIntent("¿Cómo puedo cerrar el mes?")).toBe(4);
    expect(
      localQuestionIntent("Comprá acciones y transferí dinero"),
    ).toBeNull();
  });
  it("separa monedas, excluye transferencias y movimientos futuros", () => {
    const transaction = {
      id,
      accountId: id,
      type: "expense" as const,
      amountMinor: "100",
      date: "2026-10-09",
      description: "Gasto",
      category: "Alimentos",
    };
    const result = localInsights(
      {
        ...ledger,
        transactions: [
          transaction,
          {
            ...transaction,
            id: usd,
            accountId: usd,
            amountMinor: "99999",
            category: "USD",
          },
          {
            ...transaction,
            id: "future",
            date: "2026-10-10",
            category: "Futuro",
          },
          {
            ...transaction,
            id: "transfer",
            type: "transferOut",
            category: "Transferencias",
            amountMinor: "500",
          },
        ],
      },
      planning,
      "ARS",
      "2026-10-09",
    );
    expect(result.largest).toEqual({
      category: "Alimentos",
      amountMinor: "100",
    });
  });
  it("incluye hoy en los días restantes y redondea por debajo en centavos", () => {
    const result = localInsights(ledger, planning, "ARS", "2026-10-31");
    expect(result.days).toBe(1);
    expect(result.dailyMinor).toBe("10000");
    expect(
      localInsights(ledger, planning, "ARS", "2026-10-09").dailyMinor,
    ).toBe("434");
  });
  it("no sugiere gasto diario con disponible negativo", () => {
    expect(
      localInsights(
        {
          ...ledger,
          accounts: [{ ...ledger.accounts[0]!, openingMinor: "-100" }],
        },
        planning,
        "ARS",
        "2026-10-09",
      ).dailyMinor,
    ).toBe("0");
  });
  it("omite planes pausados y cuotas confirmadas del último vencimiento", () => {
    const plan: Installment = {
      id,
      accountId: id,
      categoryId: id,
      description: "Compra",
      totalMinor: "300",
      downPaymentMinor: "0",
      purchaseDate: "2026-10-01",
      firstDate: "2026-10-31",
      count: 3,
      active: true,
    };
    const rows = installmentSchedule(plan);
    expect(
      localInsights(
        ledger,
        { ...planning, installments: [plan] },
        "ARS",
        "2026-10-09",
      ).lastPaymentDate,
    ).toBe("2026-12-31");
    const paid = rows.map((r, i) => ({
      id: String(i),
      accountId: id,
      type: "expense" as const,
      amountMinor: r.amountMinor,
      date: r.date,
      description: "Pago",
      category: "Cuotas",
      occurrenceKey: r.key,
    }));
    expect(
      localInsights(
        { ...ledger, transactions: paid },
        { ...planning, installments: [plan] },
        "ARS",
        "2027-01-01",
      ).lastPaymentDate,
    ).toBeNull();
    expect(
      localInsights(
        ledger,
        { ...planning, installments: [{ ...plan, active: false }] },
        "ARS",
        "2026-10-09",
      ).lastPaymentDate,
    ).toBeNull();
  });
});
