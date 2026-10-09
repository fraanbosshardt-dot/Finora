"use client";
import { useState, useMemo, useDeferredValue } from "react";
import {
  formatMoney,
  transactionsCsv,
  type Currency,
  type Transaction,
} from "@finora/core";
import { downloadText } from "../lib/download";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
import { dateLabel } from "../lib/client-api";
export function MovementsView({
  data,
  currency,
  onEdit,
  onAction,
  onTransfer,
  newTransactionId,
}: {
  data: Snapshot;
  currency: Currency;
  onEdit: (transaction?: Transaction) => void;
  onAction: (command: Command) => void;
  onTransfer: () => void;
  newTransactionId?: string;
}) {
  const [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [month, setMonth] = useState(""),
    [accountId, setAccountId] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [page, setPage] = useState(0);
  const deferredSearch = useDeferredValue(search).toLocaleLowerCase("es");
  const ids = useMemo(
    () =>
      new Set(
        data.ledger.accounts
          .filter((a) => a.currency === currency)
          .map((a) => a.id),
      ),
    [data.ledger.accounts, currency],
  );
  const filtered = useMemo(
    () =>
      data.ledger.transactions.filter(
        (t) =>
          ids.has(t.accountId) &&
          (!accountId || t.accountId === accountId) &&
          (!categoryId || t.categoryId === categoryId) &&
          (type === "all" || type === "transfer"
            ? type === "all" || t.transferId
            : t.type === type) &&
          (!month || t.date.startsWith(month)) &&
          `${t.description} ${t.category}`
            .toLocaleLowerCase("es")
            .includes(deferredSearch),
      ),
    [
      data.ledger.transactions,
      ids,
      accountId,
      categoryId,
      type,
      month,
      deferredSearch,
    ],
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 20) - 1),
  );
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Movimientos</h2>
        <div className="actions-row">
          <button
            className="secondary"
            disabled={!filtered.length}
            onClick={() =>
              downloadText(
                transactionsCsv(data.ledger, filtered),
                `finora-movimientos-${currency}-${data.today}.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            Exportar CSV
          </button>
          <button
            className="secondary"
            onClick={onTransfer}
            disabled={
              data.ledger.accounts.filter((a) => a.active !== false).length < 2
            }
          >
            Transferir
          </button>
          <button onClick={() => onEdit()}>+ Registrar</button>
        </div>
      </div>
      <div className="filters">
        <label htmlFor="filterAccount">
          Cuenta
          <select
            id="filterAccount"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            {data.ledger.accounts
              .filter((a) => a.currency === currency)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.active === false ? " · Inactiva" : ""}
                </option>
              ))}
          </select>
        </label>
        <label htmlFor="filterCategory">
          Categoría
          <select
            id="filterCategory"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="search">
          Buscar
          <input
            id="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Descripción o categoría"
          />
        </label>
        <label htmlFor="filterType">
          Tipo
          <select
            id="filterType"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
            <option value="transfer">Transferencias</option>
          </select>
        </label>
        <label htmlFor="filterMonth">
          Mes
          <input
            id="filterMonth"
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {!visible.length ? (
        <div className="empty">
          <h3>Sin movimientos para esta búsqueda</h3>
          <p>Cambiá los filtros o registrá tu primer ingreso o gasto.</p>
        </div>
      ) : (
        visible.map((t) => (
          <div
            className={`transaction-row ${t.id === newTransactionId ? "new-transaction" : ""}`}
            key={t.id}
          >
            <span className="account-icon" aria-hidden="true">
              {["income", "transferIn", "adjustmentIn"].includes(t.type)
                ? "↙"
                : "↗"}
            </span>
            <div className="movement-info">
              <strong>{t.description}</strong>
              <small>
                {t.category} · {dateLabel(t.date)} ·{" "}
                {data.ledger.accounts.find((a) => a.id === t.accountId)?.name}
              </small>
              {t.occurrenceKey && (
                <span className="tag">Compromiso confirmado</span>
              )}
            </div>
            <strong className="row-amount">
              {["income", "transferIn", "adjustmentIn"].includes(t.type)
                ? "+"
                : "−"}
              {formatMoney(t.amountMinor, currency)}
            </strong>
            <div className="row-actions">
              {!t.transferId && !t.occurrenceKey && (
                <button
                  className="text-button"
                  onClick={() => onEdit(t)}
                  aria-label={`Editar ${t.description}`}
                >
                  Editar
                </button>
              )}
              <button
                className="text-button danger-text"
                aria-label={`Eliminar ${t.description}`}
                onClick={() => {
                  if (
                    window.confirm(
                      t.transferId
                        ? "¿Eliminar toda esta transferencia, incluida su comisión?"
                        : t.occurrenceKey
                          ? "¿Eliminar este movimiento? El compromiso volverá a quedar pendiente."
                          : "¿Eliminar este movimiento? Se actualizará el saldo de tu cuenta.",
                    )
                  )
                    onAction({ action: "transaction.delete", id: t.id });
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))
      )}
      <div className="pagination">
        <span className="muted">
          {filtered.length} movimientos · Página {currentPage + 1}
        </span>
        <div className="actions-row">
          <button
            className="secondary"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <button
            className="secondary"
            disabled={(currentPage + 1) * 20 >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}
