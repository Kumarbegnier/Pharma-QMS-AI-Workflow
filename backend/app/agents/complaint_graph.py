"""
Two compiled LangGraph state machines for the AIVOA Pharma QMS system.

complaint_ingestion_graph: Full 8-stage complaint analysis pipeline
complaint_patch_graph: 4-stage conversational field correction pipeline
"""

from langgraph.graph import StateGraph, START, END
from app.agents.state import ComplaintAgentState
from app.agents.nodes import (
    # Ingestion graph
    parse_input_node,
    extract_structured_fields_node,
    validate_and_normalize_node,
    check_completeness_node,
    assess_risk_node,
    generate_summary_actions_node,
    generate_root_cause_capa_node,
    finalize_response_node,
    # Correction graph
    detect_update_intent_node,
    extract_field_patch_node,
    validate_patch_node,
    generate_assistant_ack_node,
)


def _build_ingestion_graph() -> object:
    """Build and compile the 8-stage complaint ingestion workflow."""
    wf = StateGraph(ComplaintAgentState)

    wf.add_node("parse_input", parse_input_node)
    wf.add_node("extract_structured_fields", extract_structured_fields_node)
    wf.add_node("validate_and_normalize", validate_and_normalize_node)
    wf.add_node("check_completeness", check_completeness_node)
    wf.add_node("assess_risk", assess_risk_node)
    wf.add_node("generate_summary_actions", generate_summary_actions_node)
    wf.add_node("generate_root_cause_capa", generate_root_cause_capa_node)
    wf.add_node("finalize_response", finalize_response_node)

    wf.add_edge(START, "parse_input")
    wf.add_edge("parse_input", "extract_structured_fields")
    wf.add_edge("extract_structured_fields", "validate_and_normalize")
    wf.add_edge("validate_and_normalize", "check_completeness")
    wf.add_edge("check_completeness", "assess_risk")
    wf.add_edge("assess_risk", "generate_summary_actions")
    wf.add_edge("generate_summary_actions", "generate_root_cause_capa")
    wf.add_edge("generate_root_cause_capa", "finalize_response")
    wf.add_edge("finalize_response", END)

    return wf.compile()


def _build_patch_graph() -> object:
    """Build and compile the 4-stage conversational correction workflow."""
    wf = StateGraph(ComplaintAgentState)

    wf.add_node("detect_update_intent", detect_update_intent_node)
    wf.add_node("extract_field_patch", extract_field_patch_node)
    wf.add_node("validate_patch", validate_patch_node)
    wf.add_node("generate_assistant_ack", generate_assistant_ack_node)

    wf.add_edge(START, "detect_update_intent")
    wf.add_edge("detect_update_intent", "extract_field_patch")
    wf.add_edge("extract_field_patch", "validate_patch")
    wf.add_edge("validate_patch", "generate_assistant_ack")
    wf.add_edge("generate_assistant_ack", END)

    return wf.compile()


# Singleton compiled graph instances (imported by API layer)
complaint_ingestion_graph = _build_ingestion_graph()
complaint_patch_graph = _build_patch_graph()
