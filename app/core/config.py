from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CRM Delivery"

    database_url: str = "sqlite:///./data/crm_dealer.db"

    telegram_bot_token: str | None = None

    admin_username: str
    admin_password: str
    admin_jwt_secret: str
    admin_setup_code: str

    superadmin_username: str | None = None
    superadmin_password: str | None = None
    superadmin_bot_setup_code: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
