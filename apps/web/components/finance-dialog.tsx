"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  parseMoney,
  parseSignedMoney,
  matchingRule,
  type Rule,
  type Account,
  type Transaction,
  type Goal,
  type Budget,
  type Recurrence,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
import { decimalInput } from "../lib/client-api";
export type FormKind =
  | "account"
  | "transaction"
  | "transfer"
  | "recurrence"
  | "planned"
  | "installment"
  | "budget"
  | "goal"
  | "category";
export type EditItem = Account | Transaction | Goal | Budget | Recurrence;
const titles: Record<FormKind, string> = {
  account: "Tu cuenta",
  transaction: "Registrar movimiento",
  transfer: "Transferir entre cuentas",
  recurrence: "Nuevo recurrente",
  planned: "Gasto futuro",
  installment: "Compra en cuotas",
  budget: "Presupuesto mensual",
  goal: "Tu objetivo",
  category: "Nueva categoría",
};
function Field({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={name}>
      {label}
      {children}
    </label>
  );
}
export function FinanceDialog({
  kind,
  data,
  edit,
  onClose,
  onSave,
  initialType = "expense",
}: {
  kind: FormKind;
  data: Snapshot;
  edit?: EditItem;
  onClose: () => void;
  onSave: (command: Command) => Promise<void>;
  initialType?: "income" | "expense";
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const [suggestion, setSuggestion] = useState<Rule | undefined>();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const accountEdit =
    kind === "account" ? (edit as Account | undefined) : undefined;
  const txEdit =
    kind === "transaction" ? (edit as Transaction | undefined) : undefined;
  const goalEdit = kind === "goal" ? (edit as Goal | undefined) : undefined;
  const budgetEdit =
    kind === "budget" ? (edit as Budget | undefined) : undefined;
  const recurrenceEdit =
    kind === "recurrence" ? (edit as Recurrence | undefined) : undefined;
  const [id] = useState(() => edit?.id ?? crypto.randomUUID());
  const accounts = data.ledger.accounts.filter(
    (a) => a.active !== false && a.kind !== "credit",
  );
  const categories = data.categories.filter((c) =>
    `${c.name} ${c.group}`
      .toLocaleLowerCase("es")
      .includes(query.toLocaleLowerCase("es")),
  );
  const accountSelect = (name = "accountId", label = "Cuenta") => (
    <Field name={name} label={label}>
      <select
        id={name}
        name={name}
        defaultValue={txEdit?.accountId ?? recurrenceEdit?.accountId}
        required
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency})
          </option>
        ))}
      </select>
    </Field>
  );
  const categorySelect = (
    <>
      <Field name="categorySearch" label="Buscar categoría">
        <input
          id="categorySearch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej. pan, combustible, alquiler"
        />
      </Field>
      <Field name="categoryId" label="Categoría">
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={
            txEdit?.categoryId ??
            budgetEdit?.categoryId ??
            recurrenceEdit?.categoryId
          }
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.group} · {c.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
  const currencySelect = (
    <Field name="currency" label="Moneda">
      <select
        id="currency"
        name="currency"
        defaultValue={
          accountEdit?.currency ??
          goalEdit?.currency ??
          budgetEdit?.currency ??
          data.workspace.baseCurrency
        }
        disabled={Boolean(accountEdit)}
      >
        {["ARS", "USD", "EUR"].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      {accountEdit && (
        <input type="hidden" name="currency" value={accountEdit.currency} />
      )}
    </Field>
  );
  const amount = (name = "amount", label = "Importe", value = "") => (
    <Field name={name} label={label}>
      <input
        id={name}
        name={name}
        inputMode="decimal"
        placeholder="0,00"
        defaultValue={value}
        required
      />
    </Field>
  );
  const date = (
    name = "date",
    label = "Fecha",
    value = data.today,
    max?: string,
  ) => (
    <Field name={name} label={label}>
      <input
        id={name}
        name={name}
        type="date"
        defaultValue={value}
        max={max}
        min={kind === "planned" ? data.today : undefined}
        required
      />
    </Field>
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget),
      get = (key: string) => String(form.get(key) ?? ""),
      money = (key: string) => parseMoney(get(key));
    try {
      const rule =
        kind === "transaction" && !txEdit && form.get("useRules") === "on"
          ? matchingRule(data.rules, {
              description: get("description"),
              accountId: get("accountId"),
              type: get("type") as "income" | "expense",
            })
          : undefined;
      const chosenCategory = rule?.categoryId ?? get("categoryId");
      let command: Command;
      if (kind === "account")
        command = {
          action: "account.save",
          data: {
            id,
            name: get("name"),
            currency: get("currency") as Account["currency"],
            openingMinor: parseSignedMoney(get("amount")),
            openingDate: get("date"),
            kind: get("kind") as Account["kind"],
            liquid: form.get("liquid") === "on",
          },
        };
      else if (kind === "transaction")
        command = {
          action: "transaction.save",
          data: {
            id,
            accountId: get("accountId"),
            categoryId: chosenCategory,
            category:
              data.categories.find((c) => c.id === chosenCategory)?.name ??
              "Otros",
            type: get("type") as "income" | "expense",
            amountMinor: money("amount"),
            description: get("description"),
            date: get("date"),
          },
        };
      else if (kind === "transfer")
        command = {
          action: "transfer.create",
          data: {
            id,
            fromId: get("fromId"),
            toId: get("toId"),
            amountMinor: money("amount"),
            receivedMinor: money("received"),
            feeMinor: money("fee"),
            date: get("date"),
            description: get("description"),
            fxSource: get("source"),
          },
        };
      else if (kind === "recurrence" || kind === "planned")
        command = {
          action: "recurrence.save",
          data: {
            id,
            accountId: get("accountId"),
            categoryId: get("categoryId"),
            description: get("description"),
            type: get("type") as "income" | "expense",
            amountMinor: money("amount"),
            startDate: get("date"),
            endDate: kind === "planned" ? get("date") : get("endDate") || null,
            frequency: (kind === "planned" ? "monthly" : get("frequency")) as
              "daily" | "weekly" | "monthly" | "yearly",
            interval: kind === "planned" ? 1 : Number(get("interval")),
            active: recurrenceEdit?.active ?? true,
          },
        };
      else if (kind === "installment")
        command = {
          action: "installment.save",
          data: {
            id,
            accountId: get("accountId"),
            categoryId: get("categoryId"),
            description: get("description"),
            totalMinor: money("amount"),
            downPaymentMinor: money("down"),
            purchaseDate: get("date"),
            count: Number(get("count")),
            firstDate: get("firstDate"),
            active: true,
          },
        };
      else if (kind === "budget")
        command = {
          action: "budget.save",
          data: {
            id,
            categoryId: get("categoryId"),
            month: get("month"),
            currency: get("currency") as Account["currency"],
            amountMinor: money("amount"),
          },
        };
      else if (kind === "goal")
        command = {
          action: "goal.save",
          data: {
            id,
            name: get("name"),
            currency: get("currency") as Account["currency"],
            targetMinor: money("amount"),
            savedMinor: money("saved"),
            targetDate: get("date"),
          },
        };
      else
        command = {
          action: "category.create",
          data: { name: get("name"), group: get("group") },
        };
      await onSave(command);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revisá los datos.");
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <form
        onSubmit={submit}
        onChange={(event) => {
          if (kind !== "transaction" || txEdit) return;
          const form = new FormData(event.currentTarget);
          setSuggestion(
            form.get("useRules") === "on"
              ? matchingRule(data.rules, {
                  description: String(form.get("description") ?? ""),
                  accountId: String(form.get("accountId") ?? ""),
                  type: form.get("type") as "income" | "expense",
                })
              : undefined,
          );
        }}
      >
        {kind === "transaction" && !txEdit && data.rules.length > 0 && (
          <>
            <label className="checkbox-label">
              <input type="checkbox" name="useRules" defaultChecked />
              Usar mis reglas de categoría
            </label>
            {suggestion && (
              <p role="status" className="success-box">
                Regla «{suggestion.name}»: se guardará en{" "}
                {
                  data.categories.find((c) => c.id === suggestion.categoryId)
                    ?.name
                }
                . Desmarcá la opción para usar tu selección manual.
              </p>
            )}
          </>
        )}
        <div className="panel-heading">
          <h2 id="dialog-title">{titles[kind]}</h2>
          <button
            type="button"
            className="text-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar formulario"
          >
            ✕
          </button>
        </div>
        {kind === "account" && (
          <>
            <Field name="name" label="Nombre">
              <input
                id="name"
                name="name"
                autoFocus
                defaultValue={accountEdit?.name}
                required
                maxLength={80}
              />
            </Field>
            {currencySelect}
            <Field name="kind" label="Tipo">
              <select
                id="kind"
                name="kind"
                defaultValue={accountEdit?.kind ?? "bank"}
              >
                <option value="bank">Banco</option>
                <option value="cash">Efectivo</option>
                <option value="wallet">Billetera virtual</option>
                <option value="investment">Inversiones</option>
                <option value="other">Otra</option>
              </select>
            </Field>
            {amount(
              "amount",
              "Saldo inicial",
              accountEdit ? decimalInput(accountEdit.openingMinor) : "0",
            )}
            {date(
              "date",
              "Fecha del saldo inicial",
              accountEdit?.openingDate ?? data.today,
              data.today,
            )}
            <label className="check-label">
              <input
                name="liquid"
                type="checkbox"
                defaultChecked={accountEdit?.liquid !== false}
              />
              Incluir en liquidez
            </label>
          </>
        )}
        {["transaction", "recurrence"].includes(kind) && (
          <Field name="type" label="Tipo de movimiento">
            <select
              id="type"
              name="type"
              defaultValue={txEdit?.type ?? recurrenceEdit?.type ?? initialType}
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </Field>
        )}
        {["transaction", "recurrence", "installment", "planned"].includes(
          kind,
        ) && (
          <>
            {amount(
              "amount",
              kind === "installment"
                ? "Precio total, incluidos intereses y cargos"
                : "Importe",
              txEdit
                ? decimalInput(txEdit.amountMinor)
                : recurrenceEdit
                  ? decimalInput(recurrenceEdit.amountMinor)
                  : "",
            )}
            <Field name="description" label="Descripción">
              <input
                id="description"
                name="description"
                defaultValue={
                  txEdit?.description ?? recurrenceEdit?.description
                }
                required
                maxLength={140}
              />
            </Field>
            {accountSelect()}
            {categorySelect}
            {date(
              "date",
              kind === "installment"
                ? "Fecha de compra"
                : kind === "recurrence"
                  ? "Fecha de inicio"
                  : kind === "planned"
                    ? "Fecha prevista del gasto"
                    : "Fecha",
              txEdit?.date ?? recurrenceEdit?.startDate ?? data.today,
              kind === "transaction" ? data.today : undefined,
            )}
          </>
        )}
        {kind === "planned" && (
          <>
            <input name="type" type="hidden" value="expense" />
            <p className="muted">
              Se registra una sola vez como compromiso. Reduce tu disponible y
              aparece en la proyección; el saldo de la cuenta se actualiza
              cuando confirmás que lo pagaste.
            </p>
          </>
        )}
        {kind === "recurrence" && (
          <>
            <div className="form-grid">
              <Field name="frequency" label="Frecuencia">
                <select
                  id="frequency"
                  name="frequency"
                  defaultValue={recurrenceEdit?.frequency ?? "monthly"}
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              </Field>
              <Field name="interval" label="Cada cuántos períodos">
                <input
                  id="interval"
                  name="interval"
                  type="number"
                  min={1}
                  max={36}
                  defaultValue={recurrenceEdit?.interval ?? 1}
                  required
                />
              </Field>
            </div>
            <Field name="endDate" label="Fecha final (opcional)">
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={recurrenceEdit?.endDate ?? ""}
              />
            </Field>
            <p className="muted">
              Aparece como compromiso. Confirmá cada ocurrencia cuando
              efectivamente suceda.
              {recurrenceEdit &&
                " Los cambios de importe afectan las ocurrencias pendientes. Si ya confirmaste pagos, se conservan la cuenta, el tipo y el calendario original."}
            </p>
          </>
        )}
        {kind === "installment" && (
          <>
            {amount("down", "Anticipo", "0")}
            <Field name="count" label="Cantidad de cuotas">
              <input
                id="count"
                name="count"
                type="number"
                min={1}
                max={120}
                defaultValue={3}
                required
              />
            </Field>
            {date("firstDate", "Primera cuota")}
            <p className="muted">
              Las cuotas reparten exactamente el total financiado. El anticipo
              queda pendiente hasta que lo confirmes.
            </p>
          </>
        )}
        {kind === "transfer" && (
          <>
            {accountSelect("fromId", "Cuenta de origen")}
            {accountSelect("toId", "Cuenta de destino")}
            {amount("amount", "Importe enviado")}
            {amount("received", "Importe recibido en la moneda de destino")}
            {amount("fee", "Comisión en la moneda de origen", "0")}
            <Field name="description" label="Descripción">
              <input
                id="description"
                name="description"
                defaultValue="Transferencia entre mis cuentas"
                required
                maxLength={140}
              />
            </Field>
            <Field name="source" label="Fuente del cambio">
              <input
                id="source"
                name="source"
                defaultValue="Tipo de cambio manual"
                required
                maxLength={80}
              />
            </Field>
            {date("date", "Fecha", data.today, data.today)}
            <p className="muted">
              Los importes enviados y recibidos quedan guardados. La comisión es
              un gasto; la transferencia no es un ingreso.
            </p>
          </>
        )}
        {kind === "budget" && (
          <>
            {categorySelect}
            {currencySelect}
            <Field name="month" label="Mes">
              <input
                id="month"
                name="month"
                type="month"
                defaultValue={budgetEdit?.month ?? data.today.slice(0, 7)}
                required
              />
            </Field>
            {amount(
              "amount",
              "Límite mensual",
              budgetEdit ? decimalInput(budgetEdit.amountMinor) : "",
            )}
          </>
        )}
        {kind === "goal" && (
          <>
            <Field name="name" label="Nombre del objetivo">
              <input
                id="name"
                name="name"
                defaultValue={goalEdit?.name}
                placeholder="Ej. Fondo de emergencia"
                maxLength={80}
                required
              />
            </Field>
            {currencySelect}
            {amount(
              "amount",
              "Monto objetivo",
              goalEdit ? decimalInput(goalEdit.targetMinor) : "",
            )}
            {amount(
              "saved",
              "Monto ya reservado",
              goalEdit ? decimalInput(goalEdit.savedMinor) : "0",
            )}
            {date("date", "Fecha objetivo", goalEdit?.targetDate ?? data.today)}
            <p className="muted">
              Reservar un importe acá no mueve dinero entre cuentas ni suma
              patrimonio.
            </p>
          </>
        )}
        {kind === "category" && (
          <>
            <Field name="name" label="Nombre">
              <input id="name" name="name" maxLength={80} required />
            </Field>
            <Field name="group" label="Grupo">
              <input
                id="group"
                name="group"
                defaultValue="Personalizadas"
                maxLength={80}
                required
              />
            </Field>
          </>
        )}
        <p className="muted form-hint">
          Importes sin separadores de miles; hasta dos decimales.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="save" disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </dialog>
  );
}
