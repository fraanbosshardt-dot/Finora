# MASTER PROMPT — FINORA

Actuá como un equipo senior completo compuesto por Product Manager, UX/UI Designer, Staff Full-Stack Engineer, Mobile Engineer, Backend Engineer, Data Engineer, Security Engineer, QA Engineer, SEO Specialist y especialista en productos fintech. Construí una plataforma de finanzas personales llamada provisionalmente **Finora**. No hagas una demo superficial: diseñá una base de producto real, rápida, mantenible, escalable y lista para convertirse en SaaS comercial.

## 1. Visión del producto

Finora no debe ser solamente una app para anotar gastos. Debe responder con claridad:

**“¿Cómo estoy hoy, qué compromisos tengo, qué me espera en los próximos meses y puedo permitirme esta decisión?”**

El producto debe permitir registrar, entender, proyectar, simular y consultar las finanzas personales desde:

- App Android.
- App iOS.
- Aplicación web completa.
- Landing pública optimizada para SEO.

Debe haber un plan gratuito realmente útil y un plan Pro económico. La experiencia debe ser extremadamente simple aunque el motor financiero sea avanzado.

## 2. Plataformas y arquitectura

Usar un monorepo TypeScript con pnpm workspaces + Turborepo.

Estructura deseada:

```text
apps/
  web/       # Next.js: marketing, dashboard web y BFF/API
  mobile/    # Expo + React Native: iOS y Android
packages/
  core/      # lógica financiera pura
  db/        # Prisma + PostgreSQL
  ui/        # design tokens y componentes compartibles cuando sea razonable
  config/    # tsconfig/eslint/configuración común
```

### Web
- Next.js 16.3.x estable/LTS o última versión estable parcheada dentro de esa rama.
- App Router.
- TypeScript estricto.
- React Server Components donde tengan sentido.
- Server Actions solo si mejoran DX sin crear acoplamiento innecesario.
- Route Handlers para API/BFF.
- Turbopack.
- SSR/SSG/ISR para marketing y SEO.
- Dashboard autenticado separado del sitio público.

### Mobile
- Expo SDK estable actual compatible con React Native estable.
- Expo Router.
- React Native.
- EAS Build / Submit / Update.
- iOS + Android desde una sola base de código.
- SecureStore para sesión y secretos locales.
- Soporte para deep links.
- Push notifications preparadas para recordatorios futuros.
- Diseño mobile-first.

### Backend
- PostgreSQL.
- Prisma estable de producción. Evitar versiones RC/beta si existe una versión estable soportada.
- API consumible tanto por web como por mobile.
- Zod para validación en límites del sistema.
- Lógica financiera aislada en `packages/core` y cubierta por tests.
- Trabajos programados desacoplados para recurrencias, FX, notificaciones e insights.

### Auth
Usar Better Auth o solución equivalente open source y económica.

Soportar:
- crear cuenta con email + contraseña;
- iniciar sesión con email + contraseña;
- continuar con Google;
- Apple Sign In en iOS cuando sea requerido/recomendable;
- recuperación de contraseña;
- verificación de email;
- sesiones revocables;
- dispositivos/sesiones visibles;
- 2FA preparado para una fase posterior.

No almacenar tokens sensibles sin cifrado/secure storage.

## 3. Principios de UX

La aplicación puede tener cientos de funciones internamente, pero el usuario no debe sentir complejidad.

Navegación principal móvil:

1. Inicio
2. Movimientos
3. Planificación
4. Cuentas
5. IA

Botón flotante o principal `+` con:
- Gasto
- Ingreso
- Transferencia
- Compra en cuotas
- Deuda / crédito

Registrar un gasto común debe poder hacerse en aproximadamente 3–5 interacciones:

1. importe;
2. categoría/comercio;
3. cuenta/medio de pago;
4. guardar.

Fecha, etiquetas, nota, ticket, recurrente, cuotas, geolocalización opcional y demás deben ir bajo “Más opciones”.

Soportar entrada natural:

“Gasté 48.000 de nafta con Visa Galicia en 3 cuotas.”

El sistema interpreta, muestra vista previa estructurada y pide confirmación antes de guardar.

## 4. Diseño visual

Objetivo: fintech moderna, limpia, amigable, premium pero accesible. No copiar a ninguna marca.

