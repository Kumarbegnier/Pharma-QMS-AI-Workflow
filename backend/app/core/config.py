import os
from pathlib import Path

# Load .env if present
_env_file = Path(__file__).parent.parent.parent / ".env"
if _env_file.exists():
    with open(_env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())


class Settings:
    # --- AI Models ---
    # Assignment mandates gemma2-9b-it; Groq decommissioned it Aug 2025.
    # Using llama-3.3-70b-versatile as functional equivalent (same provider).
    # The ASSIGNMENT_MODEL label is preserved for documentation/interview.
    ASSIGNMENT_MODEL: str = "gemma2-9b-it"          # Per assignment spec (decommissioned)
    PRIMARY_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    OPTIONAL_MODEL: str = "llama-3.1-8b-instant"    # Faster/cheaper alternative

    # --- Groq API ---
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # --- Fallback ---
    AI_FALLBACK_ENABLED: bool = os.getenv("AI_FALLBACK_ENABLED", "true").lower() == "true"

    # --- Database ---
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./pharma_qms.db")

    # --- App ---
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_TITLE: str = "AIVOA Pharma QMS – Customer Complaint Management"
    APP_VERSION: str = "2.0.0"

    def is_groq_available(self) -> bool:
        return bool(self.GROQ_API_KEY and self.GROQ_API_KEY.strip())


settings = Settings()
