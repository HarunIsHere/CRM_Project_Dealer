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
from app.services.language_service import detect_language_by_keywords
from app.services.meeting_point_service import get_default_meeting_point
from app.services.quantity_service import extract_quantity
from app.services.customer_request_service import log_customer_request
from app.services.rule_engine import get_matching_product
from app.services.rule_engine import get_rule_based_reply
from app.services.settings_service import get_setting
from app.services.settings_service import set_setting


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



def get_contact_admin_received_reply(language: str = "en") -> str:
    replies = {
        "en": "I received your message. I will help you shortly.",
        "de": "Ich habe Ihre Nachricht erhalten. Ich helfe Ihnen gleich.",
        "tr": "Mesajınızı aldım. Kısa süre içinde yardımcı olacağım.",
        "ar": "وصلتني رسالتك. سأساعدك قريبا.",
        "ru": "Я получил ваше сообщение. Скоро помогу вам.",
    }

    return replies.get(language, replies["en"])

def get_unresolved_options_reply(language: str = "en") -> str:
    replies = {
        "en": (
            "I did not understand exactly. "
            "Please choose by pressing a button or typing the number:"
        ),
        "de": (
            "Ich habe es nicht genau verstanden. "
            "Bitte wählen Sie per Button oder geben Sie die Nummer ein:"
        ),
        "tr": (
            "Tam olarak anlayamadım. "
            "Lütfen bir butona basarak veya numarayı yazarak seçin:"
        ),
        "ar": (
            "لم أفهم بالضبط. "
            "يرجى الاختيار بالضغط على الزر أو كتابة الرقم:"
        ),
        "ru": (
            "Я не совсем понял. "
            "Пожалуйста, выберите кнопку или введите номер:"
        ),
    }

    return replies.get(language, replies["en"])



def is_unresolved_options_reply(text: str) -> bool:
    return text in [
        get_unresolved_options_reply("en"),
        get_unresolved_options_reply("de"),
        get_unresolved_options_reply("tr"),
        get_unresolved_options_reply("ar"),
        get_unresolved_options_reply("ru"),
    ]


MENU_OPTIONS = {
    "1": {
        "key": "products",
        "callback_data": "option_products",
        "reply_trigger": "products",
        "typed_values": [
            "1",
            "products",
            "product",
            "produkte",
            "produkt",
            "ürünler",
            "urunler",
            "ürün",
            "urun",
        ],
        "labels": {
            "en": "1. Products",
            "de": "1. Produkte",
            "tr": "1. Ürünler",
            "ar": "1. المنتجات",
            "ru": "1. Товары",
        },
    },
    "2": {
        "key": "location",
        "callback_data": "option_location",
        "reply_trigger": "location",
        "typed_values": [
            "2",
            "location",
            "address",
            "adres",
            "konum",
            "mekan",
            "lokasyon",
            "standort",
            "adresse",
            "место",
            "локация",
            "адрес",
            "مكان",
            "موقع",
            "عنوان",
        ],
        "labels": {
            "en": "2. Location",
            "de": "2. Standort",
            "tr": "2. Konum",
            "ar": "2. الموقع",
            "ru": "2. Локация",
        },
    },
    "3": {
        "key": "contact_admin",
        "callback_data": "option_admin",
        "reply_trigger": "CONTACT_ADMIN",
        "typed_values": [
            "3",
            "admin",
            "contact admin",
            "administrator",
            "support",
            "hilfe",
            "admin kontaktieren",
            "admin ile iletişim",
            "админ",
            "администратор",
            "مشرف",
            "الإدارة",
        ],
        "labels": {
            "en": "3. Contact admin",
            "de": "3. Admin kontaktieren",
            "tr": "3. Admin ile iletişim",
            "ar": "3. التواصل مع الإدارة",
            "ru": "3. Связаться с админом",
        },
    },
}


def get_menu_option_by_text(text: str) -> dict | None:
    clean_text = text.strip().lower()

    for option in MENU_OPTIONS.values():
        if clean_text in option["typed_values"]:
            return option

    return None


def get_menu_option_by_callback(callback_data: str) -> tuple[str, dict] | None:
    for option_number, option in MENU_OPTIONS.items():
        if callback_data == option["callback_data"]:
            return option_number, option

    return None


def get_menu_keyboard_rows(language: str = "en") -> list[list[InlineKeyboardButton]]:
    rows = []

    for option in MENU_OPTIONS.values():
        labels = option["labels"]
        rows.append(
            [
                InlineKeyboardButton(
                    labels.get(language, labels["en"]),
                    callback_data=option["callback_data"]
                )
            ]
        )

    return rows

def get_unresolved_options_keyboard(language: str = "en") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        get_menu_keyboard_rows(language)
    )


def get_language_keyboard(language: str = "en") -> InlineKeyboardMarkup:
    rows = get_menu_keyboard_rows(language)

    rows.extend(
        [
            [
                InlineKeyboardButton(
                    "English",
                    callback_data="language_en"
                ),
                InlineKeyboardButton(
                    "Deutsch",
                    callback_data="language_de"
                ),
            ],
            [
                InlineKeyboardButton(
                    "Türkçe",
                    callback_data="language_tr"
                ),
                InlineKeyboardButton(
                    "العربية",
                    callback_data="language_ar"
                ),
            ],
            [
                InlineKeyboardButton(
                    "Русский",
                    callback_data="language_ru"
                )
            ],
        ]
    )

    return InlineKeyboardMarkup(rows)


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
    option = get_menu_option_by_text(incoming_text)

    if option is None:
        return None

    customer.conversation_state = None
    db.commit()

    if option["reply_trigger"] == "CONTACT_ADMIN":
        return "CONTACT_ADMIN"

    return get_rule_based_reply(
        db,
        option["reply_trigger"],
        customer.preferred_language or "en"
    )