Paleta inicial:
- background: `#F7F8FA`
- surface: `#FFFFFF`
- text primary: `#111827`
- text muted: `#667085`
- primary: `#16A085`
- primary strong: `#0F766E`
- success: `#16A34A`
- warning: `#F59E0B`
- danger: `#DC2626`
- border: `#E5E7EB`

Modo oscuro preparado desde design tokens.

Tipografía:
- Inter o equivalente sans-serif moderna.
- números financieros con excelente legibilidad y tabular numerals cuando corresponda.

UI:
- tarjetas con radios 16–24px;
- sombras muy sutiles;
- mucho espacio;
- evitar dashboards llenos de widgets irrelevantes;
- gráficos minimalistas y accesibles;
- no depender solo del color para estados positivos/negativos;
- WCAG AA como objetivo.

## 5. Conceptos financieros fundamentales

Separar correctamente:

- saldo: dinero registrado en una cuenta;
- liquidez: activos inmediatamente utilizables;
- comprometido: pagos futuros conocidos;
- disponible real: liquidez menos compromisos del horizonte seleccionado;
- flujo mensual: entradas menos salidas del período;
- patrimonio neto: activos menos pasivos;
- deuda total: capital/saldo pendiente;
- servicio de deuda: cuotas/pagos exigibles durante un período;
- exposición por moneda;
- gastos fijos vs variables;
- proyectado vs realizado.

Nunca mezclar deuda total con cuota mensual.

## 6. Cuentas

Permitir crear cuentas de tipo:
- banco;
- efectivo;
- billetera virtual;
- tarjeta de crédito;
- broker/inversiones;
- crypto exchange/wallet;
- activo patrimonial;
- otra.

Campos:
- nombre libre;
- institución opcional;
- país;
- moneda;
- saldo inicial;
- fecha del saldo inicial;
- icono/color;
- activo/inactivo;
- incluir/excluir del patrimonio;
- incluir/excluir de liquidez;
- notas.

Ejemplos:
- Galicia ARS
- Efectivo USD
- Mercado Pago
- Binance USDT
- Ledger BTC
- IOL

La desactivación no borra histórico.

## 7. Monedas y FX

Soportar ISO 4217 y activos crypto relevantes.

Cada transacción debe guardar:
- importe original;
- moneda original;
- tipo de cambio utilizado si hubo conversión;
- moneda de valuación opcional;
- timestamp de la tasa;
- proveedor/fuente.

Nunca reescribir el valor histórico de una transacción por un tipo de cambio posterior.

El workspace tiene:
- país principal;
- moneda base;
- método de valuación preferido.

Crear una capa de `FxProvider` desacoplada para poder cambiar de proveedor sin reescribir la aplicación.

### Argentina
Contemplar tipos de cambio diferenciados cuando exista fuente disponible:
- USD oficial;
- USD MEP;
- USD tarjeta;
- USD blue como referencia informativa, claramente etiquetada;
- tipo personalizado.

El usuario puede cambiar visualmente:

`Ver patrimonio en: ARS / USD MEP / USD oficial / USD tarjeta / EUR ...`

Esto revalúa la presentación actual sin modificar los movimientos originales.

### Crypto
Guardar cantidad real del activo: por ejemplo `0.025 BTC`, no solamente su equivalente en ARS.

Soportar precio actual e histórico mediante un `CryptoPriceProvider` desacoplado.

## 8. Movimientos

Tipos:
- ingreso;
- egreso;
- transferencia;
- ajuste.

Campos:
- cuenta;
- importe;
- moneda;
- fecha/hora;
- descripción;
- comercio;
- categoría;
- subcategoría;
- tags;
- nota;
- comprobante/imagen;
- recurrente sí/no;
- cuotas sí/no;
- estado: confirmado/pendiente;
- origen: manual/importado/regla/IA/integración.

Las transferencias entre cuentas propias no son ingreso ni gasto. Permitir comisión y conversión de moneda asociada.

## 9. Categorías

Incluir una biblioteca inicial de al menos 200 categorías/subcategorías útiles, pero no mostrar 200 opciones al mismo tiempo.

