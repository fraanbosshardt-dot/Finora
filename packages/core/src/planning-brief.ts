import {
  budgetProgress,
  goalContribution,
  type Planning,
  type Goal,
  type Budget,
} from "./planning";
import { debtSchedule, debtBalance } from "./debts";
import type { Ledger, Currency } from "./schemas";
export function planningBrief(
  ledger: Ledger,
  planning: Planning,
  goals: Goal[],
  budgets: Budget[],
  currency: Currency,
  today: string,
) {
  const ids = new Set(
    ledger.accounts.filter((a) => a.currency === currency).map((a) => a.id),
  );
  const paid = new Set(ledger.transactions.map((t) => t.occurrenceKey));
  return {
    goals: goals
      .filter((g) => g.currency === currency)
      .map((g) => ({
        ...g,
        percent: Number((BigInt(g.savedMinor) * 100n) / BigInt(g.targetMinor)),
        contributionMinor: goalContribution(g, today),
      })),
    debts: (planning.debts ?? [])
      .filter((d) => d.active && ids.has(d.accountId))
      .map((d) => {
        const rows = debtSchedule(d),
          unpaid = rows.filter((r) => !paid.has(r.key)),
          paidCount = rows.length - unpaid.length;
        return {
          id: d.id,
          name: d.name,
          remainingMinor: debtBalance(d, ledger, today),
          next: unpaid[0] ?? null,
          paidCount,
          count: rows.length,
          percent: rows.length
            ? Math.floor((paidCount * 100) / rows.length)
            : 100,
        };
      }),
    budgets: budgets
      .filter((b) => b.currency === currency && b.month === today.slice(0, 7))
      .map((b) => {
        const progress = budgetProgress(ledger, b);
        return {
          ...b,
          ...progress,
          overMinor:
            BigInt(progress.remaining) < 0n
              ? (-BigInt(progress.remaining)).toString()
              : "0",
        };
      }),
  };
}
