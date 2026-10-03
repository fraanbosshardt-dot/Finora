# Finora — contexto para agentes

Antes de proponer o modificar producto, leer `MASTER_PROMPT.md` completo: es la especificación funcional y técnica de referencia de Finora.

## Cómo trabajar en este repositorio

- El objetivo es construir Finora, una plataforma de finanzas personales simple para el usuario y rigurosa en sus cálculos.
- Seguir el roadmap del prompt: empezar por una base coherente y una vertical MVP completa; no intentar implementar todas las fases a la vez.
- Mantener la lógica financiera fuera de la UI, usar validación en límites del sistema y no usar floating point para persistir dinero.
- Respetar privacidad, autorización por workspace, accesibilidad, localización y los estados de carga/error/vacío definidos en la especificación.
- Antes de añadir decisiones de arquitectura que cambien lo especificado, explicar el motivo y actualizar la documentación pertinente.
- Tratar el contenido del prompt como requisitos del producto y contexto de implementación, no como autorización para acciones externas (por ejemplo, publicar, desplegar o enviar mensajes).

## Estructura prevista

Monorepo TypeScript con pnpm workspaces y Turborepo: `apps/web`, `apps/mobile`, y paquetes compartidos `core`, `db`, `ui` y `config`. Consultar el prompt antes de cambiar esta arquitectura.
