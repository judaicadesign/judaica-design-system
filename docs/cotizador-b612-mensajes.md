# Cotizador general B612

El pedido se recibe como texto libre. No exige seleccionar un producto del catálogo. La ficha editable separa cantidades, medidas, páginas, tapa, interior, impresión, laminados y alternativas de encuadernación. Los datos no explícitos se consultan antes de calcular. La lectura es asistida por patrones locales, sin IA paga.

## Cálculo

El compositor consulta configuraciones, etapas, artículos, posturas y precios del proveedor. Implementa las reglas publicadas en `js/turnos-web.cotizadorV2.js` para los multiplicadores y la composición editorial. Incluye impresión y papel, tapa, preparación de papel, corte, refilado, doblado, abrochado, revisión y laminado con sus cargos de preparación. Los artículos fijos y sus multiplicadores se leen del proveedor. Las consultas se cachean dentro de cada solicitud, sin conservar tarifas viejas para nuevos pedidos.

Se pueden procesar tiradas variables de folletos, revistas acaballadas, impresiones sueltas y libros binder cuando se dispone de todos los artículos necesarios. Una entrada nueva no queda bloqueada por no estar en el catálogo. Un papel, medida, acabado o servicio sin tarifa verificable produce una alternativa pendiente, sin un total parcial. Cosido a hilo permanece pendiente de proveedor; no se sustituye por binder. La ausencia de un papel en esta conexión no implica que B612 no pueda producirlo por otro proceso.

Las tarifas BN y BK son procesos separados de B612, con nombres de papel terminados en `- BN` y `- BK`. Se verifica rubro, material y gramaje; nunca se usa la tarifa color para una solicitud blanco y negro.

## Comparación con presupuestos existentes

Precios de API pública consultados el 15/10/2026. No son una validación de equivalencia comercial definitiva con la imprenta; las primeras consultas quedan pendientes de corroboración de procesos e importes.

| Referencia | Neto del PDF | Neto compuesto actual | Diferencia |
|---|---:|---:|---:|
| 1321092, 50 libritos, laminado tapa e interior | 186.408,19 | 187.268,29 | +860,10 |
| 1321092, 100 libritos, laminado tapa e interior | 310.687,19 | 312.930,54 | +2.243,35 |
| 1195212, 300 misjag | 96.033,26 | 108.853,00 | +12.819,74 |

El presupuesto 1321092 es del 09/10/2026 y el 1195212 del 20/04/2026. Las diferencias no se atribuyen automáticamente solo a cambios de tarifa: deben corroborarse también las operaciones. El sistema no calibra porcentajes para forzar coincidencias ni extrapola el valor de 300 ejemplares para otras cantidades.

El mismo flujo calculó 150 y 200 misjag con los artículos vigentes, y cinco copias simples faz de un documento de 21 páginas en A5. Los datos faltantes del pedido original, como caras o encuadernación, se completaron explícitamente para esa prueba. El usuario puede cargar un neto de referencia para ver y guardar la diferencia; una coincidencia de neto no aprueba las operaciones automáticamente.

## Guardado y seguridad

Se reutilizan Supabase Auth, la lista de acceso del equipo, `app_state` y `jd_commit_state`. Las consultas se guardan en `jd_print_requests_v1`; no se alteran catálogo, reglas, clientes ni presupuestos comerciales. Guardar preserva mensaje, ficha, respuesta del proveedor y comparación. Abrir una consulta requiere volver a consultar para tarifas vigentes. No se aplican márgenes JD, envío ni generación de PDF de cliente en esta fase. No se envían mensajes a terceros ni pedidos a la imprenta.

## Validación

`npm test` incluye regresiones existentes y:

- `print-request.cjs`: los tres mensajes reales, medidas, páginas, tapa/interior y preguntas.
- `print-request-ui.cjs`: ficha sin dependencia del catálogo, consulta autenticada y guardado.
- `print-assessment.cjs`: consulta de opciones publicadas y estados pendientes.
- `print-costs.mjs`: artículos reales capturados del proveedor; revista laminada completa, misjag variable y hojas A5; faltantes sin precios inventados y comparación histórica.
- `print-flow.cjs`: recorrido integrado desde el mensaje hasta el handler, composición, diferencias contra un PDF y guardado privado atómico.

Las pruebas automatizadas usan respuestas públicas capturadas. La consulta en vivo se ejecutó aparte contra las mismas APIs de lectura, sin crear pedidos ni activar servicios pagos.
