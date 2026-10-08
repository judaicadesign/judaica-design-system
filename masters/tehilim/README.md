# Tehilim 1–150 · en revisión

Los TXT de hebreo y fonética están alineados por capítulo y pasuk: 150 capítulos, 2.527 pesukim. Tehilim 119 conserva 176 pesukim. La base hebrea se extrajo de las páginas Wikisource `/ניקוד`, sin reemplazarla por OSHB, Open Siddur ni el Word previo. El JSON conserva las URLs de los 150 capítulos y hashes de las páginas recuperadas.

La fonética usa el generador original JD, revisión `02fbc2c66e2d1e7d5756335ae73eab80db2d255c`, con las decisiones editoriales disponibles. Las cinco revisiones nuevas se aplican por contexto. No se agregaron meteg inferidos al hebreo. Las variantes de lectura, nikud y acentos pendientes siguen abiertas: estos archivos no son golden aprobados ni certifican la pronunciación completa.

En Sistema: Masters & revisión → Tehilim 1–150 → Abrir hebreo / Abrir fonética → Descargar TXT completo. Los archivos publicados son la base versionada y no sobreescriben celdas ni ediciones guardadas del catálogo.

Regeneración: `TEHILIM_CACHE=/ruta/cache node scripts/build-tehilim.mjs /ruta/fonetica-hebreo/index.html`.
Verificación: `node tests/tehilim-masters.cjs`.

Revisión 2026-10-08: Tehilim 23 cotejado con la captura ArtScroll de la app; 16 meteg añadidos, nikud y fonética registrados en ARTSCROLL_023_REVISION.json. La escritura digital del Nombre se conserva de Wikisource. Las correcciones se reaplican al regenerar. El resto del corpus sigue en revisión.

El visor permite editar y Guardar Master en hebreo y fonética usando el mismo almacenamiento sincronizado que Birkat Hamazón. La descarga incluye la edición abierta. Las ediciones personales guardadas prevalecen sobre la base publicada.
