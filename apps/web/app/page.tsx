import Link from "next/link";
import { pricing } from "../lib/plans";
import {
  Wallet,
  CalendarDays,
  ShieldCheck,
  ChartNoAxesCombined,
  Sparkles,
  Landmark,
  ArrowUpRight,
} from "lucide-react";
import {
  CurrencyExample,
  LoanExample,
  PurchaseExample,
} from "../components/design-examples";
const features = [
  [
    Wallet,
    "Cuentas y monedas",
    "Bancos, efectivo y billeteras en un solo lugar, en pesos, dólares y euros.",
  ],
  [
    CalendarDays,
    "Tarjetas y cuotas",
    "Cargá una compra una sola vez y mirá cuándo termina y cuánto comprometés cada mes.",
  ],
  [
    Landmark,
    "Deudas y préstamos",
    "Cuadro de amortización, tasas y simulación de cancelación anticipada.",
  ],
  [
    ChartNoAxesCombined,
    "Proyección",
    "Mirá cómo cerrás el mes y los próximos 36 meses con los compromisos que registraste.",
  ],
  [
    Sparkles,
    "¿Puedo comprarlo?",
    "Simulá una compra sin tocar tus datos reales y mirá su impacto mes a mes.",
  ],
  [
    ShieldCheck,
    "Reglas y alertas",
    "Organizá tus categorías y seguí vencimientos, presupuestos y objetivos.",
  ],
] as const;
const security = [
  [
    "Sin credenciales bancarias",
    "Nunca te pedimos usuario ni clave de tu banco.",
  ],
  [
    "Sesiones revocables",
    "Mirá tus dispositivos y cerrá las sesiones que ya no usás.",
  ],
  [
    "Aislamiento por espacio",
    "Cada consulta valida el acceso a tu espacio de trabajo.",
  ],
  [
    "Tus datos, tu decisión",
    "Exportá un respaldo completo o borrá tu cuenta cuando quieras.",
  ],
  [
    "Cálculos transparentes",
    "Importes exactos, tasas explícitas y monedas originales conservadas.",
  ],
  [
    "Privacidad en las consultas",
    "Las respuestas locales usan tus registros sin enviar datos a una IA externa.",
  ],
];
const faqs = [
  [
    "¿Finora es gratis?",
    "Sí. Free incluye cuentas, movimientos, transferencias, recurrentes, gastos futuros, presupuestos, objetivos, alertas, consultas locales y proyección a 3 meses. Pro suma herramientas avanzadas. Los pagos todavía no están habilitados.",
  ],
  [
    "¿Qué monedas soporta?",
    "ARS, USD y EUR. Podés ingresar cotizaciones manuales con fecha y fuente para valuar tu patrimonio sin modificar tus movimientos.",
  ],
  [
    "¿Finora se conecta a mi banco?",
    "Las cuentas son manuales. Cargás tus movimientos o los importás desde un archivo; no guardamos credenciales bancarias.",
  ],
  [
    "¿Cómo se calculan las respuestas?",
    "El motor financiero usa tus registros y compromisos. Las consultas disponibles son locales y deterministas; la IA externa es una función futura.",
  ],
  [
    "¿Puedo llevarme mis datos?",
    "Sí. Podés exportar CSV, descargar un respaldo financiero completo y restaurarlo en un espacio vacío.",
  ],
];
export const metadata = { alternates: { canonical: "/" } };
export default function Page() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Finora", url: site },
      {
        "@type": "SoftwareApplication",
        name: "Finora",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        url: site,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(([q, a]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
  return (
    <div className="dc-site">
      <header className="dc-header">
        <Link href="/" className="dc-logo">
          Finora
        </Link>
        <nav aria-label="Principal">
          {[
            ["funciones", "Funciones"],
            ["comprar", "¿Puedo comprarlo?"],
            ["calculadora", "Calculadora"],
            ["seguridad", "Seguridad"],
            ["planes", "Planes"],
            ["faq", "Preguntas"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
          <Link href="/ingresar">Ingresar</Link>
          <Link className="dc-button" href="/registro">
            Empezar gratis
          </Link>
        </nav>
      </header>
      <main>
        <section id="inicio" className="dc-container dc-hero">
          <div className="dc-rise">
            <span className="dc-tag">
              Finanzas personales · web adaptable a tu celular
            </span>
            <h1>Sabé cuánto podés gastar antes de gastar.</h1>
            <p>
              Controlá ingresos, gastos, bancos, efectivo, tarjetas, cuotas,
              deudas y monedas. Mirá hoy y proyectá lo que viene.
            </p>
            <div className="dc-actions">
              <Link className="dc-button" href="/registro">
                Empezar gratis
              </Link>
              <a className="dc-button dc-outline" href="#funciones">
                Ver cómo funciona
              </a>
            </div>
          </div>
          <div className="dc-preview">
            <div className="dc-preview-balance">
              <span>Disponible real</span>
              <strong>$1.482.300</strong>
              <small>Después de compromisos próximos</small>
            </div>
            {[
              ["05 Oct", "Visa", "$480.000"],
              ["10 Oct", "Alquiler", "$500.000"],
              ["18 Oct", "Seguro", "$87.000"],
            ].map(([date, name, amount]) => (
              <div className="dc-preview-row" key={name}>
                <span>{date}</span>
                <strong>{name}</strong>
                <strong>{amount}</strong>
              </div>
            ))}
            <p className="dc-small">
              Vista ilustrativa · tus cuentas empiezan con tus datos.
            </p>
          </div>
        </section>
        <section id="funciones" className="dc-container dc-section">
          <h2 className="dc-centered">Simple por fuera, potente por dentro</h2>
          <p className="dc-centered dc-section-subtitle">
            Todo lo que necesitás para entender tu plata, sin planillas ni
            tutoriales.
          </p>
          <div className="dc-feature-grid">
            {features.map(([Icon, title, text]) => (
              <article className="dc-card dc-hover" key={title}>
                <span className="dc-icon">
                  <Icon size={23} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="monedas" className="dc-container dc-section dc-split">
          <div>
            <h2>Tu patrimonio, en la moneda que quieras</h2>
            <p>
              Cambiá cómo lo ves sin tocar tus movimientos originales. Cada
              cotización muestra su fuente y su fecha.
            </p>
          </div>
          <CurrencyExample />
        </section>
        <section id="proyeccion" className="dc-container dc-section">
          <div className="dc-card dc-split">
            <div>
              <h2>Mirá lo que viene</h2>
              <p>
                Proyectá 3, 6, 12, 24 o 36 meses. Usá los compromisos e ingresos
                que registraste, sin inventar inflación ni tasas.
              </p>
              <p className="dc-small">
                Gráfico ilustrativo, no una predicción de tus finanzas.
              </p>
            </div>
            <div
              className="dc-example-chart"
              aria-label="Proyección ilustrativa de seis meses"
            >
              {[
                ["Oct", 150],
                ["Nov", 120],
                ["Dic", 60],
                ["Ene", 110],
                ["Feb", 140],
                ["Mar", 180],
              ].map(([month, height]) => (
                <div key={month}>
                  <strong>{Number(height) / 100} M</strong>
                  <span
                    style={{ height: `${height}px` }}
                    className={height === 60 ? "dc-warning-bar" : ""}
                  />
                  <small>{month}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="calculadora" className="dc-container dc-section dc-split">
          <div>
            <h2>Calculadora de préstamos y cuotas</h2>
            <p>
              Compará pagos e intereses antes de decidir. Probá un préstamo
              francés de $1.000.000 y después ingresá tus propias condiciones.
            </p>
            <Link className="dc-text-link" href="/calculadora-cuotas">
              Calcular una compra en cuotas →
            </Link>
          </div>
          <LoanExample />
        </section>
        <section id="ia" className="dc-container dc-section dc-split">
          <div className="dc-card dc-chat">
            <div className="dc-chat-user">¿En qué gasté más este mes?</div>
            <div className="dc-chat-answer">
              Consultá tu categoría con más gastos, tu disponible por día y el
              final de tus cuotas con datos de tu espacio.
            </div>
            <span className="dc-small">
              Consultas locales disponibles · IA conversacional en desarrollo
            </span>
            <Link className="dc-button" href="/app?tab=Consultas">
              Preguntale a Finora <ArrowUpRight size={17} />
            </Link>
          </div>
          <div>
            <h2>Respuestas claras, números reales</h2>
            <p>
              Los números los calcula el motor financiero. Las consultas locales
              te los explican con enlaces a tus registros, sin conectar un
              proveedor externo.
            </p>
          </div>
        </section>
        <section id="seguridad" className="dc-security">
          <div className="dc-container">
            <h2 className="dc-centered">
              Seguridad y privacidad desde el diseño
            </h2>
            <div className="dc-security-grid">
              {security.map(([title, text]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="comprar" className="dc-purchase">
          <div className="dc-container dc-split">
            <div>
              <h2>¿Puedo comprarlo?</h2>
              <p>
                Probá una compra antes de hacerla. Finora calcula el impacto
                sobre tus saldos y compromisos para ayudarte a decidir.
              </p>
            </div>
            <PurchaseExample />
          </div>
        </section>
        <section id="planes" className="dc-container dc-section">
          <h2 className="dc-centered">
            Empezá gratis. Elegí Pro cuando necesites más.
          </h2>
          <div className="dc-price-grid">
            <article className="dc-card dc-price">
              <h3>Free</h3>
              <strong>$0</strong>
              <ul>
                {[
                  "Cuentas manuales",
                  "Ingresos, gastos y transferencias",
                  "Dashboard y presupuestos",
                  "Objetivos, recurrentes y gastos futuros",
                  "Proyección a 3 meses y alertas",
                  "Exportación y respaldos",
                ].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <Link className="dc-button" href="/registro">
                Empezar gratis
              </Link>
            </article>
            <article className="dc-card dc-price dc-pro">
              <span className="dc-tag">MÁS CLARIDAD, MENOS TRABAJO</span>
              <h3>Pro</h3>
              <strong>
                USD {pricing.monthly}
                <small> / mes</small>
              </strong>
              <p>O USD {pricing.yearly} al año. Ahorrás aproximadamente 37%.</p>
              <ul>
                {[
                  "Tarjetas, cuotas y préstamos completos",
                  "Proyección de hasta 36 meses",
                  "Simulaciones de compras y préstamos",
                  "Informes, reglas e importaciones CSV",
                  "Valuación con cotizaciones propias",
                ].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <small>
                Precio de referencia en USD. Cobros pendientes de habilitación;
                impuestos y conversión se informarán antes del pago.
              </small>
              <Link className="dc-button" href="/registro?plan=pro&period=yearly">
                Ver Finora Pro
              </Link>
            </article>
          </div>
          <p className="dc-centered dc-small">
            Exportar tus datos es siempre gratis.
          </p>
        </section>
        <section id="faq" className="dc-container dc-section dc-faq">
          <h2 className="dc-centered">Preguntas frecuentes</h2>
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section id="registro" className="dc-container dc-section">
          <div className="dc-final">
            <h2>Empezá a ver tu plata en un solo lugar</h2>
            <p>Creá tu cuenta gratis y empezá con tus datos.</p>
            <Link className="dc-button" href="/registro">
              Empezar gratis
            </Link>
          </div>
        </section>
      </main>
      <footer className="dc-container dc-footer">
        <span>Finora. Finanzas personales.</span>
        <div>
          <a href="#funciones">Funciones</a>
          <a href="#calculadora">Calculadora</a>
          <a href="#seguridad">Seguridad</a>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/terminos">Términos</Link>
        </div>
        <span>Tus datos son tuyos: podés exportarlos o borrarlos.</span>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
