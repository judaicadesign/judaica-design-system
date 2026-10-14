## Reparación técnica · 11/10/2026

La captura del usuario mostró una vista fonética de Tehilim 14 desactualizada. Los archivos canónicos contenían comas y puntos y coma, pero la sesión podía retener recursos anteriores. El editor renueva ahora el corpus y el estado al abrir cada vista; pruebas reproducen un borrador guardado sin puntuación en 14 y comprueban edición, continuo, numerado y descarga sin perder cambios de capítulos pendientes. No inferir aprobación editorial nueva de una prueba técnica.

Se alinearon las expectativas históricas 2:10, 2:11 y 14:3 con los másters aprobados, sin modificar el motor para satisfacerlas. El TXT aislado 126/137 ahora coincide con la fuente canónica. Los informes de cotejos anteriores son evidencia histórica, no fuentes para nuevas ediciones. Fuente vigente: tehilim.json + REVISION_ESTADO.json y exports FINAL.

Comercial: Sin legales respeta el vacío explícito; el adicional Deluxe se edita en la ficha del producto y se guarda atómicamente con su regla; el presupuesto Deluxe permite Canciones, Rosh Hashaná y simanim, y Janucá mediante casillas, sin contenido libre. Selecciones conservadas al guardar/reabrir y entre alternativas.

## TEHILIM 14 FINAL · 2026-10-11 · ArtScroll IMG_1547.png

- **Hebreo + fonética FINAL (7/7)**, español todavía pendiente. Cotejo visual con captura ArtScroll Siddur Wasserman Edition `IMG_1547.png` (SHA256 `359728ac44c15eccd38fd2a769b5ed18ed6ddd0a20fd97036aa7cd627fc44798`), y referencias anteriores `IMG_1474.png` / `ARTSCROLL_APP_TANDA_009-017.json`.
- **Puntuación nueva**: 10 marcas impresas de ArtScroll, calcadas en hebreo y fonética. 14:1 = punto y coma después de `לְדָוִד`, comas después de `אֱלֹהִים` y `עֲלִילָה`; 14:2 coma después de `אָדָם`; 14:4 punto y coma después de `אָֽוֶן` y coma después de `לֶֽחֶם`; 14:5 coma después de `פָֽחַד`; 14:6 coma después de `תָבִֽישׁוּ`; 14:7 punto y coma después de primera `יִשְׂרָאֵל`, coma después de `עַמּוֹ`. 14:3 mantenido con puntuación y meteg aprobados anteriormente.
- **Nikud, dagesh y meteg:** no se realizaron otros cambios sustantivos de nikud o dagesh en esta pasada; 14 marcas meteg aprobadas en el conjunto, shevá na explícito en 14:1 `לַמְנַצֵּֽחַ` (מ) y 14:4 `יָדְעוּ` (ד). Nombre editorial del tetragrama unificado a `יְיָ` en 14:2, 14:4, 14:6, 14:7 y `Ad-nai` en la fonética.
- **Generador:** auditoría REAL de 7/7 palabras-en-contexto, no estimación, `judaicadesign/fonetica-hebreo` commit `4e142bcd`, run https://github.com/judaicadesign/fonetica-hebreo/actions/runs/38151154742 . Primera corrida 6/7 por `14:3 עֹֽשֵׂה` → `'osé` incorrecto; corregido el motor para `'ose`, segunda corrida **7/7 idénticos**. Test permanente `tests/psalm-14-live-audit.mjs` falla al detectar diferencias.
- **Suite global del generador:** conserva fixture histórico desactualizado de Tehilim 2 (primero 2:3, luego 2:10). No confundir falla de ese test con el cotejo 14 aprobado; los casos históricos se resolverán separadamente, sin cambiar másters FINAL por expectativa de fixture.
- **Salmo 14 guardado en `masters/tehilim/ARTSCROLL_014_REVISION.json`** y `REVISION_ESTADO.json` con 4 artefactos `TEHILIM_014_...FINAL_...`; sincronizadas las 6 exportaciones generales y `tehilim.json`, 10 salmos FINAL acumulados [1–7,14,126,137]. Nueve FINAL anteriores permanecen intactos.

---

