from telegram import Update

from telegram.ext import Application
from telegram.ext import CommandHandler
from telegram.ext import ContextTypes
from telegram.ext import MessageHandler
from telegram.ext import filters

from app.core.config import settings
from app.core.database import SessionLocal

from app.models.customer import Customer
from app.models.message import Message

from app.services.language_service import detect_language
from app.services.rule_engine import get_rule_based_reply


def save_message(
    db,
    customer_id: int,
    direction: str,
    content: str,
    language: str | None = None,
    message_type: str = "text"
):
    message = Message(
        customer_id=customer_id,
        direction=direction,
        platform="telegram",
        content=content,
        language=language,
        message_type=message_type
    )

    db.add(message)
    db.commit()

    return message


async def start_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    await update.message.reply_text(
        "CRM Dealer Bot is running."
    )


async def handle_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    db = SessionLocal()

    try:
        telegram_user = update.effective_user
        incoming_text = update.message.text

        detected_language = detect_language(
            incoming_text
        )

        customer = db.query(Customer).filter(
            Customer.telegram_user_id == str(
                telegram_user.id
            )
        ).first()

        if not customer:
            customer = Customer(
                telegram_user_id=str(
                    telegram_user.id
                ),
                username=telegram_user.username,
                full_name=telegram_user.full_name,
                language=detected_language,
                preferred_language=detected_language
            )

            db.add(customer)
            db.commit()
            db.refresh(customer)

        save_message(
            db=db,
            customer_id=customer.id,
            direction="incoming",
            content=incoming_text,
            language=detected_language
        )

        if detected_language == "unknown":
            reply_text = (
                "Please choose a language: English, Deutsch, Türkçe, العربية"
            )
        else:
            reply_text = get_rule_based_reply(
                db,
                incoming_text,
                detected_language
            )

            if reply_text is None:
                reply_text = (
                    "I received your message. I will help you shortly."
                )

        save_message(
            db=db,
            customer_id=customer.id,
            direction="outgoing",
            content=reply_text,
            language=detected_language
        )

        await update.message.reply_text(
            reply_text
        )

    finally:
        db.close()


def create_bot_application():
    application = Application.builder().token(
        settings.telegram_bot_token
    ).build()

    application.add_handler(
        CommandHandler(
            "start",
            start_command
        )
    )

    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            handle_message
        )
    )

    return application
