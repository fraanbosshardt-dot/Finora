"use client";
import { useMemo, useState } from "react";
import {
  localInsights,
  localQuestionIntent,
  formatMoney,
  type Currency,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import { dateLabel } from "../lib/client-api";
export function LocalQuestions({
  data,
  currency,
  onView,
}: {
  data: Snapshot;
  currency: Currency;
  onView: (view: string) => void;
}) {
  const [question, setQuestion] = useState(0);
  const [text, setText] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const result = useMemo(
    () => localInsights(data.ledger, data, currency, data.today),
    [data, currency],
  );
  const questions = [
    "¿En qué gasté más este mes?",
    "¿Cuánto puedo gastar por día?",
    "¿Cuándo termino mis cuotas?",
    "¿Cuánto tengo comprometido?",
    "¿Cómo puedo cerrar el mes?",
  ];
  const answers = [
    result.largest
      ? `Tu categoría con más gastos registrados este mes es ${result.largest.category}: ${formatMoney(result.largest.amountMinor, currency)}.`
      : "Todavía no hay gastos registrados en esta moneda durante este mes.",
    BigInt(result.available) < 0n
      ? `Tu disponible real es ${formatMoney(result.available, currency)}. Ya hay compromisos que superan tu liquidez; revisá tu planificación.`
      : `Tu disponible real es ${formatMoney(result.available, currency)}. Repartido entre los ${result.days} días que quedan, incluido hoy, equivale a ${formatMoney(result.dailyMinor, currency)} por día. No incorpora gastos que no hayas registrado.`,
    result.lastPaymentDate
      ? `El último pago pendiente de los planes de cuotas y préstamos activos registrados vence el ${dateLabel(result.lastPaymentDate)}. Las recurrencias no están incluidas.`
      : "No hay pagos pendientes de cuotas o préstamos activos en esta moneda.",
    `Tus pagos pendientes hasta fin de mes, incluidos los vencidos, suman ${formatMoney(result.committed, currency)} en cuentas líquidas activas. Los ingresos previstos no reducen este compromiso.`,
    `El saldo de cierre previsto de tus cuentas líquidas activas es ${formatMoney(result.closing, currency)}. Incluye saldo actual, ingresos futuros registrados y pagos pendientes; no supone ingresos ni gastos nuevos.`,
  ];
  return (
    <section className="panel local-questions">
      <h2>Preguntale a Finora</h2>
      <p className="muted">
        Respuestas con tus registros en {currency}. Cálculo local, sin IA
        externa.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const intent = localQuestionIntent(text);
          setUnsupported(intent === null);
          if (intent !== null) setQuestion(intent);
        }}
      >
        <label htmlFor="local-question">
          Tu consulta
          <input
            id="local-question"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            required
            placeholder="¿Cuánto puedo gastar por día?"
          />
        </label>
        <button>Consultar mis registros</button>
      </form>
      {unsupported && (
        <p className="muted" role="status">
          Todavía puedo responder sobre tu mayor gasto, gasto diario, final de
          cuotas, compromisos y cierre del mes. Elegí una de estas consultas.
        </p>
      )}
      <div className="question-pills">
        {questions.map((q, i) => (
          <button
            key={q}
            className="secondary"
            aria-pressed={question === i}
            onClick={() => {
              setQuestion(i);
              setUnsupported(false);
            }}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="local-answer" role="status">
        {answers[question]}
      </div>
      <button
        className="text-button"
        onClick={() =>
          onView(
            question === 0
              ? "Informes"
              : question === 1 || question === 4
                ? "Inicio"
                : "Planificación",
          )
        }
      >
        Ver los datos →
      </button>
    </section>
  );
}
