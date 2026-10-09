"use client";
import { useState } from "react";
import {
  parseCsv,
  parseMoney,
  formatMoney,
  ledgerSchema,
  type Ledger,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
type Parsed = ReturnType<typeof parseCsv>;
type Mapping = {
  date: number;
  description: number;
  amount: number;
  type: number;
  category: number;
};
const labels: Record<keyof Mapping, string> = {
  date: "Fecha (AAAA-MM-DD)",
  description: "Descripción",
  amount: "Importe sin separadores de miles",
  type: "Tipo (ingreso/gasto)",
  category: "Categoría (opcional)",
};
export function CsvImport({
  data,
  onAction,
}: {
  data: Snapshot;
  onAction: (command: Command) => Promise<void>;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null),
    [raw, setRaw] = useState(""),
    [mapping, setMapping] = useState<Mapping>({
      date: 0,
      description: 1,
      amount: 2,
      type: 3,
      category: -1,
    }),
    [accountId, setAccountId] = useState(
      data.ledger.accounts.find(
        (a) => a.kind !== "credit" && a.active !== false,
      )?.id ?? "",
    ),
    [preview, setPreview] = useState<Ledger | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function buildPreview() {
    if (!parsed) return;
    setError("");
    try {
      const account = data.ledger.accounts.find((a) => a.id === accountId);
      if (!account) throw new Error("Seleccioná una cuenta.");
      const fileHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(raw),
      );
      const salt = Array.from(new Uint8Array(fileHash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const transactions = await Promise.all(
        parsed.rows.map(async (row, index) => {
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(`${salt}:${accountId}:${index}`),
          );
          const bytes = new Uint8Array(digest).slice(0, 16);
          bytes[6] = (bytes[6]! & 15) | 64;
          bytes[8] = (bytes[8]! & 63) | 128;
          const hex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
          const type = (row[mapping.type] ?? "").trim().toLocaleLowerCase("es");
          if (
            !["ingreso", "income", "gasto", "expense", "egreso"].includes(type)
          )
            throw new Error(
              `Fila ${index + 2}: el tipo debe ser ingreso o gasto.`,
            );
          return {
            id,
            accountId,
            type: ["ingreso", "income"].includes(type) ? "income" : "expense",
            amountMinor: parseMoney(row[mapping.amount] ?? ""),
            date: (row[mapping.date] ?? "").trim(),
            description: (row[mapping.description] ?? "").trim(),
            category: row[mapping.category]?.trim() || "Gastos varios",
          };
        }),
      );
      setPreview(ledgerSchema.parse({ accounts: [account], transactions }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revisá las columnas.");
    }
  }
  async function confirm() {
    if (!preview) return;
    setBusy(true);
    try {
      await onAction({ action: "ledger.import", data: preview });
      setPreview(null);
      setParsed(null);
      setRaw("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos importar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel section-gap">
      <h2>Importar CSV</h2>
      <p className="muted">
        Elegí el archivo, mapeá sus columnas y revisá antes de guardar. Cada
        archivo admite una moneda y una cuenta.
      </p>
      <label htmlFor="csvFile">
        Archivo CSV
        <input
          id="csvFile"
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const next = parseCsv(text);
              setRaw(text);
              setParsed(next);
              setPreview(null);
              setError("");
              const find = (names: string[]) =>
                next.headers.findIndex((h) =>
                  names.includes(h.toLocaleLowerCase("es")),
                );
              setMapping({
                date: find(["date", "fecha"]),
                description: find([
                  "description",
                  "descripcion",
                  "descripción",
                  "concepto",
                ]),
                amount: find(["amount", "importe", "monto"]),
                type: find(["type", "tipo"]),
                category: find(["category", "categoria", "categoría"]),
              });
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "No pudimos leer el archivo.",
              );
            }
          }}
        />
      </label>
      {parsed && !preview && (
        <>
          <label htmlFor="csvAccount">
            Cuenta de destino
            <select
              id="csvAccount"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {data.ledger.accounts
                .filter((a) => a.kind !== "credit" && a.active !== false)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
            </select>
          </label>
          <div className="form-grid">
            {(Object.keys(labels) as (keyof Mapping)[]).map((key) => (
              <label key={key} htmlFor={`csv-${key}`}>
                {labels[key]}
                <select
                  id={`csv-${key}`}
                  value={mapping[key]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [key]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>Seleccionar columna</option>
                  {parsed.headers.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button onClick={buildPreview}>
            Revisar {parsed.rows.length} movimientos →
          </button>
        </>
      )}
      {preview && (
        <div className="success-box">
          <h3>Vista previa: {preview.transactions.length} movimientos</h3>
          <p className="muted">
            Reimportar el mismo archivo en la misma cuenta no duplica
            movimientos. Revisá fechas, moneda e importes.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {preview.transactions.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.description}</td>
                    <td>{t.type === "income" ? "Ingreso" : "Gasto"}</td>
                    <td>
                      {formatMoney(
                        t.amountMinor,
                        preview.accounts[0]!.currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions-row section-gap">
            <button disabled={busy} onClick={confirm}>
              {busy ? "Importando…" : "Confirmar importación CSV"}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Cambiar columnas
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
