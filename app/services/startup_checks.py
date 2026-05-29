from app.core.config import settings


def validate_production_settings():
    if not settings.admin_username:
        raise RuntimeError("ADMIN_USERNAME is required")

    if not settings.admin_password:
        raise RuntimeError("ADMIN_PASSWORD is required")

    if len(settings.admin_password) < 8:
        raise RuntimeError("ADMIN_PASSWORD must be at least 8 characters")

    if not settings.admin_jwt_secret:
        raise RuntimeError("ADMIN_JWT_SECRET is required")

    if len(settings.admin_jwt_secret) < 32:
        raise RuntimeError("ADMIN_JWT_SECRET must be at least 32 characters")

    if not settings.admin_setup_code:
        raise RuntimeError("ADMIN_SETUP_CODE is required")

    if len(settings.admin_setup_code) < 8:
        raise RuntimeError("ADMIN_SETUP_CODE must be at least 8 characters")

    weak_values = {
        "admin",
        "admin123",
        "password",
        "change-this-admin-secret",
        "CHANGE_THIS_SECRET",
    }

    if settings.admin_password in weak_values:
        raise RuntimeError("ADMIN_PASSWORD uses a weak default value")

    if settings.admin_jwt_secret in weak_values:
        raise RuntimeError("ADMIN_JWT_SECRET uses a weak default value")
