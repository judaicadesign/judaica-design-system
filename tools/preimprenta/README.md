# Revisión preimprenta JD

Herramientas para revisar Birkonim (y cualquier pieza con hebreo) antes de imprenta.
**No modifican ningún archivo**: solo informan. Las decisiones las toma el titular.

## Regla principal: revisar el IDML, no el PDF
El texto que se extrae de un PDF **no conserva el nikud**: separa las marcas de sus letras, duplica letras y cambia el orden. Para el hebreo con nikud la fuente confiable es el InDesign exportado como **IDML** (Archivo › Guardar como › IDML).
Del IDML se revisa **solo lo que está dentro de la hoja**: los marcos de la mesa de trabajo se descartan, calculando la posición de cada marco.

## Herramientas
| Archivo | Qué hace |
|---|---|
| `jd_revisar_texto.py` | Nikud, ortografía mecánica y tipografía. Entrada: `.idml`, `.pdf` (solo líneas sin nikud) o `.txt`. Gravedades: ERROR / REVISAR / AVISO. |
| `jd_cotejar.py` | Compara el trabajo contra un máster `.txt`, palabra por palabra con nikud completo. Rafé y meteg se cuentan aparte. |
| `jd_comparar_versiones.py` | Compara dos IDML del mismo trabajo, carácter por carácter, para confirmar que una corrección hizo lo esperado y nada más. |
| `JD_jolam_a_punto_de_sin.jsx` | Script de InDesign: cambia el jolam (U+05B9) usado como punto de sin por el punto de sin (U+05C2), solo en la historia seleccionada. Se deshace con un Cmd/Ctrl+Z. |

## Uso
```
pip install pymupdf            # solo si se revisan PDF
python3 jd_revisar_texto.py TRABAJO.idml --out revision.md
python3 jd_cotejar.py MASTER.txt TRABAJO.idml [--historia u1803] --out cotejo.md
python3 jd_comparar_versiones.py ANTERIOR.idml NUEVO.idml --out cambios.md
```
El máster se exporta de Supabase (`app_state` › `jd_master_cells` › «Contenido||Nusaj||Hebreo» › `body`) a un `.txt`. Siempre se coteja contra el máster **vigente**, no contra copias.

## Reglas que aplica `jd_revisar_texto.py`
- **ERROR:**
  - Marca sin letra.
  - Marca duplicada (doble dagesh o doble jolam).
  - Dos vocales en una letra.
  - Jolam usado como punto de sin.
  - Punto de shin o de sin fuera de ש.
  - Letra final en medio de palabra (el maqaf separa palabras).
  - Letra latina pegada al hebreo.
  - Doble espacio.
  - Espacio antes de un signo.
  - Falta de espacio después de coma, punto y coma, dos puntos o punto.
  - Maqaf con espacios.
  - Signos duplicados.
- **REVISAR:**
  - Falta de letra final.
  - ש sin punto en una palabra vocalizada.
  - Palabra sin nikud entre palabras vocalizadas.
  - Dagesh en gutural.
  - Dagesh + rafé sin shevá (con shevá es la marca de shevá na: no es error).
  - Palabra repetida.
  - Raya distinta al estilo predominante del archivo.
  - Ad-nai en minúscula.
  - Minúscula después de punto.
  - Letra deformada (escala horizontal ≠ vertical, en el IDML).
- **AVISO:**
  - Kamats katán U+05C7.
  - Caracteres invisibles.
  - Formas precompuestas.
  - Dos apóstrofos usados como gershayim.
  - Espacio al final del párrafo.

## Pruebas
```
python3 jd_revisar_texto.py pruebas/prueba_errores.txt    # debe dar ERROR 19
python3 jd_revisar_texto.py pruebas/prueba_errores.idml   # ERROR 19 y un marco fuera de la hoja ignorado
```

## Límites conocidos
- No verifica cómo se **ve** el nikud impreso (fuente, posición del dagesh): eso requiere mirar el PDF.
- No compara el PDF enviado a imprenta contra el IDML revisado.
- No controla cantidades ni defectos físicos de la tirada: eso es la recepción de imprenta.
- El texto del pliego y del máster puede diferir por presentación (rúbricas, corchetes, orden aprobado). `jd_cotejar.py` lista las diferencias; clasificarlas es tarea editorial.
