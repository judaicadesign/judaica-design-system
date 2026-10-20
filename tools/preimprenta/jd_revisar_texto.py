#!/usr/bin/env python3
"""JD · Revisión preimprenta — Fase 1: nikud, ortografía mecánica y tipografía.

Uso:
    python3 jd_revisar_texto.py ARCHIVO.idml|.pdf|.txt [más archivos] [--out informe.md] [--csv hallazgos.csv]

No corrige nada: solo informa. Cada hallazgo tiene gravedad:
    ERROR    casi seguro un error (regla mecánica)
    REVISAR  probable error; puede ser legítimo (lo decide una persona)
    AVISO    no es error de texto, pero puede afectar la impresión o la extracción
"""
import argparse
import csv
import re
import sys
import unicodedata
from dataclasses import dataclass

# ---------------------------------------------------------------- Unicode
LETTERS = set(chr(c) for c in range(0x05D0, 0x05EB))
FINALS = set("ךםןףץ")
NONFINAL_OF = {"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"}
FINAL_OF = {v: k for k, v in NONFINAL_OF.items()}
VOWELS = set(chr(c) for c in range(0x05B0, 0x05BC)) | {"ׇ"}  # shevá … kubuts, kamats katán
SHEVA = chr(0x05B0)
DAGESH, METEG, RAFE = "ּ", "ֽ", "ֿ"
SHIN_DOT, SIN_DOT = "ׁ", "ׂ"
HOLAM_HASER_VAV = "ֺ"
KAMATS_KATAN = "ׇ"
TEAMIM = set(chr(c) for c in range(0x0591, 0x05B0))
POINTS = VOWELS | {DAGESH, METEG, RAFE, SHIN_DOT, SIN_DOT, "ׄ", "ׅ"} | TEAMIM
MAQAF, SOF_PASUK, PASEQ = "־", "׃", "׀"
GERESH, GERSHAYIM = "׳", "״"
NAMES = {
    "ְ": "shevá", "ֱ": "jataf segol", "ֲ": "jataf pataj", "ֳ": "jataf kamats",
    "ִ": "jirik", "ֵ": "tsere", "ֶ": "segol", "ַ": "pataj", "ָ": "kamats",
    "ֹ": "jolam", "ֺ": "jolam jaser", "ֻ": "kubuts", DAGESH: "dagesh", METEG: "meteg",
    RAFE: "rafé", SHIN_DOT: "punto de shin", SIN_DOT: "punto de sin", KAMATS_KATAN: "kamats katán",
}
INVISIBLES = {
    "​": "espacio de ancho cero", "‌": "ZWNJ", "‍": "ZWJ", "‎": "marca LTR",
    "‏": "marca RTL", "‪": "control bidi", "‫": "control bidi", "‬": "control bidi",
    "‭": "control bidi", "‮": "control bidi", "﻿": "BOM", "­": "guion suave",
    "\t": "tabulación",
}


def is_heb_letter(ch):
    return ch in LETTERS


def strip_marks(s):
    return "".join(c for c in s if c not in POINTS)


def has_nikud(word):
    return any(c in VOWELS or c == DAGESH for c in word)


@dataclass
class Hallazgo:
    archivo: str
    ubicacion: str
    gravedad: str
    regla: str
    detalle: str
    contexto: str


# ---------------------------------------------------------------- lectura
def leer_pdf(path):
    import pymupdf
    doc = pymupdf.open(path)
    out = []
    for i, page in enumerate(doc, 1):
        texto = page.get_text("text")
        for j, linea in enumerate(texto.splitlines(), 1):
            out.append((f"p.{i} l.{j}", linea))
    return out


def leer_txt(path):
    with open(path, encoding="utf-8-sig") as f:
        return [(f"l.{j}", linea.rstrip("\n").rstrip("\r")) for j, linea in enumerate(f, 1)]


