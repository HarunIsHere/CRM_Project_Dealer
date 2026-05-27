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
from app.services.settings_service import get_setting


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


def get_unresolved_options_reply() -> str:
    return (
        "I did not understand exactly. Please choose:\n\n"
        "1. Products\n"
        "2. Location\n"
        "3. Contact admin"
    )


def get_option_reply(db, customer: Customer, incoming_text: str) -> str | None:
    clean_text = incoming_text.strip().lower()

    if clean_text in ["1", "products", "product"]:
        customer.conversation_state = None
        db.commit()
        return get_rule_based_reply(
            db,
            "products",
            customer.preferred_language or "en"
        )

    if clean_text in ["2", "location", "address", "adres"]:
        customer.conversation_state = None
        db.commit()
        return get_rule_based_reply(
            db,
            "location",
            customer.preferred_language or "en"
        )

    if clean_text in ["3", "admin", "contact admin"]:
        customer.conversation_state = None
        db.commit()
        return "CONTACT_ADMIN"

    if customer.conversation_state != "awaiting_unresolved_option":
        return None

    customer.conversation_state = "awaiting_unresolved_option"
    db.commit()
    return get_unresolved_options_reply()


async def forward_unresolved_message(
    context: ContextTypes.DEFAULT_TYPE,
    db,
    customer: Customer,
    incoming_text: str
):
    admin_chat_id = get_setting(
        db,
        "admin_telegram_chat_id"
    )

    if not admin_chat_id:
        return

    notification_text = (
        "Unresolved customer message:\n\n"
        f"Customer: {customer.full_name}\n"
        f"Telegram ID: {customer.telegram_user_id}\n"
        f"Message: {incoming_text}"
    )

    await context.bot.send_message(
        chat_id=admin_chat_id,
        text=notification_text
    )


async def start_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    await update.message.reply_text(
        "CRM Dealer Bot is running."
    )


async def myid_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    chat_id = update.effective_chat.id

    await update.message.reply_text(
        f"Your Telegram chat ID is: {chat_id}"
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

        reply_language = detected_language
        if reply_language == "unknown":
            reply_language = customer.preferred_language or "en"

        reply_text = get_option_reply(
            db,
            customer,
            incoming_text
        )

        if reply_text == "CONTACT_ADMIN":
            await forward_unresolved_message(
                context=context,
                db=db,
                customer=customer,
                incoming_text=incoming_text
            )

            reply_text = (
                "I received your message. I will help you shortly."
            )

        if reply_text is None:
            reply_text = get_rule_based_reply(
                db,
                incoming_text,
                reply_language
            )

        if reply_text is None:
            customer.conversation_state = "awaiting_unresolved_option"
            db.commit()
            reply_text = get_unresolved_options_reply()

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
        CommandHandler(
            "myid",
            myid_command
        )
    )

    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            handle_message
        )
    )

    return application
