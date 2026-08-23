"""Live end-to-end file upload test via HTTP multipart."""
import urllib.request, json, os

def upload_file(filepath, filename, mime="application/octet-stream"):
    with open(filepath, "rb") as f:
        data = f.read()
    boundary = b"----FormBoundary7MA4YWxkTrZu0gW"
    body = (
        b"--" + boundary +
        b"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" +
        filename.encode() +
        b"\"\r\nContent-Type: " + mime.encode() +
        b"\r\n\r\n" + data +
        b"\r\n--" + boundary + b"--\r\n"
    )
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/ai/intake/file",
        data=body,
        headers={"Content-Type": "multipart/form-data; boundary=----FormBoundary7MA4YWxkTrZu0gW"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

BASE = r"C:\Users\cuk18\.gemini\antigravity\scratch\pharma-qms-complaints\backend\samples"

tests = [
    ("demo_amoxicillin.txt",  "text/plain"),
    ("demo_amoxicillin.pdf",  "application/pdf"),
    ("demo_amoxicillin.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ("demo_amoxicillin.eml",  "message/rfc822"),
]

print("=" * 75)
print(f"{'File':<30}  {'Product':<26}  {'Batch':<14}  {'Severity':<8}  {'Fallback'}")
print("=" * 75)

all_ok = True
for fname, mime in tests:
    path = os.path.join(BASE, fname)
    try:
        res = upload_file(path, fname, mime)
        a = res["analysis"]
        ef = a.get("extracted_fields", {})
        product = (ef.get("product_name") or "?")[:25]
        batch   = ef.get("batch_number") or "?"
        sev     = a.get("suggested_severity") or "?"
        fb      = str(a.get("is_fallback_used", "?"))
        assert res.get("source_type") == "file", "Missing source_type"
        assert ef.get("product_name") or ef.get("batch_number"), "No fields extracted"
        print(f"{fname:<30}  {product:<26}  {batch:<14}  {sev:<8}  {fb}")
    except AssertionError as e:
        print(f"{fname:<30}  ASSERTION ERROR: {e}")
        all_ok = False
    except Exception as e:
        print(f"{fname:<30}  ERROR: {e}")
        all_ok = False

print("=" * 75)
if all_ok:
    print("ALL 4 FILE FORMAT TESTS PASSED")
else:
    print("SOME TESTS FAILED")
    raise SystemExit(1)
