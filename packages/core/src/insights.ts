import { type Ledger, type Currency } from "./schemas";
import {
  monthEnd,
  financialSummary,
  installmentSchedule,
  type Planning,
} from "./planning";
import { debtSchedule } from "./debts";
export function localInsights(
  ledger: Ledger,
  planning: Planning,
  currency: Currency,
  today: string,
) {
  const ids = new Set(
    ledger.accounts.filter((a) => a.currency === currency).map((a) => a.id),
  );
  const categories = new Map<string, bigint>();
  for (const t of ledger.transactions) {
    if (
      t.type !== "expense" ||
      !ids.has(t.accountId) ||
      !t.date.startsWith(today.slice(0, 7)) ||
      t.date > today
    )
      continue;
    const category = t.category || "Sin categoría";
    categories.set(
      category,
      (categories.get(category) ?? 0n) + BigInt(t.amountMinor),
    );
  }
  const largest = [...categories].sort((a, b) =>
    a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : a[0].localeCompare(b[0]),
  )[0];
  const summary = financialSummary(ledger, planning, currency, today);
  const available = summary.available;
  const days = Number(monthEnd(today).slice(-2)) - Number(today.slice(-2)) + 1;
  const paid = new Set(ledger.transactions.map((t) => t.occurrenceKey));
  const rows = [
    ...planning.installments
      .filter((p) => p.active && ids.has(p.accountId))
      .flatMap(installmentSchedule),
    ...(planning.debts ?? [])
      .filter((d) => d.active && ids.has(d.accountId))
      .flatMap(debtSchedule),
  ].filter(
    (r) =>
      !paid.has(r.key) &&
      BigInt("amountMinor" in r ? r.amountMinor : r.totalMinor) > 0n,
  );
  const last =
    rows
      .map((r) => r.date)
      .sort()
      .at(-1) ?? null;
  return {
    committed: summary.committed,
    closing: summary.closing,
    largest: largest
      ? { category: largest[0], amountMinor: largest[1].toString() }
      : null,
    available,
    days,
    dailyMinor:
      BigInt(available) > 0n
        ? (BigInt(available) / BigInt(days)).toString()
        : "0",
    lastPaymentDate: last,
  };
}

export function localQuestionIntent(input: string): number | null {
  const text = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\b(dia|diario|diariamente)\b/.test(text)) return 1;
  if (
    /\b(termin|finaliz|ultim)/.test(text) &&
    /\b(cuotas?|prestamos?|pagos?)\b/.test(text)
  )
    return 2;
  if (/\b(cierre|cerrar|cerraria|fin de mes)\b/.test(text)) return 4;
  if (/\b(compromisos?|comprometido|vencimientos?|pendientes?)\b/.test(text))
    return 3;
  if (
    /\b(gaste|gastos?|categoria|categorias)\b/.test(text) &&
    /\b(mas|mayor|principal)\b/.test(text)
  )
    return 0;
  return null;
}
