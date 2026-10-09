import { z } from "zod";
import { debtSchema, debtSchedule, debtBalance, type Debt } from "./debts";
import { type Ledger, type Currency } from "./schemas";
import { project, type Planning } from "./planning";
const rate = z.string().regex(/^\d{1,4}([.,]\d{1,6})?$/);
const units = (text: string) => {
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
};
const decimal = (value: bigint) =>
  `${value / 1000000n}.${(value % 1000000n).toString().padStart(6, "0")}`;
const round = (n: bigint, d: bigint) => (n + d / 2n) / d;
export function loanRates(
  input: string,
  kind: "monthly" | "nominalAnnual" = "monthly",
) {
  const entered = units(rate.parse(input));
  const monthly = kind === "monthly" ? entered : round(entered, 12n);
  if (monthly >= 100000000n)
    throw new Error("La tasa mensual debe ser menor al 100%.");
  const base = 100000000n;
  const effective = round(
    ((base + monthly) ** 12n - base ** 12n) * 100000000n,
    base ** 12n,
  );
  return {
    monthly: decimal(monthly),
    nominalAnnual: decimal(monthly * 12n),
    effectiveAnnual: decimal(effective),
  };
}
export function loanAnalysis(debt: Debt) {
  const rows = debtSchedule(debt);
  const total = rows.reduce((s, r) => s + BigInt(r.totalMinor), 0n),
    interest = rows.reduce((s, r) => s + BigInt(r.interestMinor), 0n),
    charges = rows.reduce((s, r) => s + BigInt(r.chargesMinor), 0n);
  return {
    rows,
    totalMinor: total.toString(),
    interestMinor: interest.toString(),
    chargesMinor: charges.toString(),
    costOverReceivedMinor: (total - BigInt(debt.receivedMinor)).toString(),
    rates: loanRates(debt.monthlyRate),
  };
}
export function simulateNewLoan(
  ledger: Ledger,
  planning: Planning,
  debt: Debt,
  currency: Currency,
  today: string,
) {
  debt = debtSchema.parse(debt);
  const account = ledger.accounts.find(
    (a) =>
      a.id === debt.accountId &&
      a.currency === currency &&
      a.active !== false &&
      a.kind !== "credit" &&
      a.liquid !== false,
  );
  if (!account || debt.disbursementDate !== today)
    throw new Error(
      "Elegí una cuenta líquida de esta moneda y fecha de desembolso de hoy.",
    );
  if (debt.extras?.length)
    throw new Error("La simulación de préstamo nuevo no admite pagos previos.");
  const baseline = project(ledger, planning, currency, today);
  const simulatedLedger = {
    ...ledger,
    transactions: [
      ...ledger.transactions,
      {
        id: `simulation:${debt.id}`,
        accountId: account.id,
        type: "adjustmentIn" as const,
        amountMinor: debt.receivedMinor,
        date: today,
        description: debt.name,
        category: "Desembolso simulado",
      },
    ],
  };
  const scenario = project(
    simulatedLedger,
    { ...planning, debts: [...(planning.debts ?? []), debt] },
    currency,
    today,
  );
  return { baseline, scenario, ...loanAnalysis(debt) };
}
export function simulateEarlyPayment(
  ledger: Ledger,
  planning: Planning,
  debt: Debt,
  currency: Currency,
  today: string,
  amountMinor: string,
) {
  if (
    !ledger.accounts.some(
      (a) =>
        a.id === debt.accountId &&
        a.currency === currency &&
        a.active !== false &&
        a.kind !== "credit" &&
        a.liquid !== false,
    )
  )
    throw new Error("Elegí una cuenta líquida activa de esta moneda.");
  if (
    !/^\d{1,24}$/.test(amountMinor) ||
    BigInt(amountMinor) <= 0n ||
    BigInt(amountMinor) > BigInt(debtBalance(debt, ledger, today))
  )
    throw new Error(
      "El importe debe ser positivo y no superar el capital pendiente.",
    );
  const paid = new Set(ledger.transactions.map((t) => t.occurrenceKey));
  if (
    debtSchedule(debt).some(
      (r) => r.date <= today && BigInt(r.totalMinor) > 0n && !paid.has(r.key),
    )
  )
    throw new Error(
      "Confirmá primero las cuotas vencidas antes de simular la cancelación.",
    );
  const next = {
    ...debt,
    extras: [
      ...(debt.extras ?? []),
      { id: "simulation", date: today, amountMinor },
    ],
  };
  const before = debtSchedule(debt).filter((r) => !paid.has(r.key)),
    after = debtSchedule(next).filter((r) => !paid.has(r.key));
  const interest =
    before.reduce((s, r) => s + BigInt(r.interestMinor), 0n) -
    after.reduce((s, r) => s + BigInt(r.interestMinor), 0n);
  const charges =
    before.reduce((s, r) => s + BigInt(r.chargesMinor), 0n) -
    after.reduce((s, r) => s + BigInt(r.chargesMinor), 0n);
  const simulated = {
    ...ledger,
    transactions: [
      ...ledger.transactions,
      {
        id: "simulation-extra",
        accountId: debt.accountId,
        type: "expense" as const,
        amountMinor,
        date: today,
        description: "Pago simulado",
        category: "Préstamos",
      },
    ],
  };
  return {
    before,
    after,
    interestSavedMinor: interest.toString(),
    chargesSavedMinor: charges.toString(),
    baseline: project(ledger, planning, currency, today),
    scenario: project(
      simulated,
      {
        ...planning,
        debts: (planning.debts ?? []).map((d) => (d.id === debt.id ? next : d)),
      },
      currency,
      today,
    ),
  };
}
