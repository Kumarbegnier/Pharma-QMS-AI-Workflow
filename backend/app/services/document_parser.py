"""
Document parsing service for pharma QMS complaint intake.

Supported formats:
  PDF   — pypdf text extraction (text-based PDFs)
  DOCX  — python-docx paragraph + table extraction
  TXT   — UTF-8 / latin-1 plain text
  EML   — RFC-2822 email: Subject + From + Body (plain > html)
  MD    — Markdown plain text (treated as TXT)
  CSV   — Comma-separated (joined as readable lines)

Security:
  - In-memory processing only; no disk writes.
  - Filename sanitised; not used as filesystem path.
  - Max file size enforced at caller (API layer): 10 MB.
  - File content is never executed.
"""

from __future__ import annotations

import csv
import email
import email.policy
import io
import re
from html.parser import HTMLParser
from typing import Optional

# ── Constants ──────────────────────────────────────────────────────────────────

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx", ".eml", ".md", ".csv"}

SUPPORTED_MIMES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "message/rfc822",
    "text/csv",
    "text/markdown",
}

MIN_TEXT_LENGTH = 30  # reject trivially short extracted text


# ── Public API ─────────────────────────────────────────────────────────────────

class DocumentParseError(ValueError):
    """Raised when a file cannot be parsed into usable complaint text."""


def parse_document_bytes(
    content: bytes,
    filename: str = "document.txt",
    content_type: Optional[str] = None,
) -> str:
    """
    Extract readable complaint text from uploaded file bytes.

    Returns clean, normalised text ready for the LangGraph pipeline.
    Raises DocumentParseError with a user-friendly message on failure.
    """
    if not content:
        raise DocumentParseError(
            "The uploaded file is empty. Please upload a file containing complaint text."
        )

    if len(content) > MAX_FILE_BYTES:
        raise DocumentParseError(
            f"File exceeds the 10 MB size limit ({len(content) // 1024 // 1024} MB uploaded)."
        )

    ext = _get_extension(filename)

    if ext not in SUPPORTED_EXTENSIONS:
        raise DocumentParseError(
            f"Unsupported file type '{ext or filename}'. "
            "Please upload a PDF, DOCX, TXT, or EML file."
        )

    # Dispatch to format-specific extractor
    if ext == ".pdf":
        raw = extract_text_from_pdf(content)
    elif ext == ".docx":
        raw = extract_text_from_docx(content)
    elif ext == ".eml":
        raw = extract_text_from_eml(content)
    elif ext == ".csv":
        raw = extract_text_from_csv(content)
    else:  # .txt / .md
        raw = extract_text_from_txt(content)

    cleaned = clean_extracted_text(raw)

    if len(cleaned) < MIN_TEXT_LENGTH:
        raise DocumentParseError(
            "No usable complaint text could be extracted from this file. "
            "Please verify the file contains readable text."
        )

    return cleaned


# ── Format Extractors ──────────────────────────────────────────────────────────

def extract_text_from_pdf(content: bytes) -> str:
    """
    Extract text from a text-based PDF using pypdf.
    Does NOT perform OCR — scanned-image PDFs will produce an empty result.
    """
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        raise DocumentParseError(
            "pypdf is not installed. Run: pip install pypdf"
        )

    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as e:
        raise DocumentParseError(f"Could not open PDF: {e}")

    if len(reader.pages) == 0:
        raise DocumentParseError("PDF has no pages.")

    parts: list[str] = []
    for page_num, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
            if page_text.strip():
                parts.append(page_text)
        except Exception:
            pass  # Skip unreadable pages

    if not parts:
        raise DocumentParseError(
            "No machine-readable text was found in this PDF. "
            "Please upload a text-based PDF or paste the complaint text directly."
        )

    return "\n\n".join(parts)


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    try:
        from docx import Document  # type: ignore
    except ImportError:
        raise DocumentParseError(
            "python-docx is not installed. Run: pip install python-docx"
        )

    try:
        doc = Document(io.BytesIO(content))
    except Exception as e:
        raise DocumentParseError(f"Could not open DOCX file: {e}")

    parts: list[str] = []

    # Extract paragraphs
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            parts.append(text)

    # Extract table content
    for table in doc.tables:
        for row in table.rows:
            row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_cells:
                parts.append(" | ".join(row_cells))

    if not parts:
        raise DocumentParseError(
            "No text content found in the DOCX file. "
            "Please ensure the document contains readable paragraphs."
        )

    return "\n".join(parts)


