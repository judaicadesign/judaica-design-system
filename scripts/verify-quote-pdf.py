"""Check an exported client quote: vector text/graphics, A4 and original image ratio.
Usage: python scripts/verify-quote-pdf.py path/to/export.pdf [expected_pages]
"""
import sys
import math
import fitz

path = sys.argv[1]
document = fitz.open(path)
if len(sys.argv) > 2:
    assert len(document) == int(sys.argv[2]), 'Unexpected page count'
for number, page in enumerate(document, 1):
    assert math.isclose(page.rect.width, 595.2756, abs_tol=.01)
    assert math.isclose(page.rect.height, 841.8898, abs_tol=.01)
    text = page.get_text()
    assert len(text) > 100, 'The page is a screenshot; text is not selectable'
    assert 'Ganancia bruta' not in text, 'Internal profit must not appear in the client quote'
    assert len(page.get_images()) <= 1, 'Logo/icons must be vectors; only the mockup may be a bitmap'
    assert len(page.get_drawings()) > 20, 'Expected vector logo, icons and master geometry'
    for image in page.get_image_info():
        box = fitz.Rect(image['bbox'])
        assert math.isclose(box.width / box.height, image['width'] / image['height'], rel_tol=1e-5), 'Stretched mockup'
    print(f'Page {number}: A4, selectable text, vector graphics, original mockup aspect ratio')
