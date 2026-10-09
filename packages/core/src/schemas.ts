import { z } from "zod";

// Money travels as integer strings and is calculated with bigint, never floats.
export const minorSchema = z.string().regex(/^-?\d{1,24}$/);
export const dateSchema = z
  .string()
  .regex(/^(19|20|21)\d{2}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Fecha inválida");
export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  currency: z.enum(["ARS", "USD", "EUR"]),
  openingMinor: minorSchema,
  openingDate: dateSchema,
  active: z.boolean().optional(),
  kind: z
    .enum(["bank", "cash", "wallet", "credit", "investment", "other"])
    .optional(),
  liquid: z.boolean().optional(),
});
export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  type: z.enum([
    "income",
    "expense",
    "transferIn",
    "transferOut",
    "adjustmentIn",
  ]),
  amountMinor: minorSchema.pipe(
    z
      .string()
      .refine((value) => BigInt(value) > 0n, "El importe debe ser positivo"),
  ),
  description: z.string().trim().min(1).max(140),
  category: z.string().trim().min(1).max(80),
  date: dateSchema,
  categoryId: z.string().uuid().optional(),
  occurrenceKey: z.string().max(120).optional(),
  transferId: z.string().uuid().optional(),
  importBatchId:z.string().uuid().optional(),
});
export const ledgerSchema = z
  .object({
    accounts: z.array(accountSchema).max(500),
    transactions: z.array(transactionSchema).max(50000),
  })
  .superRefine((ledger, ctx) => {
    const accounts = new Map(
      ledger.accounts.map((account) => [account.id, account]),
    );
    if (
      accounts.size !== ledger.accounts.length ||
      new Set(ledger.transactions.map((t) => t.id)).size !==
        ledger.transactions.length
    )
      ctx.addIssue({ code: "custom", message: "Identificadores duplicados" });
    for (const transaction of ledger.transactions) {
      const account = accounts.get(transaction.accountId);
      if (!account || transaction.date < account.openingDate)
        ctx.addIssue({
          code: "custom",
          message: "Cuenta inexistente o movimiento anterior al saldo inicial",
        });
    }
  });
export type Account = z.infer<typeof accountSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Ledger = z.infer<typeof ledgerSchema>;
export type Currency = Account["currency"];
