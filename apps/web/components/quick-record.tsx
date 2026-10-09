"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { parseMoney, type Currency } from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
export function QuickRecord({
  data,
  currency,
  initialType,
  onClose,
  onSave,
  onSaved,
}: {
  data: Snapshot;
  currency: Currency;
  initialType: "expense" | "income";
  onClose: () => void;
  onSave: (command: Command) => Promise<void>;
  onSaved: (id: string, currency: Currency) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useRef(crypto.randomUUID());
  const accounts = data.ledger.accounts.filter(
    (a) => a.active !== false && a.kind !== "credit",
  );
  const [type, setType] = useState(initialType),
    [amount, setAmount] = useState(""),
    [accountId, setAccountId] = useState(
      accounts.find((a) => a.currency === currency)?.id ??
        accounts[0]?.id ??
        "",
    ),
    [categoryId, setCategoryId] = useState(
      data.categories.find((c) => c.name === (initialType === "income" ? "Sueldo" : "Supermercado"))?.id ??
        data.categories[0]?.id ??
        "",
    ),
    [description, setDescription] = useState(""),
    [date, setDate] = useState(data.today),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const selected = accounts.find((a) => a.id === accountId),
    category = data.categories.find((c) => c.id === categoryId);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const names =
    type === "expense"
      ? [
          "Supermercado",
          "Combustible",
          "Restaurantes",
          "Salud",
          "Transporte",
          "Otros",
        ]
      : ["Sueldo", "Freelance", "Otros ingresos"];
  const favorites = [
    ...names.flatMap(name=>data.categories.filter(c=>c.name===name)),
    ...data.categories.filter((c) => !names.includes(c.name) && (type === "income" ? c.group === "Ingresos" : c.group !== "Ingresos")),
  ].slice(0, 5);
  function key(value: string) {
    setAmount((previous) => {
      if (value === "⌫") return previous.slice(0, -1);
      if (value === "," && /[.,]/.test(previous)) return previous;
      return (previous + value).slice(0, 26);
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (!selected || !category)
        throw new Error("Elegí una cuenta y una categoría.");
      const amountMinor = parseMoney(amount);
      if (BigInt(amountMinor) <= 0n)
        throw new Error("Ingresá un importe mayor a cero.");
      setBusy(true);
      await onSave({
        action: "transaction.save",
        data: {
          id: id.current,
          accountId: selected.id,
          categoryId: category.id,
          type,
          amountMinor,
          date,
          description: description.trim() || category.name,
          category: category.name,
        },
      });
      onSaved(id.current, selected.currency);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Revisá el movimiento.",
      );
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="quick-record"
      aria-labelledby="quick-heading"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="quick-tabs">
          <button
            type="button"
            className="secondary"
            aria-label="Cerrar registro rápido"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
          <h2 id="quick-heading" className="sr-only">
            Registrar movimiento rápido
          </h2>
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => {setType(t);const suggested=data.categories.find(c=>c.name===(t==="income"?"Sueldo":"Supermercado"));if(suggested)setCategoryId(suggested.id);}}
            >
              {t === "expense" ? "Gasto" : "Ingreso"}
            </button>
          ))}
        </div>
        <label className="quick-amount" htmlFor="quick-amount">
          <span>{selected?.currency ?? currency}</span>
          <input
            id="quick-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            aria-label="Importe"
            required
            maxLength={26}
          />
        </label>
        <div
          className="dc-pills quick-categories"
          aria-label="Categorías frecuentes"
        >
          {favorites.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-pressed={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label htmlFor="quick-category">
          Categoría
          <select
            id="quick-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.group} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className="dc-pills quick-accounts"
          aria-label="Cuenta del movimiento"
        >
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={accountId === a.id}
              onClick={() => setAccountId(a.id)}
            >
              {a.name} · {a.currency}
            </button>
          ))}
        </div>
        {!accounts.length && (
          <p className="error">
            Agregá una cuenta activa para registrar movimientos.
          </p>
        )}
        <details>
          <summary>Más opciones</summary>
          <label htmlFor="quick-description">
            Descripción
            <input
              id="quick-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={140}
              placeholder={category?.name}
            />
          </label>
          <label htmlFor="quick-date">
            Fecha
            <input
              id="quick-date"
              type="date"
              value={date}
              min={selected?.openingDate}
              max={data.today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </details>
        <div className="quick-keypad" aria-label="Teclado de importe">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"].map(
            (k) => (
              <button
                key={k}
                type="button"
                aria-label={
                  k === "⌫"
                    ? "Borrar dígito"
                    : k === ","
                      ? "Separador decimal"
                      : `Dígito ${k}`
                }
                onClick={() => key(k)}
                disabled={busy}
              >
                {k}
              </button>
            ),
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="save" disabled={busy || !amount || !selected}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </dialog>
  );
}
