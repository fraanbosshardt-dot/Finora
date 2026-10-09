import { describe, expect, it } from "vitest";
import {
  accountBalance,
  formatMoney,
  ledgerSchema,
  parseMoney,
  summarize,
  type Ledger,
} from "./index";
const account = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Banco",
  currency: "ARS" as const,
  openingMinor: "100000",
  openingDate: "2026-10-01",
};
const ledger: Ledger = {
  accounts: [
    account,
    {
      ...account,
      id: "00000000-0000-4000-8000-000000000002",
      currency: "USD",
      openingMinor: "999999",
    },
  ],
  transactions: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      accountId: account.id,
      type: "income",
      amountMinor: "20000",
      description: "Ingreso",
      category: "Otros",
      date: "2026-10-02",
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      accountId: account.id,
      type: "expense",
      amountMinor: "101",
      description: "Gasto",
      category: "Otros",
      date: "2026-10-03",
    },
  ],
};
describe("motor monetario", () => {
  it("calcula centavos exactamente y acepta coma decimal", () => {
    expect(parseMoney("0,29")).toBe("29");
    expect(parseMoney("9999999999999999.99")).toBe("999999999999999999");
  });
  it("rechaza importes ambiguos, negativos o con más decimales", () => {
    for (const value of ["1.000,20", "-10", "1.001", "NaN", ""])
      expect(() => parseMoney(value)).toThrow();
  });
  it("excluye fechas futuras y conserva el saldo inicial", () => {
    expect(accountBalance(account, ledger.transactions, "2026-10-02")).toBe(
      "120000",
    );
    expect(accountBalance(account, ledger.transactions, "2026-09-30")).toBe(
      "0",
    );
  });
  it("separa monedas y flujo de saldo", () => {
    expect(summarize(ledger, "ARS", "2026-10-09")).toEqual({
      balance: "119899",
      income: "20000",
      expense: "101",
      flow: "19899",
    });
  });
  it("formatea valores enormes sin perder precisión", () => {
    expect(formatMoney("900719925474099399", "ARS")).toBe(
      "$ 9.007.199.254.740.993,99",
    );
  });
  it("rechaza referencias ajenas, fechas inválidas y ids duplicados", () => {
    expect(ledgerSchema.safeParse(ledger).success).toBe(true);
    expect(ledgerSchema.safeParse({ ...ledger, accounts: [] }).success).toBe(
      false,
    );
    expect(
      ledgerSchema.safeParse({ ...ledger, accounts: [account, account] })
        .success,
    ).toBe(false);
    expect(
      ledgerSchema.safeParse({
        ...ledger,
        transactions: [{ ...ledger.transactions[0], date: "2026-02-30" }],
      }).success,
    ).toBe(false);
  });
});
