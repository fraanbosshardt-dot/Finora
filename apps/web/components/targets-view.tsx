import {
  budgetProgress,
  goalContribution,
  formatMoney,
  type Goal,
  type Budget,
  type Currency,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
import { dateLabel } from "../lib/client-api";
export function TargetsView({
  view,
  data,
  currency,
  onCreate,
  onEdit,
  onAction,
}: {
  view: "Presupuestos" | "Objetivos";
  data: Snapshot;
  currency: Currency;
  onCreate: () => void;
  onEdit: (item: Goal | Budget) => void;
  onAction: (command: Command) => void;
}) {
  const budgets = data.budgets.filter((b) => b.currency === currency),
    goals = data.goals.filter((g) => g.currency === currency);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{view}</h2>
        <button onClick={onCreate}>
          + {view === "Presupuestos" ? "Crear presupuesto" : "Crear objetivo"}
        </button>
      </div>
      {view === "Presupuestos" ? (
        budgets.length ? (
          <div className="account-grid">
            {budgets.map((b) => {
              const progress = budgetProgress(data.ledger, b);
              return (
                <article className="account-tile" key={b.id}>
                  <span className="tag">{b.month}</span>
                  <h3>
                    {data.categories.find((c) => c.id === b.categoryId)?.name}
                  </h3>
                  <p className="muted">
                    {formatMoney(progress.used, currency)} de{" "}
                    {formatMoney(b.amountMinor, currency)}
                  </p>
                  <progress
                    max={100}
                    value={Math.min(progress.percent, 100)}
                    aria-label="Porcentaje del presupuesto usado"
                  />
                  <p
                    className={
                      BigInt(progress.remaining) < 0n ? "danger-text" : "muted"
                    }
                  >
                    {BigInt(progress.remaining) < 0n
                      ? "Presupuesto superado"
                      : "Restante"}
                    : {formatMoney(progress.remaining, currency)}
                  </p>
                  <button className="text-button" onClick={() => onEdit(b)}>
                    Editar presupuesto
                  </button>
                  <button
                    className="text-button danger-text"
                    onClick={() => {
                      if (window.confirm("¿Eliminar este presupuesto?"))
                        onAction({ action: "budget.delete", id: b.id });
                    }}
                  >
                    Eliminar
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <h3>Dale un límite a cada categoría</h3>
            <p>
              Definí cuánto querés gastar por mes y comparalo con tus
              movimientos.
            </p>
          </div>
        )
      ) : goals.length ? (
        <div className="account-grid">
          {goals.map((g) => (
            <article className="account-tile" key={g.id}>
              <h3>{g.name}</h3>
              <p className="muted">
                {formatMoney(g.savedMinor, currency)} de{" "}
                {formatMoney(g.targetMinor, currency)}
              </p>
              <progress
                max={100}
                value={Math.min(
                  100,
                  Number((BigInt(g.savedMinor) * 100n) / BigInt(g.targetMinor)),
                )}
                aria-label={`Avance de ${g.name}`}
              />
              <p className="muted">Objetivo: {dateLabel(g.targetDate, true)}</p>
              <p>
                Aporte mensual necesario:{" "}
                <strong>
                  {formatMoney(goalContribution(g, data.today), currency)}
                </strong>
              </p>
              <div className="actions-row">
                <button className="text-button" onClick={() => onEdit(g)}>
                  Actualizar
                </button>
                <button
                  className="text-button danger-text"
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Eliminar este objetivo? No se modificarán tus cuentas.",
                      )
                    )
                      onAction({ action: "goal.delete", id: g.id });
                  }}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>Un objetivo transforma el ahorro</h3>
          <p>
            Elegí un monto y una fecha. Te mostramos el aporte necesario, sin
            asumir rendimientos.
          </p>
        </div>
      )}
    </section>
  );
}