## CORRECCIÓN CRÍTICA DE VISTAS: BAVÉL + COMPOSICIONES + Unicode · 2026-10-11

**Motivo real:** aunque el corpus Tehilim FINAL ya contenía `Bavél` (137:1 y 137:8), en las capturas del usuario seguían visibles copias con `Bável`: la matriz Tehilim priorizaba un texto integral antiguo de `jd_master_cells` sobre los FINAL GitHub, y el campo superior de Birkat Hamazón mostraba la copia local anterior aun cuando un panel separado componía bien el texto. El bug era la **prioridad de las copias locales en la interfaz**, no falta de corrección en `tehilim.json`.

**Cambios realmente implementados:**
- `assets/jd-passage-links.js`: `overlayFinalVerses` inserta en la matriz las 93 líneas por pasuk de los nueve capítulos FINAL desde `tehilim.json`/ `REVISION_ESTADO.json`, validando cobertura completa; conserva sin modificar los 141 capítulos no aprobados ni sus ediciones locales. La vista corrige `Bável` antiguo; no escribe `localStorage` sin que el usuario guarde. Si falta un capítulo FINAL completo, bloquea la exportación.
- El editor ashkenazí superior pasa a exhibir la composición **canónica** tras cargar los datos; oculto mientras carga para evitar flashes de copia vieja. Solo el texto compuesto puede guardarse, tras acción explícita; hasta entonces no se cambia la copia local. El panel y el TXT vinculado también leen el corpus. Se mantienen los títulos/condiciones locales: hebreo `בימות החול` para 137, fonética `En días que se dice tajanún:`, y Shabat/Yom Tov/seudat mitzvá para 126. No se sustituyen decisiones litúrgicas de ArtScroll español por el PDF inglés.
- TXT de trabajo ashkenazí `ASHKENAZ_HEBREO_METEG_EN_REVISION.txt` y `ASHKENAZ_FONETICA_EN_REVISION.txt` y seed de nuevos usuarios en `index.html`: 137 y 126 sincronizados directamente con sus versiones FINAL (acentos, comas, punto y coma, signos), sin reescribir el resto del rezo. Texto hebreo de composición enlazada también actualizado. Se quitaron duplicaciones exactas `בַּמָּּרוֹם` → `בַּמָּרוֹם`, `הַנֹֹּּפָֽלֶת` → `הַנֹּפָֽלֶת`, y encabezado duplicado. Las antiguas grafías defectuosas de Jerusalén en 137 se sustituyeron **únicamente** por el texto canónico del mismo salmo. **242 meteg hebreos conservados; 0 clusters con marcas duplicadas, 0 U+200D, un solo título.**
- `tests/passage-link-regression.cjs` prueba un navegador con `Bável` desactualizado y preservación del Salmo 8 (NO FINAL); `tests/tehilim-masters.cjs` vuelve a probar las cuatro vistas reales de la matriz; `package.json` / workflow incorporan ambas pruebas.
- **CI y GitHub Pages PASS al commit `f99ac8d1`:** https://github.com/judaicadesign/judaica-design-system/actions/runs/38148858573 y https://github.com/judaicadesign/judaica-design-system/actions/runs/38148858292. La variante `Bável` no se debe volver a mostrar en las vistas canónicas. Si el navegador conserva la página vieja abierta, **recargar la web**, pero NO borrar datos/almacenamiento local.
- `masters/bircat-hamazon/REVISION_ASHKENAZ_ESTADO.json` registra todos los cambios exactos. **Birkat Hamazón ashkenazí hebreo permanece EN REVISIÓN (≈99 % listo, no declarar FINAL); luego fonética y después generador**. Nueve Tehilim FINAL intactos; Tehilim 14 sigue NO FINAL (14:3 corrección puntual ya aprobada).

---

## CIERRE DE PUNTUACIÓN TEHILIM 14:3 · 2026-10-11 (posterior al registro anterior)

