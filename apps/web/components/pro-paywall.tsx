"use client";
import { useState } from "react";
import { Check, LockKeyhole, Sparkles } from "lucide-react";
import { pricing } from "../lib/plans";

const benefits = [
  [
    "Anticipá lo que viene",
    "Proyectá hasta 36 meses y compará una compra o un préstamo antes de comprometerte.",
  ],
  [
    "Entendé tus deudas",
    "Tarjetas, cuotas, amortización y pagos extraordinarios en un solo lugar.",
  ],
  [
    "Ahorrá trabajo",
    "Importá CSV, organizá movimientos con reglas y analizá informes por cuenta y categoría.",
  ],
  [
    "Mirá el panorama completo",
    "Valuá tu patrimonio con cotizaciones propias, conservando cada importe original.",
  ],
];
export function ProPaywall({
  feature,
  onBack,
  initialPeriod = "yearly",
}: {
  feature: string;
  onBack?: () => void;
  initialPeriod?: "monthly" | "yearly";
}) {
  const [yearly, setYearly] = useState(initialPeriod === "yearly");
  const [notice, setNotice] = useState(false);
  return (
    <section className="panel pro-paywall" aria-labelledby="pro-title">
      <span className="pro-badge">
        <Sparkles size={14} aria-hidden="true" /> FINORA PRO
      </span>
      <h2 id="pro-title">Más claridad para decisiones más grandes.</h2>
      <p className="muted">
        {feature} forma parte de Pro. Tus cuentas, movimientos y organización
        diaria siguen disponibles con Free.
      </p>
      <div className="pro-benefits">
        {benefits.map(([title, text]) => (
          <div key={title}>
            <Check size={18} aria-hidden="true" />
            <div>
              <strong>{title}</strong>
              <p className="muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div
        className="pro-periods"
        role="group"
        aria-label="Periodicidad de Finora Pro"
      >
        <button
          className={yearly ? "secondary" : ""}
          aria-pressed={!yearly}
          onClick={() => {
            setYearly(false);
            setNotice(false);
          }}
        >
          Mensual · USD {pricing.monthly}
        </button>
        <button
          className={yearly ? "" : "secondary"}
          aria-pressed={yearly}
          onClick={() => {
            setYearly(true);
            setNotice(false);
          }}
        >
          Anual · Ahorrás 37%
        </button>
      </div>
      <p className="pro-price">
        USD {yearly ? pricing.yearly : pricing.monthly}
        <span> / {yearly ? "año" : "mes"}</span>
      </p>
      <p className="muted">
        {yearly
          ? "Un pago anual. Equivale aproximadamente a USD 2,50 por mes."
          : "Facturación mensual."}{" "}
        Precio de referencia en USD; impuestos y conversión se informarán antes
        de un cobro.
      </p>
      <button className="pro-checkout" onClick={() => setNotice(true)}>
        <LockKeyhole size={16} aria-hidden="true" /> Continuar con el pago
      </button>
      <p className="panel-foot">
        Los pagos todavía no están habilitados. No se realizará ningún cargo ni
        se pedirán datos de tarjeta.
      </p>
      {notice && (
        <p className="notice" role="status">
          El plan está elegido. Falta conectar la pasarela para iniciar un pago
          seguro y activar Pro automáticamente.
        </p>
      )}
      {onBack && (
        <button className="text-button" onClick={onBack}>
          Seguir con Free
        </button>
      )}
      <p className="panel-foot">
        Tus datos siguen siendo tuyos: exportación y respaldo incluidos en todos
        los planes.
      </p>
    </section>
  );
}
