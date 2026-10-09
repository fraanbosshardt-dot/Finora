import { z } from "zod";
import { dateSchema, minorSchema, type Currency, type Ledger } from "./schemas";
import { accountBalance } from "./index";
import { debtSchedule, type Debt } from "./debts";
export const positiveMinor = minorSchema.pipe(
  z
    .string()
    .refine(
      (value) => BigInt(value) > 0n,
      "El importe debe ser mayor que cero",
    ),
);
export const recurrenceSchema = z
  .object({
    id: z.string().uuid(),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid(),
    description: z.string().trim().min(1).max(140),
    type: z.enum(["income", "expense"]),
    amountMinor: positiveMinor,
    startDate: dateSchema,
    endDate: dateSchema.nullable().optional(),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).max(36),
    active: z.boolean(),
  })
  .refine(
    (value) => !value.endDate || value.endDate >= value.startDate,
    "La fecha final debe ser posterior al inicio",
  );
export const installmentSchema = z
  .object({
    id: z.string().uuid(),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid(),
    description: z.string().trim().min(1).max(140),
    totalMinor: positiveMinor,
    downPaymentMinor: minorSchema.pipe(
      z.string().refine((v) => BigInt(v) >= 0n),
    ),
    purchaseDate: dateSchema,
    count: z.number().int().min(1).max(120),
    firstDate: dateSchema,
    active: z.boolean(),
    repaymentAccountId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      /^\d+$/.test(value.downPaymentMinor) &&
      /^\d+$/.test(value.totalMinor) &&
      BigInt(value.downPaymentMinor) < BigInt(value.totalMinor),
    "El anticipo debe ser menor al total",
  )
  .refine(
    (value) => value.firstDate >= value.purchaseDate,
    "La primera cuota debe ser posterior a la compra",
  )
  .refine(
    (value) =>
      /^\d+$/.test(value.downPaymentMinor) &&
      /^\d+$/.test(value.totalMinor) &&
      BigInt(value.totalMinor) - BigInt(value.downPaymentMinor) >=
        BigInt(value.count),
    "El importe debe permitir al menos un centavo por cuota",
  );
export const budgetSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  currency: z.enum(["ARS", "USD", "EUR"]),
  amountMinor: positiveMinor,
});
export const goalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  currency: z.enum(["ARS", "USD", "EUR"]),
  targetMinor: positiveMinor,
  savedMinor: minorSchema.pipe(z.string().refine((v) => BigInt(v) >= 0n)),
  targetDate: dateSchema,
});
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Installment = z.infer<typeof installmentSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Obligation = {
  key: string;
  accountId: string;
  categoryId: string;
  description: string;
  date: string;
  amountMinor: string;
  type: "income" | "expense";
  source: "recurrence" | "installment" | "scenario" | "debt";
  repaymentAccountId?: string;
};
export type Planning = {
  recurrences: Recurrence[];
  installments: Installment[];
  debts?: Debt[];
};