def leer_idml(path):
    """Lee el texto exacto de InDesign (Archivo > Guardar como > IDML).
    Devuelve párrafos con ubicación «página · historia · párrafo» y avisos de escala H/V."""
    import zipfile, xml.etree.ElementTree as ET
    z = zipfile.ZipFile(path)
    nombres = z.namelist()
    # página de cada historia según la geometría: marco que se superpone con una página.
    # Lo que no toca ninguna página está en la mesa de trabajo y no se imprime.
    def mat(t):
        return [float(x) for x in (t or "1 0 0 1 0 0").split()]

    def comp(m, n):  # aplica m y después n
        a, b, c, d, e, f = m
        A, B, C, D, E, F = n
        return [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F]

    def ap(m, x, y):
        return m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]

    def caja(pts):
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return min(xs), min(ys), max(xs), max(ys)

    area_de = {}  # story -> {página: área}
    for sp in sorted(n for n in nombres if n.startswith("Spreads/")):
        root = ET.fromstring(z.read(sp))
        paginas = []
        for pg in root.iter("Page"):
            y1, x1, y2, x2 = [float(v) for v in pg.get("GeometricBounds").split()]
            m = mat(pg.get("ItemTransform"))
            paginas.append((pg.get("Name"), caja([ap(m, x1, y1), ap(m, x2, y2)])))

        def recorrer(el, m):
            for ch in el:
                tag = ch.tag.split("}")[-1]
                if tag in ("Page",):
                    continue
                mm = comp(mat(ch.get("ItemTransform")), m) if ch.get("ItemTransform") else m
                if tag == "TextFrame":
                    anc = [tuple(float(v) for v in pp.get("Anchor").split()) for pp in ch.iter("PathPointType")]
                    if anc:
                        bx = caja([ap(mm, x, y) for x, y in anc])
                        for nombre, pb in paginas:
                            w = min(bx[2], pb[2]) - max(bx[0], pb[0])
                            h = min(bx[3], pb[3]) - max(bx[1], pb[1])
                            if w > 0.5 and h > 0.5:
                                d = area_de.setdefault(ch.get("ParentStory"), {})
                                d[nombre] = d.get(nombre, 0) + w * h
                        area_de.setdefault(ch.get("ParentStory"), {})
                elif tag in ("Group", "Spread"):
                    recorrer(ch, mm)
        recorrer(root, [1, 0, 0, 1, 0, 0])
    pagina_de = {st: (max(d, key=d.get) if d else "FUERA") for st, d in area_de.items()}

    # orden de historias según designmap
    dm = z.read("designmap.xml").decode("utf-8")
    orden = re.findall(r'src="(Stories/Story_[^"]+\.xml)"', dm) or sorted(n for n in nombres if n.startswith("Stories/"))
    out, escalas, vistos_esc = [], [], {}
    for sname in orden:
        root = ET.fromstring(z.read(sname))
        story = root.find("Story")
        sid = story.get("Self") if story is not None else sname
        pag = pagina_de.get(sid, "?")
        npar, buf = 1, []
        for psr in root.iter("ParagraphStyleRange"):
            for csr in psr.iter("CharacterStyleRange"):
                h = float(csr.get("HorizontalScale") or psr.get("HorizontalScale") or 100)
                v = float(csr.get("VerticalScale") or psr.get("VerticalScale") or 100)
                if abs(h - v) > 0.01:
                    txt = "".join(e.text or "" for e in csr if e.tag.split("}")[-1] == "Content").strip()
                    clave = (f"pág. {pag} · {sid}", f"H {h:g} % · V {v:g} %")
                    if clave not in vistos_esc:
                        vistos_esc[clave] = []
                        escalas.append((clave[0], clave[1], vistos_esc[clave]))
                    if txt:
                        vistos_esc[clave].append(txt)
                for el in csr:
                    tag = el.tag.split("}")[-1]
                    if tag == "Content":
                        buf.append(el.text or "")
                    elif tag == "Br":
                        out.append((f"pág. {pag} · {sid} · ¶{npar}", "".join(buf)))
                        npar += 1
                        buf = []
        if buf:
            out.append((f"pág. {pag} · {sid} · ¶{npar}", "".join(buf)))
    # escalas definidas en los estilos (solo si deforman: H ≠ V)
    if "Resources/Styles.xml" in nombres:
        root = ET.fromstring(z.read("Resources/Styles.xml"))
        for st in root.iter():
            if st.tag.split("}")[-1] in ("ParagraphStyle", "CharacterStyle"):
                h, v = st.get("HorizontalScale"), st.get("VerticalScale")
                if (h or v) and abs(float(h or 100) - float(v or 100)) > 0.01:
                    escalas.append((f"estilo {st.get('Name')}", f"H {float(h or 100):g} % · V {float(v or 100):g} %", []))
    return out, escalas


