import { describe, it, expect } from "vitest";
import {
  debtSchedule,
  debtBalance,
  netWorth,
  statementDueDate,
  cardSummary,
  type Debt,
  type Ledger,
} from "./index";
const id = "00000000-0000-4000-8000-000000000001";
const debt: Debt = {
  id,
  accountId: id,
  categoryId: id,
  name: "Préstamo",
  principalMinor: "100000",
  receivedMinor: "100000",
  chargesMinor: "0",
  monthlyRate: "2",
  system: "french",
  count: 12,
  disbursementDate: "2026-01-01",
  firstDate: "2026-02-01",
  active: true,
};
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
describe("deudas y tarjetas", () => {
  it.each(["french", "german", "american"] as const)(
    "amortiza todo el capital en sistema %s",
    (system) => {
      const schedule = debtSchedule({ ...debt, system });
      expect(
        schedule.reduce((sum, row) => sum + BigInt(row.principalMinor), 0n),
      ).toBe(100000n);
      expect(schedule.at(-1)!.balanceMinor).toBe("0");
    },
  );
  it("maneja tasa cero y centavos residuales", () => {
    const schedule = debtSchedule({
      ...debt,
      monthlyRate: "0",
      principalMinor: "10001",
      count: 3,
    });
    expect(schedule.map((row) => row.totalMinor)).toEqual([
      "3334",
      "3334",
      "3333",
    ]);
  });
  it("un pago extraordinario reduce intereses sin alterar cuotas pasadas", () => {
    const base = debtSchedule(debt),
      withExtra = debtSchedule({
        ...debt,
        extras: [{ id, date: "2026-03-15", amountMinor: "20000" }],
      });
    expect(withExtra.slice(0, 2)).toEqual(base.slice(0, 2));
    expect(
      withExtra.reduce((s, r) => s + BigInt(r.interestMinor), 0n),
    ).toBeLessThan(base.reduce((s, r) => s + BigInt(r.interestMinor), 0n));
    expect(
      withExtra.reduce((s, r) => s + BigInt(r.principalMinor), 0n) + 20000n,
    ).toBe(100000n);
  });
  it("capital pendiente y patrimonio no confunden deuda con cuota", () => {
    expect(debtBalance(debt, ledger, "2026-01-09")).toBe("100000");
    expect(netWorth(ledger, [debt], "ARS", "2026-01-09")).toBe("0");
  });
  it("el cierre determina vencimientos que cruzan el año", () => {
    expect(statementDueDate("2026-12-26", 25, 10)).toBe("2027-02-10");
    expect(statementDueDate("2026-12-25", 25, 10)).toBe("2027-01-10");
    expect(statementDueDate("2026-02-20", 25, 31)).toBe("2026-02-28");
  });
  it("un pago de tarjeta reduce deuda sin registrar otra vez el gasto", () => {
    const credit = {
      ...ledger.accounts[0]!,
      id: "00000000-0000-4000-8000-000000000002",
      kind: "credit" as const,
      openingMinor: "-10000",
      liquid: false,
    };
    const state = {
      accounts: [...ledger.accounts, credit],
      transactions: [
        {
          id,
          accountId: credit.id,
          type: "transferIn" as const,
          amountMinor: "3000",
          date: "2026-01-09",
          category: "Otros",
          description: "Pago",
        },
      ],
    };
    expect(
      cardSummary(
        state,
        { recurrences: [], installments: [] },
        {
          accountId: credit.id,
          fundingAccountId: id,
          limitMinor: "50000",
          closingDay: 25,
          dueDay: 10,
        },
        "2026-01-09",
      ).consumed,
    ).toBe("7000");
  });
});
