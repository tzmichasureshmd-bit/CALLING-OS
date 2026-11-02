"""Phone-number normalization shared by ingestion and privacy controls."""

import re


def normalize_phone(phone: str | None) -> str:
    if not phone or phone.strip() in ("", "unknown"):
        return phone or ""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())[:16]
    if cleaned.startswith("+") and len(cleaned) >= 8:
        return cleaned
    digits = re.sub(r"\D", "", cleaned)
    if not digits:
        return phone
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    return f"+{digits}"
