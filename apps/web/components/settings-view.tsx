"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ledgerSchema, type Ledger } from "@finora/core";
import { authClient } from "../lib/auth-client";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
import { CsvImport } from "./csv-import";
import { BackupPanel } from "./backup-panel";
import { ProfileSecurity } from "./profile-security";
import { ProPaywall } from "./pro-paywall";
type Session = {
  id: string;
  token: string;
  userAgent?: string | null;
  createdAt: Date;
  expiresAt: Date;
};
export function SettingsView({
  data,
  user,
  onCreateCategory,
  onAction,
}: {
  data: Snapshot;
  user: { name: string; email: string };
  onCreateCategory: () => void;
  onAction: (command: Command) => Promise<void>;
}) {
  const [sessions, setSessions] = useState<Session[]>([]),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Ledger | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  useEffect(() => {
    authClient
      .listSessions()
      .then((result) => {
        if (result.data) setSessions(result.data);
        else setError("No pudimos leer las sesiones.");
      })
      .catch(() => setError("No pudimos conectar con el servidor."));
  }, []);
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 2, exportedAt: new Date().toISOString(), ...data },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `finora-${data.today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function loadImport(raw: string) {
    setError("");
    try {
      const parsed = JSON.parse(raw);
      setPending(ledgerSchema.parse(parsed.ledger ?? parsed));
    } catch {
      setError(
        "No pudimos leer el archivo. Elegí un JSON de cuentas, ingresos y gastos de Finora.",
      );
    }
  }
  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      await onAction({ action: "ledger.import", data: pending });
      setPending(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos importar.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      !window.confirm(
        "¿Borrar definitivamente tu usuario, cuentas y movimientos? Esta acción no se puede deshacer.",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await authClient.deleteUser({
        password: String(form.get("password")),
      });
      if (result.error)
        throw new Error("No pudimos borrar tu cuenta. Revisá tu contraseña.");
      window.location.assign("/");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos borrar tu cuenta.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="settings-profile">
          <span className="avatar" aria-hidden="true">
            {user.name[0]?.toUpperCase()}
          </span>
          <div>
            <h2>{user.name}</h2>
            <p className="muted">
              Plan {data.workspace.plan === "PRO" ? "Pro" : "Free"} · moneda
              base {data.workspace.baseCurrency}
            </p>
          </div>
        </div>
        <p>
          {user.name} · {user.email}
        </p>
        <p className="muted">
          {data.workspace.name} · {data.workspace.country} ·{" "}
          {data.workspace.timezone}
        </p>
        <p className="tag">
          {data.workspace.plan === "PRO"
            ? "Finora Pro activo"
            : "Free · Tu organización diaria, sin cargo"}
        </p>
      </section>
      <ProfileSecurity name={user.name} />
      <section className="panel section-gap settings-preferences">
        <h2>Preferencias</h2>
        <div className="preference-row">
          <div>
            <strong>Alertas en la aplicación</strong>
            <p className="muted">
              Vencimientos, presupuestos, saldo y objetivos.
            </p>
          </div>
          <button
            role="switch"
            aria-label="Alertas en la aplicación"
            aria-checked={Object.entries(data.alertPreferences).some(
              ([k, v]) => k !== "days" && v === true,
            )}
            disabled={busy}
            className="preference-switch"
            onClick={async () => {
              setBusy(true);
              try {
                const active = Object.entries(data.alertPreferences).some(
                  ([k, v]) => k !== "days" && v === true,
                );
                await onAction({
                  action: "alerts.preferences",
                  data: {
                    ...data.alertPreferences,
                    due: !active,
                    budget: !active,
                    negative: !active,
                    goals: !active,
                  },
                });
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "No se guardó la preferencia.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <span />
          </button>
        </div>
        <div className="preference-row">
          <div>
            <strong>Asistente de IA</strong>
            <p className="muted">
              En desarrollo. Las consultas locales funcionan sin IA externa.
            </p>
          </div>
          <span className="tag">Próximamente</span>
        </div>
        <div className="preference-row">
          <div>
            <strong>Bloqueo biométrico</strong>
            <p className="muted">Previsto para la futura app móvil.</p>
          </div>
          <span className="tag">Próximamente</span>
        </div>
        <details>
          <summary>Comparar Free y Finora Pro</summary>
          <ProPaywall feature="Las herramientas avanzadas" />
        </details>
      </section>
      <section className="panel section-gap">
        <h2>Tus datos siempre son tuyos</h2>
        <p className="muted">
          Exportá todos tus registros. Para migrar la primera versión local,
          importá su JSON o leé los datos de este navegador.
        </p>
        <div className="actions-row">
          <button onClick={exportData}>Exportar datos JSON ↓</button>
          <button
            className="secondary"
            disabled={data.workspace.plan !== "PRO"}
            onClick={() => {
              const raw = localStorage.getItem("finora.local-ledger.v1");
              if (raw) loadImport(raw);
              else
                setError(
                  "Este navegador no tiene datos de la versión anterior.",
                );
            }}
          >
            Leer versión anterior
          </button>
        </div>
        <label className="section-gap" htmlFor="importFile">
          Importar cuentas y movimientos JSON
          <input
            id="importFile"
            type="file"
            disabled={data.workspace.plan !== "PRO"}
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 512000) setError("El archivo supera 500 KB.");
                else loadImport(await file.text());
              }
            }}
          />
        </label>
        {pending && (
          <div className="success-box">
            <h3>Revisá antes de importar</h3>
            <p>
              {pending.accounts.length} cuentas · {pending.transactions.length}{" "}
              movimientos
            </p>
            <p className="muted">
              Se omiten identificadores ya importados. Admite ingresos y gastos
              manuales; los cronogramas y transferencias no se restauran con
              esta importación.
            </p>
            <div className="actions-row">
              <button disabled={busy} onClick={confirmImport}>
                {busy ? "Importando…" : "Confirmar importación"}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
      {data.workspace.plan === "PRO" ? (
        <CsvImport data={data} onAction={onAction} />
      ) : (
        <section className="panel section-gap">
          <h2>Importaciones · Pro</h2>
          <p className="muted">
            Importá CSV o registros de versiones anteriores, revisá duplicados y
            deshacé lotes. La exportación y los respaldos completos siguen
            incluidos en Free.
          </p>
          <details>
            <summary>Ver Finora Pro</summary>
            <ProPaywall feature="Importaciones" />
          </details>
        </section>
      )}
      <BackupPanel data={data} />
      <section className="panel section-gap">
        <h2>Historial de importaciones</h2>
        {data.imports.length ? (
          data.imports.map((batch) => (
            <div className="account-row" key={batch.id}>
              <div>
                <strong>{batch.importedCount} movimientos importados</strong>
                <small>
                  {new Date(batch.createdAt).toLocaleString("es-AR")} ·{" "}
                  {batch.rolledBack ? "Revertida" : "Guardada"}
                </small>
              </div>
              <button
                className="text-button danger-text"
                disabled={batch.rolledBack}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "¿Deshacer este lote? Se eliminarán sus movimientos, incluidos los que hayas editado. Las cuentas creadas se conservan.",
                    )
                  )
                    return;
                  try {
                    await onAction({ action: "import.rollback", id: batch.id });
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "No pudimos revertir el lote.",
                    );
                  }
                }}
              >
                Deshacer lote
              </button>
            </div>
          ))
        ) : (
          <p className="muted">Tus importaciones van a aparecer acá.</p>
        )}
      </section>
      <section className="panel section-gap">
        <div className="panel-heading">
          <h2>Categorías</h2>
          <button onClick={onCreateCategory}>+ Crear categoría</button>
        </div>
        <label htmlFor="categoryFilter">
          Buscar entre {data.categories.length} categorías
          <input
            id="categoryFilter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o grupo"
          />
        </label>
        <div className="category-tags">
          {data.categories
            .filter((c) =>
              `${c.group} ${c.name}`
                .toLocaleLowerCase("es")
                .includes(search.toLocaleLowerCase("es")),
            )
            .slice(0, 40)
            .map((c) => (
              <span className="tag" key={c.id}>
                {c.group} · {c.name}
              </span>
            ))}
        </div>
        <p className="panel-foot">
          Se muestran hasta 40 resultados. Refiná la búsqueda para encontrar una
          subcategoría.
        </p>
      </section>
      <section className="panel section-gap">
        <h2>Sesiones y dispositivos</h2>
        {sessions.map((session) => (
          <div className="account-row" key={session.id}>
            <div>
              <strong>
                {session.userAgent?.slice(0, 110) ?? "Dispositivo"}
              </strong>
              <small>
                Creada{" "}
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "short",
                }).format(new Date(session.createdAt))}
              </small>
            </div>
            <button
              className="text-button danger-text"
              onClick={async () => {
                if (
                  !window.confirm(
                    "¿Revocar esta sesión? Este dispositivo deberá iniciar sesión nuevamente.",
                  )
                )
                  return;
                const result = await authClient.revokeSession({
                  token: session.token,
                });
                if (result.error) setError("No pudimos revocar la sesión.");
                else setSessions(sessions.filter((s) => s.id !== session.id));
              }}
            >
              Revocar
            </button>
          </div>
        ))}
      </section>
      <section className="panel section-gap danger-zone">
        <h2>Borrar cuenta</h2>
        <p className="muted">
          Elimina tu usuario y todos los datos de tu espacio personal. Exportá
          un respaldo antes.
        </p>
        <form onSubmit={deleteUser}>
          <label htmlFor="deletePassword">
            Confirmá tu contraseña
            <input
              id="deletePassword"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="danger-button" disabled={busy}>
            Borrar mi cuenta definitivamente
          </button>
        </form>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
