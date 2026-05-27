from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.customer import Customer

router = APIRouter(
    prefix="/customers",
    tags=["customers"]
)


@router.get("/")
def get_customers(db: Session = Depends(get_db)):
    customers = db.query(Customer).all()

    return customers
