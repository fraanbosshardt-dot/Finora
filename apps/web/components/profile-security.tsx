"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth-client";

export function ProfileSecurity({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>, password: boolean) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    setError("");
    setMessage("");
    const newPassword = String(form.get("newPassword") ?? "");
    if (password && newPassword !== form.get("confirmation")) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const result = password
        ? await authClient.changePassword({
            currentPassword: String(form.get("currentPassword")),
            newPassword,
            revokeOtherSessions: true,
          })
        : await authClient.updateUser({
            name: String(form.get("name")).trim(),
          });
      if (result.error)
        throw new Error(
          password
            ? "No pudimos cambiar la contraseña. Revisá la contraseña actual y usá al menos 10 caracteres."
            : "No pudimos guardar tu nombre. Intentá de nuevo.",
        );
      if (password) element.reset();
      setMessage(
        password
          ? "Contraseña actualizada. Se cerraron las demás sesiones."
          : "Nombre guardado.",
      );
      if (!password) window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos conectar con el servidor.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel section-gap">
      <h2>Perfil y seguridad</h2>
      <form onSubmit={(event) => void save(event, false)}>
        <label htmlFor="profile-name">
          Tu nombre
          <input
            id="profile-name"
            name="name"
            defaultValue={name}
            required
            minLength={1}
            maxLength={80}
            autoComplete="name"
          />
        </label>
        <button disabled={busy}>Guardar nombre</button>
      </form>
      <details className="section-gap">
        <summary>Cambiar contraseña</summary>
        <p className="muted">
          Después del cambio conservás esta sesión y se cierran las de otros
          dispositivos.
        </p>
        <form onSubmit={(event) => void save(event, true)}>
          <label htmlFor="current-password">
            Contraseña actual
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label htmlFor="new-password">
            Nueva contraseña
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <label htmlFor="confirm-password">
            Repetir nueva contraseña
            <input
              id="confirm-password"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </details>
      {message && (
        <p className="success-box" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
