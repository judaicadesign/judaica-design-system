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
