# AIVOA Pharma QMS — AI-Powered Complaint Management System

A production-grade pharmaceutical Quality Management System (QMS) for logging, analyzing, and tracking customer complaints — powered by **LangGraph + Groq LLM + FastAPI + React + Redux**.

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.10-blue)
![React](https://img.shields.io/badge/react-18-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **AI Complaint Intake** — paste free-form text, email, paragraph, or upload PDF/DOCX/TXT/EML; the AI automatically extracts and populates all fields
- **LangGraph 8-node pipeline** — parse → extract → normalize → completeness → risk → summary → CAPA → finalize
- **Groq LLM** (`llama-3.3-70b-versatile`) for structured extraction and CAPA generation
- **ICH Q9 Risk Engine** — deterministic rule-based severity/risk assessment
- **Auto-populated form** — Redux dispatches AI results directly into the complaint draft
- **Conversational correction** — say "batch should be BMX240602" to patch any field
- **60/40 workspace split** — structured QMS form (left) + AIVOA Copilot chat (right)
- **Complaint Register** — filterable, sortable, CSV-exportable table
- **Dashboard** — KPI cards, category breakdown, severity/risk charts, recent complaints
- **Audit Trail** — every AI and user change logged with source and timestamp
- **CAPA Task tracking** — per-complaint corrective and preventive actions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI + Uvicorn |
| AI Workflow | LangGraph + LangChain Groq |
| LLM | Groq `llama-3.3-70b-versatile` |
| Database | SQLite (SQLAlchemy ORM) |
| Frontend | React 18 + TypeScript + Vite |
| State | Redux Toolkit |
| Styling | Inter + JetBrains Mono, custom CSS |
| File Parsing | pypdf, python-docx, email stdlib |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Groq API key — [get one free](https://console.groq.com)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Supported File Intake

| Format | Method |
|--------|--------|
| PDF | pypdf text extraction |
| DOCX | python-docx paragraphs + tables |
| TXT / MD | Multi-encoding (UTF-8 / latin-1 / cp1252) |
| EML | RFC-2822: subject + from + body |
| CSV | Key:value row conversion |

**Max file size:** 10 MB

---

## AI Workflow

```
User input (text / email / PDF / DOCX)
          ↓
  document_parser.py
          ↓
  LangGraph Ingestion Graph:
    1. parse_input_node
    2. extract_structured_fields_node  ← Groq AI
    3. validate_and_normalize_node
    4. check_completeness_node
    5. assess_risk_node  ← ICH Q9 rule engine
    6. generate_summary_actions_node
    7. generate_root_cause_capa_node   ← Groq AI
    8. finalize_response_node
          ↓
  Redux → auto-populates form
          ↓
  User reviews, corrects via Copilot chat, saves
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + AI status |
| POST | `/api/ai/intake/text` | Analyze free-form text |
| POST | `/api/ai/intake/file` | Upload and analyze file |
| POST | `/api/ai/chat` | Conversational field correction |
| POST | `/api/complaints` | Save complaint to ledger |
| GET | `/api/complaints` | List with filters |
| GET | `/api/complaints/stats` | Dashboard KPIs |
| GET | `/api/complaints/{id}` | Single complaint detail |
| PATCH | `/api/complaints/{id}` | Update complaint |
| GET | `/api/complaints/{id}/audit` | Audit trail |

Swagger UI: **http://localhost:8000/docs**

---

## Test Suite

```bash
cd backend
python -m pytest tests/ -v
# 30 tests: 25 backend + 5 acceptance
```

---

## Project Structure

```
pharma-qms-complaints/
├── backend/
│   ├── app/
│   │   ├── agents/          # LangGraph nodes, graphs, prompts, state
│   │   ├── api/             # FastAPI routers
│   │   ├── core/            # Config, database
│   │   ├── db/              # Seed data (12 complaints)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic v2 schemas
│   │   └── services/        # Risk engine, document parser, CRUD
│   ├── samples/             # Demo complaint files
│   └── tests/               # pytest test suite
└── frontend/
    └── src/
        ├── components/      # Header, Form, Copilot, Risk Card, etc.
        ├── features/        # Redux slice, types, thunks
        └── pages/           # Workspace, Complaints, Dashboard, Detail
```

---

## License

MIT — see [LICENSE](LICENSE)



<img width="1920" height="1032" alt="image" src="https://github.com/user-attachments/assets/53e73dc4-cfd3-401d-a655-1f9540429c65" />

