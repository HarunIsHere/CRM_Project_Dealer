import json
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
from app.models.customer_request import CustomerRequest
from app.models.message import Message
from app.models.meeting_point import MeetingPoint

from app.services.language_service import detect_language
from app.services.language_service import detect_language_by_keywords
from app.services.meeting_point_service import get_default_meeting_point
from app.services.quantity_service import extract_quantity
from app.services.customer_request_service import log_customer_request
from app.services.geocoding import search_locations
from app.services.rule_engine import get_matching_product
from app.services.rule_engine import get_rule_based_reply
from app.services.working_hours_service import get_closed_hours_reply
from app.services.working_hours_service import is_within_working_hours
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
            "Please choose by pressing a button or typing the number. "
            "You can share your location directly on chat for delivery. "
            "If you prefer to type your address, please use the "
            "Type address function."
        ),
        "de": (
            "Ich habe es nicht genau verstanden. "
            "Bitte wählen Sie per Button oder geben Sie die Nummer ein. "
            "Sie können Ihren Standort direkt im Chat für die Lieferung teilen. "
            "Wenn Sie Ihre Adresse lieber eintippen möchten, nutzen Sie bitte "
            "die Funktion Adresse eingeben."
        ),
        "tr": (
            "Tam olarak anlayamadım. "
            "Lütfen bir butona basarak veya numarayı yazarak seçin. "
            "Teslimat için konumunuzu doğrudan sohbette paylaşabilirsiniz. "
            "Adresinizi yazmak isterseniz lütfen Adres yaz fonksiyonunu kullanın."
        ),
        "ar": (
            "لم أفهم بالضبط. "
            "يرجى الاختيار بالضغط على الزر أو كتابة الرقم. "
            "يمكنك مشاركة موقعك مباشرة في المحادثة للتوصيل. "
            "إذا كنت تفضل كتابة عنوانك، يرجى استخدام خيار كتابة العنوان."
        ),
        "ru": (
            "Я не совсем понял. "
            "Пожалуйста, выберите кнопку или введите номер. "
            "Вы можете отправить свою локацию прямо в чате для доставки. "
            "Если вы хотите ввести адрес вручную, используйте функцию "
            "Ввести адрес."
        ),
    }

    return replies.get(language, replies["en"])


def get_type_address_reply(language: str = "en") -> str:
    replies = {
        "en": (
            "Please type your address. "
            "After that, choose the correct location from the list."
        ),
        "de": (
            "Bitte geben Sie Ihre Adresse ein. "
            "Wählen Sie danach den richtigen Standort aus der Liste."
        ),
        "tr": (
            "Lütfen adresinizi yazın. "
            "Sonra listeden doğru konumu seçin."
        ),
        "ar": (
            "يرجى كتابة عنوانك. "
            "بعد ذلك اختر الموقع الصحيح من القائمة."
        ),
        "ru": (
            "Пожалуйста, введите ваш адрес. "
            "После этого выберите правильную локацию из списка."
        ),
    }

    return replies.get(language, replies["en"])


def get_delivery_eta_reply(language: str, eta_text: str) -> str:
    replies = {
        "en": f"Delivery will be done to your location in {eta_text}.",
        "de": f"Die Lieferung erfolgt an Ihren Standort in {eta_text}.",
        "tr": f"Teslimat konumunuza {eta_text} içinde yapılacak.",
        "ar": f"سيتم التوصيل إلى موقعك خلال {eta_text}.",
        "ru": f"Доставка будет выполнена по вашей локации через {eta_text}.",
    }

    return replies.get(language, replies["en"])


def get_no_delivery_reply(language: str = "en") -> str:
    replies = {
        "en": "Sorry, delivery is not possible for this location.",
        "de": "Entschuldigung, Lieferung ist für diesen Standort nicht möglich.",
        "tr": "Üzgünüm, bu konuma teslimat mümkün değil.",
        "ar": "عذرا، التوصيل غير ممكن إلى هذا الموقع.",
        "ru": "Извините, доставка в эту локацию невозможна.",
    }

    return replies.get(language, replies["en"])


