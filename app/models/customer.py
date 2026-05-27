from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    telegram_user_id = Column(String, unique=True, nullable=False)

    username = Column(String, nullable=True)
    full_name = Column(String, nullable=True)

    language = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    messages = relationship(
        "Message",
        back_populates="customer"
    )
