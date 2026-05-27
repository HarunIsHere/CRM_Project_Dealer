from datetime import datetime
from datetime import timedelta
from datetime import timezone

from jose import JWTError
from jose import jwt

from app.core.config import settings


ALGORITHM = "HS256"
COOKIE_NAME = "admin_access_token"


def authenticate_admin(username: str, password: str) -> bool:
    return (
        username == settings.admin_username
        and password == settings.admin_password
    )


def create_admin_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=12)

    payload = {
        "sub": settings.admin_username,
        "scope": "admin",
        "exp": expire
    }

    return jwt.encode(
        payload,
        settings.admin_jwt_secret,
        algorithm=ALGORITHM
    )


def verify_admin_token(token: str | None) -> bool:
    if not token:
        return False

    try:
        payload = jwt.decode(
            token,
            settings.admin_jwt_secret,
            algorithms=[ALGORITHM]
        )
    except JWTError:
        return False

    return (
        payload.get("sub") == settings.admin_username
        and payload.get("scope") == "admin"
    )
