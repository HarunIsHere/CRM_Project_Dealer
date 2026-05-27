from app.services.meeting_point_service import format_meeting_point_reply


def get_rule_based_reply(db, text: str, language: str) -> str | None:
    clean_text = text.lower().strip()

    location_keywords = [
        "where",
        "location",
        "address",
        "meet",
        "place",
        "nerede",
        "konum",
        "adres",
        "buluş",
        "wo",
        "adresse",
        "treffen",
        "مكان",
        "عنوان"
    ]

    if any(keyword in clean_text for keyword in location_keywords):
        return format_meeting_point_reply(db, language)

    greeting_keywords = [
        "hello",
        "hi",
        "hey",
        "merhaba",
        "selam",
        "hallo",
        "guten tag",
        "مرحبا",
        "السلام"
    ]

    if any(keyword in clean_text for keyword in greeting_keywords):
        return get_greeting_reply(language)

    return None


def get_greeting_reply(language: str) -> str:
    replies = {
        "en": "Hello. How can I help you?",
        "de": "Hallo. Wie kann ich helfen?",
        "tr": "Merhaba. Nasıl yardımcı olabilirim?",
        "ar": "مرحبا. كيف يمكنني مساعدتك؟"
    }

    return replies.get(language, replies["en"])
