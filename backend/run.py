import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print(f"Starting Pharma QMS Backend Server...")
    print(f"Primary AI Model: {settings.PRIMARY_MODEL}")
    print(f"Groq API Key Configured: {settings.is_groq_available()}")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
