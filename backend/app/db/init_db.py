"""
Database seeder — populates realistic demo complaints for the QMS.
"""

from datetime import datetime, timedelta
from app.core.database import SessionLocal
from app.models.complaint import Complaint, AuditLog, CapaTask


SEED_COMPLAINTS = [
    # ── FDF Complaints ──────────────────────────────────────────────────────
    {
        "complaint_number": "CMP-2026-0001",
        "source": "Pharmacy",
        "customer_name": "Apollo Pharmacy - Central Branch",
        "customer_type": "Pharmacy",
        "reporter_contact": "priya.mehta@apollopharmacy.in",
        "product_type": "FDF",
        "product_name": "Amoxicillin Capsules",
        "strength_or_grade": "500 mg",
        "batch_number": "AMX240602",
        "affected_quantity": "12 capsules",
        "manufacturing_date": "March 2026",
        "expiry_date": "February 2028",
        "complaint_category": "Product Defect - Discoloration",
        "complaint_description": "Pharmacist observed approximately 12 capsules in a sealed bottle exhibited unusual brown discoloration. Capsule shells appeared darkened compared to standard white/cream color. Affected capsules found in bottle with intact seal. Bottle quarantined and retained for investigation.",
        "originating_site_block": "Manufacturing Block A",
        "impacted_non_product_material": "Primary Packaging (HDPE Bottle)",
        "severity": "Major",
        "risk_level": "Medium",
        "patient_safety_impact": False,
        "initial_risk_assessment": "Major severity per ICH Q9. Discoloration indicates possible degradation. QA investigation required.",
        "suggested_next_action": "Route to QA Investigation. Issue retain sample testing request.",
        "status": "Under Investigation",
        "assigned_investigator": "Dr. Anita Desai",
        "missing_information": [],
        "possible_root_causes": [
            "Inadequate storage conditions during transit.",
            "Chemical degradation due to moisture ingress through packaging.",
            "Cross-contamination with cleaning agent residue on equipment."
        ],
        "recommended_capa": [
            "Quarantine batch AMX240602 and initiate retain sample analysis within 24 hours.",
            "Inspect temperature monitoring in storage and transit areas.",
            "Issue SCAR to packaging supplier if defect confirmed."
        ],
    },
    {
        "complaint_number": "CMP-2026-0002",
        "source": "Hospital",
        "customer_name": "City General Hospital",
        "customer_type": "Hospital",
        "reporter_contact": "dr.rajesh.sharma@cityhospital.org",
        "product_type": "FDF",
        "product_name": "Paracetamol 500mg Tablets",
        "strength_or_grade": "500 mg",
        "batch_number": "PCM260801",
        "affected_quantity": "3 blister strips",
        "manufacturing_date": "August 2026",
        "expiry_date": "July 2028",
        "complaint_category": "Packaging",
        "complaint_description": "Three blister strips from recent delivery showed damaged seals on multiple cavities. Aluminum foil partially peeled at edges of 4-5 tablet cavities per strip. Tablets appear intact. Issue caught during stock verification, no patients affected.",
        "originating_site_block": "Packaging Line 3",
        "impacted_non_product_material": "Primary Packaging (Blister Foil)",
        "severity": "Major",
        "risk_level": "Medium",
        "patient_safety_impact": False,
        "status": "CAPA Pending",
        "assigned_investigator": "Mr. Sanjay Patel",
        "missing_information": [],
        "possible_root_causes": [
            "Heat-sealer temperature drift on Blistering Line #3.",
            "Substandard aluminum foil material.",
            "Handling vibration during transit."
        ],
        "recommended_capa": [
            "Re-calibrate heat-sealer thermal sensors.",
            "Issue SCAR to foil supplier.",
            "Quarantine remaining stock from batch PCM260801."
        ],
    },
    {
        "complaint_number": "CMP-2026-0003",
        "source": "Pharmacy",
        "customer_name": "MedPlus Pharmacy, Pune",
        "customer_type": "Pharmacy",
        "reporter_contact": "store.manager@medplus.in",
        "product_type": "FDF",
        "product_name": "Cetirizine 10mg Tablets",
        "strength_or_grade": "10 mg",
        "batch_number": "CTZ260505",
        "affected_quantity": "1 bottle (100 tablets)",
        "manufacturing_date": "May 2026",
        "expiry_date": "April 2028",
        "complaint_category": "Labeling",
        "complaint_description": "Printed label on bottle shows incorrect expiry date. Label prints 'Exp: April 2025' while the batch was manufactured May 2026. Likely a printing error. No quality defect observed on actual tablets.",
        "severity": "Minor",
        "risk_level": "Low",
        "patient_safety_impact": False,
        "status": "Closed",
        "assigned_investigator": "Ms. Priya Verma",
        "missing_information": [],
        "possible_root_causes": ["Printing system date configuration error.", "Operator data entry mistake during label setup."],
        "recommended_capa": ["Correct label template. Implement double-check on label proof approval."],
    },
    {
        "complaint_number": "CMP-2026-0004",
        "source": "Pharmacy",
        "customer_name": "Apollo Pharmacy - East Branch",
        "customer_type": "Pharmacy",
        "reporter_contact": "east.branch@apollopharmacy.in",
        "product_type": "FDF",
        "product_name": "Amoxicillin Capsules",
        "strength_or_grade": "500 mg",
        "batch_number": "AMX240602",
        "affected_quantity": "8 capsules",
        "manufacturing_date": "March 2026",
        "expiry_date": "February 2028",
        "complaint_category": "Product Defect - Discoloration",
        "complaint_description": "Similar to earlier reported complaint — 8 capsules from same batch showing brown discoloration. Second instance from different branch receiving same batch.",
        "severity": "Major",
        "risk_level": "High",
        "patient_safety_impact": False,
        "status": "Under Investigation",
        "assigned_investigator": "Dr. Anita Desai",
        "missing_information": ["Storage conditions at branch"],
        "possible_root_causes": ["Systemic batch-level degradation.", "Manufacturing temperature excursion."],
        "recommended_capa": ["Extend quarantine to full batch AMX240602.", "Initiate 72-hour stability testing."],
    },

    # ── API Complaints ──────────────────────────────────────────────────────
    {
        "complaint_number": "CMP-2026-0005",
        "source": "Email",
        "customer_name": "Zenith Life Sciences Pvt. Ltd.",
        "customer_type": "Distributor",
        "reporter_contact": "vikram.iyer@zenithlifesciences.com",
        "product_type": "API",
        "product_name": "Metformin Hydrochloride API",
        "strength_or_grade": "IP/BP",
        "batch_number": "MFH260712A",
        "affected_quantity": "25 kg (1 HDPE Drum)",
        "manufacturing_date": "25 June 2026",
        "expiry_date": "Not Provided",
        "complaint_category": "Product Defect - Foreign Matter",
        "complaint_description": "During incoming QC inspection, visible black particulate matter was found embedded within bulk API powder. Foreign matter confirmed in three separate sample pulls. Material appears non-product-related and may indicate environmental contamination or equipment cleaning failure.",
        "originating_site_block": "Manufacturing Block B",
        "impacted_non_product_material": "Primary Container (HDPE Drum)",
        "severity": "Critical",
        "risk_level": "High",
        "patient_safety_impact": True,
        "initial_risk_assessment": "Critical — Foreign matter in API intended for oral formulation. Patient safety concern.",
        "suggested_next_action": "IMMEDIATE: Quarantine all inventory. Notify Regulatory Affairs.",
        "status": "Under Investigation",
        "assigned_investigator": "Dr. Meera Kapoor",
        "missing_information": [],
        "possible_root_causes": [
            "Inadequate equipment cleaning validation.",
            "Environmental monitoring gap in ISO-classified area.",
            "Drum integrity failure during transport."
        ],
        "recommended_capa": [
            "Quarantine batch MFH260712A. Withdraw distributed quantities.",
            "Emergency equipment cleaning verification and swab testing.",
            "Issue SCAR to drum supplier."
        ],
    },
    {
        "complaint_number": "CMP-2026-0006",
        "source": "Email",
        "customer_name": "Pharma Solutions Ltd.",
        "customer_type": "Distributor",
        "reporter_contact": "quality@pharmasolutions.com",
        "product_type": "API",
        "product_name": "Ibuprofen API",
        "strength_or_grade": "BP",
        "batch_number": "IBP260601",
        "affected_quantity": "50 kg (2 Drums)",
        "manufacturing_date": "June 2026",
        "expiry_date": "May 2028",
        "complaint_category": "Product Quality",
        "complaint_description": "API powder shows unusual clumping and caking. Material is not free-flowing as expected. Moisture content appears elevated. Product not yet used in formulation.",
        "severity": "Major",
        "risk_level": "Medium",
        "patient_safety_impact": False,
        "status": "CAPA Pending",
        "assigned_investigator": "Mr. Vikrant Joshi",
        "missing_information": ["Moisture analysis results"],
        "possible_root_causes": ["Inadequate desiccant in packaging.", "Humidity exposure in warehouse."],
        "recommended_capa": ["Test moisture content against specification.", "Review storage conditions and desiccant requirements."],
    },
    {
        "complaint_number": "CMP-2026-0007",
        "source": "Email",
        "customer_name": "BioMed Research Labs",
        "customer_type": "Hospital",
        "reporter_contact": "lab.director@biomedresearch.org",
        "product_type": "API",
        "product_name": "Atorvastatin Calcium API",
        "strength_or_grade": "USP",
        "batch_number": "ATV260415",
        "affected_quantity": "10 kg",
        "manufacturing_date": "April 2026",
        "expiry_date": "March 2028",
        "complaint_category": "Product Quality",
        "complaint_description": "Assay results on incoming analysis showed 96.2% purity against specification of NLT 98.5%. Product does not meet USP monograph requirements.",
        "severity": "Critical",
        "risk_level": "High",
        "patient_safety_impact": True,
        "initial_risk_assessment": "Critical — subpotent API. Finished dosage forms would be sub-therapeutic.",
        "status": "Under Investigation",
        "assigned_investigator": "Dr. Meera Kapoor",
        "missing_information": [],
        "possible_root_causes": ["Incomplete reaction or purification step.", "Raw material quality issue."],
        "recommended_capa": ["Quarantine batch ATV260415.", "Re-test with validated method. Notify regulatory if confirmed."],
    },
    {
        "complaint_number": "CMP-2026-0008",
        "source": "Distributor",
        "customer_name": "Global Pharma Distributors",
        "customer_type": "Distributor",
        "reporter_contact": "complaints@globalpharma.in",
        "product_type": "API",
        "product_name": "Metformin Hydrochloride API",
        "strength_or_grade": "IP/BP",
        "batch_number": "MFH260610B",
        "affected_quantity": "100 kg (4 Drums)",
        "manufacturing_date": "June 2026",
        "expiry_date": "May 2028",
        "complaint_category": "Labeling",
        "complaint_description": "Certificate of Analysis attached to drums shows wrong batch number. CoA says MFH260610A but drum labels say MFH260610B. Material appears physically normal.",
        "severity": "Minor",
        "risk_level": "Low",
        "patient_safety_impact": False,
        "status": "Closed",
        "assigned_investigator": "Mr. Sanjay Patel",
        "missing_information": [],
        "possible_root_causes": ["Clerical error during CoA generation."],
        "recommended_capa": ["Issue corrected CoA. Review batch documentation workflow."],
    },

    # ── Mixed additional ────────────────────────────────────────────────────
    {
        "complaint_number": "CMP-2026-0009",
        "source": "Hospital",
        "customer_name": "Max Super Speciality Hospital",
        "customer_type": "Hospital",
        "reporter_contact": "pharmacy@maxhospital.com",
        "product_type": "FDF",
        "product_name": "Insulin Glargine Injection",
        "strength_or_grade": "100 IU/ml",
        "batch_number": "INS260320",
        "affected_quantity": "5 vials",
        "manufacturing_date": "March 2026",
        "expiry_date": "September 2026",
        "complaint_category": "Contamination",
        "complaint_description": "Pharmacist observed visible particles floating in 5 vials of Insulin Glargine from the same lot. Vials were from cold-chain storage. None administered to patients. Vials quarantined immediately.",
        "severity": "Critical",
        "risk_level": "High",
        "patient_safety_impact": True,
        "initial_risk_assessment": "Critical — visible particles in injectable product. Sterility and safety concern.",
        "status": "Pending Triage",
        "assigned_investigator": None,
        "missing_information": ["Cold chain temperature log", "Transit records"],
        "possible_root_causes": [
            "Cold chain breach causing protein aggregation.",
            "Container closure integrity failure.",
            "Manufacturing process contamination."
        ],
        "recommended_capa": [
            "IMMEDIATE quarantine of full batch INS260320.",
            "Request cold chain temperature data from distributor.",
            "Initiate sterility testing on retained samples."
        ],
    },
    {
        "complaint_number": "CMP-2026-0010",
        "source": "Pharmacy",
        "customer_name": "Wellness Pharmacy Chain",
        "customer_type": "Pharmacy",
        "reporter_contact": "qa@wellnesspharma.in",
        "product_type": "FDF",
        "product_name": "Azithromycin 250mg Tablets",
        "strength_or_grade": "250 mg",
        "batch_number": "AZT260701",
        "affected_quantity": "2 strips",
        "manufacturing_date": "July 2026",
        "expiry_date": "June 2028",
        "complaint_category": "Product Quality",
        "complaint_description": "Two tablets found chipped and crumbled in their blister cavities. Tablets broke apart when removed from packaging. Hardness appears below specification.",
        "severity": "Major",
        "risk_level": "Medium",
        "patient_safety_impact": False,
        "status": "CAPA Pending",
        "assigned_investigator": "Ms. Priya Verma",
        "missing_information": [],
        "possible_root_causes": ["Compression force variation.", "Granulation moisture issue."],
        "recommended_capa": ["Test hardness and friability on retained samples.", "Review compression parameters."],
    },
    {
        "complaint_number": "CMP-2026-0011",
        "source": "Patient",
        "customer_name": "Mr. Arun Kumar (Patient)",
        "customer_type": "Patient",
        "reporter_contact": "arun.kumar@email.com",
        "product_type": "FDF",
        "product_name": "Omeprazole 20mg Capsules",
        "strength_or_grade": "20 mg",
        "batch_number": "OMP260615",
        "affected_quantity": "1 strip",
        "manufacturing_date": "June 2026",
        "expiry_date": "May 2028",
        "complaint_category": "Adverse Event",
        "complaint_description": "Patient reports severe nausea and stomach cramps after taking Omeprazole capsule. Patient went to emergency department. Currently stable. No prior adverse reactions to this medication reported by patient.",
        "severity": "Critical",
        "risk_level": "High",
        "patient_safety_impact": True,
        "initial_risk_assessment": "Critical — adverse event with hospitalization. Regulatory reporting may be required.",
        "status": "Pending Triage",
        "assigned_investigator": None,
        "missing_information": ["Hospital discharge summary", "Concomitant medications"],
        "possible_root_causes": ["Possible hypersensitivity.", "Product quality issue in specific batch."],
        "recommended_capa": ["Report to pharmacovigilance. Request patient medical records. Test retain samples."],
    },
    {
        "complaint_number": "CMP-2026-0012",
        "source": "Distributor",
        "customer_name": "National Pharma Logistics",
        "customer_type": "Distributor",
        "reporter_contact": "logistics@nationalpl.com",
        "product_type": "FDF",
        "product_name": "Metformin SR 500mg Tablets",
        "strength_or_grade": "500 mg",
        "batch_number": "MFS260801",
        "affected_quantity": "1 carton (50 strips)",
        "manufacturing_date": "August 2026",
        "expiry_date": "July 2028",
        "complaint_category": "Packaging",
        "complaint_description": "Outer carton received in damaged condition. Secondary packaging torn. Inner blister strips appear intact upon visual inspection. No product quality issue observed.",
        "severity": "Minor",
        "risk_level": "Low",
        "patient_safety_impact": False,
        "status": "Closed",
        "assigned_investigator": "Mr. Vikrant Joshi",
        "missing_information": [],
        "possible_root_causes": ["Rough handling during transit."],
        "recommended_capa": ["File transport damage claim. Review packaging adequacy for transit."],
    },
]


