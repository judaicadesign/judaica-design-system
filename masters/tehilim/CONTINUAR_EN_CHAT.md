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
