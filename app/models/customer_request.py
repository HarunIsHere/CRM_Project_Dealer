from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text

from sqlalchemy.sql import func

from app.core.database import Base


class CustomerRequest(Base):
    __tablename__ = "customer_requests"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, nullable=False)
    request_type = Column(String, nullable=False)
    request_text = Column(Text, nullable=True)
    item_name = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="new")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
