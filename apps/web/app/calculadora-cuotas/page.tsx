import Link from "next/link";
import { Brand } from "../../components/brand";
import { InstallmentCalculator } from "../../components/installment-calculator";
export const metadata = {
  title: "Calculadora de cuotas · Finora",
  description:
    "Calculá un cronograma de cuotas y anticipo con importes exactos, sin registro.",
  alternates: { canonical: "/calculadora-cuotas" },
};
export default function Page() {
  return (
    <main className="calculator-page">
      <Brand />
      <span className="eyebrow">CALCULADORA GRATUITA</span>
      <h1>Entendé tus cuotas antes de comprometerte.</h1>
      <p className="muted">
        Ingresá el total, el anticipo y la cantidad de pagos. No hace falta
        crear una cuenta.
      </p>
      <InstallmentCalculator />
      <p>
        ¿Querés ver cómo impacta en tus finanzas?{" "}
        <Link href="/registro">Creá tu espacio gratis →</Link>
      </p>
    </main>
  );
}
