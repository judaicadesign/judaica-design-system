"""Independent raster/text validation of the fixtures from pdf-print.cjs."""
import sys
from pathlib import Path
import fitz

folder = Path(sys.argv[1])
expected = [[1, 8], [7, 2], [3, 6], [5, 4]]
for i, page in enumerate(fitz.open(folder / 'booklet.pdf')):
    blocks = page.get_text('blocks')
    sources = sorted((b[0], b[4].strip()) for b in blocks if b[4].strip().startswith('SOURCE'))
    assert [int(t.split()[1]) for x, t in sources] == expected[i], sources
    assert all(b[0] >= 0 and b[2] <= page.rect.width + 1 for b in blocks)
    page.get_pixmap().save(folder / f'booklet-{i + 1}.png')

prepared = fitz.open(folder / 'prepared.pdf')
for i, page in enumerate(prepared):
    numbers = [w for w in page.get_text('words') if w[4].isdigit() and w[1] > page.rect.height - 65]
    if 1 <= i <= 6:
        assert len(numbers) == 1, (i, numbers)
        assert numbers[0][4] == str(i)
        assert (numbers[0][0] < page.rect.width / 2) == ((i + 1) % 2 == 1), (i, numbers)
    else:
        assert not numbers, (i, numbers)
pix = prepared[0].get_pixmap()
mm = 72 / 25.4
assert pix.pixel(round(20 * mm), round(8 * mm))[:3] == (255, 255, 255)
assert pix.pixel(round(20 * mm), round(12 * mm))[:3] != (255, 255, 255)
blank = fitz.open(folder / 'blank-booklet.pdf')
assert 'SOURCE 1' in blank[0].get_text() and 'SOURCE 6' not in blank[0].get_text()
assert 'SOURCE 2' in blank[1].get_text()
print('PASS rendered PDF: RTL placement, page numbers, blank padding and cut/bleed geometry; text remains extractable.')

preserved = fitz.open(folder / 'preserved.pdf')
assert prepared[0].get_pixmap().samples == preserved[0].get_pixmap().samples
folded = fitz.open(folder / 'folded.pdf')
for i, page in enumerate(folded):
    guides = [d for d in page.get_drawings() if d['type'] == 's' and d['dashes'] != '[] 0']
    xs = sorted(set(round(d['rect'].x0 / mm - 7, 2) for d in guides))
    assert xs == ([99, 200] if i == 0 else [101, 202]), xs
    page.get_pixmap().save(folder / f'folded-{i + 1}.png')
print('PASS preserved marks and reflected three-panel fold guides.')
