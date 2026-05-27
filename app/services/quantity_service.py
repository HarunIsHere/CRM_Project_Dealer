import re


NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "bir": 1,
    "iki": 2,
    "üç": 3,
    "uc": 3,
    "dört": 4,
    "dort": 4,
    "beş": 5,
    "bes": 5,
    "ein": 1,
    "eine": 1,
    "zwei": 2,
    "drei": 3,
    "vier": 4,
    "fünf": 5,
    "funf": 5,
}


def extract_quantity(text: str) -> int | None:
    clean_text = text.lower().strip()

    digit_match = re.search(r"\b\d+\b", clean_text)
    if digit_match:
        return int(digit_match.group())

    for word, number in NUMBER_WORDS.items():
        if re.search(rf"\b{re.escape(word)}\b", clean_text):
            return number

    return None
