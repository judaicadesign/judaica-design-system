#!/usr/bin/env python3
"""JD · Compara dos versiones de un mismo trabajo (IDML), solo lo que está dentro de la hoja.

Uso:
    python3 jd_comparar_versiones.py ANTERIOR.idml NUEVO.idml [--out cambios.md]

Lista cada cambio carácter por carácter (con códigos Unicode), para confirmar que una
corrección hizo lo esperado y nada más.
"""
import argparse
import difflib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jd_revisar_texto as jr  # noqa: E402


def en_hoja(path):
    lin, _ = jr.leer_idml(path)
    return {ub: l for ub, l in lin if not ub.startswith("pág. FUERA")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("anterior")
    ap.add_argument("nuevo")
    ap.add_argument("--out")
    a = ap.parse_args()
    A, B = en_hoja(a.anterior), en_hoja(a.nuevo)
    out = [f"# Cambios · {os.path.basename(a.anterior)} → {os.path.basename(a.nuevo)}", "",
           f"Párrafos en la hoja: {len(A)} → {len(B)}", ""]
    n = 0
    for k in sorted(set(A) | set(B)):
        x, y = A.get(k, ""), B.get(k, "")
        if x == y:
            continue
        if k not in A or k not in B:
            n += 1
            out.append(f"- {k}: párrafo {'nuevo' if k not in A else 'eliminado'}: ‎{(y or x)[:80]}‎")
            continue
        sm = difflib.SequenceMatcher(None, x, y, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == "equal":
                continue
            n += 1
            cod = lambda s: " ".join(f"U+{ord(c):04X}" for c in s) or "—"
            out.append(f"- {k}: {cod(x[i1:i2])} → {cod(y[j1:j2])} · ‎{x[max(0, i1 - 6):i2 + 4]}‎ → ‎{y[max(0, j1 - 6):j2 + 4]}‎")
    out.insert(3, f"Cambios: {n}")
    texto = "\n".join(out)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(texto)
    else:
        print(texto)


if __name__ == "__main__":
    main()
