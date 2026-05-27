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
    custom_message = get_setting(db, "working_hours_closed_message")

    if custom_message:
        return custom_message

    replies = {
        "en": "We are currently closed. Please message us during working hours.",
        "de": "Wir haben derzeit geschlossen. Bitte schreiben Sie während der Arbeitszeiten.",
        "tr": "Şu anda kapalıyız. Lütfen çalışma saatleri içinde yazın.",
        "ar": "نحن مغلقون حاليا. يرجى مراسلتنا خلال ساعات العمل.",
    }

    return replies.get(language, replies["en"])


def parse_time(value: str) -> time:
    hour, minute = value.split(":")
    return time(
        hour=int(hour),
        minute=int(minute)
    )
