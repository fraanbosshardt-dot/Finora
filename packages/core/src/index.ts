import type { Account, Transaction, Ledger, Currency } from "./schemas";
export * from "./schemas";
export function parseMoney(value: string): string {
  const normalized = value.trim();
  if (!/^\d{1,20}([.,]\d{1,2})?$/.test(normalized))
    throw new Error(
      "Usá un importe sin separadores de miles y con hasta dos decimales.",
    );
  const [whole, fraction = ""] = normalized.split(/[.,]/);
  return (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"))).toString();
}

export function formatMoney(value: string, currency: Currency): string {
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  const integer = new Intl.NumberFormat("es-AR").format(absolute / 100n);
  const decimals = (absolute % 100n).toString().padStart(2, "0");
  const symbol = { ARS: "$", USD: "US$", EUR: "€" }[currency];
  return `${amount < 0n ? "−" : ""}${symbol} ${integer},${decimals}`;
}

export function accountBalance(
  account: Account,
  transactions: Transaction[],
  asOf: string,
): string {
  if (asOf < account.openingDate) return "0";
  return transactions
    .filter(
      (t) =>
        t.accountId === account.id &&
        t.date >= account.openingDate &&
        t.date <= asOf,
    )
    .reduce(
      (sum, t) =>
        sum +
        (["income", "transferIn", "adjustmentIn"].includes(t.type) ? 1n : -1n) *
          BigInt(t.amountMinor),
      BigInt(account.openingMinor),
    )
    .toString();
}

export * from "./planning";
export * from "./categories";
export * from "./debts";
export * from "./cards";
export * from "./csv";
export * from "./reports";
export * from "./automation";
export * from "./loan-analysis";
export * from "./fx";
export * from "./backup";

export function parseSignedMoney(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("-")
    ? (-BigInt(parseMoney(trimmed.slice(1)))).toString()
    : parseMoney(trimmed);
}

export function summarize(ledger: Ledger, currency: Currency, asOf: string) {
  const accounts = ledger.accounts.filter((a) => a.currency === currency);
  const ids = new Set(accounts.map((a) => a.id));
  const month = asOf.slice(0, 7);
  const movements = ledger.transactions.filter(
    (t) => ids.has(t.accountId) && t.date.startsWith(month) && t.date <= asOf,
  );
  const income = movements
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + BigInt(t.amountMinor), 0n);
  const expense = movements
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + BigInt(t.amountMinor), 0n);
  return {
    balance: accounts
      .reduce(
        (sum, a) => sum + BigInt(accountBalance(a, ledger.transactions, asOf)),
        0n,
      )
      .toString(),
    income: income.toString(),
    expense: expense.toString(),
    flow: (income - expense).toString(),
  };
}
export { localInsights, localQuestionIntent } from "./insights";
export { planningBrief } from "./planning-brief";