def tiene_nikud_linea(l):
    return any(c in VOWELS or c == DAGESH for c in l)


def orden_visual_sospechado(lineas):
    """Si la extracción del PDF salió en orden visual (invertida), muchas palabras
    empiezan con letra final. En ese caso el resto del informe no es confiable."""
    total = inicio_final = 0
    for _, l in lineas:
        for w in re.findall(r"[א-ת][֑-ׇא-ת]*", l):
            base = strip_marks(w)
            if len(base) >= 3:
                total += 1
                inicio_final += base[0] in FINALS
    return total > 30 and inicio_final / total > 0.15


# ---------------------------------------------------------------- reglas
def contexto(linea, i, ancho=18):
    a, b = max(0, i - ancho), min(len(linea), i + ancho)
    return linea[a:b].replace("\t", "⇥")


def revisar_linea(archivo, ub, raw, H):
    linea = unicodedata.normalize("NFC", raw)  # descompone formas de presentación (שּׁ etc.)

    def add(grav, regla, det, pos):
        H.append(Hallazgo(archivo, ub, grav, regla, det, contexto(linea, pos)))

    # --- caracteres invisibles / ajenos
    for i, ch in enumerate(linea):
        if ch in INVISIBLES:
            add("AVISO", "carácter invisible", INVISIBLES[ch], i)
    for m in re.finditer(r"[יִ-ﭏ]", raw):
        H.append(Hallazgo(archivo, ub, "AVISO", "forma de presentación",
                          f"U+{ord(m.group()):04X} (letra+marca precompuesta; revisar fuente)", contexto(raw, m.start())))

    # --- nikud por grupo letra+marcas
    i, n = 0, len(linea)
    while i < n:
        ch = linea[i]
        if ch in POINTS:
            # marca sin letra base
            prev = linea[i - 1] if i else ""
            if not is_heb_letter(prev) and prev not in POINTS:
                add("ERROR", "marca sin letra", f"{NAMES.get(ch, 'marca U+%04X' % ord(ch))} suelta", i)
            i += 1
            continue
        if not is_heb_letter(ch):
            i += 1
            continue
        j = i + 1
        while j < n and linea[j] in POINTS:
            j += 1
        marcas = linea[i + 1:j]
        nombres = [NAMES.get(m, "U+%04X" % ord(m)) for m in marcas]
        # duplicadas
        vistos = set()
        for m in marcas:
            if m in vistos and m not in TEAMIM:
                add("ERROR", "marca duplicada", f"{NAMES.get(m, m)} dos veces sobre {ch}", i)
            vistos.add(m)
        vocs = [m for m in marcas if m in VOWELS]
        holam_como_sin = (ch == "ש" and "\u05B9" in marcas and SHIN_DOT not in marcas and SIN_DOT not in marcas)
        if holam_como_sin:
            add("ERROR", "jolam usado como punto de sin",
                "ש con jolam U+05B9 en lugar de punto de sin U+05C2: puede verse bien, pero está mal codificado", i)
            vocs = [v for v in vocs if v != "\u05B9"]
        if len(set(vocs)) > 1:
            add("ERROR", "dos vocales en una letra", f"{ch}: " + " + ".join(NAMES[v] for v in vocs), i)
        if (SHIN_DOT in marcas or SIN_DOT in marcas) and ch != "ש":
            add("ERROR", "punto de shin/sin fuera de ש", f"sobre {ch}", i)
        if SHIN_DOT in marcas and SIN_DOT in marcas:
            add("ERROR", "shin y sin a la vez", "", i)
        if DAGESH in marcas and RAFE in marcas and SHEVA not in marcas:
            # con shevá es la marca de shevá na (regla rafé/meteg 13/10); sin shevá, dudoso
            add("REVISAR", "dagesh y rafé sin shevá", f"sobre {ch}", i)
        if DAGESH in marcas and ch in "אעח":
            add("REVISAR", "dagesh en gutural", f"{ch} con dagesh", i)
        if HOLAM_HASER_VAV in marcas and ch != "ו":
            add("REVISAR", "jolam jaser fuera de ו", f"sobre {ch}", i)
        if KAMATS_KATAN in marcas:
            add("AVISO", "kamats katán U+05C7",
                "InDesign puede no mostrarlo (Decisión E-16): verificar en el PDF", i)
        i = j

    # --- palabras hebreas
    tokens = list(re.finditer(r"[א-ת֑-ֽֿ-ׇ]+", linea))  # el maqaf separa palabras
    for k, t in enumerate(tokens):
        w = t.group()
        base = strip_marks(w).replace(MAQAF, "")
        nxt = linea[t.end():t.end() + 1]
        if not base:
            continue
        # letra final en medio de palabra
        for p, c in enumerate(base[:-1]):
            if c in FINALS:
                add("ERROR", "letra final en medio de palabra", f"{c} en «{strip_marks(w)}»", t.start())
                break
        # letra no final al final de palabra (no abreviaturas ni números)
        last = base[-1]
        if (last in FINAL_OF and len(base) > 1 and nxt not in ("'", '"', GERESH, GERSHAYIM, "׳", "״")):
            add("REVISAR", "falta letra final", f"«{strip_marks(w)}» termina en {last} (¿{FINAL_OF[last]}?)", t.start())
        # ש sin punto en palabra vocalizada
        if has_nikud(w):
            for p, c in enumerate(w):
                if c == "ש":
                    q = p + 1
                    ms = ""
                    while q < len(w) and w[q] in POINTS:
                        ms += w[q]
                        q += 1
                    if SHIN_DOT not in ms and SIN_DOT not in ms and "\u05B9" not in ms:
                        add("REVISAR", "ש sin punto", f"en «{w}»", t.start())
                        break
        # palabra sin nikud aislada entre palabras vocalizadas
        if (not has_nikud(w) and len(base) > 1 and base not in ("יהוה", "יי") and 0 < k < len(tokens) - 1
                and has_nikud(tokens[k - 1].group()) and has_nikud(tokens[k + 1].group())
                and linea[tokens[k - 1].end():t.start()] == " " and linea[t.end():tokens[k + 1].start()] == " "):
            # solo si está entre espacios simples: las rúbricas llevan «:», «–», «(»
            add("REVISAR", "palabra sin nikud", f"«{w}» entre palabras vocalizadas", t.start())
        # letras latinas pegadas a hebreo
    for m in re.finditer(r"[א-ת][֑-ׇ]*[A-Za-zЀ-ӿ]|[A-Za-zЀ-ӿ][א-ת]", linea):
        add("ERROR", "letra latina/cirílica pegada al hebreo", repr(m.group()), m.start())

    # --- palabras repetidas (con nikud idéntico)
    for m in re.finditer(r"(?<![\w֑-ת])([\w֑-ת'\-]{2,})\s+\1(?![\w֑-ת])", linea):
        add("REVISAR", "palabra repetida", f"«{m.group(1)}» dos veces seguidas (puede ser legítimo)", m.start())

    # --- tipografía
    reglas = [
        (r" {2,}", "ERROR", "doble espacio", lambda m: f"{len(m.group())} espacios"),
        (r"\s+[,.;:!?)׃]", "ERROR", "espacio antes de signo", lambda m: f"antes de «{m.group().strip()}»"),
        (r"[,;](?=[^\s\d\"'”»)\]\-–—,;.])", "ERROR", "falta espacio después de coma / punto y coma",
         lambda m: f"«{m.group()}» pegado"),
        (r"(?<!\d)[:](?=[^\s\d\"'”»)\]])", "ERROR", "falta espacio después de dos puntos", lambda m: "«:» pegado"),
        (r"(?<=[א-ת֑-ׇa-záéíóúñ])\.(?=[א-תA-Za-zÁÉÍÓÚáéíóúÑñ])", "ERROR",
         "falta espacio después de punto", lambda m: "«.» pegado"),
        (r"\(\s", "ERROR", "espacio después de «(»", lambda m: ""),
        (r"(?<=[\wא-ת֑-ׇ])\(", "REVISAR", "falta espacio antes de «(»", lambda m: ""),
        (r"\s־|־\s", "ERROR", "maqaf con espacio", lambda m: "el maqaf va pegado a ambas palabras"),
        (r"(?<=[א-ת֑-ׇ])-(?=[א-ת])", "REVISAR", "guion común entre palabras hebreas",
         lambda m: "¿maqaf ־ ?"),
        (r",,|\.\.(?!\.)|,\.|\.,|;;|::", "ERROR", "signo duplicado", lambda m: f"«{m.group()}»"),
        (r"(?<=[א-ת֑-ׇ])[\"'](?=[א-ת])", "AVISO", "comilla recta en abreviatura hebrea",
         lambda m: "¿geresh ׳ / gershayim ״?"),
        (r"(?<=[\u05D0-\u05EA\u0591-\u05C7])''(?=[\u05D0-\u05EA])", "AVISO", "dos apóstrofos como gershayim",
         lambda m: "¿gershayim ״?"),
        (r"\b[a-záéíóú]d-?nai\b", "REVISAR", "Ad-nai en minúscula", lambda m: "mayúscula reverencial"),
        (r"[.!?]\s+[a-záéíóúñ]", "REVISAR", "minúscula después de punto", lambda m: ""),
    ]
    for pat, grav, regla, det in reglas:
        for m in re.finditer(pat, linea):
            add(grav, regla, det(m), m.start())
    if linea != linea.rstrip(" ") and linea.strip():
        add("AVISO", "espacio al final de línea", "", len(linea) - 1)


