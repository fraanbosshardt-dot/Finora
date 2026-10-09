import { z } from "zod";
import {
  accountSchema,
  transactionSchema,
  recurrenceSchema,
  installmentSchema,
  budgetSchema,
  goalSchema,
  debtSchema,
  dateSchema,
  positiveMinor,
  minorSchema,
  ledgerSchema,
  obligations,
  ruleSchema,
  alertPreferencesSchema,
  fxRateSchema,
  backupSchema,
  type Obligation,
} from "@finora/core";
const uuid = z.string().uuid();
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("backup.restore"), data: backupSchema }),
  z.object({ action: z.literal("fx.save"), data: fxRateSchema }),
  z.object({ action: z.literal("fx.delete"), id: uuid }),
  z.object({ action: z.literal("rule.save"), data: ruleSchema }),
  z.object({ action: z.literal("rule.delete"), id: uuid }),
  z.object({
    action: z.literal("rule.apply"),
    ids: z.array(uuid).min(1).max(1000),
  }),
  z.object({
    action: z.literal("alerts.preferences"),
    data: alertPreferencesSchema,
  }),
  z.object({
    action: z.literal("alerts.dismiss"),
    key: z.string().min(1).max(200),
  }),
  z.object({ action: z.literal("alerts.reset") }),
  z.object({ action: z.literal("account.save"), data: accountSchema }),
  z.object({
    action: z.literal("account.toggle"),
    id: uuid,
    active: z.boolean(),
  }),
  z.object({ action: z.literal("transaction.save"), data: transactionSchema }),
  z.object({ action: z.literal("transaction.delete"), id: uuid }),
  z.object({
    action: z.literal("category.create"),
    data: z.object({
      name: z.string().trim().min(1).max(80),
      group: z.string().trim().min(1).max(80),
    }),
  }),
  z.object({ action: z.literal("recurrence.save"), data: recurrenceSchema }),
  z.object({
    action: z.literal("recurrence.toggle"),
    id: uuid,
    active: z.boolean(),
  }),
  z.object({ action: z.literal("installment.save"), data: installmentSchema }),
  z.object({
    action: z.literal("installment.toggle"),
    id: uuid,
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("obligation.post"),
    key: z.string().min(1).max(120),
    date: dateSchema,
  }),
  z.object({ action: z.literal("budget.save"), data: budgetSchema }),
  z.object({ action: z.literal("budget.delete"), id: uuid }),
  z.object({ action: z.literal("goal.save"), data: goalSchema }),
  z.object({ action: z.literal("goal.delete"), id: uuid }),
  z.object({
    action: z.literal("transfer.create"),
    data: z.object({
      id: uuid,
      fromId: uuid,
      toId: uuid,
      amountMinor: positiveMinor,
      receivedMinor: positiveMinor,
      feeMinor: minorSchema.pipe(z.string().refine((v) => BigInt(v) >= 0n)),
      date: dateSchema,
      description: z.string().trim().min(1).max(140),
      fxSource: z.string().trim().min(1).max(80),
    }),
  }),
  z.object({ action: z.literal("ledger.import"), data: ledgerSchema }),
  z.object({ action: z.literal("import.rollback"), id: uuid }),
  z.object({
    action: z.literal("scenario.save"),
    data: z.object({
      id: uuid,
      name: z.string().trim().min(1).max(80),
      accountId: uuid,
      totalMinor: positiveMinor,
      count: z.number().int().min(1).max(36),
      firstDate: dateSchema,
    }),
  }),
  z.object({ action: z.literal("scenario.delete"), id: uuid }),
  z.object({ action: z.literal("debt.create"), data: debtSchema }),
  z.object({
    action: z.literal("debt.extra"),
    id: uuid,
    amountMinor: positiveMinor,
    date: dateSchema,
  }),
  z.object({ action: z.literal("debt.toggle"), id: uuid, active: z.boolean() }),
  z.object({
    action: z.literal("card.create"),
    data: z.object({
      id: uuid,
      name: z.string().trim().min(1).max(80),
      fundingAccountId: uuid,
      limitMinor: positiveMinor,
      openingDebtMinor: minorSchema.pipe(
        z.string().refine((v) => BigInt(v) >= 0n),
      ),
      openingDate: dateSchema,
      firstDueDate: dateSchema,
      closingDay: z.number().int().min(1).max(31),
      dueDay: z.number().int().min(1).max(31),
    }),
  }),
  z.object({
    action: z.literal("card.purchase"),
    data: z.object({
      id: uuid,
      cardId: uuid,
      categoryId: uuid,
      description: z.string().trim().min(1).max(140),
      totalMinor: positiveMinor,
      count: z.number().int().min(1).max(120),
      date: dateSchema,
    }),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export function resolveObligation(
  data: Parameters<typeof obligations>[0],
  planning: Parameters<typeof obligations>[1],
  key: string,
  today: string,
): Obligation | undefined {
  return obligations(data, planning, "1900-01-01", today).find(
    (e) => e.key === key,
  );
}
