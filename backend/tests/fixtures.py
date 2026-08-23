"""
Test fixture generator: creates sample complaint files (PDF, DOCX, TXT, EML)
for use in automated tests.
"""

import io


COMPLAINT_TEXT = (
    "Date: August 12, 2026\n"
    "From: Apollo Pharmacy, Central Branch\n"
    "Subject: Product Quality Complaint - Amoxicillin Capsules\n\n"
    "Product Name: Amoxicillin Capsules 500 mg\n"
    "Batch / Lot Number: AMX240602\n"
    "Manufacturing Date: March 2026\n"
    "Expiry Date: February 2028\n"
    "Affected Quantity: 12 capsules\n\n"
    "Complaint Description:\n"
    "Upon unpacking the delivery, our pharmacist observed that approximately 12 capsules "
    "in a sealed bottle exhibited unusual brown discoloration. The capsule shells appeared "
    "darkened. Product has been quarantined pending investigation.\n\n"
    "Reporter: Ms. Priya Mehta, Head Pharmacist\n"
    "Contact: priya.mehta@apollopharmacy.in\n"
    "Customer Type: Pharmacy\n"
)


def make_txt_bytes() -> bytes:
    return COMPLAINT_TEXT.encode("utf-8")


def make_pdf_bytes() -> bytes:
    """Create a minimal, valid, text-based PDF containing the complaint text."""
    # Build a minimal PDF manually — no external library needed for test fixture.
    # This is a real text-based PDF with embedded text stream.
    lines = COMPLAINT_TEXT.replace("(", r"\(").replace(")", r"\)").split("\n")
    # Build page content stream
    text_ops = []
    y = 750
    for line in lines:
        text_ops.append(f"BT /F1 10 Tf 50 {y} Td ({line}) Tj ET")
        y -= 14
    stream_content = "\n".join(text_ops)
    stream_bytes = stream_content.encode("latin-1")
    stream_len = len(stream_bytes)

    objects = {}

    # Object 1: Catalog
    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"

    # Object 2: Pages
    objects[2] = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"

    # Object 3: Page
    objects[3] = b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"

    # Object 4: Content stream
    objects[4] = (
        f"<< /Length {stream_len} >>\nstream\n".encode()
        + stream_bytes
        + b"\nendstream"
    )

    # Object 5: Font
    objects[5] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    # Build PDF
    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n")

    offsets = {}
    for obj_num, obj_data in objects.items():
        offsets[obj_num] = buf.tell()
        buf.write(f"{obj_num} 0 obj\n".encode())
        buf.write(obj_data)
        buf.write(b"\nendobj\n")

    xref_offset = buf.tell()
    buf.write(b"xref\n")
    buf.write(f"0 {len(objects) + 1}\n".encode())
    buf.write(b"0000000000 65535 f \n")
    for obj_num in sorted(objects.keys()):
        buf.write(f"{offsets[obj_num]:010d} 00000 n \n".encode())

    buf.write(b"trailer\n")
    buf.write(f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode())
    buf.write(b"startxref\n")
    buf.write(f"{xref_offset}\n".encode())
    buf.write(b"%%EOF\n")

    return buf.getvalue()


def make_docx_bytes() -> bytes:
    """Create a real DOCX file using python-docx."""
    from docx import Document  # type: ignore
    doc = Document()
    doc.add_heading("Customer Complaint Report", level=1)
    for line in COMPLAINT_TEXT.split("\n"):
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def make_eml_bytes() -> bytes:
    content = (
        "From: priya.mehta@apollopharmacy.in\n"
        "To: qms@pharma.com\n"
        "Date: Mon, 12 Aug 2026 10:30:00 +0530\n"
        "Subject: Product Quality Complaint - Amoxicillin Capsules 500mg Batch AMX240602\n"
        "MIME-Version: 1.0\n"
        "Content-Type: text/plain; charset=utf-8\n\n"
        + COMPLAINT_TEXT
    )
    return content.encode("utf-8")
