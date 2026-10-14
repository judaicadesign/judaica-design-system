# Judaica Design® – Cotizador: checkpoint de integración

## Verificado el 14/10/2026

- Reutiliza `judaicadesign/judaica-design-system` y Supabase `athiruoimehofqzrplnl`.
- Meta app `3217384701785269`, portfolio `1358705312802186`.
- WABA de prueba `1103365929264394`, Phone Number ID `1341871429015169`.
- Número de prueba `+1 (555) 673-7237`. App en desarrollo.
- Catálogo remoto: 21 productos. Función existente `b612-quote` versión 8.
- Regla confirmada para solicitudes B612 reenviadas por WhatsApp: neto sin IVA redondeado arriba a $500, multiplicado por 1,26, resultado redondeado arriba a $100. Ese resultado es el precio final al cliente, sin envío ni margen adicional. Ejemplo: $98.325 → $98.500 → $124.110 → $124.200.
- El porcentaje (26) y ambos pasos de redondeo (500/100) son editables en Precios por producto → Cotizador por WhatsApp · B612. Se guardan como `jd_whatsapp_pricing_v1` mediante el mecanismo de escritura compartida existente. No sobrescribe las reglas de productos ni los envíos de proveedores. Las cotizaciones anteriores deben conservar su snapshot de regla y precio.
- La IA interpreta solicitudes, pero no calcula importes.
- No existe una fila remota `jd_supplier_settings_v1` en el estado consultado: el panel utiliza sus defaults existentes ($20.000 Zloto / $10.000 B612). No presentar estos defaults como ajustes remotos personalizados.

## Webhook desplegado y conectado el 14/10/2026

`whatsapp-webhook` recibe eventos firmados y guarda mensajes en una bandeja interna nueva. No toca `app_state`, clientes, presupuestos, costos ni catálogo. No contiene cliente de IA ni cliente de envío.

- GET: challenge solo con token correcto.
- POST: verificación HMAC SHA-256 del cuerpo original con el App Secret de Meta.
- Restringido a WABA y teléfono configurados.
- Duplicados: clave primaria de message ID + PostgREST ignore-duplicates.
- Estados de entrega no crean solicitudes; multimedia requiere revisión.
- Límite 256 KiB, ninguna credencial ni mensaje en logs.
- Error de guardado devuelve 503 para permitir reintento.
- RLS habilitada, sin acceso anon/authenticated. Escritura solo desde servidor.

La configuración `verify_jwt=false` corresponde únicamente al webhook nuevo: Meta no envía un JWT de Supabase y la autenticación se hace por firma HMAC. No cambiar auth de las funciones existentes.

## Secrets que deben cargarse de forma privada

- `JD_META_APP_SECRET`: secreto de esta aplicación, nunca token de WhatsApp.
- `JD_WA_VERIFY_TOKEN`: valor aleatorio generado para la verificación del callback.
- `JD_WA_WABA_ID`, `JD_WA_PHONE_NUMBER_ID`: IDs de este entorno de prueba.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: provistos por el entorno servidor.

Para la futura salida, guardar el token temporal en `JD_WA_ACCESS_TOKEN` y el número confirmado de la persona aprobadora en `JD_WA_APPROVER_NUMBER`. El webhook preparado todavía no usa estas variables ni envía mensajes.

## Pendiente para completar el circuito

1. La autorización de despliegue fue recibida y se aplicó la migración `jd_whatsapp_inbox_signed_events`. `whatsapp-webhook` versión 1 está ACTIVE. Verificado: RLS=true, anon/authenticated sin SELECT, service_role con INSERT, 0 mensajes; el endpoint real devuelve 503 `Webhook not configured` mientras faltan Secrets.
   Generación de token: Meta abrió consentimiento con la cuenta Hache Plus. Auto-review rechazó continuar por permisos continuos de administración y mensajería WhatsApp que requieren autorización explícita. Posteriormente el usuario autorizó los permisos y Meta Business Tools: token temporal generado y guardado en Supabase Secrets. Ya están guardados JD_WA_ACCESS_TOKEN, JD_WA_VERIFY_TOKEN, JD_WA_WABA_ID, JD_WA_PHONE_NUMBER_ID, JD_WA_APPROVER_NUMBER y JD_META_APP_SECRET.
2. COMPLETADO: Meta verificó y guardó el callback. `messages` está Suscrito v26.0. El endpoint responde 403 sin verificación válida (ya no 503 por falta de Secrets).
3. COMPLETADO: destinatario de prueba verificado. Recepción real de PRUEBA JD pendiente; no afirmar prueba de punta a punta.
4. Adapter `whatsapp-extract.mjs` preparado con GPT-5.4 Mini, JSON Schema estricto, sin precios en la salida, store=false y 500 tokens de salida. Desactivado por defecto y sin credencial OpenAI. Solo tests mock, ninguna llamada paga. Se propone un piloto pago con autorización previa; worker/B612/salida preparados en PR #2; falta desplegar, autorizar y medir consumo real. Interpretación estructurada contra IDs del catálogo; ningún precio, regla o envío puede ser inventado por el modelo.
5. Reutilizar lógica `b612-quote` en servidor sin permitir service-role por bypass de sesión pública. Consultar costo neto en vivo solo cuando la ficha técnica es compatible; demás casos requieren revisión explícita.
6. Releer `jd_whatsapp_pricing_v1` para cada cotización nueva y aplicar la implementación compartida `supabase/functions/_shared/jd-whatsapp-pricing.js`. Conservar la regla aplicada junto al presupuesto. No aplicar el motor de margen sobre venta ni el envío a este flujo.
7. Entregar borrador exclusivamente a la persona aprobadora. No incluir envío automático al cliente, tampoco al aprobar un borrador.
8. Prueba real de ingreso, deduplicación, interpretación, B612 en vivo, costo neto, reglas y recepción por WhatsApp. El sistema NO está funcionando de punta a punta hasta completar esta prueba.

