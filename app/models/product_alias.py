from sqlalchemy import Column
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String

from app.core.database import Base


class ProductAlias(Base):
    __tablename__ = "product_aliases"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    alias = Column(String, nullable=False, index=True)