def extract_text_from_txt(content: bytes) -> str:
    """Decode a plain-text (or Markdown) file."""
    for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            return content.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    # Last resort
    return content.decode("ascii", errors="replace")


def extract_text_from_eml(content: bytes) -> str:
    """
    Parse an RFC-2822 .eml file and extract relevant complaint content:
      Subject, From, Date, and best available body (plain text > HTML).
    """
    try:
        msg = email.message_from_bytes(content, policy=email.policy.default)
    except Exception as e:
        raise DocumentParseError(f"Could not parse EML file: {e}")

    parts: list[str] = []

    # Headers of interest
    for header in ("From", "To", "Date", "Subject"):
        val = msg.get(header, "").strip()
        if val:
            parts.append(f"{header}: {val}")

    if parts:
        parts.append("")  # blank line separator

    # Body extraction — prefer plain text
    plain_body: str = ""
    html_body: str = ""

    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if "attachment" in disposition:
                continue
            if ctype == "text/plain" and not plain_body:
                try:
                    plain_body = part.get_payload(decode=True).decode(
                        part.get_content_charset("utf-8"), errors="replace"
                    )
                except Exception:
                    pass
            elif ctype == "text/html" and not html_body:
                try:
                    html_body = part.get_payload(decode=True).decode(
                        part.get_content_charset("utf-8"), errors="replace"
                    )
                except Exception:
                    pass
    else:
        ctype = msg.get_content_type()
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset("utf-8")
            body_text = payload.decode(charset, errors="replace") if payload else ""
        except Exception:
            body_text = ""
        if ctype == "text/html":
            html_body = body_text
        else:
            plain_body = body_text

    # Choose best body
    if plain_body.strip():
        parts.append(plain_body.strip())
    elif html_body.strip():
        parts.append(_html_to_text(html_body))

    result = "\n".join(parts)
    if not result.strip():
        raise DocumentParseError(
            "The EML file appears to have no readable body content."
        )
    return result


def extract_text_from_csv(content: bytes) -> str:
    """Convert CSV rows into a readable complaint narrative."""
    text = extract_text_from_txt(content)
    try:
        reader = csv.DictReader(io.StringIO(text))
        lines: list[str] = []
        for row in reader:
            line_parts = [f"{k}: {v}" for k, v in row.items() if v and v.strip()]
            if line_parts:
                lines.append(", ".join(line_parts))
        if lines:
            return "\n".join(lines)
    except Exception:
        pass
    return text  # fallback: raw text


# ── Helpers ────────────────────────────────────────────────────────────────────

def clean_extracted_text(text: str) -> str:
    """Normalise whitespace in extracted text."""
    if not text:
        return ""
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def _get_extension(filename: str) -> str:
    """Return lowercase file extension including the dot, e.g. '.pdf'."""
    if not filename:
        return ""
    idx = filename.rfind(".")
    if idx == -1:
        return ""
    return filename[idx:].lower()


class _HTMLTextExtractor(HTMLParser):
    """Minimal HTML → plain text converter."""

    SKIP_TAGS = {"script", "style", "head", "meta", "link"}

    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in self.SKIP_TAGS:
            self._skip += 1
        if tag in ("br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4"):
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS:
            self._skip = max(0, self._skip - 1)

    def handle_data(self, data: str) -> None:
        if self._skip == 0:
            self._parts.append(data)

    def get_text(self) -> str:
        raw = "".join(self._parts)
        return re.sub(r"\n{3,}", "\n\n", raw).strip()


def _html_to_text(html: str) -> str:
    parser = _HTMLTextExtractor()
    try:
        parser.feed(html)
        return parser.get_text()
    except Exception:
        # Last resort: strip all tags
        return re.sub(r"<[^>]+>", " ", html).strip()