def get_choose_location_reply(language: str = "en") -> str:
    replies = {
        "en": "Please choose one of our active locations:",
        "de": "Bitte wählen Sie einen unserer aktiven Standorte:",
        "tr": "Lütfen aktif konumlarımızdan birini seçin:",
        "ar": "يرجى اختيار أحد مواقعنا المتاحة:",
        "ru": "Пожалуйста, выберите одну из наших активных локаций:",
    }

    return replies.get(language, replies["en"])


def get_no_active_locations_reply(language: str = "en") -> str:
    replies = {
        "en": "Currently no location is available. We will inform you shortly when it is available.",
        "de": "Aktuell ist kein Standort verfügbar. Wir informieren Sie, sobald ein Standort verfügbar ist.",
        "tr": "Şu anda uygun bir konum yok. Uygun olduğunda sizi bilgilendireceğiz.",
        "ar": "لا يوجد موقع متاح حاليا. سنبلغك عندما يصبح متاحا.",
        "ru": "Сейчас нет доступной локации. Мы сообщим вам, когда она появится.",
    }

    return replies.get(language, replies["en"])


def format_selected_meeting_point_reply(meeting_point: MeetingPoint, language: str = "en") -> str:
    replies = {
        "en": (
            f"Selected location:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
        "de": (
            f"Ausgewählter Standort:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
        "tr": (
            f"Seçilen konum:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
        "ar": (
            f"الموقع المختار:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
        "ru": (
            f"Выбранная локация:\n\n"
            f"{meeting_point.name}\n"
            f"{meeting_point.address}\n"
            f"{meeting_point.google_maps_link}"
        ),
    }

    return replies.get(language, replies["en"])


def get_active_meeting_points_keyboard(db) -> InlineKeyboardMarkup | None:
    meeting_points = db.query(MeetingPoint).filter(
        MeetingPoint.is_active.is_(True)
    ).order_by(
        MeetingPoint.is_default.desc(),
        MeetingPoint.name.asc()
    ).all()

    if not meeting_points:
        return None

    rows = []

    for meeting_point in meeting_points:
        label = meeting_point.name

        if meeting_point.is_default:
            label = f"Preferred - {label}"

        rows.append(
            [
                InlineKeyboardButton(
                    label[:60],
                    callback_data=f"meeting_point_select_{meeting_point.id}"
                )
            ]
        )

    return InlineKeyboardMarkup(rows)

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
        "key": "get_my_location",
        "callback_data": "option_get_my_location",
        "reply_trigger": "CHOOSE_MEETING_POINT",
        "typed_values": [
            "2",
            "get my location",
            "location",
            "konum",
            "standort",
            "место",
            "локация",
            "مكان",
            "موقع",
        ],
        "labels": {
            "en": "2. Get my location",
            "de": "2. Meinen Standort erhalten",
            "tr": "2. Konumumu al",
            "ar": "2. الحصول على موقعي",
            "ru": "2. Получить мою локацию",
        },
    },
    "3": {
        "key": "type_address",
        "callback_data": "option_type_address",
        "reply_trigger": "TYPE_ADDRESS",
        "typed_values": [
            "3",
            "type address",
            "type my address",
            "address",
            "adres",
            "adresse",
            "adres yaz",
            "адрес",
            "ввести адрес",
            "عنوان",
            "كتابة العنوان",
        ],
        "labels": {
            "en": "3. Type address",
            "de": "3. Adresse eingeben",
            "tr": "3. Adres yaz",
            "ar": "3. كتابة العنوان",
            "ru": "3. Ввести адрес",
        },
    },
    "4": {
        "key": "contact_admin",
        "callback_data": "option_admin",
        "reply_trigger": "CONTACT_ADMIN",
        "typed_values": [
            "4",
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
            "en": "4. Contact admin",
            "de": "4. Admin kontaktieren",
            "tr": "4. Admin ile iletişim",
            "ar": "4. التواصل مع الإدارة",
            "ru": "4. Связаться с админом",
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



def get_closed_hours_keyboard(language: str = "en") -> InlineKeyboardMarkup:
    labels = {
        "en": {
            "products": "1. Product List",
            "admin": "2. Contact admin",
        },
        "de": {
            "products": "1. Produktliste",
            "admin": "2. Admin kontaktieren",
        },
        "tr": {
            "products": "1. Ürün listesi",
            "admin": "2. Admin ile iletişim",
        },
        "ar": {
            "products": "1. قائمة المنتجات",
            "admin": "2. التواصل مع الإدارة",
        },
        "ru": {
            "products": "1. Список товаров",
            "admin": "2. Связаться с админом",
        },
    }

    selected_labels = labels.get(language, labels["en"])

    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    selected_labels["products"],
                    callback_data="option_products"
                )
            ],
            [
                InlineKeyboardButton(
                    selected_labels["admin"],
                    callback_data="option_admin"
                )
            ],
        ]
    )

def is_location_request(text: str) -> bool:
    clean_text = text.strip().lower()

    location_keywords = [
        "2",
        "location",
        "address",
        "adres",
        "konum",
        "lokasyon",
        "mekan",
        "where",
        "meet",
        "meeting point",
        "standort",
        "adresse",
        "место",
        "локация",
        "адрес",
        "مكان",
        "موقع",
        "عنوان",
    ]

    return any(
        keyword in clean_text
        for keyword in location_keywords
    )


def get_option_reply(db, customer: Customer, incoming_text: str) -> str | None:
    option = get_menu_option_by_text(incoming_text)

    if option is None:
        return None

    customer.conversation_state = None
    db.commit()

    if option["reply_trigger"] == "CONTACT_ADMIN":
        return "CONTACT_ADMIN"

    if option["reply_trigger"] == "TYPE_ADDRESS":
        customer.conversation_state = "awaiting_typed_address"
        db.commit()
        return get_type_address_reply(
            customer.preferred_language or "en"
        )

    if option["reply_trigger"] == "CHOOSE_MEETING_POINT":
        customer.conversation_state = "choosing_meeting_point"
        db.commit()
        return "CHOOSE_MEETING_POINT"

    return get_rule_based_reply(
        db,
        option["reply_trigger"],
        customer.preferred_language or "en"
    )




def make_google_maps_link(latitude: str, longitude: str) -> str:
    return (
        "https://www.google.com/maps/search/"
        f"?api=1&query={latitude},{longitude}"
    )


def get_address_choices_keyboard(results: list[dict]) -> InlineKeyboardMarkup:
    rows = []

    for index, result in enumerate(results[:7]):
        rows.append(
            [
                InlineKeyboardButton(
                    result["address"][:60],
                    callback_data=f"address_select_{index}"
                )
            ]
        )

    rows.append(
        [
            InlineKeyboardButton(
                "Contact admin to describe location",
                callback_data="option_admin"
            )
        ]
    )

    return InlineKeyboardMarkup(rows)


def get_delivery_admin_keyboard(
    customer_request_id: int,
    customer: Customer,
    google_maps_link: str,
    clicked_eta_values: set[str] | None = None,
    last_eta_value: str | None = None
) -> InlineKeyboardMarkup:
    if clicked_eta_values is None:
        clicked_eta_values = set()

    def eta_label(value: str) -> str:
        if value == last_eta_value:
            return f"🔵 {value}"
        if value in clicked_eta_values:
            return f"✓ {value}"
        return value

    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "Open Map",
                    url=google_maps_link
                ),
                InlineKeyboardButton(
                    "Free text reply",
                    callback_data=f"admin_reply_{customer.id}"
                ),
            ],
            [
                InlineKeyboardButton(
                    eta_label("15 min"),
                    callback_data=f"delivery_eta_{customer_request_id}_15 min"
                ),
                InlineKeyboardButton(
                    eta_label("30 min"),
                    callback_data=f"delivery_eta_{customer_request_id}_30 min"
                ),
                InlineKeyboardButton(
                    eta_label("45 min"),
                    callback_data=f"delivery_eta_{customer_request_id}_45 min"
                ),
            ],
            [
                InlineKeyboardButton(
                    eta_label("1h"),
                    callback_data=f"delivery_eta_{customer_request_id}_1h"
                ),
                InlineKeyboardButton(
                    eta_label("1h 15 min"),
                    callback_data=f"delivery_eta_{customer_request_id}_1h 15 min"
                ),
                InlineKeyboardButton(
                    eta_label("1h 30 min"),
                    callback_data=f"delivery_eta_{customer_request_id}_1h 30 min"
                ),
            ],
            [
                InlineKeyboardButton(
                    eta_label("No delivery"),
                    callback_data=f"delivery_no_{customer_request_id}"
                )
            ],
        ]
    )