Grupos base:
- vivienda;
- alimentos;
- supermercado;
- panadería;
- carnicería;
- verdulería;
- restaurantes;
- delivery;
- café;
- transporte;
- combustible;
- estacionamiento;
- peajes;
- mantenimiento vehículo;
- salud;
- farmacia;
- educación;
- universidad;
- entretenimiento;
- streaming;
- software;
- tecnología;
- telefonía;
- internet;
- mascotas;
- hijos;
- viajes;
- alojamiento;
- vuelos;
- ropa;
- accesorios;
- belleza;
- peluquería;
- deportes;
- gimnasio;
- impuestos;
- seguros;
- bancos;
- intereses;
- comisiones;
- deudas;
- regalos;
- donaciones;
- inversiones;
- negocio;
- otros.

Permitir categoría y subcategoría personalizada con nombre, icono y color.

Búsqueda inteligente: escribir “pan” debe sugerir “Panadería”.

## 10. Ingresos y gastos recurrentes

Frecuencias:
- una vez;
- diario;
- cada X días;
- semanal;
- cada X semanas;
- quincenal;
- mensual;
- cada X meses;
- bimestral;
- trimestral;
- semestral;
- anual;
- cada X años;
- regla personalizada cuando sea razonable.

Campos:
- fecha de inicio;
- fecha de fin opcional;
- próxima ocurrencia;
- activo/inactivo;
- importe fijo o estimado;
- posibilidad de ajustar por porcentaje desde una fecha;
- cuenta de origen/destino;
- categoría.

La proyección debe usar estos compromisos futuros.

## 11. Tarjetas de crédito

Modelo de tarjeta separado de cuentas bancarias normales.

Campos:
- nombre;
- banco/emisor;
- moneda;
- límite total;
- cierre;
- vencimiento;
- saldo consumido;
- disponible;
- pagos pendientes;
- resumen actual;
- resúmenes proyectados;
- activa/inactiva.

Diferenciar:
- consumo total pendiente;
- importe que impacta en el próximo resumen;
- cuotas futuras posteriores.

Una compra en 12 cuotas se carga una vez y genera el cronograma correspondiente.

Vista:
- próximo resumen;
- siguientes 12 meses;
- calendario de cuotas;
- cuándo finaliza cada compra;
- total comprometido futuro.

## 12. Compras en cuotas

Campos:
- descripción;
- precio total;
- anticipo opcional;
- monto financiado;
- moneda;
- cantidad de cuotas;
- importe por cuota;
- primera fecha;
- tarjeta/cuenta;
- categoría;
- interés si aplica;
- cuotas pagadas;
- cuotas restantes.

Generar automáticamente obligaciones futuras.

Soportar:
- sin interés;
- interés fijo;
- importe de cuota manual;
- esquema personalizado.

## 13. Deudas y préstamos

Tipos:
- préstamo personal;
- prendario/auto;
- hipotecario;
- refinanciación de tarjeta;
- descubierto;
- deuda informal;
- otro.

Campos:
- nombre;
- entidad;
- moneda;
- monto solicitado;
- monto efectivamente recibido;
- saldo actual;
- fecha de desembolso;
- primera cuota;
- cantidad total de cuotas;
- cuotas pagadas;
- TNA;
- TEA;
- TEM cuando corresponda;
- CFT;
- CFT con impuestos;
- sistema de amortización: francés/alemán/americano/custom;
- valor de cuota;
- próxima cuota;
- vencimiento;
- cancelación anticipada disponible;
- gastos/seguros/comisiones;
- activo/inactivo.

Cuando existan datos suficientes, calcular automáticamente tasas derivables, pero siempre etiquetar qué dato fue ingresado y cuál fue calculado.

Generar cuadro de amortización:
- cuota N;
- fecha;
- total;
- capital;
- interés;
- cargos;
- saldo restante;
- pagada/no pagada.

Permitir pagos extraordinarios y simulación de cancelación anticipada.

Nunca asumir que una TNA por sí sola determina el CFT.

## 14. Calendario financiero

Vista día/semana/mes con:
- ingresos esperados;
- vencimientos;
- tarjetas;
- cuotas;
- préstamos;
- servicios;
- objetivos/aportes;
- recurrentes.

Cada mes debe mostrar:
- ingresos;
- egresos;
- pagos de deuda;
- ahorro/inversión;
- resultado proyectado.

Navegar meses futuros rápidamente.

## 15. Proyección financiera

Horizontes:
- fin de mes;
- 3 meses;
- 6 meses;
- 12 meses;
- 24 meses;
- 36 meses cuando haya datos.