## Verificación

- `node tests/whatsapp-webhook.mjs`: pruebas unitarias con credenciales ficticias.
- `node tests/b612-quote.cjs`: respuestas API grabadas de B612; no sustituye consulta en vivo.
- `node tests/auth-bootstrap.cjs`: acceso, bootstrap y conservación de estado.
- `node tests/commercial-scenarios.cjs`: precios, PDF, pedidos, persistencia y conflictos.

Fuentes de implementación: documentación oficial Supabase de autenticación de Edge Functions y ejemplo oficial `fbsamples/whatsapp-api-examples/signature-validation-with-webhooks-payloads/app.py`.

## Preparación adicional del circuito

- `b612-core.ts` reutiliza la lógica existente sin duplicarla. El endpoint público `b612-quote` conserva la autenticación de usuario y la lista de equipo, sin bypass de service-role. Refactor preparado en rama; no desplegado a producción.
- Consulta real a los endpoints públicos de B612: 50 cuadrípticos, 2 diseños, abierto 391 × 190 mm / cerrado 100 × 190 mm; neto sin IVA $142.779,81, fetchedAt 2026-10-14T11:18:43.894Z. Es una comprobación del proveedor, no una prueba completa de WhatsApp o IA.
- `whatsapp-draft.mjs` prepara borradores con catálogo vigente y ficha técnica inequívoca, acepta solamente el remitente aprobador y ventana de 24 horas. Los formatos o materiales no compatibles requieren revisión. Conserva snapshot de regla por alternativas; La preparación de borradores no tiene cliente de envío; la salida está aislada en el adapter de aprobador del worker y requiere activación explícita.
- El adapter de IA valida nuevamente tipos, campos exactos y enum luego de la respuesta. Incluye impresión para evitar presupuestar full color cuando el pedido especifica blanco y negro.
- `whatsapp-worker` preparado con reserva atómica de presupuesto en `security/whatsapp-worker.sql`, deduplicación de procesamiento, persistencia de borradores y envío exclusivo a la persona aprobadora. No está desplegado. Ante timeout de IA no reintenta cargos; ante resultado incierto de envío registra delivery_uncertain y no reenvía. Debe verificarse la atomicidad de SQL en Supabase luego de autorización de despliegue.
- Último control de recepción: 0 mensajes. Falta que el usuario envíe PRUEBA JD desde su WhatsApp al número de prueba.
- Web pública: página de acceso visible y nueva regla publicada; panel privado aún no verificado con sesión real.
- Tests nuevos: `tests/whatsapp-extract.mjs` y `tests/whatsapp-draft.mjs` con respuestas simuladas, sin llamadas pagas ni mensajes enviados.

## Activación propuesta para aprobación

- Revisión concreta: PR #2, rama `codex/whatsapp-draft-pipeline`. No publicado ni desplegado.
- Migración nueva de dos tablas internas (`jd_whatsapp_jobs`, `jd_whatsapp_ai_budget`) y RPC privada de claim/reserva. No modifica clientes, pedidos, catálogo ni reglas existentes. Budget viene enabled=false. RLS habilitada y sin acceso público ni del panel.
- Credenciales adicionales en Supabase Secrets: `JD_OPENAI_API_KEY`, `JD_WA_WORKER_TOKEN` (aleatorio de al menos 32 caracteres), `JD_WA_AI_ENABLED` (solo true después de autorización y pruebas de seguridad).
- Piloto propuesto: US$1 de consumo de IA, hasta 20 solicitudes con reserva conservadora no reembolsable de US$0,05 por solicitud. No renueva el piloto ni amplía el límite automáticamente. Modelo fijo gpt-5.4-mini-2026-03-17, service_tier default, sin herramientas ni razonamiento, hasta 500 tokens de salida y request serializada de hasta 15.000 bytes. Tarifas oficiales consultadas el 14/10/2026: US$0,75 por millón de tokens de entrada y US$4,50 de salida; volver a verificar antes de activar. La reserva es conservadora, no el costo exacto de una cotización. Límite exclusivo del uso de IA de este worker; no limita otras aplicaciones en la misma cuenta ni impuestos o cargos externos de Meta.
- El texto reenviado y la identificación compacta del catálogo van a OpenAI para interpretar especificaciones; store=false no equivale a ausencia de retención del proveedor. No activar ni transmitir hasta autorización.
- La activación mantiene el webhook HMAC vigente y agrega un worker interno con bearer privado, sin alterar autenticación de b612-quote ni el panel web. El worker usa el core B612 compartido directamente en servidor.
- Pruebas locales del worker aprobadas con adapters simulados: desactivado por defecto, budget denegado, solo aprobador, borrador persistido antes del envío, duplicado concurrente y ningún reintento automático tras timeout de IA/envío. Falta prueba real de SQL, IA, ingreso y entrega.

- SQL ejecutado satisfactoriamente en Postgres embebido descartable (PGlite): migraciones reales, roles privados, default desactivado, un claim por message ID, rollback de reserva junto con claim y límite US$1 / 20 solicitudes. No conectó a Supabase ni usó datos reales. Falta la prueba de concurrencia de múltiples conexiones en Supabase tras despliegue.