def get_admin_reply_keyboard(customer: Customer) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "Reply to customer",
                    callback_data=f"admin_reply_{customer.id}"
                )
            ]
        ]
    )

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
        text=notification_text,
        reply_markup=get_admin_reply_keyboard(customer)
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
        text=notification_text,
        reply_markup=get_admin_reply_keyboard(customer)
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
        text=notification_text,
        reply_markup=get_admin_reply_keyboard(customer)
    )


async def start_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    await update.message.reply_text(
        "CRM Delivery Bot is running."
    )


async def myid_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    chat_id = update.effective_chat.id

    await update.message.reply_text(
        f"Your Telegram chat ID is: {chat_id}"
    )


async def setadmin_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    provided_code = ""
    if context.args:
        provided_code = context.args[0]

    if provided_code != settings.admin_setup_code:
        await update.message.reply_text(
            "Invalid admin setup code."
        )
        return

    db = SessionLocal()

    try:
        chat_id = str(update.effective_chat.id)

        set_setting(
            db,
            "admin_telegram_chat_id",
            chat_id
        )

        await update.message.reply_text(
            "You are now set as the admin notification receiver."
        )

    finally:
        db.close()


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

async def handle_admin_reply_selection(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    query = update.callback_query
    await query.answer()

    db = SessionLocal()

    try:
        admin_chat_id = get_setting(
            db,
            "admin_telegram_chat_id"
        )

        if str(query.from_user.id) != str(admin_chat_id):
            await query.message.reply_text(
                "You are not allowed to use admin reply."
            )
            return

        customer_id = int(
            query.data.replace("admin_reply_", "")
        )

        customer = db.query(Customer).filter(
            Customer.id == customer_id
        ).first()

        if not customer:
            await query.message.reply_text(
                "Customer not found."
            )
            return

        set_setting(
            db,
            "pending_admin_reply_customer_id",
            str(customer.id)
        )

        await query.message.reply_text(
            "Type your reply now. The next message you send here will be sent to "
            f"{customer.full_name or customer.telegram_user_id}."
        )

    finally:
        db.close()



async def handle_language_selection(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    query = update.callback_query
    await query.answer()

    selected_language = query.data.replace("language_", "")

    if selected_language not in ["en", "de", "tr", "ar", "ru"]:
        return

    db = SessionLocal()

    try:
        customer = get_customer(
            db,
            query.from_user
        )

        customer.preferred_language = selected_language
        customer.language = selected_language
        db.commit()

        reply_text = get_unresolved_options_reply(selected_language)

        save_message(
            db=db,
            customer_id=customer.id,
            direction="outgoing",
            content=reply_text,
            language=selected_language
        )

        await query.message.reply_text(
            reply_text,
            reply_markup=get_language_keyboard(selected_language)
        )

    finally:
        db.close()


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

        selected_menu_option = get_menu_option_by_callback(
            query.data
        )

        if selected_menu_option is None:
            return

        selected_option, option_data = selected_menu_option

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

            reply_text = get_contact_admin_received_reply(
                customer.preferred_language or "en"
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

        strong_language = detect_language_by_keywords(
            incoming_text.lower().strip()
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
                preferred_language=(
                    strong_language
                    if strong_language != "unknown"
                    else "en"
                )
            )

            db.add(customer)
            db.commit()
            db.refresh(customer)

        if strong_language != "unknown":
            customer.language = strong_language
            customer.preferred_language = strong_language
            db.commit()

        admin_chat_id = get_setting(
            db,
            "admin_telegram_chat_id"
        )

        pending_customer_id = get_setting(
            db,
            "pending_admin_reply_customer_id"
        )

        if (
            pending_customer_id
            and str(update.effective_chat.id) == str(admin_chat_id)
        ):
            target_customer = db.query(Customer).filter(
                Customer.id == int(pending_customer_id)
            ).first()

            if target_customer:
                await context.bot.send_message(
                    chat_id=target_customer.telegram_user_id,
                    text=incoming_text
                )

                save_message(
                    db=db,
                    customer_id=target_customer.id,
                    direction="outgoing",
                    content=incoming_text,
                    language=target_customer.preferred_language,
                    message_type="admin_reply"
                )

                set_setting(
                    db,
                    "pending_admin_reply_customer_id",
                    ""
                )

                await update.message.reply_text(
                    "Reply sent to customer."
                )
                return

        save_message(
            db=db,
            customer_id=customer.id,
            direction="incoming",
            content=incoming_text,
            language=detected_language
        )

        reply_language = detected_language
        if reply_language == "unknown":
            reply_language = "en"

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

            reply_text = get_contact_admin_received_reply(
                customer.preferred_language or "en"
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
            reply_text = get_unresolved_options_reply(reply_language)
            reply_markup = get_language_keyboard(reply_language)

        if (
            is_unresolved_options_reply(reply_text)
            and reply_markup is None
        ):
            keyboard_language = customer.preferred_language or reply_language
            reply_markup = get_language_keyboard(keyboard_language)

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
        CommandHandler(
            "setadmin",
            setadmin_command
        )
    )

    application.add_handler(
        CallbackQueryHandler(
            handle_admin_reply_selection,
            pattern="^admin_reply_"
        )
    )

    application.add_handler(
        CallbackQueryHandler(
            handle_language_selection,
            pattern="^language_"
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
