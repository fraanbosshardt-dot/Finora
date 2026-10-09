import Link from "next/link";
import { Brand } from "../../components/brand";
export const metadata = {
  title: "Condiciones de uso · Finora",
  alternates: { canonical: "/terminos" },
};
export default function Page() {
  return (
    <main className="legal-page">
      <Brand />
      <h1>Condiciones de la versión de desarrollo</h1>
      <p>
        Finora es una herramienta de registro y planificación de finanzas
        personales. Esta versión está en desarrollo y no incluye un servicio
        comercial ni una suscripción contratada.
      </p>
      <h2>Proyecciones y simulaciones</h2>
      <p>
        Los resultados se calculan con la información que ingresás. No
        garantizan saldos futuros, ahorro ni rendimientos. Verificá que tus
        registros estén completos antes de tomar una decisión.
      </p>
      <h2>Responsabilidad sobre los registros</h2>
      <p>
        Mantené tus datos actualizados y exportá respaldos. Finora no ejecuta
        pagos, no transfiere fondos reales y no almacena credenciales de tus
        bancos.
      </p>
      <h2>Disponibilidad</h2>
      <p>
        La instalación local depende del equipo, servidor y base de datos que la
        ejecutan. Las condiciones comerciales y el responsable del servicio se
        definirán antes de su publicación.
      </p>
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
    </main>
  );
}