# ---------------------------------------------------------------- informe
ORDEN = {"ERROR": 0, "REVISAR": 1, "AVISO": 2}


def revisar_archivo(path):
    H = []
    low = path.lower()
    if low.endswith(".idml"):
        todas, escalas_todas = leer_idml(path)
        lineas = [(ub, l) for ub, l in todas if not ub.startswith("pág. FUERA")]
        escalas = [e for e in escalas_todas if not e[0].startswith("pág. FUERA")]
        fuera = len(todas) - len(lineas)
        if fuera:
            H.append(Hallazgo(path, "-", "AVISO", "texto fuera de la hoja no revisado",
                              f"{fuera} párrafos en la mesa de trabajo (no se imprimen)", ""))
        for ub, det, textos in escalas:
            H.append(Hallazgo(path, ub, "REVISAR", "letra deformada (escala H ≠ V)", det,
                              " ".join(textos)[:40] if isinstance(textos, list) else textos))
    elif low.endswith(".pdf"):
        todas = leer_pdf(path)
        lineas = []
        for ub, l in todas:
            if tiene_nikud_linea(l):
                continue
            # bidi: el signo final de una línea hebrea sale al principio en la extracción
            m = re.match(r"^([.:,;!?\u05C3]+)(?=.*[\u05D0-\u05EA])(.*)$", l)
            lineas.append((ub, m.group(2) + m.group(1) if m else l))
        omitidas = len(todas) - len(lineas)
        if omitidas:
            H.append(Hallazgo(path, "-", "AVISO", "hebreo con nikud no revisado en PDF",
                              f"{omitidas} líneas con nikud omitidas: el texto extraído de un PDF no conserva "
                              "el orden de las marcas. Revisarlas desde el IDML.", ""))
        if orden_visual_sospechado(lineas):
            H.append(Hallazgo(path, "-", "AVISO", "extracción invertida",
                              "El PDF parece extraerse en orden visual: revisar desde el IDML.", ""))
    else:
        lineas = leer_txt(path)
    for ub, l in lineas:
        revisar_linea(path, ub, l, H)
    revisar_rayas(path, lineas, H)
    return H


