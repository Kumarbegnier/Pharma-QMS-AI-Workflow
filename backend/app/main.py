"""
AIVOA Pharma QMS — FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.api.complaints import router as complaints_router
from app.db.init_db import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Pharma QMS Backend Server...")
    print(f"  Primary AI Model: {settings.PRIMARY_MODEL}")
    print(f"  Groq API Key Configured: {settings.is_groq_available()}")

    # Create tables
    from app.models.complaint import (
        Complaint, ComplaintAIAnalysis, ComplaintSource, AuditLog, CapaTask
    )
    Base.metadata.create_all(bind=engine)

    # Seed demo data
    seed_database()

    yield

    # Shutdown
    print("Shutting down Pharma QMS Backend...")


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description="AI-Powered Customer Complaint Management System for Pharmaceutical Manufacturing",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(complaints_router)


@app.get("/health")
def health_check():
    groq_available = settings.is_groq_available()
    return {
        "status": "ok",
        "model": settings.PRIMARY_MODEL,
        "groq_available": groq_available,
        "active_provider": "Groq AI" if groq_available else "Demo Fallback Mode",
        "is_fallback_active": not groq_available,
        "version": settings.APP_VERSION,
    }
