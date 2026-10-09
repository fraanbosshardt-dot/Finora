# Validación de la web

Validado el 9 de octubre de 2026 en Windows con Node 24.19.0, pnpm 11.25.0, Chrome y PostgreSQL 17.10 local.

- `pnpm test`: 50 tests del motor. Centavos exactos, importes grandes, validación, fechas imposibles, separación de monedas, recurrencias, cuotas, préstamos, informes, CSV, reglas, alertas, tasas, simulaciones, cotizaciones, referencias de respaldos, consultas locales, clasificación de preguntas y resúmenes de planificación.
- `pnpm typecheck`: core, db y web sin errores.
- `pnpm build`: build de producción Next.js generado correctamente, con páginas públicas estáticas y API/app dinámicas.
- Esquema Prisma generado y validado por typecheck/build. Siete migraciones aplicadas a la instancia PostgreSQL local.
- `pnpm test:e2e`: batería completa de 21 pruebas aprobadas. Registro, onboarding, informes y CSV, ingresos/gastos, recurrencias, disponible, simulación, escenarios, respaldo, reglas, alertas, cotizaciones, diseño, registro rápido, edición de presupuestos/recurrentes, gasto futuro único, ICS, perfil/contraseña, todas las áreas a 360 px y separación Free/Pro en UI y servidor.
- API: aislamiento entre usuarios/workspaces, rechazo de origen ajeno, reintentos sin duplicar, transferencias con comisión, importes inválidos y confirmación repetida de compromisos.
- Tarjetas y préstamos: patrimonio conservado al desembolsar y devolver capital, pagos de tarjeta sin segundo gasto, consumos y pagos extraordinarios.
- Importaciones: vista previa CSV en navegador, importación atómica, deduplicación y reversión por lote sin borrar cuentas.
- Presupuestos: creación, edición sin duplicados y eliminación. Objetivos: creación, actualización y eliminación. Simulación aplicada mediante confirmación crea un plan real.
- Informes: fechas inclusivas, separación de monedas, cuenta/categoría, cuentas inactivas, exclusión de ajustes y transferencias, meses vacíos, importes grandes y neutralización de fórmulas en CSV. Navegador: totales, descarga exacta, cambio de moneda, filtro de cuenta y ausencia de desbordamiento a 360 px.
- Auth: revocación de otra sesión, recuperación con correo local de desarrollo, cambio de contraseña y revocación de sesiones anteriores.
- Landing, dashboard, tarjeta y formulario de préstamo inspeccionados a 360 px, sin desbordamiento horizontal; landing/dashboard también en desktop.

- Respaldo v3: restauración en otro usuario con IDs nuevos, cronogramas y pagos conservados, patrimonio y resumen equivalentes, reintento sin duplicación, rechazo de destino ocupado y acceso ajeno, reversión de lote restaurado.
- `pnpm db:verify-backup`: dump consistente restaurado en base temporal; checksum y conteos de 26 tablas correctos. La base temporal fue eliminada tras verificarla.
- Calculadora pública de préstamos, alertas y cotizaciones inspeccionadas a 360 px. Corregido contraste del enlace de registro de la calculadora.
- Diseños recibidos: landing en 1280/390/360 px y modo oscuro; dashboard, menú, teclado numérico y onboarding a 390 px. Verificados retorno del foco con Escape, creación real de ingreso desde el teclado y persistencia del switch de alertas tras recarga. Referencias y decisiones en [integración](design-integration.md).
- Regresión de origen local: registro, sesión, onboarding y escritura desde `localhost`, flujo completo desde `127.0.0.1` y rechazo de origen ajeno verificados. Ambos alias se permiten solo en desarrollo y en el puerto configurado.
- Regresión adicional de planes aprobada: enlaces de landing, registro Pro, conservación de mensual/anual al iniciar sesión, pantalla de suscripción tras registro y alternativa Free. El primer intento excedió los 5 segundos por compilación inicial de `/suscribirse` en desarrollo; se amplió el timeout de navegación de esa prueba a 20 segundos, y pasó. La batería de 21 pruebas y esta regresión adicional cubren 22 flujos.
- Responsive: todas las secciones a 360 px y landing en 1920/1280/1024/768/390/360 px sin desbordamiento horizontal. Las tarjetas de precios no se superponen y la vista previa no tiene animación. Pantallas Free/Pro inspeccionadas a 360 px.
- Rendimiento: secciones avanzadas y diálogo cargados bajo demanda, cálculo de consultas/proyección reutilizado y búsqueda de movimientos diferida. No se realizó todavía una auditoría Lighthouse ni pruebas de carga masiva; estos cambios no son una garantía de latencia para cualquier volumen.

Las pruebas usan cuentas temporales y tasas explícitas. No se verificaron entrega SMTP real, OAuth Google con proveedor, recuperación de producción, carga de grandes volúmenes ni un despliegue remoto. El importador JSON legado restaura cuentas y movimientos manuales; el respaldo v3 es el mecanismo de restauración financiera completa. CI preparado en GitHub Actions, pendiente de ejecución remota.
