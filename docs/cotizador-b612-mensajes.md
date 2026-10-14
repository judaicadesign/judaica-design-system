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
- 50, 75, 100 y 150 unidades; entre 1 y 20 diseños distintos.
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
