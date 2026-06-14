from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Jojo Client Success Portal"
    debug: bool = False

    # Database
    database_url: str = "postgresql://jojo:jojo@localhost:5432/jojo_portal"

    # Claude API
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"

    # Microsoft Entra ID
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""

    # App
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 480  # 8 hours

    class Config:
        env_file = ".env"


settings = Settings()
