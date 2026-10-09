# Free y Finora Pro

## Free

Para registrar y organizar el dinero sin pagar: cuentas manuales ARS/USD/EUR, categorías, ingresos/gastos, transferencias, filtros y CSV de movimientos, gastos futuros únicos, recurrentes, calendario día/semana/mes e ICS, proyección a 3 meses, presupuestos, objetivos, consultas deterministas y alertas en la aplicación. Perfil, contraseña, sesiones, privacidad, exportación y respaldo completo permanecen disponibles.

## Pro

Tarjetas y compras en cuotas, préstamos y amortización, simulador de compra, simulador de préstamo/cancelación anticipada, informes por período/cuenta/categoría, reglas de categorización, importación CSV/JSON, cotizaciones propias y valuación, proyección a 6/12/24/36 meses.

Precio de referencia definido: **USD 3,99 al mes o USD 29,99 al año** (aproximadamente 37% menos que 12 mensualidades). Impuestos, cobros regionales y conversión deben mostrarse antes del pago real. No se promete IA, bancos conectados, cotizaciones automáticas ni OCR como funciones actuales.

## Acceso

Las secciones Pro aparecen en el menú con su identificación. Free puede abrirlas y ver beneficios, periodicidad, precio y acceso al pago; no se renderizan los formularios Pro. Las operaciones de creación/aplicación Pro también verifican el plan en la API; ocultar botones no basta.

El plan se obtiene del workspace en servidor. Pro requiere `plan = PRO` y `proUntil` en el futuro. No existe un endpoint público para activar Pro ni se restaura una suscripción desde un respaldo. Al vencer, los datos financieros permanecen conservados y exportables; las operaciones de eliminación, reversión y confirmación de pagos existentes no cobran acceso.

**La pasarela todavía no está conectada.** El botón muestra esa condición, no solicita tarjetas, no cobra y no activa Pro. Una futura integración verificará pagos y webhooks antes de modificar el plan. Las pruebas de funciones Pro conceden acceso únicamente a usuarios temporales `@example.test`, directamente en la base de prueba; nunca desde la API del producto.

## Registro y checkout

`Empezar gratis` lleva a `/registro`, seguido del onboarding y el dashboard. `Ver Finora Pro` lleva a `/registro?plan=pro&period=yearly`; la intención se conserva al cambiar a inicio de sesión. Al autenticar, Pro va a `/suscribirse?period=...` para elegir mensual/anual, sin activar el plan ni pedir datos financieros antes del cobro. Un usuario ya autenticado va directamente al destino correcto. La suscripción activa evita ofrecer un segundo pago.

## Estrategia internacional propuesta

Precio de referencia USD, con catálogo por país/canal antes de producción. Web Argentina: evaluar Mercado Pago Suscripciones y precios ARS. Web internacional: evaluar Paddle como merchant of record, sujeto a aprobación de Finora; Lemon Squeezy es una alternativa que lista Argentina para pagos a vendedores. No se integra ninguno en esta etapa.

iOS: StoreKit/suscripciones de App Store; Android: Google Play Billing. Los precios mostrados en las apps deben provenir de la tienda, no de convertir un dólar en el teléfono. La moneda de venta y la de liquidación al desarrollador pueden ser diferentes. Apple utiliza USD para la tienda Argentina según su tabla actual; no se debe prometer ARS en todos los canales.

La cuenta deberá compartir un entitlement entre plataformas, gestionar cancelación/renovación, permitir restaurar compras y evitar una segunda suscripción si ya hay una activa. Antes de conectar, agregar el registro de suscripción/pago, proveedores desacoplados, verificación de eventos firmados, idempotencia, acceso tras vencimiento, impuestos y conciliación. El estado actual `plan/proUntil` es la base de acceso, no un sistema de cobros completo.

Fuentes oficiales consultadas el 9 de octubre de 2026:

- [Mercado Pago Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/overview).
- [Paddle: países](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle), [precios localizados](https://developer.paddle.com/concepts/sell/supported-countries-locales/), [tarifas](https://www.paddle.com/pricing) y [productos admitidos](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle).
- [Lemon Squeezy: países](https://docs.lemonsqueezy.com/help/getting-started/supported-countries), [comisiones](https://docs.lemonsqueezy.com/help/getting-started/fees).
- [Apple: suscripciones](https://developer.apple.com/app-store/subscriptions/), [reglas](https://developer.apple.com/app-store/review/guidelines/) y [monedas por tienda](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/auto-renewable-subscription-price-increase-thresholds/).
- [Google Play: pagos](https://support.google.com/googleplay/android-developer/answer/9858738), [monedas](https://support.google.com/googleplay/android-developer/answer/1169947).
- [Stripe: disponibilidad](https://stripe.com/global). Argentina no figura en la lista de países para una cuenta Stripe directa.
