"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  debtSchema,
  loanRates,
  loanAnalysis,
  simulateNewLoan,
  simulateEarlyPayment,
  debtBalance,
  parseMoney,
  formatMoney,
  type Currency,
  type Debt,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
const placeholderId = "00000000-0000-4000-8000-000000000001";
type Result = ReturnType<typeof loanAnalysis> & {
  baseline?: ReturnType<typeof simulateNewLoan>["baseline"];
  scenario?: ReturnType<typeof simulateNewLoan>["scenario"];
};
export function LoanLab({
  data,
  currency = "ARS",
  onAction,
}: {
  data?: Snapshot;
  currency?: Currency;
  onAction?: (command: Command) => Promise<void>;
}) {
  const [result, setResult] = useState<Result | null>(null),
    [draft, setDraft] = useState<Debt | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [early, setEarly] = useState<ReturnType<
      typeof simulateEarlyPayment
    > | null>(null),
    [extraDraft, setExtraDraft] = useState<{
      id: string;
      amountMinor: string;
    } | null>(null);
  const operationId = useRef(crypto.randomUUID());
  const today =
    data?.today ??
    new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
  const accounts =
    data?.ledger.accounts.filter(
      (a) =>
        a.currency === currency &&
        a.active !== false &&
        a.liquid !== false &&
        a.kind !== "credit",
    ) ?? [];
  const debts =
    data?.debts.filter((d) => accounts.some((a) => a.id === d.accountId)) ?? [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const f = new FormData(event.currentTarget),
      get = (key: string) => String(f.get(key) ?? "");
    try {
      operationId.current = crypto.randomUUID();
      const rates = loanRates(
        get("rate"),
        get("rateKind") as "monthly" | "nominalAnnual",
      );
      const debt = debtSchema.parse({
        id: operationId.current,
        accountId: get("accountId") || placeholderId,
        categoryId: get("categoryId") || placeholderId,
        name: get("name") || "Préstamo simulado",
        principalMinor: parseMoney(get("principal")),
        receivedMinor: parseMoney(get("received")),
        chargesMinor: parseMoney(get("charges")),
        monthlyRate: rates.monthly,
        system: get("system"),
        count: Number(get("count")),
        disbursementDate: today,
        firstDate: get("firstDate"),
        active: true,
      });
      setResult(
        data
          ? simulateNewLoan(data.ledger, data, debt, currency, today)
          : loanAnalysis(debt),
      );
      setDraft(debt);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Revisá los datos del préstamo.",
      );
    }
  }
  async function apply() {
    if (
      !draft ||
      !onAction ||
      !confirm(
        "¿Registrar este préstamo real? Se sumará el desembolso a la cuenta y se crearán sus compromisos de pago.",
      )
    )
      return;
    setBusy(true);
    try {
      await onAction({ action: "debt.create", data: draft });
      setDraft(null);
      setResult(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos aplicar el préstamo.",
      );
    } finally {
      setBusy(false);
    }
  }
  function previewEarly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      const debt = debts.find((d) => d.id === f.get("debtId"));
      if (!debt || !data) throw new Error("Seleccioná un préstamo.");
      const amountMinor = parseMoney(String(f.get("amount")));
      setEarly(
        simulateEarlyPayment(
          data.ledger,
          data,
          debt,
          currency,
          today,
          amountMinor,
        ),
      );
      setExtraDraft({ id: debt.id, amountMinor });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisá el pago.");
      setEarly(null);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Simulá un préstamo antes de tomarlo</h2>
        <p className="muted">
          Ingresá las condiciones conocidas. Compará sistemas de amortización y
          el total a pagar. Las tasas derivadas se redondean a seis decimales;
          no se calcula CFT.
        </p>
        <form className="credit-form" onSubmit={submit}>
          {data && (
            <>
              <label htmlFor="loan-sim-name">
                Nombre del préstamo
                <input id="loan-sim-name" name="name" maxLength={80} required />
              </label>
              <label htmlFor="loan-sim-account">
                Cuenta del desembolso
                <select id="loan-sim-account" name="accountId" required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="loan-sim-category">
                Categoría del préstamo
                <select id="loan-sim-category" name="categoryId" required>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div className="form-grid">
            <label htmlFor="loan-sim-principal">
              Capital en {currency}
              <input
                id="loan-sim-principal"
                name="principal"
                inputMode="decimal"
                required
                placeholder="0,00"
              />
            </label>
            <label htmlFor="loan-sim-received">
              Importe recibido
              <input
                id="loan-sim-received"
                name="received"
                inputMode="decimal"
                required
                placeholder="0,00"
              />
            </label>
            <label htmlFor="loan-sim-rate">
              Tasa ingresada (%)
              <input
                id="loan-sim-rate"
                name="rate"
                inputMode="decimal"
                defaultValue="0"
                required
              />
            </label>
            <label htmlFor="loan-sim-rateKind">
              Tipo de tasa
              <select id="loan-sim-rateKind" name="rateKind">
                <option value="monthly">TEM mensual</option>
                <option value="nominalAnnual">TNA nominal anual</option>
              </select>
            </label>
            <label htmlFor="loan-sim-system">
              Sistema de amortización
              <select id="loan-sim-system" name="system">
                <option value="french">Francés</option>
                <option value="german">Alemán</option>
                <option value="american">Americano</option>
              </select>
            </label>
            <label htmlFor="loan-sim-count">
              Cantidad de pagos
              <input
                id="loan-sim-count"
                name="count"
                type="number"
                min={1}
                max={360}
                defaultValue={12}
                required
              />
            </label>
            <label htmlFor="loan-sim-charges">
              Cargos fijos por pago
              <input
                id="loan-sim-charges"
                name="charges"
                inputMode="decimal"
                defaultValue="0"
                required
              />
            </label>
            <label htmlFor="loan-sim-first">
              Primera fecha de pago
              <input
                id="loan-sim-first"
                name="firstDate"
                type="date"
                min={today}
                defaultValue={today}
                required
              />
            </label>
          </div>
          <button className="save" disabled={Boolean(data && !accounts.length)}>
            Calcular préstamo
          </button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {result && (
        <section className="panel section-gap">
          <h2>Condiciones calculadas</h2>
          <div className="report-totals">
            <div>
              <p className="muted">Total de cuotas</p>
              <strong>{formatMoney(result.totalMinor, currency)}</strong>
            </div>
            <div>
              <p className="muted">Intereses totales</p>
              <strong>{formatMoney(result.interestMinor, currency)}</strong>
            </div>
            <div>
              <p className="muted">Cargos totales</p>
              <strong>{formatMoney(result.chargesMinor, currency)}</strong>
            </div>
          </div>
          <p className="muted">
            TNA: {result.rates.nominalAnnual.replace(".", ",")}% · TEA:{" "}
            {result.rates.effectiveAnnual.replace(".", ",")}% · TEM:{" "}
            {result.rates.monthly.replace(".", ",")}%
          </p>
          <p>
            Cuotas menos importe recibido:{" "}
            {formatMoney(result.costOverReceivedMinor, currency)}. Este importe
            no es una tasa de CFT.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pago</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Capital</th>
                  <th>Intereses</th>
                  <th>Cargos</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.key}>
                    <th>{r.number}</th>
                    <td>{r.date}</td>
                    <td>{formatMoney(r.totalMinor, currency)}</td>
                    <td>{formatMoney(r.principalMinor, currency)}</td>
                    <td>{formatMoney(r.interestMinor, currency)}</td>
                    <td>{formatMoney(r.chargesMinor, currency)}</td>
                    <td>{formatMoney(r.balanceMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.scenario && (
            <Comparison
              baseline={result.baseline!}
              scenario={result.scenario}
              currency={currency}
            />
          )}{" "}
          {data && draft && (
            <button disabled={busy} onClick={apply}>
              Registrar préstamo real
            </button>
          )}
        </section>
      )}
      {data && (
        <section className="panel section-gap">
          <h2>¿Qué cambia si adelantás capital?</h2>
          <p className="muted">
            Compara intereses, cargos y liquidez. No incluye penalidades ni
            comisiones de cancelación que no hayas registrado.
          </p>
          {debts.length ? (
            <form className="credit-form" onSubmit={previewEarly}>
              <label htmlFor="early-debt">
                Préstamo a simular
                <select id="early-debt" name="debtId">
                  {debts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · Pendiente{" "}
                      {formatMoney(
                        debtBalance(d, data.ledger, today),
                        currency,
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="early-amount">
                Capital a adelantar
                <input
                  id="early-amount"
                  name="amount"
                  inputMode="decimal"
                  required
                />
              </label>
              <button>Simular pago extraordinario</button>
            </form>
          ) : (
            <div className="empty">
              <p>Registrá un préstamo para comparar un pago anticipado.</p>
            </div>
          )}
          {early && (
            <>
              <div className="success-box">
                <p>
                  Intereses evitados:{" "}
                  <strong>
                    {formatMoney(early.interestSavedMinor, currency)}
                  </strong>
                </p>
                <p>
                  Cargos evitados:{" "}
                  {formatMoney(early.chargesSavedMinor, currency)}
                </p>
                <p>
                  Pagos restantes: {early.before.length} → {early.after.length}
                </p>
              </div>
              <Comparison
                baseline={early.baseline}
                scenario={early.scenario}
                currency={currency}
              />
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    !onAction ||
                    !extraDraft ||
                    !confirm(
                      "¿Aplicar este pago real de capital? Se descontará de tu cuenta.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await onAction({
                      action: "debt.extra",
                      id: extraDraft.id,
                      amountMinor: extraDraft.amountMinor,
                      date: today,
                    });
                    setEarly(null);
                    setExtraDraft(null);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "No pudimos registrar el pago.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Aplicar pago real
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
}
function Comparison({
  baseline,
  scenario,
  currency,
}: {
  baseline: NonNullable<Result["baseline"]>;
  scenario: NonNullable<Result["scenario"]>;
  currency: Currency;
}) {
  return (
    <div className="table-scroll section-gap">
      <table>
        <caption>Comparación de liquidez a 12 meses</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Actual</th>
            <th>Simulado</th>
          </tr>
        </thead>
        <tbody>
          {scenario.map((p, i) => (
            <tr key={p.month}>
              <th>{p.month}</th>
              <td>{formatMoney(baseline[i]!.closing, currency)}</td>
              <td>
                {formatMoney(p.closing, currency)}
                {p.negative ? " · Negativo" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
