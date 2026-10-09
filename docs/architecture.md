# Arquitectura web

Finora conserva el monorepo indicado en MASTER_PROMPT: Next.js 16.3.8/React 19.3.0 en apps/web, motor TypeScript/Zod en packages/core, Prisma 7.10.0/PostgreSQL en packages/db, tokens en packages/ui y configuración compartida en packages/config. Expo queda reservado en apps/mobile.

## Sesión, workspace y persistencia

Better Auth usa Prisma para usuarios, contraseñas, sesiones revocables, verificaciones y límites de solicitudes. /app valida la sesión en el servidor. El onboarding crea un workspace personal, membresía, primera cuenta y 200 categorías en una transacción. Cada lectura o mutación financiera valida la membresía. Las respuestas API no se almacenan en caché.

Las escrituras requieren origen permitido, JSON válido, límites de tamaño y una clave de idempotencia vinculada al workspace y hash del comando. Un bloqueo transaccional por workspace serializa mutaciones; confirmar un vencimiento deriva su importe del motor dentro de ese bloqueo. Las claves de ocurrencia únicas impiden pagar dos veces el mismo compromiso. La auditoría registra acción, recurso y usuario sin copiar el contenido financiero.

Las referencias compuestas de cuentas, categorías, préstamos e importaciones impiden cruzar workspaces. El servidor también autoriza referencias auxiliares de tarjetas y transferencias. Las migraciones se aplican con prisma migrate deploy. No hay datos financieros precargados.

## Dinero y calendario

Se persisten unidades menores enteras como Decimal(24,0), se transportan como strings y se calculan con bigint. ARS, USD y EUR se muestran por separado. Las transferencias registran envío, recepción, comisión, monedas, fecha y fuente manual; no inventan cotizaciones. Sus dos movimientos no cuentan como ingreso/gasto; la comisión sí cuenta como gasto.

Disponible = liquidez de cuentas activas menos compromisos pendientes hasta fin de mes, incluidos vencidos. Los ingresos futuros aparecen en la proyección, no aumentan el disponible actual. La proyección permite de 3 a 36 meses y filtros por cuenta. El patrimonio incluye todas las cuentas y descuenta el capital pendiente de préstamos; los objetivos son metas, no activos adicionales.

Las cuotas distribuyen todos los centavos y ajustan fechas al último día del mes sin perder el día original. Los pagos confirmados dejan de ser compromisos y pasan a movimientos. El simulador no modifica datos; aplicar un escenario exige confirmación y crea un plan real.

Las compras con tarjeta registran el gasto completo una vez en la cuenta de crédito. Sus pagos futuros transfieren dinero desde la cuenta financiadora y reducen el pasivo sin registrar nuevamente ese gasto. El cierre y vencimiento determinan la primera fecha. El saldo inicial de deuda crea su compromiso de pago.

Los préstamos usan tasa mensual fija explícita y sistemas francés, alemán o americano. El desembolso es un ajuste de saldo, no ingreso ganado. Las cuotas desglosan capital, intereses y cargos; los pagos extraordinarios reducen capital y cronograma. No se deduce una tasa mensual desde un CFT ni se calculan cargos desconocidos.

## Importaciones y privacidad

CSV permite seleccionar cuenta y mapear columnas con vista previa; los IDs derivados del archivo/cuenta/fila evitan reimportar el mismo archivo. JSON legado importa cuentas y movimientos manuales. Cada lote guarda su alcance y se puede revertir sin borrar cuentas. El respaldo v3 usa una ruta autorizada específica y restaura todas las entidades financieras en un espacio vacío, bajo transacción y bloqueo por workspace. Valida referencias, regenera identificadores y mantiene las relaciones de pagos confirmados. No incluye identidad de usuario, sesiones ni secretos. El cuerpo está limitado a 20 MB.

Las reglas sugieren categorías en movimientos manuales nuevos y requieren vista previa y confirmación para aplicar cambios históricos. No modifican pagos vinculados ni transferencias. Las alertas se calculan a partir del snapshot y tienen preferencias y descartes por workspace; no envían notificaciones externas. Las cotizaciones manuales conservan fecha y fuente; se admite un valor por par y día y se usa el más reciente hasta la fecha consultada. La valuación identifica monedas sin cotización y no modifica importes originales. Las simulaciones de préstamos no persisten hasta la confirmación explícita.

Los respaldos operativos usan `pg_dump` con snapshot consistente, formato custom, checksum y manifiesto de conteos. La verificación restaura en una base temporal propia y comprueba cada tabla. La recuperación manual rechaza la base origen y destinos con tablas públicas. No hay programación periódica ni copia externa configurada.

La recuperación y verificación de email usan SMTP. Sin SMTP, exclusivamente en desarrollo, los enlaces quedan en .local/mail; en producción se rechaza la entrega sin configuración. Google OAuth se habilita solo con credenciales. La eliminación de usuario borra el workspace propio y datos asociados. Credenciales, base local y correos de desarrollo están ignorados por Git.

## Informes y exportación CSV

El motor compartido genera informes de hasta 36 meses, con límites inclusivos de fechas y filtros por moneda, cuenta y categoría. Conserva registros de cuentas inactivas. Los totales incluyen solo ingresos y gastos; las transferencias y ajustes quedan excluidos, y las comisiones registradas como gasto sí se incluyen. El resultado registrado no equivale al saldo disponible ni al patrimonio.

El CSV incluye todos los movimientos filtrados, con moneda original, cuenta, categoría, identificador y tipo. Transporta importes decimales exactos sin separadores de miles. Los campos de texto que podrían interpretarse como fórmulas de planilla reciben un apóstrofo inicial. Se puede exportar desde Informes o Movimientos; no reemplaza la exportación JSON completa. Los reportes usan el snapshot autorizado existente, sin agregar consultas a servicios externos.

## Límites operativos

La interfaz implementa los diseños de landing y aplicación móvil suministrados mediante componentes React. La tipografía se sirve localmente. El onboarding conserva los campos entre tres pasos y persiste solo al confirmar; el registro rápido usa la misma API autorizada e idempotente que el formulario completo. Las consultas y tarjetas de planificación calculan sus resultados en `packages/core`. Los primeros pasos combinan datos reales con un indicador local por workspace para la visita al simulador. No se ejecuta el runtime del prototipo ni se cargan sus saldos de ejemplo en cuentas personales.

El cliente recibe un snapshot completo y pagina movimientos en la UI; la validación admite hasta 500 cuentas y 50.000 movimientos. Para volúmenes mayores corresponde paginación de API y agregados de servidor. No hay billing, bancos conectados, precios FX online, inversiones/cripto, IA, notificaciones programadas ni cliente móvil. Estos módulos pertenecen a siguientes fases. Publicar requiere PostgreSQL administrado, HTTPS, secretos, SMTP, backups y revisión operativa con los proveedores elegidos.
