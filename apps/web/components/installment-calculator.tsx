"use client";
import { useState, type FormEvent } from "react";
import {
  installmentSchema,
  installmentSchedule,
  parseMoney,
  formatMoney,
  type Obligation,
} from "@finora/core";
export function InstallmentCalculator() {
  const [events, setEvents] = useState<Obligation[]>([]),
    [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const id = "00000000-0000-4000-8000-000000000000";
      const date = String(form.get("date"));
      const plan = installmentSchema.parse({
        id,
        accountId: id,
        categoryId: id,
        description: "Cuota",
        totalMinor: parseMoney(String(form.get("amount"))),
        downPaymentMinor: parseMoney(String(form.get("down"))),
        purchaseDate: date,
        firstDate: date,
        count: Number(form.get("count")),
        active: true,
      });
      setEvents(installmentSchedule(plan));
      setError("");
    } catch {
      setError(
        "Revisá los importes, la cantidad de cuotas y la fecha. El anticipo debe ser menor al total.",
      );
    }
  }
  return (
    <section className="panel">
      <form onSubmit={submit}>
        <label htmlFor="calc-amount">
          Precio total en ARS, incluidos cargos
          <input id="calc-amount" name="amount" inputMode="decimal" required />
        </label>
        <div className="form-grid">
          <label htmlFor="calc-down">
            Anticipo
            <input
              id="calc-down"
              name="down"
              inputMode="decimal"
              defaultValue="0"
              required
            />
          </label>
          <label htmlFor="calc-count">
            Cuotas
            <input
              id="calc-count"
              name="count"
              type="number"
              min={1}
              max={120}
              defaultValue={6}
              required
            />
          </label>
        </div>
        <label htmlFor="calc-date">
          Primera fecha
          <input id="calc-date" name="date" type="date" required />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="save">Calcular cronograma</button>
      </form>
      {events.length > 0 && (
        <div className="table-scroll section-gap">
          <table>
            <thead>
              <tr>
                <th>Pago</th>
                <th>Fecha</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.key}>
                  <th>{e.description}</th>
                  <td>{e.date}</td>
                  <td>{formatMoney(e.amountMinor, "ARS")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">
        El cálculo reparte el total exacto en centavos. No calcula tasas ni
        incorpora cargos que no ingresaste.
      </p>
    </section>
  );
}
