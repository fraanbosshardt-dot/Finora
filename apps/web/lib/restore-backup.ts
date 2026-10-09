import { Prisma } from "@finora/db";
import { type FinancialBackup } from "@finora/core";
import { ApiError, toDate } from "./api";
import { snapshot } from "./snapshot";
type Tx = Prisma.TransactionClient;
const typeMap = {
  income: "INCOME",
  expense: "EXPENSE",
  transferIn: "TRANSFER_IN",
  transferOut: "TRANSFER_OUT",
  adjustmentIn: "ADJUSTMENT_IN",
} as const;
export async function restoreFinancialBackup(
  tx: Tx,
  workspaceId: string,
  backup: FinancialBackup,
) {
  const current = await snapshot(workspaceId, tx, true);
  if (
    current.ledger.transactions.length ||
    current.ledger.accounts.some((a) => BigInt(a.openingMinor) !== 0n) ||
    [
      current.cards,
      current.debts,
      current.recurrences,
      current.installments,
      current.budgets,
      current.goals,
      current.scenarios,
      current.rules,
      current.fxRates,
      current.imports,
      current.transfers,
    ].some((rows) => rows.length)
  )
    throw new ApiError(
      409,
      "La restauración requiere un espacio vacío, sin movimientos ni planes y con saldos iniciales en cero.",
    );
  const ids = (rows: { id: string }[]) =>
    new Map(rows.map((r) => [r.id, crypto.randomUUID()]));
  const accounts = ids(backup.ledger.accounts),
    plans = ids(backup.installments),
    recurrences = ids(backup.recurrences),
    debts = ids(backup.debts),
    extras = ids(backup.debts.flatMap((d) => d.extras ?? [])),
    batches = ids(backup.imports);
  const transfers = ids(
    [
      ...new Set([
        ...backup.transfers.map((t) => t.id),
        ...backup.ledger.transactions
          .map((t) => t.transferId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ].map((id) => ({ id })),
  );
  const categories = new Map<string, string>();
  for (const category of backup.categories) {
    const old = current.categories.find((c) => c.name === category.name);
    const id = old?.id ?? crypto.randomUUID();
    categories.set(category.id, id);
    if (old)
      await tx.category.updateMany({
        where: { workspaceId, id },
        data: { group: category.group },
      });
    else
      await tx.category.create({
        data: { id, workspaceId, name: category.name, group: category.group },
      });
  }
  const account = (id: string) => {
    const value = accounts.get(id);
    if (!value) throw new ApiError(400, "Cuenta inválida en el respaldo.");
    return value;
  };
  const category = (id: string | undefined) => {
    const value = id ? categories.get(id) : undefined;
    if (!value) throw new ApiError(400, "Categoría inválida en el respaldo.");
    return value;
  };
  function occurrence(key: string | undefined) {
    if (!key) return undefined;
    const [prefix, id, ...rest] = key.split(":");
    const map =
      prefix === "installment" || prefix === "card-purchase"
        ? plans
        : prefix === "recurrence"
          ? recurrences
          : prefix === "debt" || prefix === "debt-received"
            ? debts
            : prefix === "debt-extra"
              ? extras
              : undefined;
    const mapped = id ? map?.get(id) : undefined;
    if (!mapped)
      throw new ApiError(
        400,
        "El respaldo contiene una operación vinculada sin su origen.",
      );
    return [prefix, mapped, ...rest].join(":");
  }
  await tx.account.deleteMany({ where: { workspaceId } });
  if (backup.ledger.accounts.length)
    await tx.account.createMany({
      data: backup.ledger.accounts.map((a) => ({
        ...a,
        id: account(a.id),
        workspaceId,
        openingDate: toDate(a.openingDate),
      })),
    });
  if (backup.cards.length)
    await tx.creditCard.createMany({
      data: backup.cards.map((c) => ({
        ...c,
        workspaceId,
        accountId: account(c.accountId),
        fundingAccountId: account(c.fundingAccountId),
      })),
    });
  if (backup.recurrences.length)
    await tx.recurrence.createMany({
      data: backup.recurrences.map((r) => ({
        ...r,
        id: recurrences.get(r.id)!,
        workspaceId,
        accountId: account(r.accountId),
        categoryId: category(r.categoryId),
        type: typeMap[r.type],
        startDate: toDate(r.startDate),
        endDate: r.endDate ? toDate(r.endDate) : null,
      })),
    });
  if (backup.installments.length)
    await tx.installmentPlan.createMany({
      data: backup.installments.map((p) => ({
        ...p,
        id: plans.get(p.id)!,
        workspaceId,
        accountId: account(p.accountId),
        categoryId: category(p.categoryId),
        repaymentAccountId: p.repaymentAccountId
          ? account(p.repaymentAccountId)
          : null,
        purchaseDate: toDate(p.purchaseDate),
        firstDate: toDate(p.firstDate),
      })),
    });
  for (const debt of backup.debts) {
    const { extras: payments, ...data } = debt;
    await tx.debt.create({
      data: {
        ...data,
        id: debts.get(debt.id)!,
        workspaceId,
        accountId: account(debt.accountId),
        categoryId: category(debt.categoryId),
        disbursementDate: toDate(debt.disbursementDate),
        firstDate: toDate(debt.firstDate),
      },
    });
    if (payments?.length)
      await tx.debtExtraPayment.createMany({
        data: payments.map((p) => ({
          ...p,
          id: extras.get(p.id)!,
          debtId: debts.get(debt.id)!,
          workspaceId,
          date: toDate(p.date),
        })),
      });
  }
  if (backup.imports.length)
    await tx.importBatch.createMany({
      data: backup.imports.map((b) => ({
        ...b,
        id: batches.get(b.id)!,
        workspaceId,
        createdAt: new Date(b.createdAt),
      })),
    });
  if (backup.transfers.length)
    await tx.transfer.createMany({
      data: backup.transfers.map((t) => ({
        ...t,
        id: transfers.get(t.id)!,
        workspaceId,
        fromAccountId: account(t.fromAccountId),
        toAccountId: account(t.toAccountId),
        date: toDate(t.date),
        rateTimestamp: new Date(t.rateTimestamp),
      })),
    });
  for (
    let offset = 0;
    offset < backup.ledger.transactions.length;
    offset += 1000
  ) {
    const rows = backup.ledger.transactions.slice(offset, offset + 1000);
    await tx.transaction.createMany({
      data: rows.map((t) => ({
        id: crypto.randomUUID(),
        workspaceId,
        accountId: account(t.accountId),
        categoryId: category(t.categoryId),
        type: typeMap[t.type],
        amountMinor: t.amountMinor,
        description: t.description,
        date: toDate(t.date),
        occurrenceKey: occurrence(t.occurrenceKey),
        transferId: t.transferId ? transfers.get(t.transferId) : undefined,
        importBatchId: t.importBatchId
          ? batches.get(t.importBatchId)
          : undefined,
      })),
    });
  }
  if (backup.budgets.length)
    await tx.budget.createMany({
      data: backup.budgets.map((b) => ({
        ...b,
        id: crypto.randomUUID(),
        workspaceId,
        categoryId: category(b.categoryId),
      })),
    });
  if (backup.goals.length)
    await tx.goal.createMany({
      data: backup.goals.map((g) => ({
        ...g,
        id: crypto.randomUUID(),
        workspaceId,
        targetDate: toDate(g.targetDate),
      })),
    });
  if (backup.rules.length)
    await tx.rule.createMany({
      data: backup.rules.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        workspaceId,
        accountId: r.accountId ? account(r.accountId) : null,
        categoryId: category(r.categoryId),
      })),
    });
  if (backup.fxRates.length)
    await tx.fxRate.createMany({
      data: backup.fxRates.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        workspaceId,
        date: toDate(r.date),
      })),
    });
  if (backup.scenarios.length)
    await tx.scenario.createMany({
      data: backup.scenarios.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        workspaceId,
        events: { ...s.events, accountId: account(s.events.accountId) },
      })),
    });
  await tx.dismissedAlert.deleteMany({ where: { workspaceId } });
  await tx.workspace.update({
    where: { id: workspaceId },
    data: { ...backup.workspace, alertPreferences: backup.alertPreferences },
  });
}
