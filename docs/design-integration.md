# Integración de los diseños recibidos

Se incorporaron las dos versiones de `Main.dc.html` y `App.dc.html`, junto con sus cuatro archivos de canvas. Los originales están conservados en `docs/design-reference`; la segunda revisión está en `revision-2`. Los canvas describen los tamaños de referencia: landing de 1280 px y aplicación de 390 × 844 px.

El runtime `DCLogic`, las etiquetas `sc-if`/`sc-for` y los valores ilustrativos se reemplazaron por componentes React y por el motor financiero compartido. Los HTML se conservan como referencia; no ejecutamos su `support.js` dentro de la aplicación.

| Diseño | Integración |
| --- | --- |
| Landing | Hero, seis tarjetas de funciones, monedas, proyección, calculadora, consultas, seguridad, simulación, planes, preguntas y CTA. |
| Ejemplos interactivos | Monedas, TNA/plazos y compras usan el motor exacto; los datos ilustrativos están identificados. Los botones de registro abren la autenticación real. |
| Inicio móvil | Disponible, acciones, resumen mensual, próximos compromisos, patrimonio y primeros pasos derivados de los registros. |
| Navegación | Cinco accesos inferiores y botón flotante; las otras funciones siguen accesibles en la barra superior. Escritorio conserva todas las secciones. |
| Registro rápido | Gasto/ingreso, teclado con centavos y borrado, categorías, cuentas, fecha y descripción; guardado real, validación y reintentos. Transferencias, cuotas y préstamos abren sus flujos completos. |
| Registro e ingreso | Autenticación existente con el estilo nuevo, recuperación real y Google solo cuando está configurado. |
| Onboarding | País, moneda y zona horaria; cuenta y saldo; vista previa y confirmación. No persiste hasta el último paso. |
| Planificación | Calendario y proyección existentes más avances de objetivos, pagos confirmados de préstamos y presupuestos del mes. |
| Consultas | Respuestas locales a las tres preguntas del prototipo, calculadas con datos reales y filtradas por moneda. |
| Ajustes | Perfil real, sesiones, exportación, restauración, categorías, eliminación y preferencias de alertas persistentes. |
| Movimiento y accesibilidad | Animaciones de entrada, FAQ, barras, íconos y registro reciente; reducción de movimiento, foco de diálogo, navegación de teclado y contraste en modo oscuro. |

Manrope está alojada localmente en `apps/web/public/fonts`, con su licencia OFL. No hace falta consultar Google Fonts al abrir la página.

Se mantienen los importes reales completos durante las transiciones; no se anima el saldo desde cero. Las proyecciones siguen usando únicamente compromisos registrados. Las tasas de los ejemplos no se presentan como cotizaciones vigentes.

El prototipo incluye acceso Apple, biometría, IA externa, cripto, cotizaciones online y contratación Pro que todavía no existen en el producto. Se mantienen identificados como futuros cuando corresponde; no se agregaron botones que simulen iniciar sesión, cobrar o activar esas integraciones. Esta implementación adapta la interfaz móvil a la web; no crea una aplicación nativa iOS/Android.
