"""
ICH Q9-inspired deterministic risk engine.
Evaluates complaint severity and risk level from extracted complaint data.
Provides justification text for QMS audit trail.
"""

from typing import Tuple


# ── Keyword Banks ──────────────────────────────────────────────────────────────

CRITICAL_KEYWORDS = [
    "death", "died", "fatal", "hospitalized", "hospitalised", "anaphylaxis",
    "anaphylactic", "seizure", "convulsion", "unconscious", "icu",
    "sterility failure", "sterile", "contamination", "contaminated",
    "foreign matter", "glass particle", "glass fragment", "metal particle",
    "fungal", "mold", "mould", "microbial", "microbiological failure",
    "subpotent", "superpotent", "wrong dose", "wrong strength",
    "wrong product", "product mix-up", "recall", "quarantine",
    "black particle", "particulate matter", "visible particle"
]

MAJOR_KEYWORDS = [
    "discolor", "discolour", "discolored", "discoloured", "discolouration",
    "discoloration", "black spot", "brown spot", "yellow spot",
    "chipped", "chipping", "crumbled", "crumbling", "cracked",
    "broken tablet", "broken capsule", "incomplete tablet",
    "seal broken", "seal compromised", "missing foil", "foil damage",
    "leaking", "leaked", "blister damage", "packaging defect",
    "label mismatch", "label error", "wrong label",
    "clumped", "caking", "agglomeration",
    "turbid", "turbidity", "precipitate", "precipitation",
    "odour", "odor", "foul smell", "unusual smell",
    "degradation", "degraded", "expired",
    "insufficient quantity", "short fill",
]

MINOR_KEYWORDS = [
    "label", "barcode", "printing error", "typo",
    "cosmetic", "aesthetic", "appearance", "colour variation",
    "slight", "minor", "insignificant"
]


def evaluate_ich_q9_risk(
    complaint: dict,
) -> Tuple[str, str, bool, str]:
    """
    ICH Q9-based risk assessment.
    
    Args:
        complaint: dict with keys: complaint_category, complaint_description, 
                   product_name, patient_safety_indicators (optional)
    
    Returns:
        Tuple of (severity, risk_level, patient_safety_impact, justification)
    """
    category = (complaint.get("complaint_category") or "").lower()
    description = (complaint.get("complaint_description") or "").lower()
    product = (complaint.get("product_name") or "").lower()
    patient_safety = complaint.get("patient_safety_indicators", False)

    combined_text = f"{category} {description} {product}"

    # ── Evaluate critical keywords ────────────────────────────────────────────
    matched_critical = [kw for kw in CRITICAL_KEYWORDS if kw in combined_text]
    matched_major = [kw for kw in MAJOR_KEYWORDS if kw in combined_text]
    matched_minor = [kw for kw in MINOR_KEYWORDS if kw in combined_text]

    # ── Determine severity ────────────────────────────────────────────────────
    if matched_critical:
        severity = "Critical"
        risk_level = "High"
        patient_safety_impact = True
        justification = (
            f"Critical severity assigned per ICH Q9. "
            f"Indicators found: {', '.join(matched_critical[:3])}. "
            f"Immediate quarantine and regulatory reporting required."
        )

    elif matched_major:
        severity = "Major"
        risk_level = "Medium"
        patient_safety_impact = bool(patient_safety)
        justification = (
            f"Major severity assigned per ICH Q9. "
            f"Quality defect indicators: {', '.join(matched_major[:3])}. "
            f"QA investigation and root cause analysis required."
        )

    elif matched_minor:
        severity = "Minor"
        risk_level = "Low"
        patient_safety_impact = False
        justification = (
            f"Minor severity assigned per ICH Q9. "
            f"Cosmetic/labeling concern only. "
            f"Standard QA review process applicable."
        )

    else:
        # Default: assess by category
        if "contamination" in category or "adverse" in category:
            severity = "Critical"
            risk_level = "High"
            patient_safety_impact = True
            justification = (
                f"Category '{complaint.get('complaint_category')}' indicates potential patient safety concern. "
                f"Assigned Critical severity per ICH Q9 precautionary principle."
            )
        elif "packaging" in category or "quality" in category or "defect" in category:
            severity = "Major"
            risk_level = "Medium"
            patient_safety_impact = False
            justification = (
                f"Category '{complaint.get('complaint_category')}' indicates product quality defect. "
                f"Major severity assigned pending further investigation."
            )
        else:
            severity = "Minor"
            risk_level = "Low"
            patient_safety_impact = False
            justification = (
                f"Insufficient evidence for higher severity classification. "
                f"Minor severity assigned as default. "
                f"Escalate if additional information confirms patient exposure."
            )

    return severity, risk_level, patient_safety_impact, justification
