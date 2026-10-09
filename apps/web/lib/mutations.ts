import { createHash } from "node:crypto";
import { getDb, Prisma } from "@finora/db";
import {
  debtSchema,
  debtSchedule,
  debtBalance,
  accountBalance,
  statementDueDate,
  ruleChanges,
} from "@finora/core";
import { ApiError, toDate, isoDate } from "./api";
import { type Command, resolveObligation } from "./commands";
import { snapshot } from "./snapshot";
import { restoreFinancialBackup } from "./restore-backup";
type Tx = Prisma.TransactionClient;
const typeMap = {
  income: "INCOME",
  expense: "EXPENSE",
  transferIn: "TRANSFER_IN",
  transferOut: "TRANSFER_OUT",
  adjustmentIn: "ADJUSTMENT_IN",
} as const;
async function accountFor(
  tx: Tx,
  workspaceId: string,
  id: string,
  active = true,
) {
  const account = await tx.account.findFirst({
    where: { id, workspaceId, ...(active ? { active: true } : {}) },
  });
  if (!account)
    throw new ApiError(400, "Seleccioná una cuenta activa de este espacio.");
  return account;
}
async function categoryFor(tx: Tx, workspaceId: string, id: string) {
  const category = await tx.category.findFirst({ where: { id, workspaceId } });
  if (!category)
    throw new ApiError(400, "Seleccioná una categoría de este espacio.");
  return category;
}
function found(count: number) {
  if (!count) throw new ApiError(404, "No encontramos ese registro.");
}
function validDate(
  date: string,
  accountDate: Date,
  today: string,
  future = false,
) {
  if (date < isoDate(accountDate) || (!future && date > today))
    throw new ApiError(
      400,
      "La fecha debe ser posterior al saldo inicial y no puede estar en el futuro.",
    );
}
export async function mutate(
  workspaceId: string,
  userId: string,
  key: string,
  command: Command,
  today: string,
) {
  const db = getDb(),
    hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  // Resolve payment against server data, never accept an amount supplied by the browser.
  return db.$transaction(
    async (tx) => {
      // Serialize writes within a workspace: avoids retries, concurrent edits and duplicate settlement races.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`;
      const previous = await tx.requestKey.findUnique({
        where: { workspaceId_key: { workspaceId, key } },
      });
      if (previous) {
        if (previous.payloadHash !== hash)
          throw new ApiError(
            409,
            "La clave de reintento ya se usó con otros datos.",
          );
        return;
      }
      const current = [
        "obligation.post",
        "debt.extra",
        "card.purchase",
      ].includes(command.action)
        ? await snapshot(workspaceId, tx)
        : undefined;
      const scheduled =
        command.action === "obligation.post"
          ? resolveObligation(current!.ledger, current!, command.key, today)
          : undefined;
      await tx.requestKey.create({
        data: { workspaceId, key, payloadHash: hash },
      });
      switch (command.action) {
        case "backup.restore":
          await restoreFinancialBackup(tx, workspaceId, command.data);
          break;
        case "fx.save": {
          if (command.data.date > today)
            throw new ApiError(
              400,
              "La cotización no puede estar en el futuro.",
            );
          const exists = await tx.fxRate.findFirst({
            where: { workspaceId, id: command.data.id },
          });
          const duplicate = await tx.fxRate.findFirst({
            where: {
              workspaceId,
              id: { not: command.data.id },
              date: toDate(command.data.date),
              OR: [
                { base: command.data.base, quote: command.data.quote },
                { base: command.data.quote, quote: command.data.base },
              ],
            },
          });
          if (duplicate)
            throw new ApiError(
              409,
              "Ya hay una cotización de este par para ese día. Eliminá la anterior para reemplazarla.",
            );
          const data = { ...command.data, date: toDate(command.data.date) };
          if (exists)
            await tx.fxRate.updateMany({
              where: { workspaceId, id: data.id },
              data,
            });
          else {
            if ((await tx.fxRate.count({ where: { workspaceId } })) >= 1000)
              throw new ApiError(
                400,
                "El límite es de 1.000 cotizaciones por espacio.",
              );
            await tx.fxRate.create({ data: { ...data, workspaceId } });
          }
          break;
        }
        case "fx.delete":
          found(
            (
              await tx.fxRate.deleteMany({
                where: { workspaceId, id: command.id },
              })
            ).count,
          );
          break;
        case "rule.save": {
          const data = command.data;
          await categoryFor(tx, workspaceId, data.categoryId);
          if (data.accountId) await accountFor(tx, workspaceId, data.accountId);
          const existing = await tx.rule.findFirst({
            where: { workspaceId, id: data.id },
          });
          if (existing)
            await tx.rule.updateMany({
              where: { workspaceId, id: data.id },
              data,
            });
          else {
            if ((await tx.rule.count({ where: { workspaceId } })) >= 100)
              throw new ApiError(
                400,
                "El límite es de 100 reglas por espacio.",
              );
            await tx.rule.create({ data: { ...data, workspaceId } });
          }
          break;
        }
        case "rule.delete":
          found(
            (
              await tx.rule.deleteMany({
                where: { workspaceId, id: command.id },
              })
            ).count,
          );
          break;
        case "rule.apply": {
          const source = await snapshot(workspaceId, tx);
          const requested = new Set(command.ids);
          if (
            source.ledger.transactions.filter((t) => requested.has(t.id))
              .length !== requested.size
          )
            throw new ApiError(
              404,
              "No encontramos todos los movimientos en este espacio.",
            );
          for (const change of ruleChanges(source.ledger, source.rules).filter(
            (c) => requested.has(c.transactionId),
          ))
            await tx.transaction.updateMany({
              where: { workspaceId, id: change.transactionId },
              data: { categoryId: change.categoryId },
            });
          break;
        }
        case "alerts.preferences":
          await tx.workspace.update({
            where: { id: workspaceId },
            data: { alertPreferences: command.data },
          });
          break;
        case "alerts.dismiss": {
          await tx.dismissedAlert.upsert({
            where: { workspaceId_key: { workspaceId, key: command.key } },
            create: { workspaceId, key: command.key },
            update: {},
          });
          const expired = await tx.dismissedAlert.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            skip: 2000,
            select: { key: true },
          });
          if (expired.length)
            await tx.dismissedAlert.deleteMany({
              where: { workspaceId, key: { in: expired.map((a) => a.key) } },
            });
          break;
        }
        case "alerts.reset":
          await tx.dismissedAlert.deleteMany({ where: { workspaceId } });
          break;
        case "account.save": {
          const data = command.data;
          if (data.openingDate > today)
            throw new ApiError(
              400,
              "El saldo inicial no puede estar en el futuro.",
            );
          if (data.kind === "credit")
            throw new ApiError(
              400,
              "Agregá las tarjetas desde la sección Tarjetas.",
            );
          const existing = await tx.account.findFirst({
            where: { id: data.id, workspaceId },
          });
          if (existing) {
            if (existing.currency !== data.currency)
              throw new ApiError(
                400,
                "La moneda de una cuenta no se puede cambiar. Creá una cuenta nueva.",
              );
            const earliest = await tx.transaction.findFirst({
              where: { workspaceId, accountId: data.id },
              orderBy: { date: "asc" },
            });
            if (earliest && data.openingDate > isoDate(earliest.date))
              throw new ApiError(
                400,
                "El saldo inicial debe ser anterior al primer movimiento.",
              );
            await tx.account.updateMany({
              where: { id: data.id, workspaceId },
              data: {
                name: data.name,
                openingMinor: data.openingMinor,
                openingDate: toDate(data.openingDate),
                kind: data.kind ?? "bank",
                liquid: data.liquid ?? true,
              },
            });
          } else
            await tx.account.create({
              data: {
                id: data.id,
                workspaceId,
                name: data.name,
                currency: data.currency,
                openingMinor: data.openingMinor,
                openingDate: toDate(data.openingDate),
                kind: data.kind ?? "bank",
                liquid: data.liquid ?? true,
              },
            });
          break;
        }
        case "account.toggle": {
          if (!command.active) {
            const commitments =
              (await tx.recurrence.count({
                where: { workspaceId, accountId: command.id, active: true },
              })) +
              (await tx.installmentPlan.count({
                where: { workspaceId, accountId: command.id, active: true },
              })) +
              (await tx.debt.count({
                where: { workspaceId, accountId: command.id, active: true },
              })) +
              (await tx.creditCard.count({
                where: { workspaceId, fundingAccountId: command.id },
              }));
            if (commitments)
              throw new ApiError(
                400,
                "Pausá primero las recurrencias y cuotas de esta cuenta.",
              );
          }
          found(
            (
              await tx.account.updateMany({
                where: { id: command.id, workspaceId },
                data: { active: command.active },
              })
            ).count,
          );
          break;
        }
        case "transaction.save": {
          const data = command.data;
          if (
            !["income", "expense"].includes(data.type) ||
            data.occurrenceKey ||
            data.transferId
          )
            throw new ApiError(
              400,
              "Usá las operaciones de transferencia o compromiso.",
            );
          const account = await accountFor(tx, workspaceId, data.accountId);
          validDate(data.date, account.openingDate, today);
          if (account.kind === "credit")
            throw new ApiError(400, "Registrá los consumos desde Tarjetas.");
          const category = await categoryFor(
            tx,
            workspaceId,
            data.categoryId ?? "",
          );
          const existing = await tx.transaction.findFirst({
            where: { id: data.id, workspaceId },
          });
          if (existing?.occurrenceKey || existing?.transferId)
            throw new ApiError(
              400,
              "Los movimientos vinculados se gestionan desde su operación original.",
            );
          const fields = {
            accountId: account.id,
            categoryId: category.id,
            type: typeMap[data.type],
            amountMinor: data.amountMinor,
            description: data.description,
            date: toDate(data.date),
          };
          if (existing)
            await tx.transaction.updateMany({
              where: { id: data.id, workspaceId },
              data: fields,
            });
          else
            await tx.transaction.create({
              data: { id: data.id, workspaceId, ...fields },
            });
          break;
        }
        case "transaction.delete": {
          const movement = await tx.transaction.findFirst({
            where: { id: command.id, workspaceId },
          });
          if (!movement)
            throw new ApiError(404, "No encontramos el movimiento.");
          if (
            movement.occurrenceKey?.startsWith("debt-received:") ||
            movement.occurrenceKey?.startsWith("debt-extra:") ||
            movement.occurrenceKey?.startsWith("card-purchase:")
          )
            throw new ApiError(
              400,
              "Este movimiento pertenece a una operación financiera y no se puede eliminar por separado.",
            );
          if (movement.transferId) {
            await tx.transaction.deleteMany({
              where: { workspaceId, transferId: movement.transferId },
            });
            await tx.transfer.deleteMany({
              where: { workspaceId, id: movement.transferId },
            });
          } else
            await tx.transaction.deleteMany({
              where: { workspaceId, id: movement.id },
            });
          break;
        }
        case "category.create":
          await tx.category.create({ data: { workspaceId, ...command.data } });
          break;
        case "recurrence.save": {
          const data = command.data,
            account = await accountFor(tx, workspaceId, data.accountId);
          await categoryFor(tx, workspaceId, data.categoryId);
          validDate(data.startDate, account.openingDate, today, true);
          const existing = await tx.recurrence.findFirst({
            where: { workspaceId, id: data.id },
          });
          if (existing) {
            const paid = await tx.transaction.findFirst({
              where: {
                workspaceId,
                occurrenceKey: { startsWith: `recurrence:${data.id}:` },
              },
            });
            if (
              paid &&
              (existing.accountId !== data.accountId ||
                existing.type !== typeMap[data.type] ||
                isoDate(existing.startDate) !== data.startDate ||
                (existing.endDate ? isoDate(existing.endDate) : null) !==
                  (data.endDate ?? null) ||
                existing.frequency !== data.frequency ||
                existing.interval !== data.interval)
            )
              throw new ApiError(
                400,
                "Este recurrente tiene pagos confirmados. Conservá cuenta, tipo y fechas; para cambiar el calendario, pausalo y creá uno nuevo.",
              );
            await tx.recurrence.updateMany({
              where: { workspaceId, id: data.id },
              data: {
                ...data,
                type: typeMap[data.type],
                startDate: toDate(data.startDate),
                endDate: data.endDate ? toDate(data.endDate) : null,
              },
            });
            break;
          }
          if ((await tx.recurrence.count({ where: { workspaceId } })) >= 100)
            throw new ApiError(
              400,
              "Alcanzaste el límite de 100 recurrencias.",
            );
          await tx.recurrence.create({
            data: {
              ...data,
              workspaceId,
              type: typeMap[data.type],
              startDate: toDate(data.startDate),
              endDate: data.endDate ? toDate(data.endDate) : null,
            },
          });
          break;
        }
        case "recurrence.toggle":
          found(
            (
              await tx.recurrence.updateMany({
                where: { id: command.id, workspaceId },
                data: { active: command.active },
              })
            ).count,
          );
          break;
        case "installment.save": {
          const data = command.data,
            account = await accountFor(tx, workspaceId, data.accountId);
          await categoryFor(tx, workspaceId, data.categoryId);
          validDate(data.purchaseDate, account.openingDate, today, true);
          if (data.repaymentAccountId || account.kind === "credit")
            throw new ApiError(400, "Registrá los consumos desde Tarjetas.");
          await tx.installmentPlan.create({
            data: {
              ...data,
              workspaceId,
              firstDate: toDate(data.firstDate),
              purchaseDate: toDate(data.purchaseDate),
            },
          });
          break;
        }
        case "installment.toggle": {
          const plan = await tx.installmentPlan.findFirst({
            where: { workspaceId, id: command.id },
          });
          if (plan?.repaymentAccountId)
            throw new ApiError(
              400,
              "Un consumo de tarjeta debe conservar su cronograma de pagos.",
            );
          found(
            (
              await tx.installmentPlan.updateMany({
                where: { id: command.id, workspaceId },
                data: { active: command.active },
              })
            ).count,
          );
          break;
        }
        case "obligation.post": {
          if (!scheduled)
            throw new ApiError(
              409,
              "Ese compromiso ya se registró o todavía no venció.",
            );
          const account = await accountFor(
            tx,
            workspaceId,
            scheduled.accountId,
          );
          validDate(command.date, account.openingDate, today);
          await categoryFor(tx, workspaceId, scheduled.categoryId);
          if (scheduled.repaymentAccountId) {
            const credit = await accountFor(
              tx,
              workspaceId,
              scheduled.repaymentAccountId,
            );
            if (
              credit.kind !== "credit" ||
              credit.currency !== account.currency
            )
              throw new ApiError(400, "La cuenta de la tarjeta no es válida.");
            const transferId = crypto.randomUUID();
            await tx.transaction.create({
              data: {
                workspaceId,
                accountId: account.id,
                categoryId: scheduled.categoryId,
                amountMinor: scheduled.amountMinor,
                type: "TRANSFER_OUT",
                description: scheduled.description,
                date: toDate(command.date),
                occurrenceKey: scheduled.key,
                transferId,
              },
            });
            await tx.transaction.create({
              data: {
                workspaceId,
                accountId: credit.id,
                categoryId: scheduled.categoryId,
                amountMinor: scheduled.amountMinor,
                type: "TRANSFER_IN",
                description: scheduled.description,
                date: toDate(command.date),
                transferId,
              },
            });
          } else
            await tx.transaction.create({
              data: {
                workspaceId,
                accountId: account.id,
                categoryId: scheduled.categoryId,
                amountMinor: scheduled.amountMinor,
                type: typeMap[scheduled.type],
                description: scheduled.description,
                date: toDate(command.date),
                occurrenceKey: scheduled.key,
              },
            });
          break;
        }
        case "budget.save": {
          const data = command.data;
          await categoryFor(tx, workspaceId, data.categoryId);
          if (
            await tx.budget.findFirst({ where: { workspaceId, id: data.id } })
          ) {
            const duplicate = await tx.budget.findFirst({
              where: {
                workspaceId,
                categoryId: data.categoryId,
                month: data.month,
                currency: data.currency,
                id: { not: data.id },
              },
            });
            if (duplicate)
              throw new ApiError(
                400,
                "Ya tenés un presupuesto para esa categoría, mes y moneda.",
              );
            await tx.budget.updateMany({
              where: { workspaceId, id: data.id },
              data,
            });
            break;
          }
          await tx.budget.upsert({
            where: {
              workspaceId_categoryId_month_currency: {
                workspaceId,
                categoryId: data.categoryId,
                month: data.month,
                currency: data.currency,
              },
            },
            create: { ...data, workspaceId },
            update: { amountMinor: data.amountMinor },
          });
          break;
        }
        case "budget.delete":
          found(
            (
              await tx.budget.deleteMany({
                where: { workspaceId, id: command.id },
              })
            ).count,
          );
          break;
        case "goal.save": {
          const data = command.data,
            fields = { ...data, targetDate: toDate(data.targetDate) };
          if (await tx.goal.findFirst({ where: { workspaceId, id: data.id } }))
            await tx.goal.updateMany({
              where: { workspaceId, id: data.id },
              data: fields,
            });
          else await tx.goal.create({ data: { ...fields, workspaceId } });
          break;
        }
        case "goal.delete":
          found(
            (
              await tx.goal.deleteMany({
                where: { workspaceId, id: command.id },
              })
            ).count,
          );
          break;
        case "transfer.create": {
          const data = command.data;
          if (data.fromId === data.toId)
            throw new ApiError(400, "Elegí dos cuentas diferentes.");
          const from = await accountFor(tx, workspaceId, data.fromId),
            to = await accountFor(tx, workspaceId, data.toId);
          if (from.kind === "credit" || to.kind === "credit")
            throw new ApiError(
              400,
              "Pagá la tarjeta confirmando sus compromisos en el calendario.",
            );
          validDate(data.date, from.openingDate, today);
          validDate(data.date, to.openingDate, today);
          if (
            from.currency === to.currency &&
            BigInt(data.amountMinor) !== BigInt(data.receivedMinor)
          )
            throw new ApiError(
              400,
              "La transferencia en la misma moneda debe conservar el importe.",
            );
          const category = await tx.category.findFirstOrThrow({
            where: { workspaceId, name: "Costos de transferencia" },
          });
          const common = {
            workspaceId,
            categoryId: category.id,
            transferId: data.id,
            date: toDate(data.date),
          };
          // Original debit and credit remain immutable; FX source and original amounts are auditable.
          const description = `${data.description.slice(0, 75)} · ${from.currency}/${to.currency} · ${data.fxSource.slice(0, 35)}`;
          await tx.transfer.create({
            data: {
              id: data.id,
              workspaceId,
              fromAccountId: from.id,
              toAccountId: to.id,
              fromCurrency: from.currency,
              toCurrency: to.currency,
              sentMinor: data.amountMinor,
              receivedMinor: data.receivedMinor,
              feeMinor: data.feeMinor,
              fxSource: data.fxSource,
              rateTimestamp: toDate(data.date),
              date: toDate(data.date),
            },
          });
          await tx.transaction.createMany({
            data: [
              {
                ...common,
                accountId: from.id,
                amountMinor: data.amountMinor,
                type: "TRANSFER_OUT",
                description,
              },
              {
                ...common,
                accountId: to.id,
                amountMinor: data.receivedMinor,
                type: "TRANSFER_IN",
                description,
              },
              ...(BigInt(data.feeMinor) > 0n
                ? [
                    {
                      ...common,
                      accountId: from.id,
                      amountMinor: data.feeMinor,
                      type: "EXPENSE" as const,
                      description: "Comisión de transferencia",
                    },
                  ]
                : []),
            ],
          });
          break;
        }
        case "ledger.import": {
          const data = command.data;
          const batch = await tx.importBatch.create({ data: { workspaceId } });
          let importedCount = 0;
          if (data.accounts.length > 100 || data.transactions.length > 2000)
            throw new ApiError(
              400,
              "Importá hasta 100 cuentas y 2000 movimientos por archivo.",
            );
          for (const account of data.accounts) {
            if (account.kind === "credit" || account.openingDate > today)
              throw new ApiError(
                400,
                "El archivo contiene una cuenta no admitida o futura.",
              );
            const existing = await tx.account.findFirst({
              where: { workspaceId, id: account.id },
            });
            if (!existing)
              await tx.account.create({
                data: {
                  id: account.id,
                  workspaceId,
                  name: account.name,
                  currency: account.currency,
                  openingMinor: account.openingMinor,
                  openingDate: toDate(account.openingDate),
                  kind: account.kind ?? "bank",
                  liquid: account.liquid ?? true,
                },
              });
          }
          for (const movement of data.transactions) {
            if (
              movement.transferId ||
              movement.occurrenceKey ||
              !["income", "expense"].includes(movement.type)
            )
              throw new ApiError(
                400,
                "La importación inicial admite ingresos y gastos manuales.",
              );
            const account = await accountFor(
              tx,
              workspaceId,
              movement.accountId,
            );
            validDate(movement.date, account.openingDate, today);
            if (
              await tx.transaction.findFirst({
                where: { workspaceId, id: movement.id },
              })
            )
              continue;
            const category = await tx.category.upsert({
              where: {
                workspaceId_name: { workspaceId, name: movement.category },
              },
              create: {
                workspaceId,
                name: movement.category,
                group: "Importadas",
              },
              update: {},
            });
            await tx.transaction.create({
              data: {
                id: movement.id,
                workspaceId,
                accountId: account.id,
                categoryId: category.id,
                type: typeMap[movement.type],
                amountMinor: movement.amountMinor,
                date: toDate(movement.date),
                description: movement.description,
                importBatchId: batch.id,
              },
            });
            importedCount++;
          }
          await tx.importBatch.update({
            where: { id: batch.id },
            data: { importedCount },
          });
          break;
        }
        case "import.rollback": {
          const batch = await tx.importBatch.findFirst({
            where: { id: command.id, workspaceId },
          });
          if (!batch)
            throw new ApiError(404, "No encontramos esa importación.");
          await tx.transaction.deleteMany({
            where: { workspaceId, importBatchId: batch.id },
          });
          await tx.importBatch.updateMany({
            where: { id: batch.id, workspaceId },
            data: { rolledBack: true },
          });
          break;
        }
        case "scenario.save": {
          const account = await accountFor(
            tx,
            workspaceId,
            command.data.accountId,
          );
          validDate(command.data.firstDate, account.openingDate, today, true);
          if (command.data.firstDate < today)
            throw new ApiError(
              400,
              "La simulación debe comenzar hoy o en el futuro.",
            );
          await tx.scenario.create({
            data: {
              id: command.data.id,
              workspaceId,
              name: command.data.name,
              events: command.data,
            },
          });
          break;
        }
        case "scenario.delete":
          found(
            (
              await tx.scenario.deleteMany({
                where: { workspaceId, id: command.id },
              })
            ).count,
          );
          break;
        case "debt.create": {
          const data = command.data;
          if (data.extras?.length)
            throw new ApiError(
              400,
              "Registrá los pagos extraordinarios después de crear el préstamo.",
            );
          const account = await accountFor(tx, workspaceId, data.accountId);
          if (account.kind === "credit")
            throw new ApiError(
              400,
              "El préstamo necesita una cuenta bancaria o billetera.",
            );
          validDate(data.disbursementDate, account.openingDate, today);
          await categoryFor(tx, workspaceId, data.categoryId);
          const { extras, ...fields } = data;
          await tx.debt.create({
            data: {
              ...fields,
              workspaceId,
              disbursementDate: toDate(data.disbursementDate),
              firstDate: toDate(data.firstDate),
            },
          });
          await tx.transaction.create({
            data: {
              workspaceId,
              accountId: account.id,
              categoryId: data.categoryId,
              type: "ADJUSTMENT_IN",
              amountMinor: data.receivedMinor,
              date: toDate(data.disbursementDate),
              description: `Desembolso · ${data.name}`,
              occurrenceKey: `debt-received:${data.id}`,
            },
          });
          break;
        }
        case "debt.extra": {
          const stored = await tx.debt.findFirst({
            where: { id: command.id, workspaceId },
            include: { extras: true },
          });
          if (!stored) throw new ApiError(404, "No encontramos el préstamo.");
          const debt = debtSchema.parse({
            ...stored,
            principalMinor: stored.principalMinor.toFixed(0),
            receivedMinor: stored.receivedMinor.toFixed(0),
            chargesMinor: stored.chargesMinor.toFixed(0),
            disbursementDate: isoDate(stored.disbursementDate),
            firstDate: isoDate(stored.firstDate),
            extras: stored.extras.map((e) => ({
              id: e.id,
              date: isoDate(e.date),
              amountMinor: e.amountMinor.toFixed(0),
            })),
          });
          if (command.date !== today)
            throw new ApiError(
              400,
              "Los pagos extraordinarios se registran con fecha de hoy.",
            );
          const posted = new Set(
            current!.ledger.transactions.map((t) => t.occurrenceKey),
          );
          if (
            debtSchedule(debt).some(
              (row) =>
                row.date <= today &&
                !posted.has(row.key) &&
                BigInt(row.totalMinor) > 0n,
            )
          )
            throw new ApiError(
              400,
              "Confirmá primero las cuotas vencidas de este préstamo.",
            );
          if (
            BigInt(command.amountMinor) >
            BigInt(debtBalance(debt, current!.ledger, today))
          )
            throw new ApiError(
              400,
              "El pago no puede superar el capital pendiente.",
            );
          const account = await accountFor(tx, workspaceId, debt.accountId);
          validDate(command.date, account.openingDate, today);
          const extra = await tx.debtExtraPayment.create({
            data: {
              workspaceId,
              debtId: debt.id,
              amountMinor: command.amountMinor,
              date: toDate(command.date),
            },
          });
          await tx.transaction.create({
            data: {
              workspaceId,
              accountId: debt.accountId,
              categoryId: debt.categoryId,
              type: "EXPENSE",
              amountMinor: command.amountMinor,
              date: toDate(command.date),
              description: `Pago extraordinario · ${debt.name}`,
              occurrenceKey: `debt-extra:${extra.id}`,
            },
          });
          break;
        }
        case "debt.toggle":
          found(
            (
              await tx.debt.updateMany({
                where: { workspaceId, id: command.id },
                data: { active: command.active },
              })
            ).count,
          );
          break;
        case "card.create": {
          const data = command.data,
            funding = await accountFor(tx, workspaceId, data.fundingAccountId);
          if (funding.kind === "credit" || funding.liquid === false)
            throw new ApiError(
              400,
              "Elegí una cuenta líquida para pagar los resúmenes.",
            );
          if (
            data.openingDate > today ||
            data.firstDueDate < data.openingDate ||
            BigInt(data.openingDebtMinor) > BigInt(data.limitMinor)
          )
            throw new ApiError(
              400,
              "Revisá las fechas y el límite de la tarjeta.",
            );
          await tx.account.create({
            data: {
              id: data.id,
              workspaceId,
              name: data.name,
              currency: funding.currency,
              openingMinor: (-BigInt(data.openingDebtMinor)).toString(),
              openingDate: toDate(data.openingDate),
              kind: "credit",
              liquid: false,
            },
          });
          await tx.creditCard.create({
            data: {
              workspaceId,
              accountId: data.id,
              fundingAccountId: funding.id,
              limitMinor: data.limitMinor,
              closingDay: data.closingDay,
              dueDay: data.dueDay,
            },
          });
          if (BigInt(data.openingDebtMinor) > 0n) {
            const category = await tx.category.findFirstOrThrow({
              where: { workspaceId, name: "Intereses de tarjeta" },
            });
            await tx.installmentPlan.create({
              data: {
                workspaceId,
                accountId: funding.id,
                categoryId: category.id,
                description: `${data.name} · Saldo inicial`,
                totalMinor: data.openingDebtMinor,
                downPaymentMinor: "0",
                purchaseDate: toDate(data.openingDate),
                count: 1,
                firstDate: toDate(data.firstDueDate),
                repaymentAccountId: data.id,
              },
            });
          }
          break;
        }
        case "card.purchase": {
          const data = command.data,
            card = await tx.creditCard.findFirst({
              where: { workspaceId, accountId: data.cardId },
            });
          if (!card) throw new ApiError(404, "No encontramos la tarjeta.");
          const account = await accountFor(tx, workspaceId, card.accountId);
          validDate(data.date, account.openingDate, today);
          await categoryFor(tx, workspaceId, data.categoryId);
          const available =
            BigInt(card.limitMinor.toFixed(0)) +
            BigInt(
              accountBalance(
                current!.ledger.accounts.find((a) => a.id === account.id)!,
                current!.ledger.transactions,
                today,
              ),
            );
          if (BigInt(data.totalMinor) > available)
            throw new ApiError(
              400,
              "La compra supera el límite disponible de la tarjeta.",
            );
          if (BigInt(data.totalMinor) < BigInt(data.count))
            throw new ApiError(
              400,
              "Cada cuota debe ser de al menos un centavo.",
            );
          await tx.installmentPlan.create({
            data: {
              id: data.id,
              workspaceId,
              accountId: card.fundingAccountId,
              categoryId: data.categoryId,
              description: data.description,
              totalMinor: data.totalMinor,
              downPaymentMinor: "0",
              purchaseDate: toDate(data.date),
              count: data.count,
              firstDate: toDate(
                statementDueDate(data.date, card.closingDay, card.dueDay),
              ),
              repaymentAccountId: card.accountId,
            },
          });
          await tx.transaction.create({
            data: {
              workspaceId,
              accountId: account.id,
              categoryId: data.categoryId,
              type: "EXPENSE",
              amountMinor: data.totalMinor,
              date: toDate(data.date),
              description: data.description,
              occurrenceKey: `card-purchase:${data.id}`,
            },
          });
          break;
        }
      }
      const [accountCount, transactionCount] = await Promise.all([
        tx.account.count({ where: { workspaceId } }),
        tx.transaction.count({ where: { workspaceId } }),
      ]);
      if (accountCount > 500 || transactionCount > 50000)
        throw new ApiError(
          400,
          "Este espacio alcanzó el límite de 500 cuentas o 50.000 movimientos. La operación no se guardó.",
        );
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: command.action,
          resourceId:
            "id" in command
              ? command.id
              : "data" in command && "id" in command.data
                ? command.data.id
                : undefined,
        },
      });
    },
    { timeout: command.action === "backup.restore" ? 120000 : 30000 },
  );
}
