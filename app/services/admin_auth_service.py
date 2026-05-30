from datetime import datetime
from datetime import timedelta
from datetime import timezone

from jose import JWTError
from jose import jwt

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.settings_service import get_setting


ALGORITHM = "HS256"
COOKIE_NAME = "admin_access_token"


def get_current_admin_password() -> str:
    db = SessionLocal()

    try:
        password_override = get_setting(
            db,
            "admin_password_override"
        )

        if password_override:
            return password_override

        return settings.admin_password

    finally:
        db.close()


def authenticate_admin(username: str, password: str) -> bool:
    if (
        username == settings.admin_username
        and password == get_current_admin_password()
    ):
        return True

    if (
        settings.superadmin_username
        and settings.superadmin_password
        and username == settings.superadmin_username
        and password == settings.superadmin_password
    ):
        return True

    return False


def create_admin_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=12)

    payload = {
        "sub": username,
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

    username = payload.get("sub")

    allowed_usernames = [
        settings.admin_username
    ]

    if settings.superadmin_username:
        allowed_usernames.append(settings.superadmin_username)

    return (
        username in allowed_usernames
        and payload.get("scope") == "admin"
    )
