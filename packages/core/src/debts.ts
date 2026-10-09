import { z } from "zod";
import { dateSchema, minorSchema, type Ledger, type Currency } from "./schemas";
import { addMonths } from "./planning";
import { accountBalance } from "./index";
const positive = minorSchema.pipe(z.string().refine((v) => BigInt(v) > 0n));
export const debtSchema = z
  .object({
    id: z.string().uuid(),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    principalMinor: positive,
    receivedMinor: positive,
    chargesMinor: minorSchema.pipe(z.string().refine((v) => BigInt(v) >= 0n)),
    monthlyRate: z.string().regex(/^\d{1,2}([.,]\d{1,6})?$/),
    system: z.enum(["french", "german", "american"]),
    count: z.number().int().min(1).max(360),
    disbursementDate: dateSchema,
    firstDate: dateSchema,
    active: z.boolean(),
    extras: z
      .array(
        z.object({
          id: z.string().uuid(),
          date: dateSchema,
          amountMinor: positive,
        }),
      )
      .optional(),
  })
  .refine(
    (d) => d.firstDate >= d.disbursementDate,
    "La primera cuota debe ser posterior al desembolso",
  );
export type Debt = z.infer<typeof debtSchema>;
export type DebtRow = {
  key: string;
  number: number;
  date: string;
  totalMinor: string;
  principalMinor: string;
  interestMinor: string;
  chargesMinor: string;
  balanceMinor: string;
};
function divideRound(n: bigint, d: bigint) {
  return (n + d / 2n) / d;
}
function rateUnits(rate: string): bigint {
  const [whole, fraction = ""] = rate.replace(",", ".").split(".");
  return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
}
export function debtSchedule(debt: Debt): DebtRow[] {
  const original = BigInt(debt.principalMinor),
    r = rateUnits(debt.monthlyRate),
    denominator = 100000000n;
  const power = (denominator + r) ** BigInt(debt.count),
    basePower = denominator ** BigInt(debt.count);
  const payment =
    r === 0n
      ? (original + BigInt(debt.count) - 1n) / BigInt(debt.count)
      : divideRound(original * r * power, denominator * (power - basePower));
  const german = (original + BigInt(debt.count) - 1n) / BigInt(debt.count),
    charges = BigInt(debt.chargesMinor);
  const extras = [...(debt.extras ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  let extraIndex = 0,
    balance = original;
  const rows: DebtRow[] = [];
  for (let index = 0; index < debt.count && balance > 0n; index++) {
    const date = addMonths(debt.firstDate, index);
    while (extraIndex < extras.length && extras[extraIndex]!.date < date) {
      balance -= BigInt(extras[extraIndex++]!.amountMinor);
      if (balance < 0n) balance = 0n;
    }
    if (balance === 0n) break;
    const interest = divideRound(balance * r, denominator);
    let principal =
      debt.system === "german"
        ? german
        : debt.system === "american"
          ? index === debt.count - 1
            ? balance
            : 0n
          : payment - interest;
    if (principal < 0n) principal = 0n;
    if (index === debt.count - 1 || principal > balance) principal = balance;
    balance -= principal;
    rows.push({
      key: `debt:${debt.id}:${index + 1}`,
      number: index + 1,
      date,
      totalMinor: (principal + interest + charges).toString(),
      principalMinor: principal.toString(),
      interestMinor: interest.toString(),
      chargesMinor: charges.toString(),
      balanceMinor: balance.toString(),
    });
  }
  return rows;
}
export function debtBalance(debt: Debt, ledger: Ledger, today: string): string {
  if (debt.disbursementDate > today) return "0";
  const posted = new Set(
    ledger.transactions
      .filter((t) => t.date <= today)
      .map((t) => t.occurrenceKey),
  );
  const capitalPaid = debtSchedule(debt)
    .filter((row) => posted.has(row.key))
    .reduce((sum, row) => sum + BigInt(row.principalMinor), 0n);
  const extras = (debt.extras ?? [])
    .filter((e) => e.date <= today)
    .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
  const balance = BigInt(debt.principalMinor) - capitalPaid - extras;
  return (balance < 0n ? 0n : balance).toString();
}
export function netWorth(
  ledger: Ledger,
  debts: Debt[],
  currency: Currency,
  today: string,
): string {
  const ids = new Set(
    ledger.accounts.filter((a) => a.currency === currency).map((a) => a.id),
  );
  const assets = ledger.accounts
    .filter((a) => ids.has(a.id))
    .reduce(
      (sum, a) => sum + BigInt(accountBalance(a, ledger.transactions, today)),
      0n,
    );
  const liabilities = debts
    .filter((d) => ids.has(d.accountId))
    .reduce((sum, d) => sum + BigInt(debtBalance(d, ledger, today)), 0n);
  return (assets - liabilities).toString();
}
