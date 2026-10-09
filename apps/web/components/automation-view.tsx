"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  ruleChanges,
  ruleSchema,
  financeAlerts,
  type Rule,
  type Currency,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
export function AutomationView({
  data,
  currency,
  view,
  onAction,
  onView,
}: {
  data: Snapshot;
  currency: Currency;
  view: "Reglas" | "Alertas";
  onAction: (command: Command) => Promise<void>;
  onView: (view: string) => void;
}) {
  const [edit, setEdit] = useState<Rule | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const id = useRef(crypto.randomUUID());
  const changes = ruleChanges(data.ledger, data.rules);
  const hidden = new Set(data.dismissedAlerts);
  const alerts = financeAlerts(
    data.ledger,
    data,
    data.budgets,
    data.goals,
    currency,
    data.today,
    data.alertPreferences,
  ).filter((a) => !hidden.has(a.id));
  async function run(command: Command) {
    setBusy(true);
    setError("");
    try {
      await onAction(command);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const rule = ruleSchema.parse({
        id: edit?.id ?? id.current,
        name: form.get("name"),
        contains: form.get("contains"),
        categoryId: form.get("categoryId"),
        accountId: form.get("accountId") || null,
        type: form.get("type"),
        priority: Number(form.get("priority")),
        active: form.get("active") === "on",
      });
      await run({ action: "rule.save", data: rule });
      setOpen(false);
      setPreview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisá la regla.");
    }
  }
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {view === "Reglas" ? "Reglas de categorización" : "Tus alertas"}
            </h2>
            <p className="muted">
              {view === "Reglas"
                ? "La primera regla que coincida define la sugerencia. Un número de prioridad menor se aplica primero."
                : `Avisos calculados con tus registros en ${currency}. Se actualizan cuando cambia tu información.`}
            </p>
          </div>
          {view === "Reglas" && (
            <button
              onClick={() => {
                id.current = crypto.randomUUID();
                setEdit(null);
                setOpen(true);
              }}
            >
              + Crear regla
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {view === "Reglas" ? (
          <>
            {open && (
              <form
                className="credit-form"
                key={edit?.id ?? id.current}
                onSubmit={save}
              >
                <label htmlFor="rule-name">
                  Nombre de regla
                  <input
                    id="rule-name"
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={edit?.name}
                  />
                </label>
                <label htmlFor="rule-contains">
                  Descripción contiene
                  <input
                    id="rule-contains"
                    name="contains"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={edit?.contains}
                  />
                </label>
                <div className="form-grid">
                  <label htmlFor="rule-type">
                    Tipo de regla
                    <select
                      id="rule-type"
                      name="type"
                      defaultValue={edit?.type ?? "all"}
                    >
                      <option value="all">Ingresos y gastos</option>
                      <option value="expense">Gastos</option>
                      <option value="income">Ingresos</option>
                    </select>
                  </label>
                  <label htmlFor="rule-priority">
                    Prioridad
                    <input
                      id="rule-priority"
                      name="priority"
                      type="number"
                      min={0}
                      max={999}
                      defaultValue={edit?.priority ?? 0}
                      required
                    />
                  </label>
                </div>
                <label htmlFor="rule-account">
                  Cuenta de regla
                  <select
                    id="rule-account"
                    name="accountId"
                    defaultValue={edit?.accountId ?? ""}
                  >
                    <option value="">Todas las cuentas</option>
                    {data.ledger.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="rule-category">
                  Categoría de regla
                  <select
                    id="rule-category"
                    name="categoryId"
                    defaultValue={edit?.categoryId}
                    required
                  >
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={edit?.active ?? true}
                  />
                  Regla activa
                </label>
                <div className="actions-row">
                  <button disabled={busy}>Guardar regla</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            {data.rules.length ? (
              data.rules.map((r) => (
                <div className="account-row" key={r.id}>
                  <div>
                    <strong>{r.name}</strong>
                    <small>
                      Contiene «{r.contains}» →{" "}
                      {data.categories.find((c) => c.id === r.categoryId)?.name}{" "}
                      · {r.active ? "Activa" : "Pausada"} · Prioridad{" "}
                      {r.priority}
                    </small>
                  </div>
                  <div className="actions-row">
                    <button
                      className="text-button"
                      onClick={() => {
                        setEdit(r);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "¿Eliminar esta regla? Las categorías ya asignadas se conservarán.",
                          )
                        )
                          void run({ action: "rule.delete", id: r.id }).catch(
                            () => {},
                          );
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">
                <h3>Categorizá con tus propios criterios</h3>
                <p>
                  Por ejemplo: descripción contiene «panadería» → Panadería.
                </p>
              </div>
            )}
            <button
              className="secondary section-gap"
              disabled={!changes.length || busy}
              onClick={() => setPreview(true)}
            >
              Revisar {changes.length} cambios en el historial
            </button>
            {preview && (
              <div className="success-box section-gap">
                <h3>Vista previa de categorización</h3>
                <p>
                  Solo movimientos manuales o importados. Los pagos de
                  compromisos y transferencias conservan su categoría.
                </p>
                {changes.slice(0, 20).map((c) => (
                  <p key={c.transactionId}>
                    {c.description} →{" "}
                    {
                      data.categories.find(
                        (category) => category.id === c.categoryId,
                      )?.name
                    }
                  </p>
                ))}
                <p>
                  {changes.length} cambios. Se aplican hasta 1.000 por
                  operación.
                </p>
                <button
                  disabled={busy || !changes.length}
                  onClick={() => {
                    if (
                      confirm(
                        "¿Aplicar estas categorías a los movimientos revisados?",
                      )
                    )
                      void run({
                        action: "rule.apply",
                        ids: changes.slice(0, 1000).map((c) => c.transactionId),
                      })
                        .then(() => setPreview(false))
                        .catch(() => {});
                  }}
                >
                  Aplicar categorías
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {alerts.length ? (
              alerts.map((a) => (
                <div
                  className={
                    a.level === "danger"
                      ? "warning-box section-gap"
                      : "success-box section-gap"
                  }
                  key={a.id}
                >
                  <strong>{a.title}</strong>
                  <p>{a.detail}</p>
                  <div className="actions-row">
                    <button
                      className="text-button"
                      onClick={() => onView(a.view)}
                    >
                      Ver detalle →
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void run({ action: "alerts.dismiss", key: a.id }).catch(
                          () => {},
                        )
                      }
                    >
                      Descartar aviso
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">
                <h3>Sin alertas pendientes</h3>
                <p>
                  Se revisan tus vencimientos, presupuestos, proyección y
                  objetivos.
                </p>
              </div>
            )}
            <details className="section-gap">
              <summary>Configurar alertas</summary>
              <form
                className="credit-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void run({
                    action: "alerts.preferences",
                    data: {
                      due: form.get("due") === "on",
                      budget: form.get("budget") === "on",
                      negative: form.get("negative") === "on",
                      goals: form.get("goals") === "on",
                      days: Number(form.get("days")),
                    },
                  }).catch(() => {});
                }}
              >
                {(
                  [
                    ["due", "Vencimientos"],
                    ["budget", "Presupuestos superados"],
                    ["negative", "Saldo negativo"],
                    ["goals", "Objetivos vencidos"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="checkbox-label" key={key}>
                    <input
                      name={key}
                      type="checkbox"
                      defaultChecked={data.alertPreferences[key]}
                    />
                    {label}
                  </label>
                ))}
                <label htmlFor="alert-days">
                  Anticipación en días
                  <input
                    id="alert-days"
                    name="days"
                    type="number"
                    min={1}
                    max={30}
                    defaultValue={data.alertPreferences.days}
                    required
                  />
                </label>
                <button disabled={busy}>Guardar preferencias</button>
              </form>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void run({ action: "alerts.reset" }).catch(() => {})
                }
              >
                Volver a mostrar avisos descartados
              </button>
            </details>
          </>
        )}
      </section>
    </>
  );
}
