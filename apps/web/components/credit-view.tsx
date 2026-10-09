"use client";
import { useState, useRef, type FormEvent } from "react";
import {
  cardSummary,
  debtSchedule,
  debtBalance,
  parseMoney,
  formatMoney,
  type Currency,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
type Mode = "card" | "purchase" | "debt";
export function CreditView({
  view,
  data,
  currency,
  onAction,
  initialMode = null,
}: {
  view: "Tarjetas" | "Préstamos";
  data: Snapshot;
  currency: Currency;
  onAction: (command: Command) => Promise<void>;
  initialMode?: Mode | null;
}) {
  const [mode, setMode] = useState<Mode | null>(initialMode),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const operationId = useRef(crypto.randomUUID());
  function openForm(next: Mode) {
    operationId.current = crypto.randomUUID();
    setError("");
    setMode(next);
  }
  const accounts = data.ledger.accounts.filter(
    (a) =>
      a.active !== false &&
      a.kind !== "credit" &&
      a.currency === currency &&
      a.liquid !== false,
  );
  const cards = data.cards.filter(
    (c) =>
      data.ledger.accounts.find((a) => a.id === c.accountId)?.currency ===
      currency,
  );
  const debts = data.debts.filter(
    (d) =>
      data.ledger.accounts.find((a) => a.id === d.accountId)?.currency ===
      currency,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget),
      get = (key: string) => String(form.get(key) ?? ""),
      money = (key: string) => parseMoney(get(key));
    try {
      const id = operationId.current;
      let command: Command;
      if (mode === "card")
        command = {
          action: "card.create",
          data: {
            id,
            name: get("name"),
            fundingAccountId: get("accountId"),
            limitMinor: money("limit"),
            openingDebtMinor: money("consumed"),
            openingDate: get("date"),
            firstDueDate: get("firstDate"),
            closingDay: Number(get("closingDay")),
            dueDay: Number(get("dueDay")),
          },
        };
      else if (mode === "purchase")
        command = {
          action: "card.purchase",
          data: {
            id,
            cardId: get("cardId"),
            categoryId: get("categoryId"),
            description: get("name"),
            totalMinor: money("amount"),
            count: Number(get("count")),
            date: get("date"),
          },
        };
      else
        command = {
          action: "debt.create",
          data: {
            id,
            accountId: get("accountId"),
            categoryId: get("categoryId"),
            name: get("name"),
            principalMinor: money("amount"),
            receivedMinor: money("received"),
            chargesMinor: money("charges"),
            monthlyRate: get("rate"),
            system: get("system") as "french" | "german" | "american",
            count: Number(get("count")),
            disbursementDate: get("date"),
            firstDate: get("firstDate"),
            active: true,
          },
        };
      await onAction(command);
      setMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revisá los datos.");
    } finally {
      setBusy(false);
    }
  }
  async function extra(id: string) {
    const amount = window.prompt(
      "Importe del pago extraordinario de capital (sin separadores de miles):",
    );
    if (!amount) return;
    try {
      const amountMinor = parseMoney(amount);
      if (
        !window.confirm(
          `¿Registrar un pago extraordinario de ${formatMoney(amountMinor, currency)}? Se descontará de la cuenta y del capital pendiente.`,
        )
      )
        return;
      await onAction({
        action: "debt.extra",
        id,
        amountMinor,
        date: data.today,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos registrar el pago.",
      );
    }
  }
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>{view}</h2>
          <div className="actions-row">
            {view === "Tarjetas" && (
              <button
                className="secondary"
                disabled={!cards.length}
                onClick={() => openForm("purchase")}
              >
                + Registrar consumo
              </button>
            )}
            <button
              disabled={!accounts.length}
              onClick={() => openForm(view === "Tarjetas" ? "card" : "debt")}
            >
              + {view === "Tarjetas" ? "Agregar tarjeta" : "Agregar préstamo"}
            </button>
          </div>
        </div>
        {!accounts.length && (
          <p className="muted">
            Primero agregá una cuenta líquida en {currency} para pagar los
            vencimientos.
          </p>
        )}
        {mode && (
          <form className="credit-form" onSubmit={submit}>
            <div className="panel-heading">
              <h3>
                {mode === "card"
                  ? "Nueva tarjeta"
                  : mode === "purchase"
                    ? "Consumo de tarjeta"
                    : "Nuevo préstamo"}
              </h3>
              <button
                className="text-button"
                type="button"
                onClick={() => setMode(null)}
                disabled={busy}
              >
                Cancelar
              </button>
            </div>
            <label htmlFor="credit-name">
              {mode === "purchase" ? "Descripción" : "Nombre"}
              <input id="credit-name" name="name" maxLength={80} required />
            </label>
            {mode !== "purchase" && (
              <label htmlFor="credit-account">
                Cuenta de pago ({currency})
                <select id="credit-account" name="accountId" required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mode === "card" ? (
              <>
                <div className="form-grid">
                  <label htmlFor="credit-limit">
                    Límite total
                    <input
                      id="credit-limit"
                      name="limit"
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label htmlFor="credit-consumed">
                    Saldo de deuda inicial
                    <input
                      id="credit-consumed"
                      name="consumed"
                      inputMode="decimal"
                      defaultValue="0"
                      required
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label htmlFor="credit-closing">
                    Día de cierre
                    <input
                      id="credit-closing"
                      name="closingDay"
                      type="number"
                      min={1}
                      max={31}
                      defaultValue={25}
                      required
                    />
                  </label>
                  <label htmlFor="credit-due">
                    Día de vencimiento
                    <input
                      id="credit-due"
                      name="dueDay"
                      type="number"
                      min={1}
                      max={31}
                      defaultValue={10}
                      required
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label htmlFor="credit-amount">
                  {mode === "purchase"
                    ? "Precio total, incluidos intereses y cargos"
                    : "Capital del préstamo"}
                  <input
                    id="credit-amount"
                    name="amount"
                    inputMode="decimal"
                    required
                  />
                </label>
                <label htmlFor="credit-category">
                  Categoría
                  <select id="credit-category" name="categoryId" required>
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.group} · {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="credit-count">
                  Cantidad de cuotas
                  <input
                    id="credit-count"
                    name="count"
                    type="number"
                    min={1}
                    max={mode === "debt" ? 360 : 120}
                    defaultValue={6}
                    required
                  />
                </label>
              </>
            )}
            {mode === "purchase" && (
              <label htmlFor="credit-card">
                Tarjeta
                <select id="credit-card" name="cardId" required>
                  {cards.map((c) => (
                    <option key={c.accountId} value={c.accountId}>
                      {
                        data.ledger.accounts.find((a) => a.id === c.accountId)
                          ?.name
                      }
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mode === "debt" && (
              <>
                <div className="form-grid">
                  <label htmlFor="credit-received">
                    Importe efectivamente recibido
                    <input
                      id="credit-received"
                      name="received"
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label htmlFor="credit-charges">
                    Cargos fijos por cuota
                    <input
                      id="credit-charges"
                      name="charges"
                      inputMode="decimal"
                      defaultValue="0"
                      required
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label htmlFor="credit-rate">
                    Tasa mensual (%)
                    <input
                      id="credit-rate"
                      name="rate"
                      inputMode="decimal"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label htmlFor="credit-system">
                    Amortización
                    <select id="credit-system" name="system">
                      <option value="french">Francés</option>
                      <option value="german">Alemán</option>
                      <option value="american">Americano</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            <div className="form-grid">
              <label htmlFor="credit-date">
                {mode === "debt"
                  ? "Desembolso"
                  : mode === "card"
                    ? "Fecha del saldo"
                    : "Fecha de compra"}
                <input
                  id="credit-date"
                  name="date"
                  type="date"
                  defaultValue={data.today}
                  max={data.today}
                  required
                />
              </label>
              {mode !== "purchase" && (
                <label htmlFor="credit-firstDate">
                  {mode === "card"
                    ? "Vencimiento del saldo inicial"
                    : "Primera cuota"}
                  <input
                    id="credit-firstDate"
                    name="firstDate"
                    type="date"
                    defaultValue={data.today}
                    required
                  />
                </label>
              )}
            </div>
            <p className="muted">
              {mode === "debt"
                ? "El desembolso aumenta liquidez y deuda; no se cuenta como ingreso. La tasa mensual es ingresada, no se presume un CFT."
                : mode === "card"
                  ? "El saldo inicial se descuenta del patrimonio y se programa para el vencimiento elegido."
                  : "El consumo se registra una vez. El cierre determina el primer resumen; los pagos serán transferencias a la tarjeta."}
            </p>
            <button disabled={busy}>
              {busy ? "Guardando…" : "Guardar operación"}
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {view === "Tarjetas" ? (
          !cards.length ? (
            <div className="empty">
              <h3>Tus tarjetas, sin sorpresas</h3>
              <p>
                Agregá límite, cierre y vencimiento para separar deuda total de
                próximos pagos.
              </p>
            </div>
          ) : (
            <div className="account-grid">
              {cards.map((card) => {
                const summary = cardSummary(
                  data.ledger,
                  data,
                  card,
                  data.today,
                );
                return (
                  <article className="account-tile" key={card.accountId}>
                    <span className="tag">CRÉDITO · {currency}</span>
                    <h3>
                      {
                        data.ledger.accounts.find(
                          (a) => a.id === card.accountId,
                        )?.name
                      }
                    </h3>
                    <p className="muted">Deuda total</p>
                    <strong className="account-total">
                      {formatMoney(summary.consumed, currency)}
                    </strong>
                    <p>
                      Disponible del límite:{" "}
                      {formatMoney(summary.available, currency)}
                    </p>
                    <p>
                      Próximo resumen:{" "}
                      <strong>{formatMoney(summary.next, currency)}</strong>
                    </p>
                    <p className="muted">
                      {summary.nextDate ?? "Sin vencimientos"} · Cuotas
                      posteriores {formatMoney(summary.future, currency)}
                    </p>
                    <p className="panel-foot">
                      Cierra el {card.closingDay} · Vence el {card.dueDay}.
                      Confirmá pagos en Planificación.
                    </p>
                    <details>
                      <summary>Ver cronograma</summary>
                      {summary.events.slice(0, 36).map((e) => (
                        <div className="account-row" key={e.key}>
                          <span>{e.date}</span>
                          <strong>
                            {formatMoney(e.amountMinor, currency)}
                          </strong>
                        </div>
                      ))}
                    </details>
                  </article>
                );
              })}
            </div>
          )
        ) : !debts.length ? (
          <div className="empty">
            <h3>Separá deuda de cuota</h3>
            <p>
              Cargá un préstamo para ver capital pendiente, intereses y pagos
              futuros.
            </p>
          </div>
        ) : (
          debts.map((debt) => (
            <article className="debt-card" key={debt.id}>
              <div className="panel-heading">
                <div>
                  <h3>{debt.name}</h3>
                  <p className="muted">
                    Capital pendiente:{" "}
                    <strong>
                      {formatMoney(
                        debtBalance(debt, data.ledger, data.today),
                        currency,
                      )}
                    </strong>
                  </p>
                </div>
                <button className="secondary" onClick={() => extra(debt.id)}>
                  Pago extraordinario
                </button>
              </div>
              <p className="muted">
                Tasa mensual ingresada: {debt.monthlyRate}% · {debt.count}{" "}
                cuotas · Sin cálculo automático de CFT.
              </p>
              <details>
                <summary>Ver cuadro de amortización</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuota</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Capital</th>
                        <th>Interés</th>
                        <th>Cargos</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debtSchedule(debt).map((row) => (
                        <tr key={row.key}>
                          <th>{row.number}</th>
                          <td>{row.date}</td>
                          <td>{formatMoney(row.totalMinor, currency)}</td>
                          <td>{formatMoney(row.principalMinor, currency)}</td>
                          <td>{formatMoney(row.interestMinor, currency)}</td>
                          <td>{formatMoney(row.chargesMinor, currency)}</td>
                          <td>{formatMoney(row.balanceMinor, currency)}</td>
                          <td>
                            {data.ledger.transactions.some(
                              (t) => t.occurrenceKey === row.key,
                            )
                              ? "Pagada"
                              : "Pendiente"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          ))
        )}
      </section>
    </>
  );
}
