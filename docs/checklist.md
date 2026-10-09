# Avance de la web

Actualizado: 9 de octubre de 2026. El alcance actual es la web pública y el dashboard responsive. La app nativa se empezará cuando el usuario lo indique.

## Funciones locales completadas

- [x] Registro e inicio de sesión por email, onboarding y alias localhost/127.0.0.1.
- [x] Inicio con saldo, disponible, compromisos, flujo, patrimonio y primeros pasos.
- [x] Cuentas: crear, editar, desactivar y conservar histórico.
- [x] Movimientos: ingresos, gastos, edición, eliminación, filtros, paginación y exportación.
- [x] Transferencias con comisión y conversión manual, sin contabilizarlas como ingreso.
- [x] Planificación: gasto futuro único, recurrentes, calendario día/semana/mes, confirmación de pagos y descarga ICS.
- [x] Edición de recurrentes con conservación de pagos y protección del calendario confirmado.
- [x] Presupuestos: crear, editar y eliminar, usado y restante por moneda y mes.
- [x] Objetivos: monto, avance, fecha y aporte necesario.
- [x] Consultas escritas locales sobre gastos, disponible diario, cuotas, compromisos y cierre mensual.
- [x] Alertas configurables, ocultación y recuperación.
- [x] Tarjetas y compras en cuotas: límite, consumo y calendario, sin duplicar gastos al pagar.
- [x] Préstamos: amortización, cuotas y pagos extraordinarios.
- [x] Simulaciones: compras y préstamos, comparación y aplicación confirmada.
- [x] Informes con filtros y descarga CSV.
- [x] Reglas editables, vista previa y aplicación.
- [x] Cotizaciones propias con fecha/fuente y valuación sin alterar importes originales.
- [x] Importación CSV/JSON con revisión, duplicados y reversión.
- [x] Respaldos completos, exportación gratuita y restauración autorizada.
- [x] Ajustes: nombre, contraseña, sesiones, categorías, privacidad y borrado de cuenta.
- [x] Free/Pro: clasificación, precios, pantallas de acceso y validación de operaciones Pro en servidor.
- [x] Recorrido de planes: registro Free al dashboard; registro Pro a suscripción mensual/anual, con inicio de sesión conservando la elección.
- [x] Sidebar agrupado; barras de scroll ocultas manteniendo el desplazamiento.
- [x] Animaciones separadas entre marketing y producto web; preview estática en la landing.
- [x] Carga por sección y reutilización de cálculos al buscar o escribir consultas.

## Conexiones pendientes

- [ ] Pasarela de pago y checkout real, webhooks firmados y activación/renovación/cancelación de Pro.
- [ ] SMTP real y verificación de email en producción.
- [ ] OAuth Google y futuro Apple para iOS.
- [ ] Proveedores de cotizaciones y precios de activos.
- [ ] Proveedor de IA conversacional, cuotas de uso y anonimización.
- [ ] Integraciones bancarias, notificaciones externas y observabilidad remota.
- [ ] Hosting, dominio, TLS y validación del despliegue.

## Ampliaciones del roadmap

No forman parte de los flujos actuales: activos crypto con cantidades, lectura de tickets/PDF, espacios familiares, más tipos de escenarios, sincronización offline, traducciones y app nativa. Necesitan desarrollo y validación propios; no se consideran terminadas por conectar un proveedor.

Las comprobaciones ejecutadas y sus límites están en [validation.md](validation.md). Los planes están definidos en [plans.md](plans.md).
