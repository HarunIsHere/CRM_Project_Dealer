from app.models.app_setting import AppSetting


def get_setting(db, key: str):
    setting = db.query(AppSetting).filter(
        AppSetting.key == key
    ).first()

    if not setting:
        return None

    return setting.value


def set_setting(db, key: str, value: str):
    setting = db.query(AppSetting).filter(
        AppSetting.key == key
    ).first()

    if not setting:
        setting = AppSetting(
            key=key,
            value=value
        )
        db.add(setting)
    else:
        setting.value = value

    db.commit()

    return setting
