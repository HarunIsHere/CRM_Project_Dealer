from app.models.meeting_point import MeetingPoint


def get_default_meeting_point(db):
    return db.query(MeetingPoint).filter(
        MeetingPoint.is_default == True,
        MeetingPoint.is_active == True
    ).first()


def format_meeting_point_reply(db, language: str) -> str:
    meeting_point = get_default_meeting_point(db)

    if not meeting_point:
        replies = {
            "en": (
                "Currently no location is available. "
                "We will inform you shortly when it is available."
            ),
            "de": (
                "Aktuell ist kein Standort verfügbar. "
                "Wir informieren Sie, sobald ein Standort verfügbar ist."
            ),
            "tr": (
                "Şu anda uygun bir konum yok. "
                "Uygun olduğunda sizi bilgilendireceğiz."
            ),
            "ar": (
                "لا يوجد موقع متاح حاليا. "
                "سنبلغك عندما يصبح متاحا."
            ),
            "ru": (
                "Сейчас нет доступной локации. "
                "Мы сообщим вам, когда она появится."
            ),
        }

        return replies.get(language, replies["en"])

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
        ),
        "ru": (
            f"Мы можем встретиться здесь:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        )
    }

    return replies.get(language, replies["en"])
