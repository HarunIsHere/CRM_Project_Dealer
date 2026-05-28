from telegram import InlineKeyboardButton
from telegram import InlineKeyboardMarkup
from telegram import Update

from telegram.ext import Application
from telegram.ext import CallbackQueryHandler
from telegram.ext import CommandHandler
from telegram.ext import ContextTypes
from telegram.ext import MessageHandler
from telegram.ext import filters

from app.core.config import settings
from app.core.database import SessionLocal

from app.models.customer import Customer
from app.models.message import Message

from app.services.language_service import detect_language
from app.services.meeting_point_service import get_default_meeting_point
from app.services.quantity_service import extract_quantity
from app.services.customer_request_service import log_customer_request
from app.services.rule_engine import get_matching_product
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
        "I did not understand exactly. "
        "Please choose by pressing a button or typing the number:"
    )


def get_unresolved_options_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "1. Products",
                    callback_data="option_products"
                )
            ],
            [
                InlineKeyboardButton(
                    "2. Location",
                    callback_data="option_location"
                )
            ],
            [
                InlineKeyboardButton(
                    "3. Contact admin",
                    callback_data="option_admin"
                )
            ],
        ]
    )



def is_location_request(text: str) -> bool:
    clean_text = text.strip().lower()
    return clean_text in [
        "2",
        "location",
        "address",
        "adres",
        "konum",
        "where",
        "meet",
        "meeting point",
    ]

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


async def forward_product_request(
    context: ContextTypes.DEFAULT_TYPE,
    db,
    customer: Customer,
    incoming_text: str,
    product_name: str,
    quantity: int | None
):
    admin_chat_id = get_setting(
        db,
        "admin_telegram_chat_id"
    )

    if not admin_chat_id:
        return

    notification_text = (
        "Product request:\n\n"
        f"Customer: {customer.full_name}\n"
        f"Telegram ID: {customer.telegram_user_id}\n"
        f"Product: {product_name}\n"
        f"Quantity: {quantity or 'Not specified'}\n"
        f"Message: {incoming_text}"
    )

    await context.bot.send_message(
        chat_id=admin_chat_id,
        text=notification_text
    )


async def forward_location_needed(
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
        "Location needed:\n\n"
        f"Customer: {customer.full_name}\n"
        f"Telegram ID: {customer.telegram_user_id}\n"
        "Customer asked for location, but no active default location is available.\n"
        f"Message: {incoming_text}"
    )

    await context.bot.send_message(
        chat_id=admin_chat_id,
        text=notification_text
    )


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


def get_customer(db, telegram_user):
    customer = db.query(Customer).filter(
        Customer.telegram_user_id == str(
            telegram_user.id
        )
    ).first()

    if customer:
        return customer

    customer = Customer(
        telegram_user_id=str(
            telegram_user.id
        ),
        username=telegram_user.username,
        full_name=telegram_user.full_name,
        language="unknown",
        preferred_language="en"
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


async def handle_option_selection(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    query = update.callback_query
    await query.answer()

    db = SessionLocal()

    try:
        telegram_user = query.from_user
        customer = get_customer(
            db,
            telegram_user
        )

        option_map = {
            "option_products": "1",
            "option_location": "2",
            "option_admin": "3",
        }

        selected_option = option_map.get(
            query.data
        )

        if selected_option is None:
            return

        save_message(
            db=db,
            customer_id=customer.id,
            direction="incoming",
            content=selected_option,
            language=customer.preferred_language
        )

        reply_text = get_option_reply(
            db,
            customer,
            selected_option
        )

        if selected_option == "1":
            log_customer_request(
                db,
                customer.id,
                "product_list",
                "Customer selected product list"
            )

        if selected_option == "2":
            log_customer_request(
                db,
                customer.id,
                "location",
                "Customer selected location"
            )

        if reply_text == "CONTACT_ADMIN":
            log_customer_request(
                db,
                customer.id,
                "contact_admin",
                "Customer selected contact admin"
            )

            await forward_unresolved_message(
                context=context,
                db=db,
                customer=customer,
                incoming_text="Customer selected: Contact admin"
            )

            reply_text = (
                "I received your message. I will help you shortly."
            )

        save_message(
            db=db,
            customer_id=customer.id,
            direction="outgoing",
            content=reply_text,
            language=customer.preferred_language
        )

        await query.message.reply_text(
            reply_text
        )

    finally:
        db.close()


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

        reply_markup = None

        reply_text = get_option_reply(
            db,
            customer,
            incoming_text
        )

        if incoming_text.strip().lower() in ["1", "products", "product"]:
            log_customer_request(
                db,
                customer.id,
                "product_list",
                incoming_text,
                extract_quantity(incoming_text)
            )

        if incoming_text.strip().lower() in ["2", "location", "address", "adres"]:
            log_customer_request(
                db,
                customer.id,
                "location",
                incoming_text
            )

            if get_default_meeting_point(db) is None:
                await forward_location_needed(
                    context=context,
                    db=db,
                    customer=customer,
                    incoming_text=incoming_text
                )

        if reply_text == "CONTACT_ADMIN":
            log_customer_request(
                db,
                customer.id,
                "contact_admin",
                incoming_text
            )

            forward_text = incoming_text
            if incoming_text.strip().lower() in ["3", "admin", "contact admin"]:
                forward_text = "Customer selected: Contact admin"

            await forward_unresolved_message(
                context=context,
                db=db,
                customer=customer,
                incoming_text=forward_text
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

            if (
                reply_text is not None
                and is_location_request(incoming_text)
                and get_default_meeting_point(db) is None
            ):
                await forward_location_needed(
                    context=context,
                    db=db,
                    customer=customer,
                    incoming_text=incoming_text
                )

            if reply_text is not None and "Available products:" not in reply_text:
                matched_product = get_matching_product(
                    db,
                    incoming_text
                )
                quantity = extract_quantity(incoming_text)

                if matched_product is not None:
                    log_customer_request(
                        db,
                        customer.id,
                        "product_specific",
                        incoming_text,
                        quantity,
                        matched_product.name
                    )

                    await forward_product_request(
                        context=context,
                        db=db,
                        customer=customer,
                        incoming_text=incoming_text,
                        product_name=matched_product.name,
                        quantity=quantity
                    )

        if reply_text is None:
            customer.conversation_state = "awaiting_unresolved_option"
            db.commit()
            reply_text = get_unresolved_options_reply()
            reply_markup = get_unresolved_options_keyboard()

        if reply_text == get_unresolved_options_reply():
            reply_markup = get_unresolved_options_keyboard()

        save_message(
            db=db,
            customer_id=customer.id,
            direction="outgoing",
            content=reply_text,
            language=detected_language
        )

        await update.message.reply_text(
            reply_text,
            reply_markup=reply_markup
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
        CallbackQueryHandler(
            handle_option_selection
        )
    )

    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            handle_message
        )
    )

    return application
