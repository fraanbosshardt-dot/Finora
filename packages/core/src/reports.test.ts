import { describe, it, expect } from "vitest";
import {
  financialReport,
  reportFilterSchema,
  transactionsCsv,
  parseCsv,
  type Ledger,
  type Transaction,
} from "./index";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  c = "00000000-0000-4000-8000-000000000003";
const tx = (
  id: string,
  type: Transaction["type"],
  amountMinor: string,
  date = "2026-01-31",
  accountId = a,
): Transaction => ({
  id,
  accountId,
  type,
  amountMinor,
  date,
  categoryId: c,
  category: "Alimentos",
  description: "Registro",
});
const ledger: Ledger = {
  accounts: [
    {
      id: a,
      name: "Banco",
      currency: "ARS",
      openingMinor: "0",
      openingDate: "2025-01-01",
      active: false,
    },
    {
      id: b,
      name: "USD",
      currency: "USD",
      openingMinor: "0",
      openingDate: "2025-01-01",
    },
  ],
  transactions: [
    tx("1", "income", "10001"),
    tx("2", "expense", "3334"),
    tx("3", "transferOut", "5000"),
    tx("4", "adjustmentIn", "30000"),
    tx("5", "expense", "100", "2026-02-01"),
    tx("6", "expense", "9000", "2026-01-31", b),
  ],
};
const filter = {
  currency: "ARS" as const,
  from: "2026-01-01",
  to: "2026-03-31",
};
describe("informes de registros", () => {
  it("separa monedas, excluye transferencias y ajustes de totales y conserva cuentas inactivas", () => {
    const report = financialReport(ledger, filter);
    expect(report.incomeMinor).toBe("10001");
    expect(report.expenseMinor).toBe("3434");
    expect(report.netMinor).toBe("6567");
    expect(report.count).toBe(3);
    expect(report.months.map((m) => m.expenseMinor)).toEqual([
      "3334",
      "100",
      "0",
    ]);
  });
  it("limita fechas inclusivas, cuentas y categorías sin mezclar resultados", () => {
    expect(
      financialReport(ledger, {
        ...filter,
        from: "2026-02-01",
        to: "2026-02-01",
      }).expenseMinor,
    ).toBe("100");
    expect(financialReport(ledger, { ...filter, accountId: b }).count).toBe(0);
    expect(financialReport(ledger, { ...filter, categoryId: b }).count).toBe(0);
  });
  it("suma importes mayores al límite seguro de number y ordena por gasto", () => {
    const report = financialReport(
      {
        ...ledger,
        transactions: [
          tx("7", "expense", "900719925474099300"),
          { ...tx("8", "expense", "100"), categoryId: b, category: "Otra" },
        ],
      },
      filter,
    );
    expect(report.expenseMinor).toBe("900719925474099400");
    expect(report.categories[0]!.amountMinor).toBe("900719925474099300");
  });
  it("rechaza intervalos invertidos, fechas imposibles y horizontes mayores a 36 meses", () => {
    expect(
      reportFilterSchema.safeParse({
        ...filter,
        from: "2026-03-01",
        to: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(
      reportFilterSchema.safeParse({ ...filter, from: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      reportFilterSchema.safeParse({ ...filter, to: "2029-01-01" }).success,
    ).toBe(false);
    expect(
      financialReport(ledger, { ...filter, to: "2028-12-31" }).months,
    ).toHaveLength(36);
  });
  it("exporta centavos exactos, comillas y saltos de línea sin fórmulas ejecutables", () => {
    const csv = transactionsCsv(ledger, [
      {
        ...tx("9", "expense", "900719925474099301"),
        description: ' =HYPERLINK("x")\nsegunda línea',
      },
    ]);
    const parsed = parseCsv(csv);
    expect(parsed.rows[0]![1]).toBe('\' =HYPERLINK("x")\nsegunda línea');
    expect(parsed.rows[0]![2]).toBe("9007199254740993,01");
    expect(parsed.rows[0]![3]).toBe("gasto");
    expect(parsed.rows[0]![6]).toBe("ARS");
  });
});
