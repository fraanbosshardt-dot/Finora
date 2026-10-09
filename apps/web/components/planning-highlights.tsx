import { planningBrief, formatMoney, type Currency } from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import { dateLabel } from "../lib/client-api";
export function PlanningHighlights({
  data,
  currency,
}: {
  data: Snapshot;
  currency: Currency;
}) {
  const brief = planningBrief(
    data.ledger,
    data,
    data.goals,
    data.budgets,
    currency,
    data.today,
  );
  if (!brief.goals.length && !brief.debts.length && !brief.budgets.length)
    return null;
  return (
    <section
      className="planning-highlights section-gap"
      aria-label="Objetivos, préstamos y presupuestos"
    >
      {brief.goals.map((g) => (
        <article key={g.id} className="panel">
          <div className="panel-heading">
            <h2>{g.name}</h2>
            <strong>{g.percent}%</strong>
          </div>
          <progress
            max={100}
            value={Math.min(100, g.percent)}
            aria-label={`Avance de ${g.name}`}
          />
          <p className="muted">
            Aporte mensual necesario:{" "}
            {formatMoney(g.contributionMinor, currency)} para llegar el{" "}
            {dateLabel(g.targetDate)}.
          </p>
        </article>
      ))}
      {brief.debts.map((d) => (
        <article className="panel" key={d.id}>
          <div className="panel-heading">
            <h2>{d.name}</h2>
            <strong>
              {d.next
                ? formatMoney(d.next.totalMinor, currency)
                : "Sin cuotas pendientes"}
            </strong>
          </div>
          <progress
            max={100}
            value={d.percent}
            aria-label={`Pagos confirmados de ${d.name}`}
          />
          <p className="muted">
            {d.paidCount} de {d.count} pagos confirmados. Capital pendiente:{" "}
            {formatMoney(d.remainingMinor, currency)}.
            {d.next ? ` Próximo pago: ${dateLabel(d.next.date)}.` : ""}
          </p>
          <a className="text-button" href="/app?tab=Simular%20pr%C3%A9stamo">
            Simular cancelación anticipada →
          </a>
        </article>
      ))}
      {brief.budgets.length > 0 && (
        <article className="panel">
          <h2>Presupuestos de este mes</h2>
          {brief.budgets.map((b) => (
            <div className="planning-budget" key={b.id}>
              <div className="panel-heading">
                <strong>
                  {data.categories.find((c) => c.id === b.categoryId)?.name}
                </strong>
                <small>
                  {formatMoney(b.used, currency)} de{" "}
                  {formatMoney(b.amountMinor, currency)}
                </small>
              </div>
              <progress
                max={100}
                value={Math.min(100, b.percent)}
                aria-label="Presupuesto usado"
                className={
                  b.percent > 100
                    ? "over-budget"
                    : b.percent >= 80
                      ? "near-budget"
                      : ""
                }
              />
              <p className={b.percent > 100 ? "danger-text" : "muted"}>
                {b.percent > 100
                  ? `Superado por ${formatMoney(b.overMinor, currency)}`
                  : b.percent >= 80
                    ? "Cerca del límite"
                    : `En camino, usaste el ${b.percent}%`}
              </p>
            </div>
          ))}
        </article>
      )}
    </section>
  );
}