- **IMG_1474.png RECUPERADA Y VISTA** desde la Biblioteca personal del proyecto. El seguimiento anterior que decía que faltaba la captura queda superado en 14:3.
- Lectura hebrea cotejada: **`הַכֹּל סָר, יַחְדָּו נֶאֱלָֽחוּ; אֵין עֹֽשֵׂה טוֹב, אֵין גַּם אֶחָד.`** Dos comas después de סָר y טוֹב; punto y coma después de נֶאֱלָֽחוּ. Meteg en ע de עֹֽשֵׂה confirmado por usuario.
- Fonética paralela de JD: **`Hakol sar, yajdav neelaju; en 'ose tov, en gam ejad.`** (Ó-se, sin tilde redundante). Ajustada en `tehilim.json` y las seis exportaciones generales, y anotada en `ARTSCROLL_014_CONFIRMACION_20261011.json`, `ARTSCROLL_APP_TANDA_009-017.json` y `REVISION_ESTADO.json`.
- `tests/passage-link-regression.cjs` incluye ahora aserciones exactas de la puntuación y de las seis exportaciones. La marca de 14:3 está cerrada. **Tehilim 14 sigue NO FINAL** hasta cotejo global ArtScroll independiente.
- La vinculación Birkat Hamazón ashkenazí ↔ Tehilim 137/126 se conserva con sus encabezados originales y CI de protección; no reabrir los nueve FINAL.

## VINCULACIÓN CANÓNICA y corrección 14:3 · 2026-10-11 (estado confirmado en GitHub)

- **Implementado y publicado:** `assets/jd-passage-links.js` + `masters/compositions/BIRKAT_HAMAZON_ASHKENAZI.json` + integración en `index.html` (Masters → Birkat Hamazón → Ashkenazí → Hebreo/Fonética). Lee `tehilim.json` y `REVISION_ESTADO.json`, bloquea la composición cuando los capítulos enlazados no están FINAL. Resuelve salmos desde sus pesukim vigentes y preserva literalmente el contexto local fuera de los dos segmentos.
- **Contextos preservados:** 137 (fonética: **En días que se dice tajanún:**; hebreo legacy: `בימות החול–`, sin cambiarlo unilateralmente) y 126 (**En Shabat, Yom Tov y en una comida de mitsvá**; hebreo: `בשבת, יום טוב ובסעודת מצוה–`). Después de 126 permanecen Tehilat Ad-nai, zimún, berajot y las demás instrucciones locales de Birkat Hamazón.
- La vista y **Descargar TXT vinculado** toman 137/126 del Tehilim FINAL, incluyendo **Bavél** en 137:1/8 y la puntuación ArtScroll aprobada. El Birkat antiguo todavía tiene `Bável`: NO se modifica silenciosamente una copia/maestro previo, en especial si ya fue entregado. Botón explícito **Pasar esta composición al editor (requiere revisión)**; degradar a Revisión fina, luego guardar de forma deliberada.
- Protección adicional: `tehilim.json.approvedChapters` corregido de la metadata desactualizada `[1,2]` a `[1,2,3,4,5,6,7,126,137]`, y flags aprobados de 126/137 sincronizados con `REVISION_ESTADO.json`. Ningún texto FINAL alterado.
- **Regresión AUTOMÁTICA PASS:** `tests/passage-link-regression.cjs`, `package.json`, `.github/workflows/canonical-passage-links.yml`; corrida pública exitosa https://github.com/judaicadesign/judaica-design-system/actions/runs/38144774821; despliegue GitHub Pages success https://github.com/judaicadesign/judaica-design-system/actions/runs/38144773718. Verifica contexto, orden 137/126, ausencia de `Bável` en composición, idempotencia, falla segura con capítulo no aprobado, 36 exportaciones FINAL intactas.
- **14:3 confirmado por el usuario**: meteg en ע, `עֹֽשֵׂה`; fonética `'ose` (**Ó-se**, sin tilde redundante en palabra llana terminada en vocal), antes `'osé`. Corregidos corpus, seis exportaciones generales y el registro de revisión 009–017. Ficha `ARTSCROLL_014_CONFIRMACION_20261011.json`.
- **PENDIENTE DE PUNTUACIÓN 14:3:** el verso aún carece de un cotejo de comas de ArtScroll; la versión heredada tiene puntuación de la base digital. Fuente indicada `IMG_1474.png`; no se obtuvo nueva vista de esos píxeles. No inventar signos, ni marcar salmo 14 FINAL.
- **9/150 capítulos FINAL**: 1–7, 126, 137. La composición vinculada por ahora está activada en Birkat ashkenazí (hebreo/fonética), y la API genérica permite registrar otros usos sólo con mapeos y aprobaciones específicas. No decir que todas las referencias de otros textos ya están migradas.

