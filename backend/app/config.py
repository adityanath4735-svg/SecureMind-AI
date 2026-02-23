from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SecureMind AI"
    debug: bool = True
    cors_origins: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    jwt_secret: str = "securemind-dev-secret-change-in-production"
    # Email (Resend): set RESEND_API_KEY and optionally FROM_EMAIL for high-risk alerts
    resend_api_key: str = ""
    from_email: str = "alerts@securemind.local"
    alert_email_enabled: bool = False  # set True when RESEND_API_KEY is set

    class Config:
        env_file = ".env"


settings = Settings()
