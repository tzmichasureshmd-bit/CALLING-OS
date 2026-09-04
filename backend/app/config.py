from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    # Supabase PostgreSQL is the only supported application database.
    DATABASE_URL: str
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_RECORDINGS_BUCKET: str = "call-recordings"

    # JWT
    JWT_SECRET_KEY: str = "callnexa-dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # App
    APP_ENV: str = "development"
    # APP_DEBUG is deliberately project-prefixed. Generic DEBUG variables are
    # often supplied by shells, editors, and hosting platforms.
    APP_DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    SEED_DEMO_DATA: bool = True

    GOOGLE_CLIENT_ID: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def debug(self) -> bool:
        return self.APP_DEBUG

    @model_validator(mode="after")
    def require_postgres(self):
        if not self.DATABASE_URL.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a PostgreSQL/Supabase connection URL")
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
