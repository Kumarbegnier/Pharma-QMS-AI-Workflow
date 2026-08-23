"""
Generate demo complaint files for manual UI testing.
Run from: backend/
  python tools/generate_demo_files.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from tests.fixtures import make_pdf_bytes, make_docx_bytes, make_eml_bytes, make_txt_bytes

SAMPLES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples")
os.makedirs(SAMPLES_DIR, exist_ok=True)

files = {
    "demo_amoxicillin.pdf":  make_pdf_bytes(),
    "demo_amoxicillin.docx": make_docx_bytes(),
    "demo_amoxicillin.eml":  make_eml_bytes(),
    "demo_amoxicillin.txt":  make_txt_bytes(),
}

for name, data in files.items():
    path = os.path.join(SAMPLES_DIR, name)
    with open(path, "wb") as f:
        f.write(data)
    print(f"Created: {path} ({len(data):,} bytes)")

print("\nDone! Upload any of these files to the UI to test file intake.")
