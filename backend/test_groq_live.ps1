$body = @{
    text_content = "Date: August 12, 2026. Apollo Pharmacy reported that approximately 12 capsules of Amoxicillin 500mg capsules from batch AMX240602 (Mfg: March 2026, Exp: February 2028) showed unusual brown discoloration. Reporter: Ms. Priya Mehta, priya.mehta@apollopharmacy.in. The seal was intact. Product quarantined. Pharmacy customer type."
    file_name = "test_complaint.txt"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri http://127.0.0.1:8000/api/ai/intake/text -Method POST -Body $body -ContentType "application/json"

Write-Output "=== GROQ AI EXTRACTION RESULT ==="
$f = $response.analysis.extracted_fields
Write-Output ("Product Name    : " + $f.product_name)
Write-Output ("Batch Number    : " + $f.batch_number)
Write-Output ("Strength/Grade  : " + $f.strength_or_grade)
Write-Output ("Customer Name   : " + $f.customer_name)
Write-Output ("Reporter        : " + $f.reporter_contact)
Write-Output ("Category        : " + $f.complaint_category)
Write-Output ("Product Type    : " + $f.product_type)
Write-Output "---"
Write-Output ("Severity        : " + $response.analysis.suggested_severity)
Write-Output ("Risk Level      : " + $response.analysis.suggested_risk)
Write-Output ("Completeness    : " + $response.analysis.completeness_score)
Write-Output ("Model Used      : " + $response.analysis.model_name)
Write-Output ("Fallback Used   : " + $response.analysis.is_fallback_used)
Write-Output ("Duplicates Found: " + $response.duplicates.Count)
Write-Output "---"
Write-Output ("Summary         : " + $response.analysis.complaint_summary)
