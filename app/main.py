from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.customers import router as customers_router
from app.api.meeting_points import router as meeting_points_router
from app.admin.routes import router as admin_router

from app.core.database import Base
from app.core.database import engine

from app.models.customer import Customer
from app.models.customer_request import CustomerRequest
from app.models.message import Message
from app.models.meeting_point import MeetingPoint
from app.models.app_setting import AppSetting
from app.models.product import Product

from app.services.startup_checks import validate_production_settings
from app.services.telegram_bot import create_bot_application


telegram_app = create_bot_application()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await telegram_app.initialize()

    await telegram_app.start()

    await telegram_app.updater.start_polling()

    yield

    await telegram_app.updater.stop()

    await telegram_app.stop()

    await telegram_app.shutdown()


validate_production_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CRM Project Dealer",
    lifespan=lifespan
)

app.include_router(customers_router)
app.include_router(meeting_points_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {
        "status": "running",
        "app": "CRM Project Dealer"
    }
