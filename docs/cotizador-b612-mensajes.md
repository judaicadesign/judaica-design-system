# Pedido general de imprenta · estado de implementación

## Entrada general, sin pertenencia obligatoria al catálogo

La pantalla principal lee un mensaje libre y prepara una ficha editable. Se separan cantidades, medidas, páginas interiores y de tapa, materiales, gramajes, color, caras, laminados y encuadernaciones alternativas. Se conserva el mensaje original. La lectura es local de datos explícitos; no es todavía un intérprete general con IA.

Los tres casos reales del 15/10/2026 se verifican en `tests/print-request.cjs`: libro 240 páginas y lomo 11 mm con cosido o binder; 5 copias de PDF de 21 páginas en A5; 20 libritos de 24 páginas, 20 interiores más 4 de tapa. Los datos faltantes generan preguntas; no se asumen papel de tapa, caras, laminado brillante/mate ni inclusión de tapa.

Los pedidos se guardan en `jd_print_requests_v1` con la escritura atómica existente, sin migraciones, alteraciones del catálogo ni presupuestos comerciales. Recuperar un pedido conserva sus especificaciones y solicita una consulta nueva para las tarifas.

## Comprobación B612, todavía sin motor general de costos

La acción autenticada `assess-request` del endpoint existente consulta configuraciones y opciones editoriales publicadas por B612. El 15/10/2026 las categorías Libros (77, cotizador 62) y Revistas (68, cotizador 50) declaraban `soloFormularioDeContactoEnWeb: true`. El resultado distingue opciones no encontradas y costos pendientes de confirmar. No afirma que un papel ausente de esas opciones sea imposible de producir.

**No está terminado el cotizador general de precios.** Esta rama permite recibir, aclarar, guardar y comprobar opciones de pedidos generales; no calcula su total automáticamente. No genera un total parcial, extrapolado de un PDF histórico o de una ficha distinta. Falta desarrollar y validar la composición completa de los artículos y operaciones para cada servicio publicado y una vía de resolución de tarifas que B612 no expone.

El flujo anterior de folletos se conserva como herramienta secundaria con su alcance explícito y sus consultas históricas. Es la única vía actual de cálculo automático validado; no se presenta como motor general. No se activan servicios pagos de IA, WhatsApp ni generación de PDF de cliente.

## Publicación

Cambios preparados localmente en la rama `codex/recurring-b612`. La subida anterior fue bloqueada por revisión automática por falta de autorización explícita de publicación en GitHub. Esta rama no se ha subido ni desplegado a producción.

## Verificación

Se agregaron pruebas de extracción de los tres pedidos reales, UI sin selección obligatoria del catálogo, aclaraciones, autenticación, preservación de tapa e interior, alternativas, guardado privado y comprobación B612 sin precios inventados. Los datos del proveedor se simulan en las pruebas automatizadas; las configuraciones públicas se consultaron por separado para confirmar el estado actual.

---

## Documentación anterior del adaptador de folletos

# Cotizador B612 dentro del sistema · primera etapa

La integración elegida es una herramienta interna, accesible desde Cotizador B612. WhatsApp y la activación de IA paga quedan fuera de esta etapa. Reutiliza el repositorio, Supabase Auth/RLS, catálogo y función `b612-quote` existentes.

## Flujo

1. Pegar el pedido recibido y leer sus datos explícitos.
2. Completar las preguntas de producto, formato, cantidades y diseños. Revisar los materiales y medidas tomados del mensaje o del catálogo.
3. Confirmar la ficha y consultar B612 en vivo con la sesión existente.
4. Ver los artículos, cantidades, precios unitarios, subtotales, costo neto, IVA y total del proveedor. Se muestran la tirada optimizada y los pliegos.
5. Guardar la consulta de imprenta para compararla con B612. Ingresar los netos confirmados y corroborar por separado las operaciones del desglose.

La lectura inicial es local y basada en patrones; no constituye una interpretación general con IA. Cantidades de nusaj, teléfonos, fechas y dimensiones no se usan como número de diseños o unidades. Los datos que no se reconocen requieren confirmación. Los formatos mezclados y acabados no compatibles se señalan para revisión.

## Alcance de la conexión actual

- Díptico, tríptico y cuadríptico, según producto activo del catálogo.
- Papel ilustración 300 g, full color, doble faz y laminado mate.
- Cantidades enteras entre 1 y 40.000, limitadas además por el rango vigente del cotizador B612; entre 1 y 20 diseños distintos.
- Medidas abiertas y cerradas confirmadas en milímetros.
- Reutiliza íntegra la lógica del proveedor, incluyendo refilado, laminado, variantes de diseño y doblez. La suma de líneas y la relación neto + IVA = total se verifican antes de mostrar un resultado.

Otros papeles, acabados, productos o cantidades requieren ampliar y validar la integración con B612; no se sustituyen automáticamente por una ficha compatible. Falta cotejar uno o más pedidos reales de Abi con un presupuesto de B612 antes de afirmar equivalencia con toda su operatoria.

## Persistencia y seguridad

Las consultas se guardan mediante el mecanismo atómico `jdUpdateSharedState` existente, en la clave privada `jd_b612_requests_v1` de `app_state`. No hay tablas, servicios, credenciales ni planes pagos nuevos. Solo se guarda al pulsar Guardar consulta. Se conservan mensaje original, ficha, líneas del proveedor, fecha, precios y corroboración manual. Un conflicto entre dispositivos impide reemplazar una consulta modificada.

Esta etapa no escribe en clientes, costos comerciales, catálogo, reglas o presupuestos de cliente; tampoco genera PDF ni envía mensajes. Los snapshots guardados se abren sin recalcular sus importes.

## Verificación

- `tests/message-request.cjs`: extracción explícita, preguntas, medidas y bloqueo de materiales incompatibles.
- `tests/message-quote.cjs`: ficha → endpoint autenticado → desglose → guardado privado → corroboración; ningún precio JD o PDF de cliente. Respuestas del proveedor simuladas.
- `tests/b612-quote.cjs`: regresiones existentes del cálculo B612 y caso de referencia con PDF del proveedor.
- Prueba real de una nueva solicitud y contraste directo con B612: pendiente de recibir el pedido.

La segunda etapa, reglas de precio de Judaica Design® y presupuesto PDF con mockup disponible, se implementará después de validar la primera.


## Referencia recurrente Misjag

Reconoce «Misjag 150», «Misjag 200» o «Misjag 300», con una misma ficha técnica y cantidad independiente. Referencia: presupuesto B612 1195212 del 20/04/2026, 300 trípticos Obra 120 g, blanco y negro doble faz, 301 × 447 mm. El neto histórico de $96.033,26 no se usa para extrapolar otras cantidades ni como tarifa vigente.

La referencia se añade a la lista interna de la herramienta sin escribir en el catálogo compartido. El ancho cerrado de 149 mm se propone para revisar; el laminado y los diseños se confirman. Los datos explícitos del nuevo mensaje prevalecen sobre la referencia.

**Pendiente de conexión para este producto:** el 14/10/2026, `/api/articulo/Obra%20120grs./3?simpleFaz=false&esCombo=false&rubroPapel=89` devolvió `articulo: null`. El cotizador público de trípticos ofrece Obra 120 g en color, pero no permite afirmar equivalencia con esta ficha B&N. Tanto la herramienta como el servidor bloquean la sustitución por color. Esta rama no declara que Misjag ya se pueda cotizar en vivo.

Los avisos también se muestran debajo de Consultar B612 ahora, para que se vea el motivo si no se puede continuar.