Diferenciar:
- histórico real;
- futuro confirmado;
- futuro estimado;
- escenario hipotético.

Proyectar:
- saldo por cuenta;
- flujo;
- compromisos;
- deuda;
- disponible real;
- patrimonio.

Nunca inventar inflación o tasas futuras. Las hipótesis deben ser explícitas y editables.

## 16. Escenarios y simulaciones

Crear un motor de escenarios que no modifique los datos reales hasta que el usuario pulse “Aplicar”.

Ejemplos:
- comprar un celular;
- comprar un auto;
- tomar un préstamo;
- cancelar una deuda;
- aumentar alquiler;
- perder un ingreso;
- agregar un ingreso;
- viaje;
- inversión;
- pago extraordinario.

Comparar escenario actual vs A/B/C en:
- flujo mensual;
- disponible real;
- deuda;
- liquidez;
- patrimonio;
- fecha de objetivos.

## 17. Función estrella: “¿Puedo comprarlo?”

Formulario simple:
- precio;
- moneda;
- efectivo o cuotas;
- anticipo;
- cantidad de cuotas;
- cuenta/tarjeta;
- fecha.

El motor determinista calcula primero:
- disponibilidad actual;
- nueva cuota;
- compromisos ya existentes;
- saldo proyectado por mes;
- meses negativos;
- impacto sobre objetivos;
- relación de compromisos sobre ingresos;
- liquidez posterior.

Luego la IA explica el resultado en lenguaje natural.

No permitir que la IA invente números. Debe recibir un JSON estructurado calculado por backend.

## 18. IA financiera

La IA es una capa conversacional y de interpretación, no la fuente contable.

Casos de uso:
- “¿En qué gasté más?”
- “¿Por qué tengo menos plata?”
- “¿Cuánto voy a pagar de tarjetas en diciembre?”
- “¿Cuándo termino mis cuotas?”
- “¿Qué pasa si compro esto?”
- “¿Cuánto ahorro si cancelo estas suscripciones?”
- “Simulá un préstamo.”
- “Mostrame gastos anómalos.”
- “¿Cuánto puedo gastar por día hasta fin de mes?”
- “¿Qué compromisos tengo en USD?”

Arquitectura:
1. usuario pregunta;
2. clasificar intención;
3. ejecutar herramientas internas/autorizadas;
4. obtener datos estructurados;
5. ejecutar cálculos en `packages/core`;
6. entregar a la IA únicamente los datos necesarios;
7. generar explicación;
8. incluir enlaces profundos a los datos relevantes.

Privacidad:
- minimizar información enviada al proveedor de IA;
- no enviar secretos ni credenciales;
- configurable para desactivar IA;
- dejar preparado un sistema de redacción/anonimización.

## 19. Dashboard

Prioridad visual:

1. Disponible real.
2. Proyección de cierre del mes.
3. Próximos compromisos.
4. Ingresos vs egresos.
5. Patrimonio.
6. Atajo “¿Puedo comprarlo?”.

Ejemplo:

```text
Buenas tardes 👋

Disponible real
$1.482.300
Después de compromisos próximos

Octubre
Ingresos            $3.301.000
Gastos              $1.240.000
Cuotas/deudas         $577.700
Proyección          +$1.483.300

Próximamente
05 Oct  Visa          $480.000
10 Oct  Alquiler      $500.000
18 Oct  Seguro         $87.000

[ + Registrar ]
[ ✨ ¿Puedo comprarlo? ]
```

## 20. Patrimonio

Activos:
- bancos;
- efectivo;
- inversiones;
- crypto;
- bienes registrados manualmente.

Pasivos:
- tarjetas;
- préstamos;
- otras deudas.

Mostrar:
- patrimonio neto actual;
- evolución;
- composición;
- exposición por moneda.

No considerar transferencias como creación/destrucción de patrimonio.

## 21. Presupuestos

Permitir presupuesto por:
- categoría;
- grupo;
- mes;
- cuenta opcional.

Dos vistas:
- detallada con usado/restante;
- simple tipo semáforo.

Ejemplo:
“Si mantenés este ritmo, cerrarías el mes $120.000 por encima del presupuesto de restaurantes.”

## 22. Objetivos

Ejemplos:
- fondo de emergencia;
- viaje;
- auto;
- casa;
- cancelar deuda;
- inversión.

Campos:
- nombre;
- moneda;
- objetivo;
- acumulado;
- fecha objetivo;
- aporte recurrente.