async def forward_customer_location_to_admin(
    context: ContextTypes.DEFAULT_TYPE,
    db,
    customer: Customer,
    customer_request_id: int,
    location_label: str,
    google_maps_link: str
):
    admin_chat_id = get_setting(
        db,
        "admin_telegram_chat_id"
    )

    if not admin_chat_id:
        return

    notification_text = (
        "Customer delivery location:\n\n"
        f"Customer: {customer.full_name}\n"
        f"Telegram ID: {customer.telegram_user_id}\n"
        f"Location: {location_label}\n"
        f"Map: {google_maps_link}"
    )

    await context.bot.send_message(
        chat_id=admin_chat_id,
        text=notification_text,
        reply_markup=get_delivery_admin_keyboard(
            customer_request_id,
            customer,
            google_maps_link
        )
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



async def setsuperadmin_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    provided_code = ""
    if context.args:
        provided_code = context.args[0]

    if (
        not settings.superadmin_bot_setup_code
        or provided_code != settings.superadmin_bot_setup_code
    ):
        await update.message.reply_text(
            "Invalid superadmin setup code."
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
            "Superadmin takeover complete. You are now the admin notification receiver."
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
async def send_meeting_point_choice_or_direct(
    context: ContextTypes.DEFAULT_TYPE,
    db,
    customer: Customer,
    reply_target,
    incoming_text: str
):
    meeting_points = db.query(MeetingPoint).filter(
        MeetingPoint.is_active.is_(True)
    ).order_by(
        MeetingPoint.is_default.desc(),
        MeetingPoint.name.asc()
    ).all()

    if not meeting_points:
        reply_text = get_no_active_locations_reply(
            customer.preferred_language or "en"
        )

        await forward_location_needed(
            context=context,
            db=db,
            customer=customer,
            incoming_text=incoming_text
        )

        await reply_target.reply_text(reply_text)
        return

    if len(meeting_points) == 1:
        meeting_point = meeting_points[0]

        reply_text = format_selected_meeting_point_reply(
            meeting_point,
            customer.preferred_language or "en"
        )

        log_customer_request(
            db,
            customer.id,
            "location",
            incoming_text,
            None,
            meeting_point.name,
            meeting_point.address,
            None,
            None,
            meeting_point.google_maps_link
        )

        save_message(
            db=db,
            customer_id=customer.id,
            direction="outgoing",
            content=reply_text,
            language=customer.preferred_language
        )

        await reply_target.reply_text(reply_text)
        return

    keyboard = get_active_meeting_points_keyboard(db)

    reply_text = get_choose_location_reply(
        customer.preferred_language or "en"
    )

    save_message(
        db=db,
        customer_id=customer.id,
        direction="outgoing",
        content=reply_text,
        language=customer.preferred_language
    )

    await reply_target.reply_text(
        reply_text,
        reply_markup=keyboard
    )



async def handle_meeting_point_selection(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    query = update.callback_query
    await query.answer()

    db = SessionLocal()

    try:
        customer = get_customer(
            db,
            query.from_user
        )

        meeting_point_id = int(
            query.data.replace("meeting_point_select_", "")
        )

        meeting_point = db.query(MeetingPoint).filter(
            MeetingPoint.id == meeting_point_id,
            MeetingPoint.is_active.is_(True)
        ).first()

        if not meeting_point:
            await query.message.reply_text(
                get_no_active_locations_reply(
                    customer.preferred_language or "en"
                )
            )
            return

        customer.conversation_state = None
        db.commit()

        reply_text = format_selected_meeting_point_reply(
            meeting_point,
            customer.preferred_language or "en"
        )

        log_customer_request(
            db,
            customer.id,
            "location",
            "Customer selected meeting point",
            None,
            meeting_point.name,
            meeting_point.address,
            None,
            None,
            meeting_point.google_maps_link
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



async def handle_delivery_eta_selection(
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
                "You are not allowed to send delivery updates."
            )
            return

        if query.data.startswith("delivery_no_"):
            request_id = int(
                query.data.replace("delivery_no_", "")
            )
            eta_text = None
        else:
            payload = query.data.replace("delivery_eta_", "")
            request_id_text, eta_text = payload.split("_", 1)
            request_id = int(request_id_text)

        customer_request = db.query(CustomerRequest).filter(
            CustomerRequest.id == request_id
        ).first()

        if not customer_request:
            await query.message.reply_text(
                "Delivery request not found."
            )
            return

        customer = db.query(Customer).filter(
            Customer.id == customer_request.customer_id
        ).first()

        if not customer:
            await query.message.reply_text(
                "Customer not found."
            )
            return

        clicked_key = (
            f"delivery_eta_clicked_{customer_request.id}"
        )
        last_key = (
            f"delivery_eta_last_{customer_request.id}"
        )

        previous_clicked = get_setting(
            db,
            clicked_key
        ) or ""

        clicked_eta_values = {
            value
            for value in previous_clicked.split("|")
            if value
        }

        if eta_text is None:
            eta_value = "No delivery"
            reply_text = get_no_delivery_reply(
                customer.preferred_language or "en"
            )
            customer_request.status = "done"
        else:
            eta_value = eta_text
            reply_text = get_delivery_eta_reply(
                customer.preferred_language or "en",
                eta_text
            )
            customer_request.status = "in_progress"

        clicked_eta_values.add(eta_value)

        set_setting(
            db,
            clicked_key,
            "|".join(sorted(clicked_eta_values))
        )
        set_setting(
            db,
            last_key,
            eta_value
        )

        db.commit()

        await context.bot.send_message(
            chat_id=customer.telegram_user_id,
            text=reply_text
        )

        save_message(
            db=db,
            customer_id=customer.id,
            direction="outgoing",
            content=reply_text,
            language=customer.preferred_language,
            message_type="delivery_eta"
        )

        await query.edit_message_reply_markup(
            reply_markup=get_delivery_admin_keyboard(
                customer_request.id,
                customer,
                customer_request.google_maps_link,
                clicked_eta_values,
                eta_value
            )
        )

        await query.message.reply_text(
            f"Delivery update sent to customer: {eta_value}"
        )

    finally:
        db.close()



async def handle_address_selection(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    query = update.callback_query
    await query.answer()

    db = SessionLocal()

    try:
        customer = get_customer(
            db,
            query.from_user
        )

        index = int(
            query.data.replace("address_select_", "")
        )

        stored_results = get_setting(
            db,
            f"address_search_results_{customer.id}"
        )

        if not stored_results:
            await query.message.reply_text(
                "Address search expired. Please type your address again."
            )
            return

        results = json.loads(stored_results)

        if index >= len(results):
            await query.message.reply_text(
                "Selected address was not found. Please type your address again."
            )
            return

        selected_location = results[index]

        latitude = str(selected_location["latitude"])
        longitude = str(selected_location["longitude"])
        google_maps_link = selected_location["google_maps_link"]
        location_label = selected_location["address"]

        customer.conversation_state = None
        db.commit()

        customer_request = log_customer_request(
            db,
            customer.id,
            "delivery_location",
            location_label,
            None,
            "typed_address",
            location_label,
            latitude,
            longitude,
            google_maps_link
        )

        save_message(
            db=db,
            customer_id=customer.id,
            direction="incoming",
            content=location_label,
            language=customer.preferred_language,
            message_type="typed_address_location"
        )

        await forward_customer_location_to_admin(
            context=context,
            db=db,
            customer=customer,
            customer_request_id=customer_request.id,
            location_label=location_label,
            google_maps_link=google_maps_link
        )

        await query.message.reply_text(
            "Location received. We will confirm delivery shortly."
        )

    finally:
        db.close()



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

        if (
            not is_within_working_hours(db)
            and option_data["key"] not in ["products", "contact_admin"]
        ):
            closed_reply = get_closed_hours_reply(
                db,
                customer.preferred_language or "en"
            )

            save_message(
                db=db,
                customer_id=customer.id,
                direction="outgoing",
                content=closed_reply,
                language=customer.preferred_language
            )

            await query.message.reply_text(
                closed_reply,
                reply_markup=get_closed_hours_keyboard(
                    customer.preferred_language or "en"
                )
            )
            return

        if selected_option == "2":
            await send_meeting_point_choice_or_direct(
                context=context,
                db=db,
                customer=customer,
                reply_target=query.message,
                incoming_text="Customer selected get my location"
            )
            return

        if selected_option == "3":
            log_customer_request(
                db,
                customer.id,
                "typed_address_started",
                "Customer selected type address"
            )

        if reply_text == "CHOOSE_MEETING_POINT":
            await send_meeting_point_choice_or_direct(
                context=context,
                db=db,
                customer=customer,
                reply_target=update.message,
                incoming_text=incoming_text
            )
            return

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

async def handle_location_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    db = SessionLocal()

    try:
        telegram_user = update.effective_user
        customer = get_customer(
            db,
            telegram_user
        )

        latitude = str(update.message.location.latitude)
        longitude = str(update.message.location.longitude)
        google_maps_link = make_google_maps_link(
            latitude,
            longitude
        )

        location_label = (
            f"Telegram shared location: {latitude}, {longitude}"
        )

        save_message(
            db=db,
            customer_id=customer.id,
            direction="incoming",
            content=google_maps_link,
            language=customer.preferred_language,
            message_type="telegram_location"
        )

        customer_request = log_customer_request(
            db,
            customer.id,
            "delivery_location",
            location_label,
            None,
            "telegram_location",
            location_label,
            latitude,
            longitude,
            google_maps_link
        )

        await forward_customer_location_to_admin(
            context=context,
            db=db,
            customer=customer,
            customer_request_id=customer_request.id,
            location_label=location_label,
            google_maps_link=google_maps_link
        )

        await update.message.reply_text(
            "Location received. We will confirm delivery shortly."
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

        if customer.conversation_state == "awaiting_typed_address":
            results = search_locations(incoming_text)[:7]

            if results:
                set_setting(
                    db,
                    f"address_search_results_{customer.id}",
                    json.dumps(results)
                )

                reply_text = (
                    "Please choose the correct location from the list."
                )

                save_message(
                    db=db,
                    customer_id=customer.id,
                    direction="outgoing",
                    content=reply_text,
                    language=customer.preferred_language
                )

                await update.message.reply_text(
                    reply_text,
                    reply_markup=get_address_choices_keyboard(results)
                )
                return

            reply_text = get_unresolved_options_reply(
                customer.preferred_language or "en"
            )

            await update.message.reply_text(
                reply_text,
                reply_markup=get_language_keyboard(
                    customer.preferred_language or "en"
                )
            )
            return

        reply_language = detected_language
        if reply_language == "unknown":
            reply_language = "en"

        reply_markup = None

        reply_text = get_option_reply(
            db,
            customer,
            incoming_text
        )

        clean_incoming_text = incoming_text.strip().lower()
        selected_menu_option = get_menu_option_by_text(incoming_text)
        selected_menu_key = (
            selected_menu_option["key"]
            if selected_menu_option
            else None
        )

        if (
            not is_within_working_hours(db)
            and selected_menu_key not in ["products", "contact_admin"]
        ):
            closed_reply = get_closed_hours_reply(
                db,
                customer.preferred_language or reply_language
            )

            save_message(
                db=db,
                customer_id=customer.id,
                direction="outgoing",
                content=closed_reply,
                language=customer.preferred_language
            )

            await update.message.reply_text(
                closed_reply,
                reply_markup=get_closed_hours_keyboard(
                    customer.preferred_language or reply_language
                )
            )
            return

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

        if (
            reply_text is None
            and is_location_request(incoming_text)
        ):
            await send_meeting_point_choice_or_direct(
                context=context,
                db=db,
                customer=customer,
                reply_target=update.message,
                incoming_text=incoming_text
            )
            return

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
        CommandHandler(
            "setsuperadmin",
            setsuperadmin_command
        )
    )

    application.add_handler(
        CallbackQueryHandler(
            handle_address_selection,
            pattern="^address_select_"
        )
    )

    application.add_handler(
        CallbackQueryHandler(
            handle_meeting_point_selection,
            pattern="^meeting_point_select_"
        )
    )

    application.add_handler(
        CallbackQueryHandler(
            handle_delivery_eta_selection,
            pattern="^delivery_"
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
            filters.LOCATION,
            handle_location_message
        )
    )

    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            handle_message
        )
    )

    return application
