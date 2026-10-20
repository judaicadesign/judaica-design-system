#!/usr/bin/env python3
"""JD · Cotejo de un trabajo (IDML o TXT) contra un máster (TXT).

Uso:
    python3 jd_cotejar.py MASTER.txt TRABAJO.idml [--historia u1803] [--out informe.md]

- Del IDML toma solo el texto que está DENTRO de la hoja (descarta la mesa de trabajo).
- Compara palabra por palabra con nikud completo.
- Rafé (U+05BF) y meteg (U+05BD) se cuentan aparte para que no tapen las diferencias de texto.
- No decide nada: lista diferencias para que el titular las clasifique
  (corregir / decisión ya tomada / presentación).
"""
import argparse
import difflib
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jd_revisar_texto as jr  # noqa: E402

RAFE, METEG, MAQAF = "ֿ", "ֽ", "־"


def tokens(t):
    t = unicodedata.normalize("NFC", t).replace(MAQAF, f" {MAQAF} ")
    return re.findall(r"[֑-ֽֿ-ׇא-ת]+|[^\s֑-ׇא-ת]", t)


def sin(w, cs):
    return "".join(c for c in w if c not in cs)


def leer_trabajo(path, historia=None):
    if path.lower().endswith(".idml"):
        lin, _ = jr.leer_idml(path)
        lin = [(ub, l) for ub, l in lin if not ub.startswith("pág. FUERA")]
        if historia:
            lin = [(ub, l) for ub, l in lin if f"· {historia} ·" in ub]
        return "\n".join(l for _, l in lin)
    return open(path, encoding="utf-8-sig").read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("master")
    ap.add_argument("trabajo")
    ap.add_argument("--historia", help="ID de historia del IDML (ej. u1803); por defecto, todo lo que está en la hoja")
    ap.add_argument("--out")
    a = ap.parse_args()

    master = open(a.master, encoding="utf-8-sig").read()
    master = "\n".join(l for l in master.split("\n") if not l.startswith("#"))
    trabajo = leer_trabajo(a.trabajo, a.historia)
    M, T = tokens(master), tokens(trabajo)
    clave = lambda w: sin(w, RAFE + METEG)

    out = [f"# Cotejo · {os.path.basename(a.trabajo)} vs {os.path.basename(a.master)}", ""]
    out.append("| Marca | Máster | Trabajo |")
    out.append("|---|---:|---:|")
    out.append(f"| Rafé (shevá na) | {master.count(RAFE)} | {trabajo.count(RAFE)} |")
    out.append(f"| Meteg | {master.count(METEG)} | {trabajo.count(METEG)} |")
    out.append("")

    sm = difflib.SequenceMatcher(None, [clave(w) for w in M], [clave(w) for w in T], autojunk=False)
    metegs = []
    difs = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for x, y in zip(M[i1:i2], T[j1:j2]):
                if sin(x, RAFE) != sin(y, RAFE):
                    metegs.append((sin(x, RAFE), sin(y, RAFE)))
            continue
        ctx = " ".join(clave(w) for w in M[max(0, i1 - 4):i1])
        difs.append((op, ctx, " ".join(clave(w) for w in M[i1:i2]), " ".join(clave(w) for w in T[j1:j2])))

    out.append(f"## Meteg en distinta posición (palabras iguales): {len(metegs)}")
    for x, y in metegs:
        out.append(f"- máster ‎{x}‎ · trabajo ‎{y}‎")
    out.append("")
    nombres = {"replace": "cambia", "delete": "falta en el trabajo", "insert": "agregado en el trabajo"}
    out.append(f"## Diferencias de texto (sin contar rafé ni meteg): {len(difs)}")
    out.append("")
    out.append("| # | Tipo | Contexto (máster) | Máster | Trabajo |")
    out.append("|---|---|---|---|---|")
    for n, (op, ctx, x, y) in enumerate(difs, 1):
        recorta = lambda s: (s[:220] + "…") if len(s) > 220 else s
        out.append(f"| {n} | {nombres[op]} | ‎…{ctx}‎ | ‎{recorta(x)}‎ | ‎{recorta(y)}‎ |")
    out.append("")
    out.append("_Clasificar cada diferencia: corregir · decisión ya tomada (citar nota) · presentación (rúbricas, separadores, orden aprobado) · sección no requerida en este producto._")
    texto = "\n".join(out)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(texto)
    else:
        print(texto)


if __name__ == "__main__":
    main()
