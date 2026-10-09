"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth-client";
import { Brand } from "./brand";
export function AuthForm({
  mode,
  googleEnabled = false,
  destination = "/app",
  intentQuery = "",
}: {
  mode: "signin" | "signup" | "forgot" | "reset";
  googleEnabled?: boolean;
  destination?: string;
  intentQuery?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const titles = {
    signin: "Qué bueno verte de nuevo.",
    signup: "Tu dinero merece claridad.",
    forgot: "Recuperá tu acceso.",
    reset: "Elegí una nueva contraseña.",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const email = String(form.get("email")),
        password = String(form.get("password"));
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              name: String(form.get("name")),
              email,
              password,
              callbackURL: destination,
            })
          : mode === "signin"
            ? await authClient.signIn.email({
                email,
                password,
                callbackURL: destination,
              })
            : mode === "forgot"
              ? await authClient.requestPasswordReset({
                  email,
                  redirectTo: "/restablecer",
                })
              : await authClient.resetPassword({
                  newPassword: password,
                  token:
                    new URLSearchParams(window.location.search).get("token") ??
                    "",
                });
      if (result.error)
        throw new Error(
          result.error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "El email o la contraseña no coinciden."
            : result.error.code === "USER_ALREADY_EXISTS"
              ? "Este email ya está registrado. Iniciá sesión."
              : result.error.code === "EMAIL_NOT_VERIFIED"
                ? "Verificá tu email para iniciar sesión."
                : result.error.status === 429
                  ? "Hubo varios intentos seguidos. Esperá un minuto y volvé a intentar."
                  : result.error.status === 403
                    ? "Esta dirección no está autorizada para iniciar sesión. Abrí Finora desde la dirección configurada."
                    : "No pudimos continuar. Revisá los datos e intentá de nuevo.",
        );
      if (mode === "forgot")
        setSuccess(
          "Si el email está registrado, vas a recibir un enlace para recuperar tu contraseña.",
        );
      else if (mode === "reset")
        setSuccess("Contraseña actualizada. Ya podés iniciar sesión.");
      else if (
        mode === "signup" &&
        (!result.data || !("token" in result.data) || !result.data.token)
      )
        setSuccess("Revisá tu email y verificá tu cuenta para continuar.");
      else window.location.assign(destination);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos conectar. Intentá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">MENOS INCERTIDUMBRE. MÁS CONTROL.</span>
          <h1>
            Un lugar para tu presente.
            <br />
            Una mirada a lo que viene.
          </h1>
          <p>
            Organizá tus cuentas, entendé tus compromisos y tomá decisiones con
            números claros.
          </p>
          <ul>
            <li>Importes precisos, hasta el último centavo.</li>
            <li>Tus monedas, sin mezclar saldos.</li>
            <li>Tus datos, disponibles para exportar.</li>
          </ul>
        </div>
        <p className="muted">Simple por fuera. Preciso por dentro.</p>
      </section>
      <section className="auth-card">
        <Link className="back-link" href="/">
          ← Volver al inicio
        </Link>
        <h1>{titles[mode]}</h1>
        <p className="muted">
          {mode === "signup"
            ? destination.startsWith("/suscribirse")
              ? "Creá tu cuenta para elegir tu suscripción Pro. Antes de pagar podrás revisar el plan y el precio."
              : "Creá tu espacio personal y empezá con tu primera cuenta."
            : mode === "signin"
              ? "Ingresá a tu espacio personal."
              : "Te ayudamos a volver a tu espacio."}
        </p>
        {success ? (
          <div className="success-box" role="status">
            <p>{success}</p>
            <Link className="button-link" href="/ingresar">
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label htmlFor="name">
                Tu nombre
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label htmlFor="email">
                Email
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label htmlFor="password">
                Contraseña
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "signin" ? 1 : 10}
                  maxLength={128}
                />
                {mode !== "signin" && (
                  <small className="muted">Al menos 10 caracteres.</small>
                )}
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="save" disabled={busy}>
              {busy
                ? "Un momento…"
                : mode === "signin"
                  ? "Iniciar sesión"
                  : mode === "signup"
                    ? "Crear mi cuenta"
                    : mode === "forgot"
                      ? "Enviar enlace"
                      : "Actualizar contraseña"}
            </button>
            {mode === "signin" && (
              <Link className="auth-link" href="/recuperar">
                Olvidé mi contraseña
              </Link>
            )}
          </form>
        )}
        {googleEnabled && (mode === "signin" || mode === "signup") && (
          <button
            className="secondary save"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await authClient.signIn.social({
                provider: "google",
                callbackURL: destination,
              });
              if (result.error) {
                setError("No pudimos conectar con Google.");
                setBusy(false);
              }
            }}
          >
            Continuar con Google
          </button>
        )}
        {(mode === "signin" || mode === "signup") && (
          <p className="auth-switch">
            {mode === "signin"
              ? "¿Todavía no tenés cuenta? "
              : "¿Ya tenés una cuenta? "}
            <Link
              href={`${mode === "signin" ? "/registro" : "/ingresar"}${intentQuery}`}
            >
              {mode === "signin" ? "Empezar gratis" : "Iniciar sesión"}
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