## Corrección de acento Tehilim 137 · 2026-10-11

- **137:1 y 137:8: בָּבֶ֗ל = Bavél, NO Bável.** Reviá masorético sobre la segunda ב, acento principal final (milrá). En fonética JD lleva tilde sobre la é por ser aguda terminada en l.
- La fonética Bável de la primera aprobación fue un error; ni el nikud por sí mismo ni un meteg justificaban el acento inicial. **Hebreo inalterado.**
- Corrección aplicada a tehilim.json, ARTSCROLL_137_REVISION.json, los 2 finales fonéticos del 137 y las 3 exportaciones generales de fonética. Informe COTEJO_126_137_20261011.md también corregido.
- Generador corregido específicamente en 137:1 y 137:8, con prueba de regresión en tests/artscroll-126-137-20261011.mjs, PASS en paso dirigido de GitHub Actions (run 38121073125).
- **Se conservan 9/150 capítulos FINAL.** No reabrir el hebreo; corrección posterior a FINAL de fonética verificada por evidencia masorética.
- La prueba completa del generador sigue roja por fixture anterior 2:3, NO por 137.

## CIERRE FINAL 126 + 137 · 2026-10-11

**AVANCE CONFIRMADO: 9/150 Tehilim con HEBREO FINAL y FONÉTICA FINAL**: 1–7, 126 y 137. Los 141 restantes no están FINAL. Español independiente queda pendiente.

- Fuente golden visual: **IMG_1529.png (126)** y **IMG_1530.png (137)**. PDF ArtScroll Interlinear Benching subido de nuevo en la misma sesión, SHA-256 **f50d33123d082f5ee86161b579c38ef2818b3a49719b07a9218902ce48a6eec7**, exactamente el mismo original cotejado el 9/10, páginas **2 y 1** respectivamente.
- Cotejo: los 15 pesukim visualmente contrastados con capturas y PDF. Se preservaron los anteriores **11 meteg (126)** y **19 meteg (137)**, rayitas de shevá na, nikud, dagesh, palabras y excepciones fonéticas. Asteriscos de la app NO son meteg.
- Cambio editorial final: transcripción fiel de **puntuación** (comas, punto y coma y dos puntos) ArtScroll en 14 pesukim de 126/137; fonética con puntuación paralela.
- Regresión automática **PASS 15/15** versos en forma Unicode normal y NFD en https://github.com/judaicadesign/fonetica-hebreo/actions/runs/38118815765. No hay divergencias del generador en 126/137.
- **OCHO ARCHIVOS PUBLICADOS, VERIFICADOS:** `TEHILIM_126_{HEBREO,FONETICA}_FINAL_{continuous,numbered}.txt` y `TEHILIM_137_{HEBREO,FONETICA}_FINAL_{continuous,numbered}.txt`; su contenido se releyó desde GitHub y se cotejó byte a byte con los 15 versículos del corpus.
- `ARTSCROLL_126_REVISION.json` y `ARTSCROLL_137_REVISION.json` aprobados; `REVISION_ESTADO.json` actualizado; `tehilim.json` anota FINAL sin alterar su texto; las seis exportaciones generales se sincronizaron; `COTEJO_126_137_20261011.md` contiene informe final y los textos por pasuk.
- Fonética histórica específica **137:3 divré** se mantiene, a diferencia de **7:1 diveré**.
- La CI global del generador sigue fallando en **fixtures históricos 2:3 y posiblemente más**; se corrigió la entrada antigua 2:2 sin tocar el máster. No confundir esa deuda de pruebas generales con el **PASS 126/137**.
- Las notas de continuidad anteriores que expresan "7/150" o "126/137 NO FINAL" son HISTÓRICAS y quedan reemplazadas por este encabezado. **No volver a abrir los dos capítulos salvo evidencia concreta de error.**

