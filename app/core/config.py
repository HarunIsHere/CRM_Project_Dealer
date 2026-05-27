from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CRM Project Dealer"
    database_url: str = "sqlite:///./data/crm_dealer.db"

    class Config:
        env_file = ".env"


settings = Settings()
