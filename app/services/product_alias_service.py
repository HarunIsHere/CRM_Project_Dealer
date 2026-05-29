import unicodedata

from app.models.product_alias import ProductAlias


def normalize_alias(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower().strip())
    return "".join(
        char
        for char in normalized
        if not unicodedata.combining(char)
    )


def generate_basic_aliases(product_name: str) -> set[str]:
    aliases = set()

    clean_name = product_name.lower().strip()
    normalized_name = normalize_alias(product_name)

    aliases.add(clean_name)
    aliases.add(normalized_name)

    for word in clean_name.split():
        if len(word) >= 3:
            aliases.add(word)

    for word in normalized_name.split():
        if len(word) >= 3:
            aliases.add(word)

    return {
        alias
        for alias in aliases
        if alias
    }


def sync_auto_aliases(db, product):
    existing_aliases = {
        alias.alias
        for alias in db.query(ProductAlias).filter(
            ProductAlias.product_id == product.id
        ).all()
    }

    for alias_text in generate_basic_aliases(product.name):
        if alias_text not in existing_aliases:
            db.add(
                ProductAlias(
                    product_id=product.id,
                    alias=alias_text
                )
            )

    db.commit()


def replace_manual_aliases(db, product_id: int, aliases_text: str):
    db.query(ProductAlias).filter(
        ProductAlias.product_id == product_id
    ).delete()

    aliases = generate_basic_aliases(aliases_text)

    for raw_alias in aliases_text.split(","):
        alias = normalize_alias(raw_alias)
        if alias:
            aliases.add(alias)

    for alias_text in aliases:
        db.add(
            ProductAlias(
                product_id=product_id,
                alias=alias_text
            )
        )

    db.commit()


def get_alias_text_for_product(db, product_id: int) -> str:
    aliases = db.query(ProductAlias).filter(
        ProductAlias.product_id == product_id
    ).order_by(
        ProductAlias.alias.asc()
    ).all()

    return ", ".join(
        alias.alias
        for alias in aliases
    )
