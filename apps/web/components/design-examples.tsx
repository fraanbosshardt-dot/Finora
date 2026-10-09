"use client";
import { useState } from "react";
import Link from "next/link";
import {
  convertMoney,
  formatMoney,
  loanAnalysis,
  loanRates,
  simulatePurchase,
  type Currency,
  type Ledger,
} from "@finora/core";
const id = "00000000-0000-4000-8000-000000000001";
const today = "2026-10-01";
const ledger: Ledger = {
  accounts: [
    {
      id,
      name: "Cuenta de ejemplo",
      currency: "ARS",
      openingMinor: "148230000",
      openingDate: today,
    },
  ],
  transactions: [],
};
const planning = { recurrences: [], installments: [] };
export function CurrencyExample() {
  const [currency, setCurrency] = useState<Currency>("ARS");
  const rates = [
    {
      id,
      base: "USD" as const,
      quote: "ARS" as const,
      rate: "1480",
      date: today,
      source: "Ejemplo ilustrativo",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      base: "EUR" as const,
      quote: "ARS" as const,
      rate: "1600",
      date: today,
      source: "Ejemplo ilustrativo",
    },
  ];
  const converted = convertMoney("891240000", "ARS", currency, rates, today)!;
  return (
    <div className="dc-card">
      <div className="dc-pills" aria-label="Moneda del ejemplo">
        {(["ARS", "USD", "EUR"] as const).map((c) => (
          <button
            key={c}
            aria-pressed={currency === c}
            onClick={() => setCurrency(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="dc-caption">Patrimonio neto · ejemplo</p>
      <strong className="dc-number" aria-live="polite">
        {formatMoney(converted.amountMinor, currency)}
      </strong>
      <p className="dc-small">
        Cotizaciones ilustrativas, no precios actuales. En tu espacio ingresás
        fecha y fuente.
      </p>
    </div>
  );
}
export function LoanExample() {
  const [count, setCount] = useState(12),
    [tna, setTna] = useState(60);
  const result = loanAnalysis({
    id,
    accountId: id,
    categoryId: id,
    name: "Préstamo de ejemplo",
    principalMinor: "100000000",
    receivedMinor: "100000000",
    monthlyRate: loanRates(String(tna), "nominalAnnual").monthly,
    system: "french",
    count,
    chargesMinor: "0",
    disbursementDate: today,
    firstDate: "2026-11-01",
    active: true,
  });
  return (
    <div className="dc-card">
      <p className="dc-caption">Cuotas</p>
      <div className="dc-pills">
        {[6, 12, 24].map((n) => (
          <button
            key={n}
            aria-pressed={count === n}
            onClick={() => setCount(n)}
          >
            {n} cuotas
          </button>
        ))}
      </div>
      <p className="dc-caption">TNA ingresada</p>
      <div className="dc-pills">
        {[0, 60, 90].map((n) => (
          <button key={n} aria-pressed={tna === n} onClick={() => setTna(n)}>
            {n}%
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {[
          ["Primera cuota", result.rows[0]!.totalMinor],
          ["Total a pagar", result.totalMinor],
          ["Intereses", result.interestMinor],
        ].map(([label, amount]) => (
          <div className="dc-value-row" key={label}>
            <span>{label}</span>
            <strong>{formatMoney(amount!, "ARS")}</strong>
          </div>
        ))}
      </div>
      <p className="dc-small">
        Ejemplo sin cargos ni impuestos. No representa CFT ni una oferta de
        crédito.
      </p>
      <Link className="dc-text-link" href="/calculadora-prestamos">
        Calcular mi préstamo →
      </Link>
    </div>
  );
}
export function PurchaseExample() {
  const [count, setCount] = useState(3);
  const result = simulatePurchase(ledger, planning, "ARS", today, {
    accountId: id,
    totalMinor: "48000000",
    count,
    firstDate: today,
  });
  return (
    <div className="dc-card">
      <h3>Celular nuevo por $480.000</h3>
      <div className="dc-pills">
        {[1, 3, 6, 12].map((n) => (
          <button
            key={n}
            aria-pressed={count === n}
            onClick={() => setCount(n)}
          >
            {n === 1 ? "1 pago" : `${n} cuotas`}
          </button>
        ))}
      </div>
      <div className="dc-verdict" role="status">
        <strong>
          {result.negativeMonths.length
            ? "Revisá los meses negativos"
            : "La compra cabe en este ejemplo"}
        </strong>
        <p>
          Primer pago de {formatMoney(result.firstPayment, "ARS")}. El cierre
          del primer mes queda en{" "}
          {formatMoney(result.scenario[0]!.closing, "ARS")}.
        </p>
      </div>
      <p className="dc-small">
        Ejemplo ilustrativo sin otros compromisos. Tu resultado se calcula con
        tus cuentas y planes.
      </p>
      <Link className="dc-text-link" href="/registro">
        Simular con mis datos →
      </Link>
    </div>
  );
}