Calcular aporte necesario para llegar a la fecha, sin asumir rendimientos no configurados.

## 23. Importación

### CSV/Excel
- import wizard;
- detectar columnas;
- vista previa;
- mapear fecha/descripción/débito/crédito/moneda;
- detectar duplicados;
- rollback de importación.

### Resúmenes PDF
Fase posterior:
- subir resumen de tarjeta/banco;
- extracción estructurada;
- detectar movimientos, total, vencimiento y cuotas;
- revisión manual antes de confirmar;
- nunca guardar automáticamente datos dudosos.

### Tickets
Foto/OCR o visión:
- comercio;
- fecha;
- total;
- moneda;
- sugerencia de categoría;
- confirmar antes de guardar.

## 24. Reglas automáticas

Motor de reglas:
- comercio contiene X -> categoría Y;
- cuenta X + concepto Y -> categoría Z;
- importe > X -> notificación;
- gasto de categoría supera presupuesto -> alerta;
- disponible real < X -> alerta.

Las reglas deben ser deterministas y editables.

## 25. Notificaciones

Preparar:
- push mobile;
- email opcional;
- in-app.

Casos:
- vencimiento próximo;
- tarjeta próxima a vencer;
- cuota;
- saldo proyectado negativo;
- presupuesto superado;
- objetivo atrasado;
- suscripción/recurrente detectado.

Permitir control granular y quiet hours.

## 26. Free + Pro barato

El producto gratuito debe servir de verdad.

### Free
- 1 workspace personal;
- cuentas manuales;
- ingresos/egresos;
- categorías;
- transferencias;
- recurrencias básicas;
- dashboard;
- presupuesto básico;
- exportación de datos;
- cantidad limitada razonable de consultas IA al mes o IA desactivada según costos.

### Pro
Precio objetivo inicial bajo: alrededor de USD 2.99–3.99/mes equivalente regional, con anual más económico. El precio final debe ser configurable por país y por plataforma.

Incluir:
- tarjetas y cuotas avanzadas;
- préstamos y amortización;
- proyección 12–36 meses;
- escenarios ilimitados;
- multimoneda avanzada;
- tipos de cambio personalizados;
- importaciones avanzadas;
- más IA;
- reglas automáticas;
- reportes avanzados;
- espacios compartidos/familia como evolución.

No bloquear exportación de datos detrás del plan pago.

Preparar billing desacoplado para:
- web;
- iOS;
- Android;
con sincronización de entitlement en backend.

## 27. Landing pública

Objetivo: conversión a registro gratuito.

Hero:
**“Sabé cuánto podés gastar antes de gastar.”**

Subtítulo:
“Controlá ingresos, gastos, bancos, efectivo, crypto, tarjetas, cuotas, deudas y monedas. Mirá hoy y proyectá lo que viene.”

CTA:
- Empezar gratis
- Ver cómo funciona

Secciones:
1. hero;
2. captura/dashboard;
3. problema;
4. cuentas y monedas;
5. cuotas y tarjetas;
6. deudas;
7. proyección;
8. “¿Puedo comprarlo?”;
9. IA;
10. seguridad/privacidad;
11. Free vs Pro;
12. FAQ;
13. CTA final.

No usar claims engañosos como “te hacemos rico” o “garantizamos ahorro”.

## 28. SEO

La web pública debe ser SEO-first.

Implementar:
- metadata dinámica;
- canonical;
- sitemap.xml;
- robots.txt;
- Open Graph;
- Twitter cards;
- JSON-LD Organization/SoftwareApplication/FAQ cuando corresponda;
- páginas rápidas;
- Core Web Vitals;
- HTML semántico;
- headings correctos;
- contenido indexable server-side;
- imágenes optimizadas;
- alt text;
- URLs limpias.

Crear arquitectura de contenido futura:
- `/finanzas-personales`
- `/control-de-gastos`
- `/calculadora-cuotas`
- `/calculadora-prestamos`
- `/tna-tea-cft`
- `/dolar-mep`
- `/presupuesto-personal`
- `/blog/...`

Las calculadoras públicas pueden captar tráfico y llevar al registro.

Preparar i18n para español primero y luego inglés/portugués.

## 29. Performance

