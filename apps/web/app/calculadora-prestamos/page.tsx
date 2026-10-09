import Link from "next/link";
import {Brand} from "../../components/brand";
import {LoanLab} from "../../components/loan-lab";
export const metadata={title:"Calculadora de préstamos · Finora",description:"Compará cuotas francesas, alemanas y americanas, intereses y tasas derivadas con condiciones explícitas.",alternates:{canonical:"/calculadora-prestamos"}};
export default function Page(){return <main className="calculator-page"><Brand/><h1>Calculadora de préstamos</h1><p className="muted">Un cronograma claro para entender el costo de tus pagos.</p><LoanLab/><Link className="button-link section-gap" href="/registro">Guardar mis préstamos en Finora</Link><Link className="back-link" href="/">← Volver al inicio</Link></main>;}
