import asyncio

from telegram import Bot

from app.core.config import settings


def send_admin_reply_to_customer(
    telegram_user_id: str,
    message_text: str
):
    asyncio.run(
        send_telegram_message(
            telegram_user_id,
            message_text
        )
    )


async def send_telegram_message(
    telegram_user_id: str,
    message_text: str
):
    bot = Bot(
        token=settings.telegram_bot_token
    )

    await bot.send_message(
        chat_id=telegram_user_id,
        text=message_text
    )
