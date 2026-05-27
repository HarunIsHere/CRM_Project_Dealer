from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CRM Project Dealer"

    database_url: str = "sqlite:///./data/crm_dealer.db"

    telegram_bot_token: str | None = None

    admin_username: str = "admin"
    admin_password: str = "admin123"
    admin_jwt_secret: str = "change-this-admin-secret"

    class Config:
        env_file = ".env"


settings = Settings()
