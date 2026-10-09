# Continuar la revisión de Tehilim

## Regla editorial del Nombre · 9 de octubre de 2026

- **Norma obligatoria Judaica Design (de producción):** en el hebreo de todos los Tehilim representar el Nombre exclusivamente como `יְיָ`; su fonética es siempre `Ad-nai`.
- Esta convención editorial se aplica a las salidas de producción aun si la captura de ArtScroll utiliza otra representación del Nombre; para las demás letras, nikud, dagesh, meteg y rayitas de shevá na, ArtScroll sigue siendo el golden master.
- **Pendiente de propagación:** actualizar el Salmo 1 ya aprobado y todo el corpus de 150 salmos, las exportaciones hebreas y las reglas de regeneración; comprobar el resultado antes de afirmar que los archivos publicados cumplen esta norma. No modificar ni reinterpretar otras marcas por esta sustitución.

Actualizado: 9 de octubre de 2026.

Base de texto: Wikisource. ArtScroll es la referencia visual para nikud, dagesh, meteg y las rayitas de shevá na. No agregar marcas por inferencia. Un palito vertical debajo y un guion horizontal arriba son datos distintos; los asteriscos no son meteg.

## Salmo 1 cerrado · 9 de octubre de 2026

- Hebreo FINAL: seis pesukim cotejados palabra por palabra con `sources/ARTSCROLL_001.png` (la captura original `IMG_1457.png`). ArtScroll es el golden master; sus diferencias prevalecen sobre Wikisource.
- Diez meteg confirmados. Rayitas de shevá na confirmadas en ר de הָרְשָׁעִים y ד de תִּדְּפֶֽנּוּ, ambas en 1:4. Los shevot iniciales se leen na sin exigir rayita; los asteriscos no son meteg.
- El nikud de las palabras coincide con la base; el Nombre se deja sin nikud, יהוה, como en la captura. Se reproduce también la puntuación de ArtScroll.
- Fonética FINAL: cotejada independientemente antes de ejecutar el motor. Se usa acentuación española, sin tildes redundantes.
- Generador publicado: coincide exactamente en los seis pesukim y el capítulo de corrido. No hizo falta cambiar sus reglas.
- Registro íntegro: `ARTSCROLL_001_REVISION.json`. Estado de ambos idiomas: aprobado/final en `REVISION_ESTADO.json` y `tehilim.json`.
- Descargas específicas: `TEHILIM_001_HEBREO_FINAL_{continuous,numbered}.txt` y `TEHILIM_001_FONETICA_FINAL_{continuous,numbered}.txt`. Los TXT generales contienen también la versión final del Salmo 1; el resto del corpus conserva su estado de revisión.
- Método para continuar: cerrar primero hebreo contra ArtScroll; después fonética independiente; finalmente comprobar el generador contra ese master.

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
