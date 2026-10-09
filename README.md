# Finora

Web de finanzas personales para registrar movimientos, conocer el disponible y proyectar decisiones. La especificación está en [MASTER_PROMPT.md](./MASTER_PROMPT.md); las instrucciones de trabajo en [AGENTS.md](./AGENTS.md).

## Desarrollo local

Requisitos: Node.js 24, pnpm 11.25.0 y Chrome para las pruebas de navegador.

```sh
pnpm install
pnpm db:local
```

Dejar esa terminal abierta. El helper levanta PostgreSQL en `127.0.0.1:55432`, conserva la base en `.local/postgres` y genera credenciales aleatorias en archivos ignorados por Git. Usa embedded-postgres beta únicamente como herramienta de desarrollo, con binario PostgreSQL 17.10.

En otra terminal:

```sh
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Abrir [Finora local](http://127.0.0.1:3000), registrarse y completar el onboarding. El dashboard está en `/app`. Los datos se guardan en PostgreSQL y se conservan al recargar o cambiar de navegador después de iniciar sesión. No hay registros financieros de demostración en cuentas personales.

En desarrollo se aceptan `localhost` y `127.0.0.1` en el mismo puerto configurado. En producción se acepta únicamente el origen de `BETTER_AUTH_URL`. Las cookies de sesión pertenecen a la dirección usada para ingresar.

Sin SMTP, los enlaces de recuperación quedan en `.local/mail` exclusivamente en desarrollo. Para entregar correos reales, configurar SMTP. Para usar una base externa, configurar `DATABASE_URL` en `apps/web/.env.local` y `packages/db/.env`; las demás variables están en [.env.example](./.env.example). `BETTER_AUTH_URL` debe coincidir con el origen del navegador.

## Funciones implementadas

- Landing, calculadora pública, SEO y diseño adaptable a 360 px, con modo oscuro según el sistema.
- Diseño integrado de las dos exportaciones recibidas: Manrope local, navegación inferior móvil, registro rápido con teclado, onboarding de tres pasos y ajustes. Ver [integración de diseño](docs/design-integration.md).
- Consultas locales sobre categoría de mayor gasto, disponible por día y último pago pendiente de cuotas, calculadas con registros reales.
- Registro, login, recuperación, onboarding, sesiones revocables y eliminación de cuenta. Google y verificación de email disponibles mediante configuración.
- Cuentas ARS/USD/EUR, ingresos/gastos, edición, transferencias con comisión y comprobante de cambio manual.
- 200 categorías iniciales, presupuestos mensuales y objetivos de ahorro.
- Informes por fechas, cuenta y categoría, distribución de gastos, resultado mensual y exportación CSV. Incluyen el historial de cuentas inactivas y separan cada moneda.
- Recurrentes, cuotas exactas, calendario, confirmación de pagos y proyección de 3 a 36 meses, con filtro por cuenta.
- Tarjetas con límite, cierre, vencimiento y consumos; préstamos con amortización francesa, alemana y americana y pagos extraordinarios.
- Simulador de compras, escenarios guardados y aplicación confirmada a planificación.
- Calculadora pública de préstamos, TEM/TNA/TEA y simulación de cancelaciones anticipadas con comparación de liquidez e intereses.
- Reglas de categorización con vista previa y alertas configurables de vencimientos, presupuestos, saldo y objetivos.
- Cotizaciones manuales históricas, conversor y valuación de patrimonio con indicación de cobertura parcial.
- Exportación JSON, importación CSV/JSON con vista previa, deduplicación y reversión por lote. La importación JSON restaura cuentas y movimientos manuales, no todas las entidades de la exportación.
- Respaldo financiero completo v3 desde Ajustes, con vista previa y restauración atómica en un espacio vacío. Conserva cronogramas y pagos; regenera identificadores y no incluye contraseñas ni sesiones.

El motor calcula en unidades menores enteras. Las monedas permanecen separadas y los importes/tasas se cargan explícitamente.

## Verificación

Con la base y `pnpm dev` activos:

```sh
pnpm test
pnpm typecheck
pnpm test:e2e
pnpm build
pnpm --filter @finora/db validate
```

La suite E2E crea y elimina sus propios usuarios y respeta los límites de registro. Ejecutarla en una base de desarrollo. Ver [validación](docs/validation.md) y [arquitectura](docs/architecture.md).

## Publicación y alcance

Todavía no se desplegó. Configurar PostgreSQL, HTTPS, secretos aleatorios y SMTP antes de alojarlo. Aplicar las migraciones y definir la frecuencia y retención de respaldos. Free/Pro y el recorrido de suscripción están preparados; todavía no hay cobros reales. Conexión bancaria, FX online, IA, inversiones/cripto y app nativa siguen en el roadmap. La configuración de CI está preparada en `.github/workflows/verify.yml`; todavía no se ejecutó en GitHub. Ver [pendientes](docs/checklist.md) y [planes](docs/plans.md).

## Respaldos de PostgreSQL

`pnpm db:backup` crea un dump y un manifiesto con checksum en `.local/backups`. `pnpm db:verify-backup` crea un respaldo, lo restaura en una base temporal y comprueba los conteos de las tablas antes de eliminar esa base temporal. Necesita permiso para crear bases y los clientes PostgreSQL (`pg_dump` y `pg_restore`) en PATH o en `PG_BIN_DIR`. En esta instalación están disponibles en `.local/pgtools/bin`.

`pnpm db:restore -- --file=RUTA_ABSOLUTA` restaura únicamente en una base vacía indicada por `RESTORE_DATABASE_URL`; rechaza la base origen. Los respaldos contienen datos personales y deben conservarse con acceso restringido. Estos comandos son manuales: no hay una tarea periódica de respaldo activada.

```text
apps/web        Next.js App Router y API
apps/mobile     ubicación reservada para Expo
packages/core   motor y validación financiera
packages/db     Prisma/PostgreSQL y migraciones
packages/ui     tokens de diseño
packages/config TypeScript compartido
tests/e2e       Playwright contra la web local
```
