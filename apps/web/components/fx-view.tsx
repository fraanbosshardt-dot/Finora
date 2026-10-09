"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  fxRateSchema,
  valuedNetWorth,
  convertMoney,
  formatMoney,
  parseMoney,
  type Currency,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
export function FxView({
  data,
  currency,
  onAction,
}: {
  data: Snapshot;
  currency: Currency;
  onAction: (command: Command) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [converted, setConverted] = useState<
      ReturnType<typeof convertMoney> | undefined
    >();
  const id = useRef(crypto.randomUUID());
  const valuation = valuedNetWorth(
    data.ledger,
    data.debts,
    currency,
    data.fxRates,
    data.today,
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const f = new FormData(element);
    setError("");
    try {
      const rate = fxRateSchema.parse({
        id: id.current,
        base: f.get("base"),
        quote: f.get("quote"),
        rate: f.get("rate"),
        source: f.get("source"),
        date: f.get("date"),
      });
      setBusy(true);
      await onAction({ action: "fx.save", data: rate });
      id.current = crypto.randomUUID();
      element.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisá la cotización.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Patrimonio valuado en {currency}</h2>
        <p className="muted">
          Usa cotizaciones manuales vigentes a la fecha. Esta vista no cambia
          los movimientos ni su tipo de cambio histórico.
        </p>
        <strong className="wealth-amount">
          {formatMoney(valuation.totalMinor, currency)}
        </strong>
        {!valuation.complete && (
          <p className="warning-box">
            Total parcial: faltan cotizaciones para una o más monedas. Agregá el
            par requerido para completar la valuación.
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Moneda original</th>
                <th>Patrimonio original</th>
                <th>Valuado en {currency}</th>
                <th>Fuente y fecha</th>
              </tr>
            </thead>
            <tbody>
              {valuation.parts.map((p) => (
                <tr key={p.currency}>
                  <th>{p.currency}</th>
                  <td>{formatMoney(p.originalMinor, p.currency)}</td>
                  <td>
                    {p.converted
                      ? formatMoney(p.converted.amountMinor, currency)
                      : "Sin cotización"}
                  </td>
                  <td>
                    {p.converted?.rate
                      ? `${p.converted.rate.source} · ${p.converted.rate.date}`
                      : "Sin conversión"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel section-gap">
        <h2>Agregar cotización manual</h2>
        <p className="muted">
          Indicá cuántas unidades de la moneda destino equivalen a 1 unidad de
          la moneda origen. No consultamos precios online.
        </p>
        <form className="credit-form" onSubmit={save}>
          <div className="form-grid">
            <label htmlFor="fx-base">
              Moneda origen
              <select id="fx-base" name="base" defaultValue="USD">
                {["ARS", "USD", "EUR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label htmlFor="fx-quote">
              Moneda destino
              <select id="fx-quote" name="quote" defaultValue="ARS">
                {["ARS", "USD", "EUR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label htmlFor="fx-rate">
            Unidades destino por 1 origen
            <input id="fx-rate" name="rate" inputMode="decimal" required />
          </label>
          <label htmlFor="fx-source">
            Fuente o criterio
            <input
              id="fx-source"
              name="source"
              maxLength={80}
              placeholder="Ej. MEP ingresado manualmente"
              required
            />
          </label>
          <label htmlFor="fx-date">
            Fecha de cotización
            <input
              id="fx-date"
              name="date"
              type="date"
              max={data.today}
              defaultValue={data.today}
              required
            />
          </label>
          <button disabled={busy}>Guardar cotización</button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {data.fxRates.map((r) => (
          <div className="account-row" key={r.id}>
            <div>
              <strong>
                1 {r.base} = {r.rate} {r.quote}
              </strong>
              <small>
                {r.source} · {r.date}
              </small>
            </div>
            <button
              className="text-button danger-text"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    "¿Eliminar esta cotización? Cambiará la valuación visual, sin modificar movimientos históricos.",
                  )
                )
                  return;
                try {
                  setBusy(true);
                  await onAction({ action: "fx.delete", id: r.id });
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No pudimos eliminar.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Eliminar
            </button>
          </div>
        ))}
      </section>
      <section className="panel section-gap">
        <h2>Conversor con tus cotizaciones</h2>
        <form
          className="credit-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              setConverted(
                convertMoney(
                  parseMoney(String(f.get("amount"))),
                  f.get("base") as Currency,
                  currency,
                  data.fxRates,
                  data.today,
                ),
              );
              setError("");
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Importe inválido.",
              );
            }
          }}
        >
          <label htmlFor="fx-convert-amount">
            Importe a convertir
            <input
              id="fx-convert-amount"
              name="amount"
              inputMode="decimal"
              required
            />
          </label>
          <label htmlFor="fx-convert-base">
            Moneda del importe
            <select id="fx-convert-base" name="base">
              {["ARS", "USD", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button>Convertir a {currency}</button>
        </form>
        {converted !== undefined && (
          <p className="success-box">
            {converted
              ? formatMoney(converted.amountMinor, currency)
              : "No hay una cotización registrada para este par."}
          </p>
        )}
      </section>
    </>
  );
}
