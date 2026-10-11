La copia ashkenazí incorpora los 242 meteg del master de fonetica-hebreo, auditados por ocurrencia contra el PDF ArtScroll el 2026-10-07. Sistema tenía un seed anterior sin esas marcas. Se actualiza el seed y se migra únicamente el texto guardado idéntico a aquel seed; cualquier edición propia queda intacta. El editor ofrece la descarga de la base corregida. El archivo sigue en revisión: incorporar meteg no resuelve automáticamente las diferencias de nikud ni la fonética completa.

Revisión visual 2026-10-08: el meteg de הַזָּֽרַע se ubica en la zayin; se corrigió la asociación a resh de la extracción previa. Los párrafos 126 y 137 en la fonética ashkenazí reciben las mismas correcciones del corpus cuando el párrafo guardado coincide exactamente con la base anterior. No se propaga a otros nusajim sin cotejo.


## Política editorial de cierre ashkenazí — 11/10/2026

**Prioridad de producto:** Birkat Hamazón ashkenazí se vende regularmente y tiene prioridad de revisión sobre cerrar todo Tehilim. El TXT actual `ASHKENAZ_HEBREO_METEG_EN_REVISION.txt` es el **máster de trabajo prácticamente terminado (≈99 %, según indicación del usuario)**, fruto del cotejo para el último birkón vendido. No reconstruirlo, regenerarlo desde el motor ni sustituirlo en bloque.

**Jerarquía de autoridades:**
1. ArtScroll **edición en español**, edición principal utilizada durante la elaboración y las correcciones para el birkón vendido.
2. Texto actual del máster ashkenazí — conservar íntegramente todas las decisiones previamente revisadas.
3. PDF `ArtScroll - ashkenaz bircat hamazon Interlinear Benching.pdf` (**edición en inglés**) — referencia cruzada secundaria para localizar typos y diferencias de nikud, dagesh, meteg, puntuación y variantes de edición. Una diferencia **no** significa error del texto español.

**Vinculación:** las composiciones de hebreo y fonética ashkenazí reutilizan el hebreo/fonética FINAL de Tehilim 137 y 126 mediante `assets/jd-passage-links.js` y `masters/compositions/BIRKAT_HAMAZON_ASHKENAZI.json`. Los títulos/instrucciones de días con tajanún, Shabat, Yom Tov y comidas de mitsvá, así como todo el cuerpo de Birkat Hamazón, son propiedad del documento local. Las versiones en producción no se sobrescriben silenciosamente; las composiciones actualizadas se revisan expresamente antes de aprobarlas o imprimirlas. En la edición hebrea la instrucción local sigue diciendo `בימות החול`; en la fonética dice `En días que se dice tajanún:`. La aparente diferencia debe tratarse como cuestión editorial de ediciones y contexto, no normalizarse automáticamente.

**Orden obligatorio de cierre:**
1. Auditar exclusivamente hebreo ashkenazí actual contra la fuente de ArtScroll en español y contrastar con PDF inglés como segundo control; registrar cada diferencia con ubicación, lectura del TXT, edición de referencia y dictamen.
2. Una vez **hebreo FINAL independiente**, revisar y aprobar la fonética en una etapa separada sin adaptar hebreo a la salida del generador.
3. Una vez **fonética FINAL**, ejecutar el generador y comparar salida exacta contra el máster aprobado. Corregir el motor o sus fixtures; no acomodar el máster para conseguir PASS.

**Auditoría técnica inicial sin alteración de máster:** el archivo hebreo de GitHub contiene 242 signos meteg U+05BD, 65 líneas y 11.064 caracteres Unicode. La composición de 137 y 126 es implementada y está probada, pero **el cierre completo del hebreo ashkenazí NO está otorgado**. Primeros candidatos a revisión de maquetación/datos, **sin corrección automática**:
- La primera línea aparece concatenada dos veces: `ברכת המזון · נוסח אשכנזברכת המזון · נוסח אשכנז`. Contrastar con el original del último birkón, el seed de `index.html` y el encabezado único del PDF antes de modificar, para no alterar copias guardadas.
- En el agregado de Sucot aparece `הַנֹֹּּפָֽלֶת`, con signos combinantes reiterados. Revisar la forma exacta en el ArtScroll español y la fuente del último birkón; el PDF inglés es solo apoyo. No corregir acentos ni agregar/quitar meteg por inferencia.
- El PDF inglés titula el Salmo 137 de modo condicionado por tajanún; el hebreo local conserva `בימות החול`. Corresponde comprobar la instrucción de la **edición española principal** antes de decidir si procede alguna corrección del encabezado.

No marcar hebreo ni fonética FINAL hasta terminar el cotejo y registrar la aprobación específica. No modificar ninguna edición entregada.