def seed_database():
    """Seed the database with demo complaints if empty."""
    db = SessionLocal()
    try:
        existing_count = db.query(Complaint).count()
        if existing_count > 0:
            return  # Already seeded

        print("Seeding initial Pharma QMS database with historic complaints...")

        for idx, data in enumerate(SEED_COMPLAINTS):
            complaint = Complaint(**data)
            db.add(complaint)
            db.flush()

            # Add initial audit log
            audit = AuditLog(
                complaint_id=complaint.id,
                field_name="COMPLAINT_LOGGED",
                old_value=None,
                new_value=f"Seeded complaint {data['complaint_number']}",
                change_source="SYSTEM",
                actor="System Seed",
            )
            db.add(audit)

            # Add CAPA tasks for complaints with recommendations
            if data.get("recommended_capa"):
                for capa_text in data["recommended_capa"][:3]:
                    task = CapaTask(
                        complaint_id=complaint.id,
                        action=capa_text,
                        owner="QA Manager",
                        status="Open" if data["status"] != "Closed" else "Completed",
                    )
                    db.add(task)

        db.commit()
        print(f"Database seeding completed successfully. {len(SEED_COMPLAINTS)} complaints added.")
    except Exception as e:
        db.rollback()
        print(f"Database seeding error: {e}")
    finally:
        db.close()