## Actualización editorial · 11/10/2026 (confirmaciones y Tehilim 126/137)

- **CIERRE 9:21:** שִׁיתָה SIN meteg, fonética **Shitá** (milrá, Radak). הֵֽמָּה CON meteg en ה, fonética **hema** (HE-ma; tilde española innecesaria). Ambas decisiones dadas por el usuario y guardadas en corpus/generador.
- **CIERRE 10:3:** בֵּרֵךְ sin meteg, conservar berej.
- **CIERRE 11:3:** פָּעָל sin meteg, conservar pa'al.
- **12:2 y 20:10:** הוֹשִֽׁיעָה → **Hoshí'a / hoshí'a**; salida del generador corregida, corpus y exportaciones sincronizados.
- **126 y 137:** segundas revisiones ArtScroll PDF de 09/10 preservadas, 11+19 meteg previos, shevá na registrado; nombres editoriales יְיָ normalizados en 126:1–4 y 137:4,7. Ninguna fonética previa modificada en estos 15 pasukim.
- **Prueba real exitosa** en el generador: 126 = 6/6, 137 = 9/9 pesukim completos, también Unicode NFD. Confirmadas también 9:21, 12:2, 20:10 y 7:1 diveré frente a 137:3 divré: https://github.com/judaicadesign/fonetica-hebreo/actions/runs/38116804259
- Informe permanente palabra por palabra: [COTEJO_126_137_20261011.md](COTEJO_126_137_20261011.md). Dudas 9:21, 10:3 y 11:3 de la entrada anterior **resueltas: NO REPREGUNTAR**.
- **Aprobación:** todavía 7/150 FINAL; 8–12, 126 y 137 continúan EN REVISIÓN por falta de aprobación editorial integral. La imagen del PDF 126/137 no pudo renderizarse de nuevo desde Biblioteca en este chat; no fingir nuevo cotejo visual.
- GitHub Pages del generador desplegó; CI completa todavía FALLA por fixture histórico 2:2 (`Yityatsevú / nosedú`) en vez del máster aprobado (`Yitiatsevú / nósedu`). No cambiar jamás el máster para satisfacer ese fixture.

## Continuidad verificada · 2026-10-11 (chat normal)

- Conservados 7/150 FINAL (salmos 1–7). `REVISION_ESTADO.json` intacto; 8–12 siguen SIN FINAL.
- Capturas ArtScroll recuperadas y abiertas desde Biblioteca: 8 = IMG_1466; 9 = IMG_1467–1468; 10 = IMG_1469–1470; 11 = IMG_1471; 12 = IMG_1472 (65 versículos con cobertura visual).
- En `tehilim.json` y tres exportaciones generales de **hebreo**: normalización editorial del Nombre (24 versículos) y corrección **8:6 מְּעַט → מְעַט**; ningún aprobado 1–7 modificado.
- Auditoría automática REAL en generador contra los 65 versículos de 8–12: **0 diferencias** respecto de la fonética provisional guardada. Ejecutada en https://github.com/judaicadesign/fonetica-hebreo/actions/runs/38115902015 ; esto NO certifica pronunciación ArtScroll.
- Generador 7:1 דִּבְרֵי: prueba **diveré** PASÓ sin cambiar la forma histórica 137:3 divré.
- Protección anti-sobreescritura añadida a `scripts/build-tehilim.mjs`. Toda regeneración que difiera del corpus existente se bloquea para conciliación editorial; no eliminar ese seguro.
- Cuatro dudas de marcas pequeñas: 9:21 שִׁיתָה; 9:21 הֵמָּה; 10:3 בֵּרֵךְ; 11:3 פָּעָל. Preguntas con entorno, salida actual de motor y fuente en `ARTSCROLL_008-012_AVANCE_20261011.json`.
- CI completa del generador aún roja por test HISTÓRICO de 2:2 que espera la fonética antigua; el máster FINAL 2:2 **no** debe cambiarse para satisfacer ese fixture.
- Pendiente: cotejo exhaustivo de puntuación, marcas y acentos en 8–12, más aprobación independiente de hebreo y fonética; solo entonces publicar FINAL.

# Continuar la revisión de Tehilim

## Cierre 3–7 · 10 de octubre de 2026

