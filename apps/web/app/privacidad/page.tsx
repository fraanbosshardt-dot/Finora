import Link from "next/link";
import { Brand } from "../../components/brand";
export const metadata = {
  title: "Privacidad · Finora",
  alternates: { canonical: "/privacidad" },
};
export default function Page() {
  return (
    <main className="legal-page">
      <Brand />
      <h1>Privacidad de esta versión</h1>
      <p>
        Finora está en desarrollo. En esta instalación, tus datos se guardan en
        PostgreSQL del equipo que ejecuta la aplicación. El navegador conserva
        únicamente la cookie de sesión; las nuevas operaciones financieras se
        guardan en el servidor.
      </p>
      <h2>Qué datos se guardan</h2>
      <p>
        Tu nombre, email, contraseña protegida por Better Auth, sesiones y datos
        financieros que ingreses. Los registros técnicos de auditoría guardan el
        tipo de operación y su identificador, sin incluir importes ni
        descripciones financieras.
      </p>
      <h2>Control de tus datos</h2>
      <p>
        Desde Ajustes podés exportar tus datos, revocar sesiones y borrar tu
        usuario junto con su espacio personal. La exportación no requiere un
        plan pago.
      </p>
      <h2>Servicios externos</h2>
      <p>
        Si el administrador configura Google o un proveedor de email, esos
        servicios participan en el inicio de sesión o la entrega de emails. No
        hay conexión bancaria, IA ni envío de datos financieros a proveedores de
        IA en esta versión.
      </p>
      <h2>Antes de una publicación comercial</h2>
      <p>
        El responsable de la instalación deberá completar su identidad,
        contacto, plazos de retención y condiciones de operación. Esta página
        describe el funcionamiento actual de la versión de desarrollo.
      </p>
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
    </main>
  );
}
