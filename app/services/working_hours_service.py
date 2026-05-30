from datetime import datetime
from datetime import time
from zoneinfo import ZoneInfo

from app.services.settings_service import get_setting


def is_within_working_hours(db) -> bool:
    enabled = get_setting(db, "working_hours_enabled")

    if enabled != "on":
        return True

    timezone_name = get_setting(db, "working_hours_timezone") or "Europe/Berlin"
    start_value = get_setting(db, "working_hours_start") or "10:00"
    end_value = get_setting(db, "working_hours_end") or "22:00"

    now = datetime.now(ZoneInfo(timezone_name)).time()
    start_time = parse_time(start_value)
    end_time = parse_time(end_value)

    if start_time <= end_time:
        return start_time <= now <= end_time

    return now >= start_time or now <= end_time


def get_closed_hours_reply(db, language: str) -> str:
    message_mode = (
        get_setting(db, "working_hours_message_mode")
        or "custom"
    )

    custom_message = get_setting(db, "working_hours_closed_message")

    if message_mode == "custom" and custom_message:
        return custom_message

    return get_auto_closed_hours_reply(db, language)


def get_auto_closed_hours_reply(db, language: str) -> str:
    timezone_name = get_setting(db, "working_hours_timezone") or "Europe/Berlin"
    start_value = get_setting(db, "working_hours_start") or "10:00"
    end_value = get_setting(db, "working_hours_end") or "22:00"

    local_replies = {
        "en": (
            "We are currently closed. "
            f"Our working hours are {start_value} - {end_value} "
            f"({timezone_name})."
        ),
        "de": (
            "Wir haben derzeit geschlossen. "
            f"Unsere Arbeitszeiten sind {start_value} - {end_value} "
            f"({timezone_name})."
        ),
        "tr": (
            "Şu anda kapalıyız. "
            f"Çalışma saatlerimiz {start_value} - {end_value} "
            f"({timezone_name})."
        ),
        "ar": (
            "نحن مغلقون حاليا. "
            f"ساعات العمل لدينا هي {start_value} - {end_value} "
            f"({timezone_name})."
        ),
        "ru": (
            "Сейчас мы закрыты. "
            f"Наши рабочие часы: {start_value} - {end_value} "
            f"({timezone_name})."
        ),
    }

    english_reply = local_replies["en"]
    local_reply = local_replies.get(language, english_reply)

    if language == "en":
        return english_reply

    return f"{local_reply}\n\n{english_reply}"


def parse_time(value: str) -> time:
    hour, minute = value.split(":")
    return time(
        hour=int(hour),
        minute=int(minute)
    )
