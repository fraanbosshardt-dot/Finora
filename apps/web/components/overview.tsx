import {
  financialSummary,
  summarize,
  formatMoney,
  obligations,
  monthEnd,
  netWorth,
  type Currency,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import { dateLabel } from "../lib/client-api";
export function Overview({
  data,
  currency,
  onView,
  onRegister,
  simulatorSeen,
}: {
  data: Snapshot;
  currency: Currency;
  onView: (view: string) => void;
  onRegister: () => void;
  simulatorSeen: boolean;
}) {
  const summary = financialSummary(data.ledger, data, currency, data.today),
    flow = summarize(data.ledger, currency, data.today);
  const ids = new Set(
    data.ledger.accounts
      .filter((a) => a.currency === currency)
      .map((a) => a.id),
  );
  const upcoming = obligations(
    data.ledger,
    data,
    "1900-01-01",
    monthEnd(data.today),
  )
    .filter((e) => ids.has(e.accountId))
    .slice(0, 5);
  const steps = [
    {
      label: "Crear una cuenta",
      done: data.ledger.accounts.length > 0,
      view: "Cuentas",
    },
    {
      label: "Registrar un ingreso",
      done: data.ledger.transactions.some((t) => t.type === "income"),
      view: "Movimientos",
    },
    {
      label: "Registrar un gasto",
      done: data.ledger.transactions.some((t) => t.type === "expense"),
      view: "Movimientos",
    },
    {
      label: "Agregar un compromiso futuro",
      done:
        data.recurrences.length + data.installments.length + data.debts.length >
        0,
      view: "Planificación",
    },
    {
      label:
        data.workspace.plan === "PRO"
          ? "Probar ¿Puedo comprarlo?"
          : "Crear un objetivo de ahorro",
      done:
        data.workspace.plan === "PRO" ? simulatorSeen : data.goals.length > 0,
      view: data.workspace.plan === "PRO" ? "Simulador" : "Objetivos",
    },
  ];
  return (
    <>
      <section className="stats" aria-label="Resumen financiero">
        <article className="balance-card">
          <div className="card-caption">
            Disponible real <span aria-hidden="true">↗</span>
          </div>
          <strong>{formatMoney(summary.available, currency)}</strong>
          <p>Después de compromisos hasta fin de mes</p>
          <div className="balance-foot">
            Liquidez {formatMoney(summary.liquid, currency)} · Comprometido{" "}
            {formatMoney(summary.committed, currency)}
          </div>
          <div className="balance-actions">
            <button onClick={() => onView("Simulador")}>
              ¿Puedo comprarlo?
            </button>
            <button onClick={onRegister}>Registrar</button>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon">↙</span>
          <p>Ingresos del mes</p>
          <strong>{formatMoney(flow.income, currency)}</strong>
          <span className="muted">Movimientos confirmados</span>
        </article>
        <article className="stat-card">
          <span className="stat-icon expense-icon">↗</span>
          <p>Gastos del mes</p>
          <strong>{formatMoney(flow.expense, currency)}</strong>
          <span className="muted">Las transferencias no son gasto</span>
        </article>
      </section>
      <section className="panel mobile-month-summary">
        <h2>Este mes</h2>
        {[
          ["Ingresos", flow.income],
          ["Gastos", flow.expense],
          ["Compromisos pendientes", summary.committed],
        ].map(([label, amount]) => (
          <div className="dc-value-row" key={label}>
            <span>{label}</span>
            <strong>{formatMoney(amount!, currency)}</strong>
          </div>
        ))}
        <div className="dc-value-row month-closing">
          <strong>Proyección de cierre</strong>
          <strong>{formatMoney(summary.closing, currency)}</strong>
        </div>
      </section>
      <div className="flow">
        <div>
          <h3>Así puede cerrar tu mes</h3>
          <p className="muted">
            Con los ingresos previstos y compromisos pendientes que registraste.
          </p>
        </div>
        <strong>{formatMoney(summary.closing, currency)}</strong>
      </div>
      <div className="panels">
        <section className="panel">
          <div className="panel-heading">
            <h2>Próximos compromisos</h2>
            <button
              className="text-button"
              onClick={() => onView("Planificación")}
            >
              Ver calendario →
            </button>
          </div>
          {upcoming.length ? (
            upcoming.map((event) => (
              <div className="account-row" key={event.key}>
                <span className="account-icon" aria-hidden="true">
                  {event.type === "income" ? "↙" : "↗"}
                </span>
                <div>
                  <strong>{event.description}</strong>
                  <small>
                    {dateLabel(event.date)}
                    {event.date < data.today ? " · Vencido" : ""}
                  </small>
                </div>
                <strong className="row-amount">
                  {event.type === "income" ? "+" : "−"}
                  {formatMoney(event.amountMinor, currency)}
                </strong>
              </div>
            ))
          ) : (
            <div className="empty">
              <h3>Un mes sin compromisos registrados</h3>
              <p>
                Sumá un gasto fijo o tu ingreso habitual para mirar hacia
                adelante.
              </p>
              <button onClick={() => onView("Planificación")}>
                Planificar mi mes
              </button>
            </div>
          )}
        </section>
        <section className="panel decision-card">
          <p className="eyebrow">DECIDÍ CON NÚMEROS</p>
          <h2>¿Puedo comprarlo?</h2>
          <p className="muted">
            Probá una compra y compará cómo cambia tu saldo durante los próximos
            12 meses.
          </p>
          <button onClick={() => onView("Simulador")}>
            Simular una compra →
          </button>
          <p className="panel-foot">
            La simulación no modifica tus movimientos.
          </p>
        </section>
      </div>
      <section className="next-step">
        <div>
          <span className="eyebrow">UNA MIRADA COMPLETA</span>
          <h3>Patrimonio neto en {currency}</h3>
          <p>
            Saldos de tus cuentas menos tarjetas y capital pendiente de
            préstamos. Los objetivos no se suman otra vez.
          </p>
        </div>
        <strong className="wealth-amount">
          {formatMoney(
            netWorth(data.ledger, data.debts, currency, data.today),
            currency,
          )}
        </strong>
      </section>
      <section className="panel section-gap first-steps">
        <div className="panel-heading">
          <h2>Primeros pasos</h2>
          <span>{steps.filter((s) => s.done).length} de 5</span>
        </div>
        {steps.map((step) => (
          <button
            className="step-choice"
            key={step.label}
            onClick={() => onView(step.view)}
          >
            <span
              className={step.done ? "step-done" : "step-pending"}
              aria-label={step.done ? "Completado" : "Pendiente"}
            >
              {step.done ? "✓" : ""}
            </span>
            {step.label}
          </button>
        ))}
      </section>
    </>
  );
}