Objetivos:
- landing con excelente Lighthouse;
- lazy load de gráficas pesadas;
- evitar JS innecesario en marketing;
- cache correcto;
- paginación/cursor para movimientos;
- índices DB;
- agregados precalculados cuando el volumen lo requiera;
- optimistic UI en acciones simples;
- skeletons discretos;
- mobile funcional con mala red.

Fase posterior: offline-first parcial para carga rápida y cola de movimientos, con sincronización segura e idempotente.

## 30. Seguridad

Implementar desde el inicio:
- TLS;
- hashing seguro de contraseñas gestionado por auth provider;
- SecureStore mobile;
- cookies HttpOnly/Secure/SameSite apropiadas web;
- CSRF donde corresponda;
- rate limiting;
- validación server-side;
- autorización por workspace en cada consulta;
- evitar IDOR;
- logs sin datos financieros sensibles innecesarios;
- backups;
- auditoría de cambios sensibles;
- borrado de cuenta;
- exportación de datos;
- secretos solo por variables de entorno;
- no almacenar credenciales bancarias.

Separar PII de telemetría siempre que sea razonable.

## 31. Observabilidad

Preparar:
- Sentry o equivalente para errores;
- métricas técnicas;
- auditoría de jobs;
- correlation/request IDs;
- logging estructurado;
- feature flags simples.

Nunca registrar contraseñas, tokens, números completos de tarjetas ni contenido financiero sensible sin necesidad.

## 32. Analytics de producto

Eventos respetuosos de privacidad:
- signup_completed;
- account_created;
- transaction_created;
- installment_created;
- debt_created;
- scenario_simulated;
- can_i_buy_used;
- ai_question_asked;
- upgrade_started;
- subscription_started.

No incluir importe exacto o descripción financiera en herramientas de analytics de terceros por defecto.

## 33. Modelo de datos mínimo

Incluir y relacionar adecuadamente:
- User
- Workspace
- WorkspaceMember
- Account
- CreditCard metadata
- Category
- Transaction
- Recurrence
- InstallmentPlan
- Debt
- DebtPayment
- FxRate
- CryptoPrice
- Budget
- Goal
- Scenario
- ScenarioEvent
- ImportBatch
- Rule
- NotificationPreference
- Subscription/Entitlement
- AIConversation
- AIMessage/Insight con política de retención configurable

Usar DECIMAL o unidades menores según el dominio. No usar floats JS para persistir dinero.

## 34. Motor financiero

Crear funciones puras y testeables para:
- saldo por cuenta;
- cash flow;
- disponible real;
- generación de recurrencias;
- cronograma de cuotas;
- cronograma de préstamo;
- conversión por FX;
- patrimonio;
- proyección;
- escenario;
- ratios descriptivos;
- TNA/TEA/TEM cuando la conversión sea matemáticamente válida;
- sistema francés/alemán/americano.

Evitar `number` para cálculos monetarios críticos si produce errores de precisión. Usar bigint/decimal apropiadamente.

Los cálculos deben incluir tests de borde.

## 35. API

Diseñar endpoints o procedimientos coherentes para:
- auth/session;
- workspaces;
- accounts;
- transactions;
- categories;
- recurrences;
- cards/installments;
- debts/payments;
- fx/current;
- fx/history;
- projection;
- scenarios;
- budgets;
- goals;
- imports;
- AI query.

Toda mutación debe validar `workspaceId` contra la sesión.

Usar idempotency keys en importaciones y operaciones móviles susceptibles de reintento.

## 36. Integraciones de mercado/FX

No acoplarse a un solo proveedor.

Interfaces:

```ts
interface FxProvider {
  getLatest(base: string, quote: string, type?: string): Promise<FxQuote>;
  getHistorical(base: string, quote: string, at: Date, type?: string): Promise<FxQuote>;
}

interface CryptoPriceProvider {
  getLatest(asset: string, quote: string): Promise<PriceQuote>;
  getHistorical(asset: string, quote: string, at: Date): Promise<PriceQuote>;
}
```

Agregar cache, TTL y fallback. Mostrar timestamp/fuente de la cotización al usuario.

## 37. Estados vacíos y onboarding

Onboarding corto:
1. país;
2. moneda base;
3. crear primera cuenta;
4. saldo inicial opcional;
5. ingreso principal opcional;
6. listo.

No pedir 20 datos antes de mostrar valor.