- **Tehilim 1–7: hebreo FINAL + fonética FINAL**, 7 de 150 capítulos aprobados. Cada uno tiene exportación individual de corrido y por pasuk, y ficha `ARTSCROLL_00N_REVISION.json`.
- **Tehilim 3:** 9 pesukim, 14 meteg, 3 rayitas explícitas; `רַבּוּ` (3:2) sin meteg. Puntuación de ArtScroll sincronizada. El motor difiere solamente en mayúsculas editoriales de 3:9.
- **Tehilim 4:** 9 pesukim, 13 meteg, 3 rayitas; se mantiene ausencia de rayita en las ב de 4:5.
- **Tehilim 5:** 13 pesukim, 22 meteg, 6 rayitas; `וַאֲצַפֶּה` (5:4) y `לְפָנַי` (5:9) sin meteg, confirmados. Los pasek verticales son signos de la edición y no se añaden como sílabas.
- **Tehilim 6:** 11 pesukim, **21 meteg**, incluido `לַֽיְלָה` (6:7), primera ל, confirmado por el usuario; 5 rayitas. Fonética "layla".
- **Tehilim 7:** 18 pesukim, 19 meteg, 4 rayitas; `וָאֲחַלְּצָה` (7:5) y `וַאֲזַמְּרָה` (7:18) sin meteg, confirmados. El motor da `divré` para 7:1 `דִּבְרֵי` después de la puntuación, pero **la fonética MASTER es `diveré`** por shevá na explícito sobre ב. Registrado como pendiente independiente de motor en Supabase.
- Capturas recuperadas de la Biblioteca: `IMG_1459.png`, `IMG_1460.png`, `IMG_1462.png`, `IMG_1463.png`, `IMG_1464.png`, `IMG_1465.png`. No volver a pedirlas.
- Regeneración adaptada: `scripts/build-tehilim.mjs` preserva fichas FINAL 003–007 además de 001–002 y aplica `יְיָ` a todos los aprobados. No ejecutar una regeneración sin validar las pruebas de regresión.
- **Próximo salmo: Tehilim 8.** Para preguntas, siempre presentar pasuk, palabra anterior, consultada, siguiente y fonética que arroja el generador; usar etiquetas Antes/Corregido, nunca flechas bidi.
- Los másters Hebrew y fonética se aprueban independientemente del motor. El español se revisará en otra fase.

## Regla editorial del Nombre · 9 de octubre de 2026

- **Norma obligatoria Judaica Design (de producción):** en el hebreo de todos los Tehilim representar el Nombre exclusivamente como `יְיָ`; su fonética es siempre `Ad-nai`.
- Esta convención editorial se aplica a las salidas de producción aun si la captura de ArtScroll utiliza otra representación del Nombre; para las demás letras, nikud, dagesh, meteg y rayitas de shevá na, ArtScroll sigue siendo el golden master.
- **Estado de propagación:** capítulos 1 y 2 ya usan `יְיָ` en el texto canónico y las cuatro exportaciones finales de cada salmo; quedan pendientes los capítulos 8–150 y la revisión de las reglas de regeneración. No modificar otras marcas por esta sustitución.

Actualizado: 9 de octubre de 2026.

Base de texto: Wikisource. ArtScroll es la referencia visual para nikud, dagesh, meteg y las rayitas de shevá na. No agregar marcas por inferencia. Un palito vertical debajo y un guion horizontal arriba son datos distintos; los asteriscos no son meteg.

## Tehilim 3–7 cerrados · 10 de octubre de 2026

