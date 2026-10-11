# Judaica Design® — arquitectura de textos canónicos reutilizables

**Propuesta técnica — 11/10/2026.** Documento de diseño, **NO implementado aún**. No reemplaza archivos, no autoriza cambios automáticos en másters FINAL ni en documentos impresos.

## El problema concreto

Tehilim 137 (*Al Naharot Bavel*) y 126 (*Shir HaMa'alot*) se emplean en Tehilim y en Birkat Hamazón ashkenazí, con condiciones litúrgicas diferentes. Tehilim 23 (*Mizmor LeDavid*) se emplea también al inicio del Kidush diurno sefaradí. Hoy pueden existir copias independientes de la fonética y una corrección del corpus no necesariamente actualiza el maestro completo de Birkat Hamazón u otros textos.

**Regla:** fuente única de cada **pasaje editorial** (hebreo, fonética, español por separado), más múltiples **usos/referencias**. No sustituir palabras a ciegas dentro de una cadena gigante.

## Propuesta de modelo

- **Pasaje canónico**, clave estable como `tehilim:137:1-9` o `tehilim:23:1-6`, con contenido por versículo (en `masters/tehilim/tehilim.json` y, cuando corresponda, su almacenamiento protegido). Cada idioma/capa editorial tiene estado y versión propios.
- **Composición de un documento:** secuencia de bloques `texto_local`, `referencia`, `seccion_condicional`, `titulo`. Las referencias pueden seleccionar pasukim y capa (`hebrew`, `phonetic`, `spanish`); la composición renderiza el contenido desde el pasaje canónico.
- **Registro inverso de usos:** buscar dónde aparece cada pasaje canónico; mostrar “Usado en: Birkat Hamazón ashkenazí, Tehilim, Kidush diurno sefaradí…” y la versión empleada.
- **Variantes legítimas:** si ArtScroll/nusaj difiere (grafía, inserción, orden, puntuación), usar una variante editorial o `override` específico, documentado y aprobable; no suponer que todo bloque llamado “Mizmor LeDavid” es idéntico.
- **Estado y versión:** `draft / revisión / FINAL` por hebreo, fonética y español, con `content_version`, aprobación, autor/fecha, evidencia y registro de cambios. Aprobar el 137 no aprueba automáticamente todo Birkat Hamazón.
- **Regeneración:** las vistas y los borradores pueden resolver referencias a la versión canónica vigente. Si un pasaje FINAL ya se utilizó en un documento FINAL/impreso, mostrar “Actualización disponible — revisar”; no cambiar silenciosamente una edición ya aprobada o entregada. Guardar instantánea y versión de cada PDF/publicación.

## Ejemplo conceptual: Birkat Hamazón ashkenazí

```json
{
  "document_id": "birkat_hamazon_ashkenazi",
  "language": "phonetic",
  "blocks": [
    {
      "type": "conditional",
      "when": "dias_con_tajanun",
      "blocks": [
        { "type": "local_text", "text": "En días que se dice tajanún" },
        { "type": "reference", "passage_id": "tehilim:137:1-9" }
      ]
    },
    {
      "type": "conditional",
      "when": "shabat_o_yom_tov",
      "blocks": [
        { "type": "reference", "passage_id": "tehilim:126:1-6" }
      ]
    }
  ]
}
```

Esto es solo una **ilustración de estructura**; los títulos, condiciones exactas y orden litúrgico se conservan según los másters del documento. El resto de Birkat Hamazón sigue siendo texto propio o referencias a otros pasajes, según corresponda.

Ejemplo adicional: el documento `kidush_diurno_sefaradi` contendría una referencia a `tehilim:23:1-6` en la ubicación editorial correcta, además de sus otros bloques.

## Flujo correcto para corregir “Bavél”

1. Abrir el pasaje canónico Tehilim 137:1/137:8 y registrar la corrección `Bável` → `Bavél` exclusivamente en fonética, con fuente, versículos afectados y prueba de regresión.
2. Revisar y aprobar el cambio en el pasaje; no degradar ni reaprobar hebreo si está intacto.
3. Calcular **impacto inverso**: todas las instancias que referencian 137 en Tehilim, Birkat Hamazón y demás documentos.
4. Los borradores/vistas enlazadas se actualizan con la versión corregida. Las publicaciones FINAL reciben notificación de actualización disponible y diferencia, sin sobrescritura ni modificación retrospectiva de PDFs impresos.
5. Generar nuevas exportaciones/versiones solo luego del control editorial adecuado; registrar commit, versión previa, versión nueva y prueba de regresión.
6. Impedir que un usuario reescriba localmente una referencia sin elegir explícitamente “crear variante” y registrar la desviación.

## Interfaz deseada

En “Masters & revisión”, la sección de Birkat Hamazón muestra el pasaje enlazado como bloque identificado: **Tehilim 137 — fonética FINAL vN**. Acciones: “Abrir pasaje fuente”, “Ver usos”, “Comparar cambios”, “Crear variante justificada”. El texto compuesto se visualiza entero, pero el bloque referenciado no se edita como un duplicado de 200 palabras en un `textarea`.

## Implementación segura, por etapas

1. **Auditoría sin mutación:** comparar el bloque de 137 y de 126 incluido en los maestros actuales de Birkat Hamazón con la versión canónica, identificando divergencias, condición litúrgica y aprobaciones.
2. **Esquema de referencias y backups:** añadir modelo de bloques y registro de usos sin retirar `app_state`, sin tocar los FINAL ni cambiar visibilidad del repositorio público. Mantener en Supabase datos protegidos con Auth/RLS cuando corresponda; migración incompleta exige respaldo y recuperación probada.
3. **Vista compuesta en lectura:** probar con Tehilim 126/137 ↔ Birkat Hamazón ashkenazí, y después 23 ↔ Kidush diurno sefaradí. Comparar salida con másters existentes.
4. **Edición, propagación y aprobación:** añadir propuestas de cambio, comparación y actualización controlada. Pruebas de regresión que impidan duplicación y pérdida de variantes.
5. **Exportaciones:** PDF/Word y otros formatos generados desde los bloques, con versión y lista de fuentes. Nunca reescribir automáticamente PDFs o ediciones ya entregados.

## Continuidad de chats

La fuente de verdad es GitHub + base privada, no el historial de ChatGPT. Al cerrar cada pequeña tanda, registrar cambios y SHA, estado de aprobación, consultas pendientes, pruebas y siguiente tarea en `masters/tehilim/CONTINUAR_EN_CHAT.md` y `masters/tehilim/REVISION_ESTADO.json`. Abrir conversaciones nuevas *dentro del mismo proyecto* cuando sea conveniente, sin trasladar todo el contenido del chat previo. Pedir que se lean los archivos reales y se comparen con los registros actuales; no tomar el contexto recordado como prueba de FINAL.

**Política fundamental:** ninguna propagación silenciosa ni reaprobación automática de publicaciones finales. Cambiar un solo pasaje canónico debe mostrar el impacto y requerir revisión donde exista una variante o un documento FINAL.
