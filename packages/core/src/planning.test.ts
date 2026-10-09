import { describe, it, expect } from "vitest";
import {
  addMonths,
  installmentSchedule,
  recurrenceDates,
  obligations,
  project,
  financialSummary,
  categoryLibrary,
  type Ledger,
  type Recurrence,
  type Installment,
} from "./index";
const id = "00000000-0000-4000-8000-000000000001";
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
const recurrence: Recurrence = {
  id,
  accountId: id,
  categoryId: id,
  description: "Sueldo",
  amountMinor: "50000",
  type: "income",
  startDate: "2026-01-31",
  frequency: "monthly",
  interval: 1,
  active: true,
};
const plan: Installment = {
  id,
  accountId: id,
  categoryId: id,
  description: "Celular",
  totalMinor: "10001",
  downPaymentMinor: "1000",
  purchaseDate: "2026-12-01",
  count: 3,
  firstDate: "2026-12-31",
  active: true,
};
describe("planificación determinista", () => {
  it("una cuenta desactivada conserva historia pero no financia el disponible", () => {
    const inactive = {
      ...ledger,
      accounts: ledger.accounts.map((a) => ({ ...a, active: false })),
    };
    const planning = { recurrences: [], installments: [] };
    expect(
      financialSummary(inactive, planning, "ARS", "2026-01-01").liquid,
    ).toBe("0");
    expect(project(inactive, planning, "ARS", "2026-01-01")[0]!.closing).toBe(
      "0",
    );
  });
  it("un préstamo americano sin interés no crea pagos de cero", () => {
    const planning = {
      recurrences: [],
      installments: [],
      debts: [
        {
          id,
          accountId: id,
          categoryId: id,
          name: "Sin interés",
          principalMinor: "10000",
          receivedMinor: "10000",
          chargesMinor: "0",
          monthlyRate: "0",
          system: "american" as const,
          count: 3,
          disbursementDate: "2026-01-01",
          firstDate: "2026-01-01",
          active: true,
        },
      ],
    };
    const pending = obligations(ledger, planning, "2026-01-01", "2026-12-31");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.amountMinor).toBe("10000");
    expect(pending[0]!.date).toBe("2026-03-01");
  });
  it("conserva el día original al cruzar febrero", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(recurrenceDates(recurrence, "2026-01-01", "2026-03-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
  });
  it("una recurrencia desactivada no proyecta ingresos", () => {
    expect(
      recurrenceDates(
        { ...recurrence, active: false },
        "2026-01-01",
        "2027-01-01",
      ),
    ).toEqual([]);
  });
  it("reparte centavos sin pérdida y cruza el año", () => {
    const schedule = installmentSchedule(plan);
    expect(schedule.map((e) => e.date)).toEqual([
      "2026-12-01",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
    ]);
    expect(schedule.reduce((sum, e) => sum + BigInt(e.amountMinor), 0n)).toBe(
      10001n,
    );
  });
  it("no vuelve a proyectar una cuota ya registrada", () => {
    const key = installmentSchedule(plan)[1]!.key;
    const paid = {
      ...ledger,
      transactions: [
        {
          id,
          accountId: id,
          type: "expense" as const,
          amountMinor: "3001",
          description: "Cuota",
          category: "Otros",
          date: "2026-12-31",
          occurrenceKey: key,
        },
      ],
    };
    expect(
      obligations(
        paid,
        { recurrences: [], installments: [plan] },
        "2026-12-01",
        "2027-03-01",
      ).some((e) => e.key === key),
    ).toBe(false);
  });
  it("incluye vencidos sin asumir ingresos omitidos", () => {
    const bill = {
      ...recurrence,
      type: "expense" as const,
      startDate: "2026-10-01",
      amountMinor: "30000",
    };
    const data = financialSummary(
      ledger,
      { recurrences: [bill], installments: [] },
      "ARS",
      "2026-10-09",
    );
    expect(data).toEqual({
      liquid: "100000",
      committed: "30000",
      available: "70000",
      closing: "70000",
    });
  });
  it("proyecta solamente reglas registradas y detecta meses negativos", () => {
    const result = project(
      ledger,
      {
        recurrences: [{ ...recurrence, type: "expense", amountMinor: "60000" }],
        installments: [],
      },
      "ARS",
      "2026-01-01",
      3,
    );
    expect(result.map((m) => m.closing)).toEqual(["40000", "-20000", "-80000"]);
  });
  it("transferir no genera ingresos o gastos", () => {
    const transfer = {
      ...ledger,
      transactions: [
        {
          id,
          accountId: id,
          type: "transferOut" as const,
          amountMinor: "100",
          description: "Transferencia",
          category: "Otros",
          date: "2026-01-02",
        },
      ],
    };
    expect(
      financialSummary(
        transfer,
        { recurrences: [], installments: [] },
        "ARS",
        "2026-01-09",
      ).liquid,
    ).toBe("99900");
  });
  it("la biblioteca ofrece al menos 200 categorías diferentes", () => {
    expect(categoryLibrary.length).toBeGreaterThanOrEqual(200);
    expect(new Set(categoryLibrary.map((c) => c.name)).size).toBe(
      categoryLibrary.length,
    );
  });
});