- **Siete salmos FINAL acumulados: Tehilim 1–7.** Salmos 3–7: hebreo y fonética aprobados por cotejo visual de ArtScroll (capturas `IMG_1459.png`, `IMG_1460.png`, `IMG_1462.png`, `IMG_1463.png`, y para Salmo 7 `IMG_1464.png` + `IMG_1465.png`). Son **60 pesukim** adicionales: 9 + 9 + 13 + 11 + 18.
- Documentos de aprobación: `ARTSCROLL_003_REVISION.json` a `ARTSCROLL_007_REVISION.json`; los 20 TXT finales individuales existen (hebreo/fonética × continuo/numerado) y fueron verificados contra los 60 registros canónicos.
- Confirmaciones del usuario: **3:2 רַבּוּ** sin meteg; **5:4 וַאֲצַפֶּה** sin meteg; **5:9 לְפָנַי** sin meteg; **6:7 לַֽיְלָה** con meteg en primera ל; **7:5 וָאֲחַלְּצָה** y **7:18 וַאֲזַמְּרָה** sin meteg. Estas seis dudas están resueltas: NO volver a preguntar.
- El motor se corrige aparte del máster: **7:1 דִּבְרֵי** debe producir `diveré` en vez de `divré` (shevá na marcado); **3:9** tiene una diferencia de mayúsculas en `'Amejá Virjateja`. Ambas incidencias figuran en Supabase `jd_fonetica_diferencias` como pendientes. No modificar los másters FINAL para acomodarlos al generador.
- **Formato obligatorio de próximas consultas:** pasuk, palabra anterior + palabra consultada + palabra siguiente (hebreo), fonética ACTUAL exacta que arroja el motor y pregunta sobre meteg, shevá na o nikud. Nunca presentar flechas entre variantes en hebreo, por problemas de direccionalidad; usar rótulos «Antes» y «Corregido».
- ArtScroll sigue siendo la referencia editorial y **יְיָ / Ad-nai** la norma JD. El español se deja para su fase editorial posterior.
- Atención: el informe `REVISION_003-007_PENDIENTES.md` contiene dudas históricas ya cerradas; su encabezado actualizado prevalece sobre las preguntas antiguas.

## Salmo 1 cerrado · 9 de octubre de 2026

- Hebreo FINAL: seis pesukim cotejados palabra por palabra con `sources/ARTSCROLL_001.png` (la captura original `IMG_1457.png`). ArtScroll es el golden master; sus diferencias prevalecen sobre Wikisource.
- Diez meteg confirmados. Rayitas de shevá na confirmadas en ר de הָרְשָׁעִים y ד de תִּדְּפֶֽנּוּ, ambas en 1:4. Los shevot iniciales se leen na sin exigir rayita; los asteriscos no son meteg.
- El nikud de las palabras coincide con la base; la captura tiene el Nombre sin nikud; en la producción JD, יְיָ. Se reproduce también la puntuación de ArtScroll.
- Fonética FINAL: cotejada independientemente antes de ejecutar el motor. Se usa acentuación española, sin tildes redundantes.
- Generador publicado: coincide exactamente en los seis pesukim y el capítulo de corrido. No hizo falta cambiar sus reglas.
- Registro íntegro: `ARTSCROLL_001_REVISION.json`. Estado de ambos idiomas: aprobado/final en `REVISION_ESTADO.json` y `tehilim.json`.
- Descargas específicas: `TEHILIM_001_HEBREO_FINAL_{continuous,numbered}.txt` y `TEHILIM_001_FONETICA_FINAL_{continuous,numbered}.txt`. Los TXT generales contienen también la versión final del Salmo 1; el resto del corpus conserva su estado de revisión.
- Método para continuar: cerrar primero hebreo contra ArtScroll; después fonética independiente; finalmente comprobar el generador contra ese master.

## Salmo 2 cerrado · 9 de octubre de 2026

- ArtScroll `IMG_1458.png`: hebreo y fonética FINAL, 12 pesukim, 21 meteg. Rayitas de shevá na registradas aparte; sin meteg en 2:12 אַפּוֹ.
- Confirmados: 2:2 נֽוֹסְדוּ (nósedu), יִתְיַצְּבוּ (yitiatsevú); 2:3 מוֹסְרוֹתֵֽימוֹ (moserotémo), נְנַתְּקָה (nenateká); 2:10 שֹֽׁפְטֵי (shófete), הִוָּסְרוּ (hivaserú); 2:11 וְגִֽילוּ; 2:12 נַשְּׁקוּ, וְתֹֽאבְדוּ (vetóvedu).
- Norma de escritura del Nombre ya aplicada a los salmos 1 y 2: יְיָ → Ad-nai. Pendiente de propagación y revisión contextual en los otros salmos.
- Registro completo: `ARTSCROLL_002_REVISION.json`; cuatro `TEHILIM_002_*_FINAL_*.txt`, sin alterar la disposición de corrido / numerado.
- Generador `f8915d0fc181a4df517c2a2cf925bfebb0590b3d`: 12/12 coinciden; regresión Salmo 1: 6/6.

