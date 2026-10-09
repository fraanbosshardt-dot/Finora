import { z } from "zod";
import {
  dateSchema,
  type Ledger,
  type Currency,
  type Transaction,
} from "./schemas";

export const reportFilterSchema = z
  .object({
    currency: z.enum(["ARS", "USD", "EUR"]),
    from: dateSchema,
    to: dateSchema,
    accountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.from > value.to)
      ctx.addIssue({
        code: "custom",
        message: "La fecha inicial debe ser anterior a la final.",
      });
    const start =
      Number(value.from.slice(0, 4)) * 12 + Number(value.from.slice(5, 7));
    const end =
      Number(value.to.slice(0, 4)) * 12 + Number(value.to.slice(5, 7));
    if (end - start >= 36)
      ctx.addIssue({
        code: "custom",
        message: "Elegí un período de hasta 36 meses.",
      });
  });
export type ReportFilter = z.infer<typeof reportFilterSchema>;
export function reportTransactions(
  ledger: Ledger,
  input: ReportFilter,
): Transaction[] {
  const filter = reportFilterSchema.parse(input);
  const accountIds = new Set(
    ledger.accounts
      .filter(
        (a) =>
          a.currency === filter.currency &&
          (!filter.accountId || a.id === filter.accountId),
      )
      .map((a) => a.id),
  );
  return ledger.transactions
    .filter(
      (t) =>
        accountIds.has(t.accountId) &&
        t.date >= filter.from &&
        t.date <= filter.to &&
        (!filter.categoryId || t.categoryId === filter.categoryId),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
type Totals = {
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  count: number;
};
function totals(transactions: Transaction[]): Totals {
  let income = 0n,
    expense = 0n;
  for (const transaction of transactions) {
    if (transaction.type === "income")
      income += BigInt(transaction.amountMinor);
    if (transaction.type === "expense")
      expense += BigInt(transaction.amountMinor);
  }
  return {
    incomeMinor: income.toString(),
    expenseMinor: expense.toString(),
    netMinor: (income - expense).toString(),
    count: transactions.filter(
      (t) => t.type === "income" || t.type === "expense",
    ).length,
  };
}
export function financialReport(ledger: Ledger, input: ReportFilter) {
  const filter = reportFilterSchema.parse(input),
    transactions = reportTransactions(ledger, filter),
    summary = totals(transactions);
  const months: Array<{ month: string } & Totals> = [];
  let year = Number(filter.from.slice(0, 4)),
    month = Number(filter.from.slice(5, 7));
  while (`${year}-${String(month).padStart(2, "0")}` <= filter.to.slice(0, 7)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push({
      month: key,
      ...totals(transactions.filter((t) => t.date.startsWith(key))),
    });
    if (++month === 13) {
      month = 1;
      year++;
    }
  }
  const grouped = new Map<
    string,
    { id: string; name: string; amount: bigint; count: number }
  >();
  for (const transaction of transactions.filter((t) => t.type === "expense")) {
    const key = transaction.categoryId ?? `name:${transaction.category}`;
    const group = grouped.get(key) ?? {
      id: key,
      name: transaction.category,
      amount: 0n,
      count: 0,
    };
    group.amount += BigInt(transaction.amountMinor);
    group.count++;
    grouped.set(key, group);
  }
  const categories = [...grouped.values()]
    .sort((a, b) =>
      a.amount === b.amount
        ? a.name.localeCompare(b.name)
        : a.amount > b.amount
          ? -1
          : 1,
    )
    .map((group) => ({
      id: group.id,
      name: group.name,
      amountMinor: group.amount.toString(),
      count: group.count,
      percent:
        BigInt(summary.expenseMinor) > 0n
          ? Number((group.amount * 10000n) / BigInt(summary.expenseMinor)) / 100
          : 0,
    }));
  return { ...summary, months, categories, transactions };
}

// Neutralize spreadsheet formulas in text cells, including leading whitespace.
function csvCell(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function transactionsCsv(
  ledger: Ledger,
  transactions: Transaction[],
): string {
  const accounts = new Map(ledger.accounts.map((a) => [a.id, a]));
  const names = {
    income: "ingreso",
    expense: "gasto",
    transferIn: "transferencia entrante",
    transferOut: "transferencia saliente",
    adjustmentIn: "ajuste",
  };
  const rows = transactions.map((t) => {
    const amount = BigInt(t.amountMinor);
    return [
      t.date,
      t.description,
      `${amount / 100n},${(amount % 100n).toString().padStart(2, "0")}`,
      names[t.type],
      t.category,
      accounts.get(t.accountId)?.name ?? "",
      accounts.get(t.accountId)?.currency ?? "",
      t.id,
    ]
      .map(csvCell)
      .join(";");
  });
  return (
    "\uFEFF" +
    ["fecha;descripcion;importe;tipo;categoria;cuenta;moneda;id", ...rows].join(
      "\r\n",
    ) +
    "\r\n"
  );
}
