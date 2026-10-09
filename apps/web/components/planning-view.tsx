"use client";
import { useMemo, useState } from "react";
import {
  obligations,
  monthEnd,
  addMonths,
  formatMoney,
  project,
  type Currency,
  type Recurrence,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
import { dateLabel } from "../lib/client-api";
import { PlanningHighlights } from "./planning-highlights";
import { downloadText } from "../lib/download";
import { calendarExport } from "../lib/calendar-export";
export function PlanningView({
  data,
  currency,
  onCreate,
  onEdit,
  onUpgrade,
  onAction,
}: {
  data: Snapshot;
  currency: Currency;
  onCreate: (kind: "recurrence" | "installment" | "planned") => void;
  onEdit: (item: Recurrence) => void;
  onUpgrade: () => void;
  onAction: (command: Command) => void;
}) {
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const [period, setPeriod] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(data.today);
  const [horizon, setHorizon] = useState(
      data.workspace.plan === "PRO" ? 12 : 3,
    ),
    [accountId, setAccountId] = useState("");
  const ids = new Set(
    data.ledger.accounts
      .filter((a) => a.currency === currency)
      .map((a) => a.id),
  );
  const weekEnd = new Date(`${selectedDate}T12:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const from = period === "month" ? `${month}-01` : selectedDate;
  const through =
    period === "month"
      ? monthEnd(from)
      : period === "day"
        ? selectedDate
        : weekEnd.toISOString().slice(0, 10);
  function navigate(direction: number) {
    if (period === "month")
      setMonth(addMonths(`${month}-01`, direction).slice(0, 7));
    else {
      const date = new Date(`${selectedDate}T12:00:00Z`);
      date.setUTCDate(
        date.getUTCDate() + direction * (period === "week" ? 7 : 1),
      );
      setSelectedDate(date.toISOString().slice(0, 10));
    }
  }
  const events = obligations(data.ledger, data, from, through).filter(
    (e) => ids.has(e.accountId) && (!accountId || e.accountId === accountId),
  );
  const projection = useMemo(
    () =>
      project(
        {
          ...data.ledger,
          accounts: data.ledger.accounts.filter(
            (a) => !accountId || a.id === accountId,
          ),
        },
        data,
        currency,
        data.today,
        horizon,
      ),
    [data, accountId, currency, horizon],
  );
  const maximum = projection.reduce((max, point) => {
    const value = BigInt(point.closing);
    return (value < 0n ? -value : value) > max
      ? value < 0n
        ? -value
        : value
      : max;
  }, 1n);
  return (
    <>
      <PlanningHighlights data={data} currency={currency} />
      <section className="panel">
        <div className="panel-heading">
          <h2>Calendario financiero</h2>
          <div className="actions-row">
            <button onClick={() => onCreate("planned")}>+ Gasto futuro</button>
            <button
              className="secondary"
              onClick={() => onCreate("recurrence")}
            >
              + Recurrente
            </button>
            <button onClick={() => onCreate("installment")}>
              + Compra en cuotas
            </button>
          </div>
        </div>
        <div className="calendar-controls">
          <label htmlFor="calendar-period">
            Vista
            <select
              id="calendar-period"
              aria-label="Vista"
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
            >
              <option value="month">Mes</option>
              <option value="week">Semana</option>
              <option value="day">Día</option>
            </select>
          </label>
          {period !== "month" && (
            <label htmlFor="calendar-date">
              {period === "week" ? "Inicio de la semana" : "Día"}
              <input
                id="calendar-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
              />
            </label>
          )}
          <button
            className="secondary"
            aria-label={
              period === "month"
                ? "Mes anterior"
                : period === "week"
                  ? "Semana anterior"
                  : "Día anterior"
            }
            onClick={() => navigate(-1)}
          >
            ←
          </button>
          {period === "month" && (
            <label htmlFor="calendarMonth">
              Mes
              <input
                id="calendarMonth"
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
              />
            </label>
          )}
          <button
            className="secondary"
            aria-label={
              period === "month"
                ? "Mes siguiente"
                : period === "week"
                  ? "Semana siguiente"
                  : "Día siguiente"
            }
            onClick={() => navigate(1)}
          >
            →
          </button>
        </div>
        <p className="muted">
          Del {dateLabel(from, true)} al {dateLabel(through, true)} ·{" "}
          {events.length} compromisos pendientes
        </p>
        <button
          className="secondary"
          disabled={!events.length}
          onClick={() =>
            downloadText(
              calendarExport(events, currency),
              `finora-calendario-${currency}-${from}.ics`,
              "text/calendar;charset=utf-8",
            )
          }
        >
          Descargar calendario ICS
        </button>
        <p className="panel-foot">
          El archivo permite importar estos vencimientos en tu calendario. Es
          una copia del período elegido; no se sincroniza automáticamente.
        </p>
        {!events.length ? (
          <div className="empty">
            <h3>Un mes por planificar</h3>
            <p>
              Agregá recurrentes o cuotas para ver ingresos y vencimientos en
              este calendario.
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div className="transaction-row" key={event.key}>
              <span className="date-chip" title={dateLabel(event.date, true)}>
                {dateLabel(event.date)}
              </span>
              <div className="movement-info">
                <strong>{event.description}</strong>
                <small>
                  {
                    data.ledger.accounts.find((a) => a.id === event.accountId)
                      ?.name
                  }{" "}
                  ·{" "}
                  {event.date < data.today
                    ? "Vencido"
                    : event.source === "installment"
                      ? "Cuota"
                      : event.source === "debt"
                        ? "Préstamo"
                        : "Recurrente"}
                </small>
              </div>
              <strong className="row-amount">
                {event.type === "income" ? "+" : "−"}
                {formatMoney(event.amountMinor, currency)}
              </strong>
              {event.date <= data.today && (
                <button
                  className="text-button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Confirmar ${event.description} por ${formatMoney(event.amountMinor, currency)} con fecha de hoy?`,
                      )
                    )
                      onAction({
                        action: "obligation.post",
                        key: event.key,
                        date: data.today,
                      });
                  }}
                >
                  Confirmar
                </button>
              )}
            </div>
          ))
        )}
        <p className="panel-foot">
          Confirmá solo cuando el ingreso o pago suceda. La confirmación
          actualiza el saldo y evita duplicar el compromiso.
        </p>
      </section>
      <section className="panel section-gap">
        <div className="panel-heading">
          <h2>Proyección a {horizon} meses</h2>
          <span className="tag">Sin inflación ni tasas supuestas</span>
        </div>
        <div className="form-grid">
          <label htmlFor="projection-horizon">
            Horizonte
            <select
              id="projection-horizon"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              {(data.workspace.plan === "PRO" ? [3, 6, 12, 24, 36] : [3]).map(
                (n) => (
                  <option key={n} value={n}>
                    {n} meses
                  </option>
                ),
              )}
            </select>
          </label>
          <label htmlFor="projection-account">
            Cuenta proyectada
            <select
              id="projection-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Todas las cuentas líquidas</option>
              {data.ledger.accounts
                .filter(
                  (a) =>
                    a.currency === currency &&
                    a.active !== false &&
                    a.kind !== "credit" &&
                    a.liquid !== false,
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {data.workspace.plan !== "PRO" && (
          <button className="secondary" onClick={onUpgrade}>
            Ampliar a 36 meses con Pro
          </button>
        )}
        <div
          className="projection-chart"
          role="img"
          aria-label="Saldos proyectados por mes"
        >
          {projection.map((point) => {
            const value = BigInt(point.closing);
            const height = Number(
              ((value < 0n ? -value : value) * 100n) / maximum,
            );
            return (
              <div key={point.month} className="chart-column">
                <div
                  className={`chart-bar ${point.negative ? "chart-negative" : ""}`}
                  style={{ height: `${Math.max(3, height)}%` }}
                  title={`${point.month}: ${formatMoney(point.closing, currency)}`}
                />
                <span>{point.month.slice(5)}</span>
              </div>
            );
          })}
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Proyección mensual según compromisos registrados
            </caption>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Ingresos previstos</th>
                <th>Compromisos</th>
                <th>Saldo al cierre</th>
              </tr>
            </thead>
            <tbody>
              {projection.map((p) => (
                <tr key={p.month}>
                  <th>{dateLabel(`${p.month}-01`, true)}</th>
                  <td>{formatMoney(p.income, currency)}</td>
                  <td>{formatMoney(p.expense, currency)}</td>
                  <td className={p.negative ? "danger-text" : ""}>
                    {formatMoney(p.closing, currency)}
                    {p.negative ? " · Negativo" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-foot">
          El primer mes incluye gastos vencidos aún pendientes. No se presuponen
          ingresos que ya deberían haber ocurrido.
        </p>
      </section>
      <div className="panels section-gap">
        <section className="panel">
          <h2>Recurrentes y gastos previstos</h2>
          {data.recurrences
            .filter((r) => ids.has(r.accountId))
            .map((r) => (
              <div className="account-row" key={r.id}>
                <div>
                  <strong>{r.description}</strong>
                  <small>
                    {formatMoney(r.amountMinor, currency)} ·{" "}
                    {r.endDate === r.startDate
                      ? "Una vez"
                      : r.frequency === "monthly"
                        ? "Mensual"
                        : r.frequency === "weekly"
                          ? "Semanal"
                          : r.frequency === "daily"
                            ? "Diario"
                            : "Anual"}{" "}
                    · {r.active ? "Activo" : "Pausado"}
                  </small>
                </div>
                <button className="text-button" onClick={() => onEdit(r)}>
                  Editar recurrente
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    onAction({
                      action: "recurrence.toggle",
                      id: r.id,
                      active: !r.active,
                    })
                  }
                >
                  {r.active ? "Pausar" : "Activar"}
                </button>
              </div>
            ))}
        </section>
        <section className="panel">
          <h2>Compras en cuotas</h2>
          {data.installments
            .filter((p) => ids.has(p.accountId))
            .map((p) => (
              <div className="account-row" key={p.id}>
                <div>
                  <strong>{p.description}</strong>
                  <small>
                    {p.count} cuotas · Total{" "}
                    {formatMoney(p.totalMinor, currency)} ·{" "}
                    {p.active ? "Activa" : "Pausada"}
                  </small>
                </div>
                {!p.repaymentAccountId && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        !p.active ||
                        window.confirm(
                          "¿Pausar este cronograma? Dejará de aparecer en la proyección y disponible real.",
                        )
                      )
                        onAction({
                          action: "installment.toggle",
                          id: p.id,
                          active: !p.active,
                        });
                    }}
                  >
                    {p.active ? "Pausar" : "Activar"}
                  </button>
                )}
              </div>
            ))}
        </section>
      </div>
    </>
  );
}
