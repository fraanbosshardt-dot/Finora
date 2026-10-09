"use client";
import { useRef, useState } from "react";
import { backupSchema, type FinancialBackup } from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import { downloadText } from "../lib/download";
import { requestJson } from "../lib/client-api";
export function BackupPanel({ data }: { data: Snapshot }) {
  const [preview, setPreview] = useState<FinancialBackup | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  return (
    <section className="panel section-gap">
      <h2>Respaldo completo del espacio</h2>
      <p className="muted">
        Incluye cuentas, movimientos, tarjetas, préstamos, planes, objetivos,
        presupuestos, escenarios, importaciones, reglas y cotizaciones. No
        incluye contraseñas ni sesiones. Restaurá en un espacio vacío con saldos
        iniciales en cero; la identidad del usuario destino se conserva.
      </p>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const backup = await requestJson<FinancialBackup>(
              `/api/workspaces/${data.workspace.id}/backup`,
            );
            downloadText(
              JSON.stringify(backup, null, 2),
              `finora-respaldo-${data.today}.json`,
              "application/json",
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "No pudimos exportar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Descargar respaldo completo
      </button>
      <label className="section-gap" htmlFor="full-backup">
        Restaurar respaldo completo (versión 3)
        <input
          id="full-backup"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            setPreview(null);
            try {
              if (file.size > 20 * 1024 * 1024)
                throw new Error("El respaldo supera 20 MB.");
              const parsed = backupSchema.parse(JSON.parse(await file.text()));
              key.current = crypto.randomUUID();
              setPreview(parsed);
            } catch {
              setError(
                "Respaldo inválido. Usá una exportación completa versión 3, de hasta 20 MB.",
              );
            }
          }}
        />
      </label>
      {preview && (
        <div className="success-box">
          <h3>Revisá la restauración</h3>
          <p>
            {preview.workspace.name} · {preview.ledger.accounts.length} cuentas
            · {preview.ledger.transactions.length} movimientos ·{" "}
            {preview.cards.length} tarjetas · {preview.debts.length} préstamos ·{" "}
            {preview.installments.length} planes
          </p>
          <p>
            Se regeneran los identificadores y se conservan las relaciones y
            pagos confirmados. El espacio destino debe estar vacío.
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "¿Restaurar este respaldo completo en tu espacio vacío? Sus cuentas y configuración iniciales serán reemplazadas.",
                )
              )
                return;
              setBusy(true);
              setError("");
              try {
                await requestJson(
                  `/api/workspaces/${data.workspace.id}/backup`,
                  {
                    method: "POST",
                    headers: { "idempotency-key": key.current },
                    body: JSON.stringify(preview),
                  },
                );
                window.location.assign("/app");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No pudimos restaurar.",
                );
                setBusy(false);
              }
            }}
          >
            Confirmar restauración completa
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
