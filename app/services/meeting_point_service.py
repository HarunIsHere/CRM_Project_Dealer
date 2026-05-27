from app.models.meeting_point import MeetingPoint


def get_default_meeting_point(db):
    return db.query(MeetingPoint).filter(
        MeetingPoint.is_default == True,
        MeetingPoint.is_active == True
    ).first()


def format_meeting_point_reply(db, language: str) -> str:
    meeting_point = get_default_meeting_point(db)

    if not meeting_point:
        return "No active meeting point is configured."

    replies = {
        "en": (
            f"We can meet here:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
        "de": (
            f"Wir können uns hier treffen:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
        "tr": (
            f"Burada buluşabiliriz:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
        "ar": (
            f"يمكننا اللقاء هنا:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        )
    }

    return replies.get(language, replies["en"])