## Trabajo de la tanda 17–20

- Se cotejaron las capturas del final de 17, todo 18, todo 19 y la repetición de 20. También las repeticiones de 15–17.
- Registro de 69 pesukim: 105 apariciones de meteg, 41 registros de shevá na; cambios efectivos en el hebreo de 55 pesukim y la fonética de 44.
- Se actualizaron el JSON canónico y los TXT de hebreo y fonética, de corrido y con pasuk. Informe con antes/después: `REVISION_APP_017-020.html`.
- 365 contextos revisados coinciden entre motor y máster. Esto prueba coherencia y regresiones; no aprueba visualmente los otros salmos ni demuestra por sí solo que cada palabra sea correcta.
- La cobertura de capturas de 17–20 está completa. La aprobación editorial integral sigue abierta y está diferenciada de la incorporación de las marcas.
- **20:3: עֶזְרְךָ → ’ezrejá.** El usuario rectificó la lectura anterior `עֶזְרֶֽךָ`; esa lectura se descartó, se retiró su supuesto meteg y se conserva el nikud correcto. No volver a cambiarlo por la misma imagen.
- Shevá na confirmada no debe borrar un acento final explícito del resultado previo; existe una prueba independiente de esa interacción.

## Pendientes concretos del lote anterior

Consultar `ARTSCROLL_APP_TANDA_009-017.json`: siguen abiertos 10:3 בֵּרֵךְ, 11:3 פָּעָל, 14:3 עֹשֵׂה y 9:21 שִׁיתָה / הֵמָּה. El antiguo pendiente de 17:14–15 ya se resolvió.

## Enlaces

- Sistema y másters: https://judaicadesign.github.io/judaica-design-system/
- Informe: https://judaicadesign.github.io/judaica-design-system/masters/tehilim/REVISION_APP_017-020.html
- Hebreo canónico: https://judaicadesign.github.io/judaica-design-system/masters/tehilim/TEHILIM_001-150_HEBREO_EN_REVISION.txt
- Fonética canónica: https://judaicadesign.github.io/judaica-design-system/masters/tehilim/TEHILIM_001-150_FONETICA_EN_REVISION.txt
- Motor: https://judaicadesign.github.io/fonetica-hebreo/

En Chat, el análisis y las capturas pueden continuar, pero editar y publicar el generador requiere acceso efectivo al repositorio. No afirmar que un cambio está implementado sin comprobar archivos y publicación.

## Lote ArtScroll 14/10/2026 · salmos 11, 14, 16, 63, 76, 83, 84 y 130 (FINAL)

- Hebreo reconstruido desde las capturas de ArtScroll: nikud, dagesh, rafé (U+05BF) sobre cada consonante con shevá na confirmado, meteg, paseq (׀) y puntuación; donde ArtScroll imprime el Nombre se escribe `יְיָ` / `לַיְיָ` (fonética `Ad-nai`).
- Fonética generada por reglas con `fonetica-hebreo` commit `063b125`; no hay excepciones por palabra. Nueva regla: ו con jolam tras consonante con vocal plena o jatáf es consonántica (`עֲוֹנוֹתָיו` = 'avonot).
- Estos salmos pasaron directo a FINAL por decisión editorial del dueño del proyecto; solo se consultan las dudas reales, en lista.
- Registros: `ARTSCROLL_011/014/016/063/076/083/084/130_REVISION.json` (con `previousHebrew` de Wikisource, para que `scripts/build-tehilim.mjs` los reaplique), `REVISION_ESTADO.json` y 32 `TEHILIM_NNN_*_FINAL_*.txt`.
- El 14 se rehízo (ya era FINAL): ahora incluye rafé y los `יי` normalizados.
- FINAL totales: 1–7, 11, 14, 16, 63, 76, 83, 84, 126, 130, 137 (17 de 150).
- El paseq no aparece en la fonética (pendiente de decidir).