export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year!, month! - 1 + months, 1, 12));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  target.setUTCDate(Math.min(day!, last));
  return target.toISOString().slice(0, 10);
}
export function monthEnd(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month!, 0, 12)).toISOString().slice(0, 10);
}
export function statementDueDate(
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
): string {
  const closingBase = `${purchaseDate.slice(0, 7)}-${String(closingDay).padStart(2, "0")}`;
  const last = monthEnd(purchaseDate),
    closing = closingBase > last ? last : closingBase;
  const closureMonth =
    purchaseDate <= closing
      ? purchaseDate.slice(0, 7)
      : addMonths(`${purchaseDate.slice(0, 7)}-01`, 1).slice(0, 7);
  const dueMonth =
    dueDay <= closingDay
      ? addMonths(`${closureMonth}-01`, 1).slice(0, 7)
      : closureMonth;
  const due = `${dueMonth}-${String(dueDay).padStart(2, "0")}`;
  return due > monthEnd(`${dueMonth}-01`) ? monthEnd(`${dueMonth}-01`) : due;
}
function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function recurrenceDates(
  recurrence: Recurrence,
  from: string,
  to: string,
): string[] {
  if (!recurrence.active) return [];
  const result: string[] = [];
  for (let n = 0; n < 110000; n++) {
    const step = n * recurrence.interval;
    const date =
      recurrence.frequency === "monthly"
        ? addMonths(recurrence.startDate, step)
        : recurrence.frequency === "yearly"
          ? addMonths(recurrence.startDate, step * 12)
          : addDays(
              recurrence.startDate,
              step * (recurrence.frequency === "weekly" ? 7 : 1),
            );
    if (date > to || (recurrence.endDate && date > recurrence.endDate)) break;
    if (date >= from) result.push(date);
  }
  return result;
}
export function installmentSchedule(plan: Installment): Obligation[] {
  const financed = BigInt(plan.totalMinor) - BigInt(plan.downPaymentMinor),
    count = BigInt(plan.count);
  const base = financed / count,
    remainder = financed % count;
  const result: Obligation[] = Array.from(
    { length: plan.count },
    (_, index) => ({
      key: `installment:${plan.id}:${index + 1}`,
      accountId: plan.accountId,
      categoryId: plan.categoryId,
      description: `${plan.description} · ${index + 1}/${plan.count}`,
      date: addMonths(plan.firstDate, index),
      amountMinor: (base + (BigInt(index) < remainder ? 1n : 0n)).toString(),
      type: "expense",
      source: "installment",
    }),
  );
  if (BigInt(plan.downPaymentMinor) > 0n)
    result.unshift({
      key: `installment:${plan.id}:down`,
      accountId: plan.accountId,
      categoryId: plan.categoryId,
      description: `${plan.description} · Anticipo`,
      date: plan.purchaseDate,
      amountMinor: plan.downPaymentMinor,
      type: "expense",
      source: "installment",
    });
  return plan.repaymentAccountId
    ? result.map((e) => ({
        ...e,
        repaymentAccountId: plan.repaymentAccountId!,
      }))
    : result;
}
export function obligations(
  ledger: Ledger,
  planning: Planning,
  from: string,
  to: string,
): Obligation[] {
  const paid = new Set(
    ledger.transactions.map((t) => t.occurrenceKey).filter(Boolean),
  );
  const events: Obligation[] = [
    ...(planning.debts ?? [])
      .filter((d) => d.active)
      .flatMap((d) =>
        debtSchedule(d)
          .filter((row) => BigInt(row.totalMinor) > 0n)
          .map((row) => ({
            key: row.key,
            accountId: d.accountId,
            categoryId: d.categoryId,
            description: `${d.name} · Cuota ${row.number}`,
            date: row.date,
            amountMinor: row.totalMinor,
            type: "expense" as const,
            source: "debt" as const,
          })),
      ),
    ...planning.installments
      .filter((p) => p.active)
      .flatMap(installmentSchedule),
    ...planning.recurrences.flatMap((r) =>
      recurrenceDates(r, from, to).map((date) => ({
        key: `recurrence:${r.id}:${date}`,
        accountId: r.accountId,
        categoryId: r.categoryId,
        description: r.description,
        date,
        amountMinor: r.amountMinor,
        type: r.type,
        source: "recurrence" as const,
      })),
    ),
  ];
  return events
    .filter(
      (event) => event.date >= from && event.date <= to && !paid.has(event.key),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
export function financialSummary(
  ledger: Ledger,
  planning: Planning,
  currency: Currency,
  today: string,
) {
  const accounts = ledger.accounts.filter(
    (a) =>
      a.active !== false &&
      a.currency === currency &&
      a.kind !== "credit" &&
      a.liquid !== false,
  );
  const ids = new Set(accounts.map((a) => a.id));
  const liquid = accounts.reduce(
    (sum, a) => sum + BigInt(accountBalance(a, ledger.transactions, today)),
    0n,
  );
  // Pending overdue expenses remain committed until paid; future income does not increase availability.
  const events = obligations(
    ledger,
    planning,
    "1900-01-01",
    monthEnd(today),
  ).filter((e) => ids.has(e.accountId));
  const committed = events
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
  const incoming = events
    .filter((e) => e.type === "income" && e.date >= today)
    .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
  return {
    liquid: liquid.toString(),
    committed: committed.toString(),
    available: (liquid - committed).toString(),
    closing: (liquid - committed + incoming).toString(),
  };
}
export function project(
  ledger: Ledger,
  planning: Planning,
  currency: Currency,
  today: string,
  months = 12,
  extra: Obligation[] = [],
) {
  if (!Number.isInteger(months) || months < 1 || months > 36)
    throw new Error("Horizonte inválido");
  const accounts = ledger.accounts.filter(
    (a) =>
      a.active !== false &&
      a.currency === currency &&
      a.kind !== "credit" &&
      a.liquid !== false,
  );
  const ids = new Set(accounts.map((a) => a.id));
  let balance = accounts.reduce(
    (sum, a) => sum + BigInt(accountBalance(a, ledger.transactions, today)),
    0n,
  );
  const events = [
    ...obligations(
      ledger,
      planning,
      "1900-01-01",
      monthEnd(addMonths(today, months - 1)),
    ),
    ...extra,
  ].filter((e) => ids.has(e.accountId));
  return Array.from({ length: months }, (_, index) => {
    const month = addMonths(today, index).slice(0, 7);
    const entries = events.filter(
      (e) =>
        e.date.startsWith(month) ||
        (index === 0 && e.date < today && e.type === "expense"),
    );
    const income = entries
      .filter((e) => e.type === "income" && e.date >= today)
      .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
    const expense = entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
    balance += income - expense;
    return {
      month,
      income: income.toString(),
      expense: expense.toString(),
      closing: balance.toString(),
      negative: balance < 0n,
    };
  });
}
export function budgetProgress(ledger: Ledger, budget: Budget) {
  const ids = new Set(
    ledger.accounts
      .filter((a) => a.currency === budget.currency)
      .map((a) => a.id),
  );
  const used = ledger.transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.categoryId === budget.categoryId &&
        t.date.startsWith(budget.month) &&
        ids.has(t.accountId),
    )
    .reduce((sum, t) => sum + BigInt(t.amountMinor), 0n);
  return {
    used: used.toString(),
    remaining: (BigInt(budget.amountMinor) - used).toString(),
    percent: Number((used * 100n) / BigInt(budget.amountMinor)),
  };
}
export function goalContribution(goal: Goal, today: string): string {
  const [year, month] = today.split("-").map(Number),
    [targetYear, targetMonth] = goal.targetDate.split("-").map(Number);
  const months = Math.max(
    1,
    (targetYear! - year!) * 12 + targetMonth! - month! + 1,
  );
  const remaining = BigInt(goal.targetMinor) - BigInt(goal.savedMinor);
  return remaining <= 0n
    ? "0"
    : ((remaining + BigInt(months) - 1n) / BigInt(months)).toString();
}

export const purchaseSchema = z.object({
  accountId: z.string().uuid(),
  totalMinor: positiveMinor,
  count: z.number().int().min(1).max(36),
  firstDate: dateSchema,
});
export type Purchase = z.infer<typeof purchaseSchema>;
export function simulatePurchase(
  ledger: Ledger,
  planning: Planning,
  currency: Currency,
  today: string,
  purchase: Purchase,
) {
  const account = ledger.accounts.find(
    (a) =>
      a.id === purchase.accountId &&
      a.currency === currency &&
      a.active !== false &&
      a.liquid !== false &&
      a.kind !== "credit",
  );
  if (!account || purchase.firstDate < today)
    throw new Error(
      "Elegí una cuenta líquida en la moneda seleccionada y una fecha de hoy o futura.",
    );
  if (BigInt(purchase.totalMinor) < BigInt(purchase.count))
    throw new Error("Cada cuota debe tener al menos un centavo.");
  const events = installmentSchedule({
    id: "00000000-0000-4000-8000-000000000000",
    accountId: account.id,
    categoryId: "00000000-0000-4000-8000-000000000000",
    description: "Compra simulada",
    totalMinor: purchase.totalMinor,
    downPaymentMinor: "0",
    purchaseDate: purchase.firstDate,
    firstDate: purchase.firstDate,
    count: purchase.count,
    active: true,
  }).map((e) => ({ ...e, source: "scenario" as const }));
  const baseline = project(ledger, planning, currency, today, 12),
    scenario = project(ledger, planning, currency, today, 12, events);
  return {
    baseline,
    scenario,
    firstPayment: events[0]!.amountMinor,
    negativeMonths: scenario.filter((p) => p.negative).map((p) => p.month),
    events,
  };
}