Estado vacío de inicio:
“Agregá tu primera cuenta para ver tu dinero en un solo lugar.”

## 38. Primera experiencia

Tras crear cuenta, mostrar checklist discreto:
- crear una cuenta;
- registrar un ingreso;
- registrar un gasto;
- agregar un compromiso futuro;
- probar “¿Puedo comprarlo?”.

## 39. Accesibilidad y localización

- formatos numéricos por locale;
- monedas correctas;
- fechas locales;
- timezone por usuario/workspace;
- VoiceOver/TalkBack;
- labels de inputs;
- targets táctiles adecuados;
- contraste;
- soporte dinámico de tamaño de texto razonable.

## 40. Testing

Agregar:
- unit tests para core financiero;
- integration tests API;
- tests de autorización multi-tenant;
- e2e web para flujos críticos;
- smoke tests mobile;
- fixtures deterministas.

Casos obligatorios:
- compra en cuotas cruza año;
- préstamo con pagos extraordinarios;
- ingreso recurrente desactivado;
- transferencia ARS -> USD con comisión;
- cambio de moneda de visualización sin mutar histórico;
- duplicado de importación;
- usuario intentando acceder a workspace ajeno.

## 41. Roadmap de implementación

### Fase 1 — MVP usable
- auth;
- onboarding;
- cuentas;
- categorías;
- movimientos;
- recurrentes;
- tarjetas básicas;
- cuotas;
- dashboard;
- proyección 12 meses;
- multimoneda manual;
- landing/SEO;
- Free/Pro feature flags.

### Fase 2
- deudas completas;
- TNA/TEA/CFT;
- amortizaciones;
- escenarios;
- “¿Puedo comprarlo?”;
- FX online;
- crypto prices;
- IA;
- CSV.

### Fase 3
- PDF/tickets;
- reglas automáticas;
- notificaciones;
- familia/compartido;
- integraciones financieras donde sean viables;
- offline parcial.

No intentes construir toda Fase 3 antes de tener un MVP coherente.

## 42. Entregables que tenés que producir como coding agent

1. árbol completo del monorepo;
2. configuración raíz;
3. esquema de DB;
4. migraciones iniciales;
5. seed de categorías;
6. auth web/mobile;
7. landing responsive;
8. onboarding;
9. dashboard inicial;
10. CRUD de cuentas;
11. CRUD de movimientos;
12. recurrencias;
13. tarjetas/cuotas;
14. deudas;
15. motor de proyección;
16. tests;
17. README de instalación;
18. `.env.example`;
19. arquitectura documentada;
20. checklist para deploy web, Android e iOS.

## 43. Reglas de implementación

- No dejar componentes gigantes.
- No duplicar lógica entre web/mobile.
- No hacer cálculos financieros dentro de componentes UI.
- No usar mocks permanentes en producción.
- No guardar dinero en floating point en DB.
- No hacer una UI de administración genérica: diseñar producto.
- No crear abstracciones innecesarias antes de necesitarlas.
- Preferir código claro a “ingeniería elegante” difícil de mantener.
- Todo estado de loading/error/empty debe estar diseñado.
- Toda acción destructiva debe confirmar.
- La app debe sentirse rápida.
- Cada feature debe funcionar bien en 360px de ancho.
- Desktop debe aprovechar espacio sin parecer una tabla ERP.

## 44. Criterio de éxito

Una persona sin conocimientos financieros debe poder:
- crear una cuenta;
- cargar dónde tiene dinero;
- registrar gastos e ingresos;
- agregar una compra en cuotas;
- agregar un préstamo;
- entender cuánto tiene;
- ver cuánto ya está comprometido;
- saber cómo puede cerrar el próximo mes;
- simular una compra;
- hacer una pregunta en lenguaje natural;

en menos de 10 minutos sin necesitar tutorial externo.

La sensación final debe ser:
**simple por fuera, extremadamente potente por dentro.**

## 45. Primer paso de ejecución

Antes de implementar features avanzadas:
1. generar árbol del repo;
2. instalar dependencias estables compatibles;
3. crear design tokens;
4. crear DB inicial;
5. implementar auth;
6. implementar onboarding;
7. implementar una vertical completa de punta a punta: crear cuenta -> registrar ingreso/gasto -> dashboard actualizado;
8. recién después sumar cuotas/deudas/proyección.

En cada etapa, mantener el proyecto compilando y con tests verdes.
