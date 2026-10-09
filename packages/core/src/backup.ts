import { z } from "zod";
import { ledgerSchema, dateSchema } from "./schemas";
import {
  recurrenceSchema,
  installmentSchema,
  budgetSchema,
  goalSchema,
  purchaseSchema,
  positiveMinor,
} from "./planning";
import { debtSchema } from "./debts";
import { ruleSchema, alertPreferencesSchema } from "./automation";
import { fxRateSchema } from "./fx";
const uuid = z.string().uuid(),
  money = positiveMinor;
export const backupSchema = z
  .object({
    version: z.literal(3),
    exportedAt: z.string().datetime(),
    workspace: z.object({
      name: z.string().trim().min(1).max(80),
      baseCurrency: z.enum(["ARS", "USD", "EUR"]),
      country: z.string().regex(/^[A-Z]{2}$/),
      timezone: z
        .string()
        .max(80)
        .refine((v) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: v });
            return true;
          } catch {
            return false;
          }
        }, "Zona horaria inválida"),
    }),
    ledger: ledgerSchema,
    categories: z
      .array(
        z.object({
          id: uuid,
          name: z.string().min(1).max(80),
          group: z.string().min(1).max(80),
        }),
      )
      .max(5000),
    recurrences: z.array(recurrenceSchema).max(1000),
    installments: z.array(installmentSchema).max(5000),
    debts: z.array(debtSchema).max(500),
    budgets: z.array(budgetSchema).max(5000),
    goals: z.array(goalSchema).max(5000),
    cards: z
      .array(
        z.object({
          accountId: uuid,
          fundingAccountId: uuid,
          limitMinor: money,
          closingDay: z.number().int().min(1).max(31),
          dueDay: z.number().int().min(1).max(31),
        }),
      )
      .max(500),
    scenarios: z
      .array(
        z.object({
          id: uuid,
          name: z.string().min(1).max(80),
          events: purchaseSchema,
        }),
      )
      .max(5000),
    rules: z.array(ruleSchema).max(100),
    fxRates: z.array(fxRateSchema).max(1000),
    alertPreferences: alertPreferencesSchema,
    imports: z
      .array(
        z.object({
          id: uuid,
          importedCount: z.number().int().min(0),
          rolledBack: z.boolean(),
          createdAt: z.string().datetime(),
        }),
      )
      .max(50000),
    transfers: z
      .array(
        z.object({
          id: uuid,
          fromAccountId: uuid,
          toAccountId: uuid,
          fromCurrency: z.enum(["ARS", "USD", "EUR"]),
          toCurrency: z.enum(["ARS", "USD", "EUR"]),
          sentMinor: money,
          receivedMinor: money,
          feeMinor: z.string().regex(/^\d{1,24}$/),
          fxSource: z.string().min(1).max(80),
          rateTimestamp: z.string().datetime(),
          date: dateSchema,
        }),
      )
      .max(25000),
  })
  .superRefine((b, ctx) => {
    const accounts = new Set(b.ledger.accounts.map((a) => a.id)),
      categories = new Set(b.categories.map((c) => c.id)),
      batches = new Set(b.imports.map((i) => i.id));
    function refs(accountId: string | undefined | null, categoryId?: string) {
      if (accountId && !accounts.has(accountId))
        ctx.addIssue({
          code: "custom",
          message: "El respaldo referencia una cuenta inexistente.",
        });
      if (categoryId && !categories.has(categoryId))
        ctx.addIssue({
          code: "custom",
          message: "El respaldo referencia una categoría inexistente.",
        });
    }
    for (const row of [
      ...b.ledger.transactions,
      ...b.recurrences,
      ...b.installments,
      ...b.debts,
    ])
      refs(row.accountId, row.categoryId);
    for (const row of b.ledger.transactions)
      if (row.importBatchId && !batches.has(row.importBatchId))
        ctx.addIssue({
          code: "custom",
          message: "Falta un lote de importación en el respaldo.",
        });
    for (const row of b.cards) {
      refs(row.accountId);
      refs(row.fundingAccountId);
      if (
        b.ledger.accounts.find((a) => a.id === row.accountId)?.kind !== "credit"
      )
        ctx.addIssue({
          code: "custom",
          message: "La tarjeta debe referenciar una cuenta de crédito.",
        });
    }
    for (const row of b.installments) refs(row.repaymentAccountId);
    for (const row of b.budgets) refs(undefined, row.categoryId);
    for (const row of b.rules) refs(row.accountId, row.categoryId);
    for (const row of b.scenarios) refs(row.events.accountId);
    for (const row of b.transfers) {
      refs(row.fromAccountId);
      refs(row.toAccountId);
    }
    for (const rows of [
      b.categories,
      b.recurrences,
      b.installments,
      b.debts,
      b.budgets,
      b.goals,
      b.rules,
      b.fxRates,
      b.imports,
      b.transfers,
      b.scenarios,
    ])
      if (new Set(rows.map((r) => r.id)).size !== rows.length)
        ctx.addIssue({
          code: "custom",
          message: "Identificadores duplicados en el respaldo.",
        });
    if (new Set(b.categories.map((c) => c.name)).size !== b.categories.length)
      ctx.addIssue({
        code: "custom",
        message: "Categorías duplicadas en el respaldo.",
      });
    if (new Set(b.cards.map((c) => c.accountId)).size !== b.cards.length)
      ctx.addIssue({
        code: "custom",
        message: "Tarjetas duplicadas en el respaldo.",
      });
    const keys = b.ledger.transactions
      .map((t) => t.occurrenceKey)
      .filter(Boolean);
    const rateKeys = b.fxRates.map(
      (r) => `${[r.base, r.quote].sort().join(":")}:${r.date}`,
    );
    if (new Set(rateKeys).size !== rateKeys.length)
      ctx.addIssue({
        code: "custom",
        message: "Cotizaciones duplicadas para el mismo par y día.",
      });
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        message: "Confirmaciones duplicadas en el respaldo.",
      });
  });
export type FinancialBackup = z.infer<typeof backupSchema>;
