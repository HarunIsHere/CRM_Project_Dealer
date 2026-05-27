from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False
    )

    direction = Column(String, nullable=False)

    platform = Column(
        String,
        default="telegram"
    )

    content = Column(Text, nullable=True)

    message_type = Column(
        String,
        default="text"
    )

    language = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    customer = relationship(
        "Customer",
        back_populates="messages"
    )
