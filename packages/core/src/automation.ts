import { z } from "zod";
import { type Ledger, type Currency, type Transaction } from "./schemas";
import {
  obligations,
  financialSummary,
  project,
  budgetProgress,
  type Planning,
  type Budget,
  type Goal,
} from "./planning";
export const ruleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  contains: z.string().trim().min(2).max(80),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  type: z.enum(["income", "expense", "all"]),
  priority: z.number().int().min(0).max(999),
  active: z.boolean(),
});
export type Rule = z.infer<typeof ruleSchema>;
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
export function matchingRule(
  rules: Rule[],
  transaction: Pick<Transaction, "description" | "accountId" | "type">,
) {
  return [...rules]
    .filter(
      (r) =>
        r.active &&
        (!r.accountId || r.accountId === transaction.accountId) &&
        (r.type === "all" || r.type === transaction.type) &&
        normalize(transaction.description).includes(normalize(r.contains)),
    )
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))[0];
}
export function ruleChanges(ledger: Ledger, rules: Rule[]) {
  return ledger.transactions
    .filter(
      (t) =>
        (t.type === "income" || t.type === "expense") &&
        !t.occurrenceKey &&
        !t.transferId,
    )
    .flatMap((t) => {
      const rule = matchingRule(rules, t);
      return rule && rule.categoryId !== t.categoryId
        ? [
            {
              transactionId: t.id,
              ruleId: rule.id,
              categoryId: rule.categoryId,
              description: t.description,
            },
          ]
        : [];
    });
}
export const alertPreferencesSchema = z.object({
  due: z.boolean().default(true),
  budget: z.boolean().default(true),
  negative: z.boolean().default(true),
  goals: z.boolean().default(true),
  days: z.number().int().min(1).max(30).default(7),
});
export type AlertPreferences = z.infer<typeof alertPreferencesSchema>;
export type FinanceAlert = {
  id: string;
  title: string;
  detail: string;
  view: string;
  level: "warning" | "danger";
};
export function financeAlerts(
  ledger: Ledger,
  planning: Planning,
  budgets: Budget[],
  goals: Goal[],
  currency: Currency,
  today: string,
  preferences: AlertPreferences,
): FinanceAlert[] {
  const ids = new Set(
    ledger.accounts.filter((a) => a.currency === currency).map((a) => a.id),
  );
  const alerts: FinanceAlert[] = [];
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + preferences.days);
  if (preferences.due) {
    for (const event of obligations(
      ledger,
      planning,
      "1900-01-01",
      end.toISOString().slice(0, 10),
    ).filter((e) => e.type === "expense" && ids.has(e.accountId)))
      alerts.push({
        id: `due:${event.key}:${event.amountMinor}`,
        title:
          event.date < today
            ? "Tenés un pago vencido"
            : "Se acerca un vencimiento",
        detail: `${event.description} · ${event.date}`,
        view: "Planificación",
        level: event.date < today ? "danger" : "warning",
      });
  }
  if (preferences.budget)
    for (const budget of budgets.filter(
      (b) => b.currency === currency && b.month === today.slice(0, 7),
    )) {
      const progress = budgetProgress(ledger, budget);
      if (BigInt(progress.remaining) < 0n)
        alerts.push({
          id: `budget:${budget.id}:${today.slice(0, 7)}:${progress.used}`,
          title: "Superaste un presupuesto",
          detail: "Revisá los gastos y el límite mensual de esta categoría.",
          view: "Presupuestos",
          level: "danger",
        });
    }
  if (preferences.negative) {
    const first = project(ledger, planning, currency, today).find(
      (p) => p.negative,
    );
    if (first)
      alerts.push({
        id: `negative:${currency}:${first.month}:${first.closing}`,
        title: "Aparece un saldo proyectado negativo",
        detail: `Primer mes: ${first.month}. Revisá los compromisos e ingresos registrados.`,
        view: "Planificación",
        level: "danger",
      });
    if (
      BigInt(financialSummary(ledger, planning, currency, today).available) < 0n
    )
      alerts.push({
        id: `available:${currency}:${today}`,
        title: "Tus compromisos superan la liquidez",
        detail: "El disponible actual es negativo para esta moneda.",
        view: "Inicio",
        level: "danger",
      });
  }
  if (preferences.goals)
    for (const goal of goals.filter(
      (g) =>
        g.currency === currency &&
        g.targetDate < today &&
        BigInt(g.savedMinor) < BigInt(g.targetMinor),
    ))
      alerts.push({
        id: `goal:${goal.id}:${goal.targetDate}`,
        title: "Un objetivo llegó a su fecha",
        detail: `${goal.name}: revisá el acumulado o ajustá la fecha.`,
        view: "Objetivos",
        level: "warning",
      });
  return alerts.sort((a, b) =>
    a.level === b.level
      ? a.id.localeCompare(b.id)
      : a.level === "danger"
        ? -1
        : 1,
  );
}
