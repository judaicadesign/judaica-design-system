# Tehilim 1–150 · en revisión

Los TXT de hebreo y fonética están alineados por capítulo y pasuk: 150 capítulos, 2.527 pesukim. Tehilim 119 conserva 176 pesukim. La base hebrea se extrajo de las páginas Wikisource `/ניקוד`, sin reemplazarla por OSHB, Open Siddur ni el Word previo. El JSON conserva las URLs de los 150 capítulos y hashes de las páginas recuperadas.

La fonética usa el generador original JD, revisión `02fbc2c66e2d1e7d5756335ae73eab80db2d255c`, con las decisiones editoriales disponibles. Las cinco revisiones nuevas se aplican por contexto. No se agregaron meteg inferidos al hebreo. Las variantes de lectura, nikud y acentos pendientes siguen abiertas: estos archivos no son golden aprobados ni certifican la pronunciación completa.

En Sistema: Masters & revisión → Tehilim 1–150 → Abrir matriz → idioma y presentación → Descargar TXT. Los archivos publicados son la base versionada y no sobreescriben celdas ni ediciones guardadas del catálogo.

Regeneración: `TEHILIM_CACHE=/ruta/cache node scripts/build-tehilim.mjs /ruta/fonetica-hebreo/index.html`.
Verificación: `node tests/tehilim-masters.cjs`.

Revisión 2026-10-08: Tehilim 23 cotejado con la captura ArtScroll de la app; 16 meteg añadidos, nikud y fonética registrados en ARTSCROLL_023_REVISION.json. La escritura digital del Nombre se conserva de Wikisource. Las correcciones se reaplican al regenerar. El resto del corpus sigue en revisión.

El visor permite editar y Guardar Master en hebreo y fonética usando el mismo almacenamiento sincronizado que Birkat Hamazón. La descarga incluye la edición abierta. Las ediciones personales guardadas prevalecen sobre la base publicada.

Revisión 2026-10-08 lote 2: capítulos 126 y 137 con 11 y 19 meteg respectivamente. En 126:4 se eliminó del texto de lectura el ketiv duplicado que aparecía como shvvtnv. Las diferencias del motor están registradas por pasuk en AUDITORIA_MOTOR_REVISADOS.json. Estado por etapa en REVISION_ESTADO.json; ninguno se marca aprobado automáticamente.

Descargas de la matriz: cuatro TXT, hebreo/fonética de corrido o con pasuk. La edición del texto base conserva referencias internas para alinear los 2.527 pesukim. En hebreo la marca es la letra del pasuk; en fonética el número, sin repetir capítulo:pasuk. Las exportaciones usan el texto de la edición abierta. La traducción española no forma parte de este corpus.

## Presentaciones para producción
Abrir matriz muestra cuatro variantes: hebreo/fonética, de corrido/con pasuk. Todas derivan de las dos bases editables. Con pasuk se exporta TXT con una letra o número, tabulación, y texto por párrafo. En InDesign: crear un estilo de carácter para el pasuk y un estilo anidado hasta la primera tabulación; para el texto siguiente usar el estilo normal. TXT no guarda estilos. RTF/HTML no son opciones necesarias y se retiraron de esta interfaz.

## Corrección del cotejo 23:3
Se retiró el dagesh erróneo añadido a la bet de בְמַעְגְּלֵי. La forma correcta conserva vema'guelé. REGISTRO_CAMBIOS_NIKUD.json lista cambios ajenos al meteg y su fuente, para auditoría.

Motor 2026-10-08: los 21 pesukim cotejados de 23, 126 y 137 coinciden con los masters. Las pruebas pasan también para las grafías explícitas del Nombre usadas en el birkón. La coincidencia no aprueba automáticamente el resto del corpus.

2026-10-08: revisión de los 10 salmos recibidos: 97 pesukim, 163 meteg, 3 cambios de nikud documentados. Ver REVISION_10_SALMOS.html y ARTSCROLL_NNN_REVISION.json. Aprobación editorial final pendiente.

## Salmo 1 · FINAL · 2026-10-09

Hebreo y fonética cerrados por cotejo integral con ArtScroll como golden master. Diez meteg y dos rayitas de shevá na confirmados; Nombre sin nikud y puntuación como en la captura. El generador coincide exactamente con los seis pesukim y con el capítulo de corrido. Registro independiente: ARTSCROLL_001_REVISION.json; evidencia: sources/ARTSCROLL_001.png. Los cuatro TXT TEHILIM_001_*_FINAL_* son las versiones de producción. Los TXT generales y el JSON canónico también contienen este cierre; los demás capítulos siguen en revisión.
