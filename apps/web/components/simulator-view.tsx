"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  simulatePurchase,
  purchaseSchema,
  parseMoney,
  formatMoney,
  type Currency,
  type Purchase,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
export function SimulatorView({
  data,
  currency,
  onAction,
}: {
  data: Snapshot;
  currency: Currency;
  onAction: (command: Command) => Promise<void>;
}) {
  const [purchase, setPurchase] = useState<Purchase | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const purchaseId = useRef("");
  const accounts = data.ledger.accounts.filter(
    (a) => a.active !== false && a.currency === currency && a.liquid !== false,
  );
  const result = purchase
    ? simulatePurchase(data.ledger, data, currency, data.today, purchase)
    : null;
  const scenarios = data.scenarios.filter((s) => {
    const parsed = purchaseSchema.safeParse(s.events);
    return (
      parsed.success && accounts.some((a) => a.id === parsed.data.accountId)
    );
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const next = purchaseSchema.parse({
        accountId: form.get("accountId"),
        totalMinor: parseMoney(String(form.get("amount"))),
        count: Number(form.get("count")),
        firstDate: form.get("date"),
      });
      simulatePurchase(data.ledger, data, currency, data.today, next);
      setPurchase(next);
      purchaseId.current = crypto.randomUUID();
      setName(String(form.get("name")));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Revisá el importe y la fecha.",
      );
    }
  }
  return (
    <>
      <section className="panel simulator-panel">
        <div>
          <p className="eyebrow">¿PUEDO COMPRARLO?</p>
          <h2>Probá antes de decidir.</h2>
          <p className="muted">
            Compará tu proyección actual con una compra en efectivo o cuotas.
            Tus datos reales siguen intactos.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="sim-name">
              ¿Qué querés comprar?
              <input
                id="sim-name"
                name="name"
                placeholder="Ej. Una notebook"
                required
                maxLength={80}
              />
            </label>
            <label htmlFor="sim-amount">
              Precio total en {currency}
              <input
                id="sim-amount"
                name="amount"
                inputMode="decimal"
                required
                placeholder="0,00"
              />
            </label>
            <div className="form-grid">
              <label htmlFor="sim-count">
                Pagos
                <input
                  id="sim-count"
                  name="count"
                  type="number"
                  min={1}
                  max={36}
                  defaultValue={1}
                  required
                />
              </label>
              <label htmlFor="sim-date">
                Primer pago
                <input
                  id="sim-date"
                  name="date"
                  type="date"
                  min={data.today}
                  defaultValue={data.today}
                  required
                />
              </label>
            </div>
            <label htmlFor="sim-account">
              Cuenta
              <select id="sim-account" name="accountId" required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={!accounts.length} className="save">
              Calcular impacto
            </button>
          </form>
        </div>
        <div className="simulation-result">
          {result ? (
            <>
              <span className="tag">CÁLCULO DETERMINISTA</span>
              <h3>{name}</h3>
              <p>
                Primer pago:{" "}
                <strong>{formatMoney(result.firstPayment, currency)}</strong>
              </p>
              <div
                className={
                  result.negativeMonths.length ? "warning-box" : "success-box"
                }
              >
                {result.negativeMonths.length ? (
                  <>
                    <strong>
                      Atención: aparecen meses con saldo negativo.
                    </strong>
                    <p>{result.negativeMonths.join(", ")}</p>
                  </>
                ) : (
                  <>
                    <strong>
                      No aparecen saldos negativos en los 12 meses analizados.
                    </strong>
                    <p>
                      El resultado depende de que los ingresos y compromisos
                      registrados sean completos.
                    </p>
                  </>
                )}
              </div>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await onAction({
                      action: "scenario.save",
                      data: { id: crypto.randomUUID(), name, ...purchase! },
                    });
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "No pudimos guardar el escenario.",
                    );
                  }
                }}
              >
                Guardar escenario
              </button>
              <label htmlFor="apply-category">
                Categoría para la compra
                <select
                  id="apply-category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Elegí una categoría</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="save"
                disabled={!categoryId}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "¿Crear este compromiso real? Sus pagos aparecerán en el calendario y reducirán tu disponible. No se registrará un gasto hasta confirmar cada pago.",
                    )
                  )
                    return;
                  try {
                    await onAction({
                      action: "installment.save",
                      data: {
                        id: purchaseId.current,
                        accountId: purchase!.accountId,
                        categoryId,
                        description: name,
                        totalMinor: purchase!.totalMinor,
                        downPaymentMinor: "0",
                        count: purchase!.count,
                        firstDate: purchase!.firstDate,
                        purchaseDate: data.today,
                        active: true,
                      },
                    });
                    setPurchase(null);
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "No pudimos aplicar la compra.",
                    );
                  }
                }}
              >
                Aplicar a planificación
              </button>
              <p className="panel-foot">
                Los objetivos no son egresos automáticos. Evaluá el impacto
                sobre tu ahorro antes de aplicar la compra.
              </p>
            </>
          ) : (
            <div className="empty">
              <span aria-hidden="true">✳</span>
              <h3>La próxima decisión, más clara.</h3>
              <p>Cargá una compra para ver su impacto mes a mes.</p>
            </div>
          )}
        </div>
      </section>
      {result && (
        <section className="panel section-gap">
          <h2>Actual vs. compra</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Saldo actual</th>
                  <th>Con la compra</th>
                </tr>
              </thead>
              <tbody>
                {result.baseline.map((point, i) => (
                  <tr key={point.month}>
                    <th>{point.month}</th>
                    <td>{formatMoney(point.closing, currency)}</td>
                    <td
                      className={
                        result.scenario[i]!.negative ? "danger-text" : ""
                      }
                    >
                      {formatMoney(result.scenario[i]!.closing, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel section-gap">
        <h2>Escenarios guardados</h2>
        {!scenarios.length ? (
          <p className="muted">Guardá una simulación para retomarla después.</p>
        ) : (
          scenarios.map((s) => (
            <div className="account-row" key={s.id}>
              <strong>{s.name}</strong>
              <div className="actions-row">
                <button
                  className="text-button"
                  onClick={() => {
                    const parsed = purchaseSchema.safeParse(s.events);
                    if (parsed.success) {
                      setPurchase(parsed.data);
                      purchaseId.current = crypto.randomUUID();
                      setName(s.name);
                    } else setError("No pudimos leer este escenario.");
                  }}
                >
                  Comparar
                </button>
                <button
                  className="text-button danger-text"
                  onClick={() => {
                    if (window.confirm("¿Eliminar este escenario?"))
                      onAction({ action: "scenario.delete", id: s.id });
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
