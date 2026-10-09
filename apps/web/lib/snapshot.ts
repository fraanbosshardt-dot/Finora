import { getDb, Prisma } from "@finora/db";
import {
  ledgerSchema,
  recurrenceSchema,
  installmentSchema,
  budgetSchema,
  goalSchema,
  debtSchema,
  ruleSchema,
  alertPreferencesSchema,
  fxRateSchema,
  type Category,
} from "@finora/core";
import { isoDate, todayAt } from "./api";
import { activePlan } from "./plans";
const typeMap = {
  INCOME: "income",
  EXPENSE: "expense",
  TRANSFER_IN: "transferIn",
  TRANSFER_OUT: "transferOut",
  ADJUSTMENT_IN: "adjustmentIn",
} as const;
export async function snapshot(
  workspaceId: string,
  existingTx?: Prisma.TransactionClient,
  fullBackup = false,
) {
  const db = getDb();
  const read = async (tx: Prisma.TransactionClient) => {
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    const [
      accounts,
      transactions,
      categories,
      recurrences,
      installments,
      budgets,
      goals,
      scenarios,
      debts,
      cards,
      imports,
      transfers,
      rules,
      dismissedAlerts,
      fxRates,
    ] = await Promise.all([
      tx.account.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
      tx.transaction.findMany({
        where: { workspaceId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      tx.category.findMany({
        where: { workspaceId },
        orderBy: [{ group: "asc" }, { name: "asc" }],
      }),
      tx.recurrence.findMany({ where: { workspaceId } }),
      tx.installmentPlan.findMany({ where: { workspaceId } }),
      tx.budget.findMany({ where: { workspaceId } }),
      tx.goal.findMany({ where: { workspaceId } }),
      tx.scenario.findMany({ where: { workspaceId } }),
      tx.debt.findMany({ where: { workspaceId }, include: { extras: true } }),
      tx.creditCard.findMany({ where: { workspaceId } }),
      tx.importBatch.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: fullBackup ? undefined : 30,
      }),
      tx.transfer.findMany({ where: { workspaceId } }),
      tx.rule.findMany({
        where: { workspaceId },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
      }),
      tx.dismissedAlert.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      tx.fxRate.findMany({ where: { workspaceId }, orderBy: { date: "desc" } }),
    ]);
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        baseCurrency: workspace.baseCurrency,
        timezone: workspace.timezone,
        country: workspace.country,
        plan: activePlan(workspace),
      },
      today: todayAt(workspace.timezone),
      rules: rules.map((r) => ruleSchema.parse(r)),
      fxRates: fxRates.map((r) =>
        fxRateSchema.parse({ ...r, date: isoDate(r.date) }),
      ),
      alertPreferences: alertPreferencesSchema.parse(
        workspace.alertPreferences,
      ),
      dismissedAlerts: dismissedAlerts.map((a) => a.key),
      ledger: ledgerSchema.parse({
        accounts: accounts.map((a) => ({
          ...a,
          openingMinor: a.openingMinor.toFixed(0),
          openingDate: isoDate(a.openingDate),
        })),
        transactions: transactions.map((t) => ({
          ...t,
          type: typeMap[t.type],
          amountMinor: t.amountMinor.toFixed(0),
          date: isoDate(t.date),
          category: categoryNames.get(t.categoryId) ?? "Otros",
          occurrenceKey: t.occurrenceKey ?? undefined,
          transferId: t.transferId ?? undefined,
          importBatchId: t.importBatchId ?? undefined,
        })),
      }),
      categories: categories.map(({ id, name, group }) => ({
        id,
        name,
        group,
      })) as Category[],
      recurrences: recurrences.map((r) =>
        recurrenceSchema.parse({
          ...r,
          type: typeMap[r.type],
          amountMinor: r.amountMinor.toFixed(0),
          startDate: isoDate(r.startDate),
          endDate: r.endDate ? isoDate(r.endDate) : null,
        }),
      ),
      installments: installments.map((p) =>
        installmentSchema.parse({
          ...p,
          totalMinor: p.totalMinor.toFixed(0),
          downPaymentMinor: p.downPaymentMinor.toFixed(0),
          purchaseDate: isoDate(p.purchaseDate),
          firstDate: isoDate(p.firstDate),
        }),
      ),
      budgets: budgets.map((b) =>
        budgetSchema.parse({ ...b, amountMinor: b.amountMinor.toFixed(0) }),
      ),
      goals: goals.map((g) =>
        goalSchema.parse({
          ...g,
          targetMinor: g.targetMinor.toFixed(0),
          savedMinor: g.savedMinor.toFixed(0),
          targetDate: isoDate(g.targetDate),
        }),
      ),
      scenarios: scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        events: s.events,
      })),
      debts: debts.map((d) =>
        debtSchema.parse({
          ...d,
          principalMinor: d.principalMinor.toFixed(0),
          receivedMinor: d.receivedMinor.toFixed(0),
          chargesMinor: d.chargesMinor.toFixed(0),
          disbursementDate: isoDate(d.disbursementDate),
          firstDate: isoDate(d.firstDate),
          extras: d.extras.map((e) => ({
            id: e.id,
            date: isoDate(e.date),
            amountMinor: e.amountMinor.toFixed(0),
          })),
        }),
      ),
      cards: cards.map((c) => ({ ...c, limitMinor: c.limitMinor.toFixed(0) })),
      imports: imports.map((batch) => ({
        ...batch,
        createdAt: batch.createdAt.toISOString(),
      })),
      transfers: transfers.map((t) => ({
        ...t,
        sentMinor: t.sentMinor.toFixed(0),
        receivedMinor: t.receivedMinor.toFixed(0),
        feeMinor: t.feeMinor.toFixed(0),
        date: isoDate(t.date),
        rateTimestamp: t.rateTimestamp.toISOString(),
      })),
    };
  };
  return existingTx
    ? read(existingTx)
    : db.$transaction(read, { isolationLevel: "RepeatableRead" });
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
