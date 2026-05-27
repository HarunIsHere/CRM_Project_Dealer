from fastapi import FastAPI

from app.api.customers import router as customers_router

from app.core.database import Base
from app.core.database import engine

from app.models.customer import Customer
from app.models.message import Message

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CRM Project Dealer")

app.include_router(customers_router)


@app.get("/")
def root():
    return {
        "status": "running",
        "app": "CRM Project Dealer"
    }
