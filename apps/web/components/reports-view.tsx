"use client";
import { useState } from "react";
import {
  financialReport,
  reportFilterSchema,
  transactionsCsv,
  formatMoney,
  type Currency,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import { downloadText } from "../lib/download";
export function ReportsView({
  data,
  currency,
}: {
  data: Snapshot;
  currency: Currency;
}) {
  const [from, setFrom] = useState(`${data.today.slice(0, 7)}-01`),
    [to, setTo] = useState(data.today),
    [accountId, setAccountId] = useState(""),
    [categoryId, setCategoryId] = useState("");
  const parsed = reportFilterSchema.safeParse({
    from,
    to,
    currency,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
  });
  const report = parsed.success
    ? financialReport(data.ledger, parsed.data)
    : null;
  const accounts = data.ledger.accounts.filter((a) => a.currency === currency);
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Entendé tus movimientos</h2>
            <p className="muted">
              Ingresos y gastos registrados en {currency} durante el período
              elegido.
            </p>
          </div>
          <button
            className="secondary"
            disabled={!report?.transactions.length}
            onClick={() =>
              downloadText(
                transactionsCsv(data.ledger, report!.transactions),
                `finora-informe-${currency}-${from}-${to}.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            Exportar informe CSV
          </button>
        </div>
        <div className="report-filters">
          <label htmlFor="report-from">
            Desde
            <input
              id="report-from"
              type="date"
              value={from}
              max={to || data.today}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label htmlFor="report-to">
            Hasta
            <input
              id="report-to"
              type="date"
              value={to}
              min={from}
              max={data.today}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label htmlFor="report-account">
            Cuenta del informe
            <select
              id="report-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Todas las cuentas en {currency}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.active === false ? " · Inactiva" : ""}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="report-category">
            Categoría del informe
            <select
              id="report-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted report-note">
          Se excluyen transferencias y ajustes de los totales. Las compras con
          tarjeta cuentan en la fecha del consumo; sus pagos no vuelven a sumar
          gasto. Los pagos de préstamo incluyen capital, intereses y cargos
          registrados. El resultado no representa tu saldo disponible.
        </p>
        {!parsed.success && (
          <p role="alert" className="error">
            {parsed.error.issues.find((issue) => issue.code === "custom")
              ?.message ?? "Elegí una fecha inicial y final válidas."}
          </p>
        )}
      </section>
      {report && (
        <>
          <section
            className="report-totals section-gap"
            aria-label="Totales del informe"
          >
            {[
              ["Ingresos", report.incomeMinor],
              ["Gastos", report.expenseMinor],
              ["Resultado registrado", report.netMinor],
            ].map(([label, amount]) => (
              <article className="panel" key={label}>
                <p className="muted">{label}</p>
                <strong>{formatMoney(amount!, currency)}</strong>
              </article>
            ))}
          </section>
          {!report.count ? (
            <section className="panel section-gap empty">
              <h3>No hay ingresos ni gastos en este período</h3>
              <p>
                Cambiá las fechas o los filtros para consultar tu historial.
              </p>
            </section>
          ) : (
            <section className="panel section-gap">
              <h2>¿En qué gastaste más?</h2>
              <p className="muted">
                {report.count} ingresos y gastos registrados. Distribución de
                los gastos por categoría.
              </p>
              {report.categories.length ? (
                report.categories.map((c) => (
                  <div className="report-category" key={c.id}>
                    <div>
                      <strong>{c.name}</strong>
                      <span>{formatMoney(c.amountMinor, currency)}</span>
                    </div>
                    <progress
                      max={100}
                      value={c.percent}
                      aria-label={`${c.name}: ${c.percent}% de gastos`}
                    />
                    <small>
                      {c.percent.toLocaleString("es-AR")}% · {c.count}{" "}
                      movimientos
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted">
                  No hay gastos; los movimientos de este período son ingresos.
                </p>
              )}
            </section>
          )}
          <section className="panel section-gap">
            <h2>Mes a mes</h2>
            <p className="muted">
              Los meses inicial y final incluyen únicamente las fechas
              seleccionadas.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Ingresos</th>
                    <th>Gastos</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((m) => (
                    <tr key={m.month}>
                      <th>{m.month}</th>
                      <td>{formatMoney(m.incomeMinor, currency)}</td>
                      <td>{formatMoney(m.expenseMinor, currency)}</td>
                      <td>{formatMoney(m.netMinor, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