def revisar_rayas(path, lineas, H):
    """Las rayas se controlan por coherencia: se informa el estilo minoritario del archivo."""
    from collections import Counter
    nombres = {("", " "): "pegada a la izquierda (texto– texto)", (" ", ""): "pegada a la derecha (texto –texto)",
               (" ", " "): "con espacios (texto – texto)", ("", ""): "sin espacios (texto–texto)"}
    estilos = []
    for ub, l in lineas:
        for m in re.finditer(r"( ?)[–—]( ?)", l):
            if m.start() == 0 or m.end() == len(l):
                continue
            estilos.append((ub, nombres[(m.group(1), m.group(2))], contexto(l, m.start())))
    if not estilos:
        return
    mayor, n = Counter(e for _, e, _ in estilos).most_common(1)[0]
    for ub, est, ctx in estilos:
        if est != mayor:
            H.append(Hallazgo(path, ub, "REVISAR", "raya distinta al estilo del archivo",
                              f"{est}; predomina {mayor} ({n} de {len(estilos)})", ctx))


def informe_md(todos, archivos):
    out = ["# Revisión preimprenta · nikud, ortografía mecánica y tipografía", ""]
    for a in archivos:
        hs = [h for h in todos if h.archivo == a]
        cuenta = {g: sum(h.gravedad == g for h in hs) for g in ORDEN}
        out.append(f"## {a.split('/')[-1]}")
        out.append(f"ERROR {cuenta['ERROR']} · REVISAR {cuenta['REVISAR']} · AVISO {cuenta['AVISO']}")
        out.append("")
        if not hs:
            out.append("Sin hallazgos.\n")
            continue
        out.append("| Gravedad | Dónde | Regla | Detalle | Contexto |")
        out.append("|---|---|---|---|---|")
        for h in sorted(hs, key=lambda h: (ORDEN[h.gravedad], h.regla)):
            ctx = h.contexto.replace("|", "¦")
            out.append(f"| {h.gravedad} | {h.ubicacion} | {h.regla} | {h.detalle} | ‎{ctx}‎ |")
        out.append("")
    out.append("_Este control no certifica el texto: no compara contra el máster ni contra ArtScroll._")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("archivos", nargs="+")
    ap.add_argument("--out")
    ap.add_argument("--csv")
    a = ap.parse_args()
    todos = []
    for p in a.archivos:
        todos += revisar_archivo(p)
    md = informe_md(todos, a.archivos)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(md)
    else:
        print(md)
    if a.csv:
        with open(a.csv, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["archivo", "ubicación", "gravedad", "regla", "detalle", "contexto"])
            for h in todos:
                w.writerow([h.archivo.split("/")[-1], h.ubicacion, h.gravedad, h.regla, h.detalle, h.contexto])
    sys.exit(1 if any(h.gravedad == "ERROR" for h in todos) else 0)


if __name__ == "__main__":
    main()
