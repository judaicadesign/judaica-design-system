# Judaica Design® — Sistema interno

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal autorizado de Judaica Design® que administra trabajos de diseño e impresión, clientes, presupuestos, proveedores y entregas. La interfaz de clientes es una superficie distinta.

## Product Purpose

Permitir el seguimiento operativo de cada trabajo de Judaica Design® desde su preparación y presupuesto hasta la aprobación, la producción, la entrega y el registro administrativo correspondiente. El objetivo es reducir la carga manual, evitar registros duplicados y mostrar claramente el estado y el siguiente paso de cada trabajo.

## Positioning

Sistema interno orientado al flujo real de trabajos editoriales y gráficos personalizados de Judaica Design®, en lugar de una herramienta genérica de tareas.

## Operating Context

- Un trabajo puede incluir cotización, archivos de diseño, revisiones, aprobación del cliente, control interno, imprenta, pagos, gastos, logística y entrega.
- Las etapas y los hitos deben representar hechos efectivamente concretados y mantenerse sincronizados en todas las vistas donde se muestran.
- Se utilizan herramientas de preimpresión, recursos editoriales y sistemas externos para la gestión operativa.
- URL del acceso interno publicado: https://judaicadesign.github.io/judaica-design-system/
- El portal de clientes y las herramientas públicas se mantienen por separado en `judaicadesign/portal`.

## Capabilities and Constraints

- Este repositorio es una **superficie pública de publicación y acceso** al sistema interno; no debe tratarse como fuente de las reglas comerciales o de los permisos.
- La pantalla de acceso solicita autenticación para continuar con el trabajo interno. La aplicación protegida y sus reglas sensibles se administran separadamente.
- Las reglas de precios, credenciales, datos personales, registros de clientes y controles de autorización no deben incluirse en archivos públicos de documentación ni trasladarse al frontend público.
- Las rutas históricas pueden permanecer como accesos o redirecciones, pero no deben generar una segunda versión operativa del sistema.
- Los cambios de interfaz no deben alterar la lógica comercial, los permisos, la integridad de datos ni los enlaces existentes sin una revisión explícita.
- Mantener una experiencia usable en escritorio y dispositivos móviles.

## Brand Commitments

La marca se presenta como **Judaica Design®**. La interfaz interna se expresa en español y debe usar terminología consistente, concreta y fácil de comprender.

## Evidence on Hand

- `README.md`: delimita publicación del Dashboard interno, portal de clientes, herramientas públicas y separación de reglas privadas.
- `index.html`: página de acceso publicada, con controles de inicio de sesión y estados de carga/error.
- `delivery/`: archivos de publicación de la experiencia interna.
- `portal/index.html`: redirección al portal separado.

La presencia de rutas o recursos publicados no acredita por sí sola el funcionamiento de los procesos protegidos, que deben verificarse en su entorno correspondiente.

## Product Principles

1. **Un solo registro por hecho.** Evitar que el usuario tenga que repetir un mismo hito en varias pantallas.
2. **Estado inequívoco.** Mostrar qué se completó, qué falta y cuál es la próxima acción concreta.
3. **Menos fricción operativa.** Priorizar tareas y datos necesarios; evitar campos, controles y pasos que no aportan valor.
4. **Privacidad por diseño.** Mantener separadas las superficies públicas y las operaciones privadas.
5. **Consistencia entre herramientas.** Preservar navegación, terminología y comportamiento coherentes, sin confundir interfaces distintas.

## Accessibility & Inclusion

- Utilizar etiquetas comprensibles y mensajes de error o progreso que expresen el estado de la operación.
- Mantener navegación por teclado, foco visible y contraste legible.
- Contemplar especialmente el uso en pantallas móviles.
