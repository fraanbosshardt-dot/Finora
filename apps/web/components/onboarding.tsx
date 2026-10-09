"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  parseSignedMoney as parseMoney,
  formatMoney,
  type Currency,
} from "@finora/core";
import { requestJson } from "../lib/client-api";
import { Brand } from "./brand";
export function Onboarding({
  name,
  today,
  destination = "/app",
}: {
  name: string;
  today: string;
  destination?: string;
}) {
  const [error, setError] = useState(""),
    [step, setStep] = useState(0),
    [preview, setPreview] = useState({
      name: "",
      currency: "ARS" as Currency,
      amount: "0",
      kind: "Banco",
    }),
    [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);
  function next() {
    const form = formRef.current;
    if (!form) return;
    setError("");
    for (const control of form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >(
      `fieldset[data-step="${step}"] input,fieldset[data-step="${step}"] select`,
    )) {
      if (!control.reportValidity()) return;
    }
    try {
      const values = new FormData(form);
      if (step === 1)
        setPreview({
          name: String(values.get("accountName")),
          currency: values.get("currency") as Currency,
          amount: parseMoney(String(values.get("amount") || "0")),
          kind:
            values.get("kind") === "bank"
              ? "Banco"
              : values.get("kind") === "cash"
                ? "Efectivo"
                : "Billetera",
        });
      setStep(step + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revisá el saldo.");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      next();
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const currency = String(form.get("currency"));
      await requestJson("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: "Mi espacio personal",
          country: form.get("country"),
          currency,
          timezone: form.get("timezone"),
          account: {
            id: crypto.randomUUID(),
            name: form.get("accountName"),
            currency,
            openingMinor: parseMoney(String(form.get("amount") || "0")),
            openingDate: form.get("date"),
            kind: form.get("kind"),
          },
        }),
      });
      window.location.assign(destination);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos crear tu espacio.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="onboarding">
      <Brand />
      <section className="panel onboarding-card">
        <div
          className="onboarding-progress"
          aria-label={`Paso ${step + 1} de 3`}
        >
          {[0, 1, 2].map((n) => (
            <span key={n} className={n <= step ? "complete" : ""} />
          ))}
        </div>
        <p className="eyebrow">UN COMIENZO SIMPLE</p>
        <h1 ref={headingRef} tabIndex={-1}>
          {step === 0
            ? `Hola, ${name.split(" ")[0]}. ¿Dónde vivís?`
            : step === 1
              ? "Tu primera cuenta"
              : "Todo listo"}
        </h1>
        <p className="muted">
          {step === 0
            ? "Elegí tu país, moneda y zona horaria."
            : step === 1
              ? "El saldo inicial es opcional. Después podés agregar más cuentas."
              : "Revisá tu cuenta antes de crear tu espacio."}
        </p>
        <form ref={formRef} onSubmit={submit} noValidate>
          <fieldset data-step="0" hidden={step !== 0}>
            <div className="form-grid">
              <label htmlFor="country">
                País
                <select id="country" name="country" defaultValue="AR">
                  <option value="AR">Argentina</option>
                  <option value="UY">Uruguay</option>
                  <option value="CL">Chile</option>
                  <option value="ES">España</option>
                  <option value="US">Estados Unidos</option>
                  <option value="MX">México</option>
                  <option value="BR">Brasil</option>
                </select>
              </label>
              <label htmlFor="currency">
                Moneda base
                <select id="currency" name="currency">
                  {["ARS", "USD", "EUR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label htmlFor="timezone">
              Zona horaria
              <select
                id="timezone"
                name="timezone"
                defaultValue="America/Argentina/Buenos_Aires"
              >
                <option value="America/Argentina/Buenos_Aires">
                  Buenos Aires
                </option>
                <option value="America/Montevideo">Montevideo</option>
                <option value="America/Santiago">Santiago</option>
                <option value="Europe/Madrid">Madrid</option>
                <option value="America/New_York">Nueva York</option>
                <option value="America/Mexico_City">Ciudad de México</option>
                <option value="America/Sao_Paulo">São Paulo</option>
              </select>
            </label>
          </fieldset>
          <fieldset data-step="1" hidden={step !== 1}>
            <label htmlFor="accountName">
              Nombre de tu primera cuenta
              <input
                id="accountName"
                name="accountName"
                placeholder="Ej. Galicia o Mercado Pago"
                required
                maxLength={80}
              />
            </label>
            <label htmlFor="kind">
              Tipo de cuenta
              <select id="kind" name="kind">
                <option value="bank">Banco</option>
                <option value="cash">Efectivo</option>
                <option value="wallet">Billetera virtual</option>
              </select>
            </label>
            <div className="form-grid">
              <label htmlFor="amount">
                Saldo inicial
                <input
                  id="amount"
                  name="amount"
                  inputMode="decimal"
                  defaultValue="0"
                  required
                />
              </label>
              <label htmlFor="date">
                Fecha del saldo
                <input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={today}
                  max={today}
                  required
                />
              </label>
            </div>
            <p className="muted">
              Usá importes sin separadores de miles y con hasta dos decimales.
              Este saldo no cuenta como ingreso.
            </p>
          </fieldset>
          {step === 2 && (
            <div className="onboarding-confirm">
              <span aria-hidden="true">✓</span>
              <h2>{preview.name}</h2>
              <p className="muted">
                {preview.kind} en {preview.currency}. Saldo inicial:{" "}
                {formatMoney(preview.amount, preview.currency)}.
              </p>
              <p>
                Al confirmar, creamos tu espacio y tu cuenta. Ya vas a poder
                registrar tu primer movimiento.
              </p>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="onboarding-buttons">
            {step > 0 && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                Atrás
              </button>
            )}
            <button className="save" disabled={busy}>
              {busy
                ? "Creando tu espacio…"
                : step < 2
                  ? "Siguiente"
                  : "Empezar a organizarme →"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
