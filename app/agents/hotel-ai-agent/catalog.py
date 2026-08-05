"""Hôtel Levio public listing catalog — mirrors seed pricing in lib/seed-types.ts."""

from __future__ import annotations

import math
import re
from datetime import date
from typing import Any

LOWER_LEVEL_PRICE_CENTS = 11900
LAKE_VIEW_MULTIPLIER = 1.25
VIEWS = ("Lower Level", "Lake View", "City View")

ROOM_TYPES: dict[str, dict[str, Any]] = {
    "twin": {
        "label": "Twin Room",
        "base_price_cents": 12900,
        "capacity": 2,
        "beds": 2,
        "amenities": [
            "Two single beds",
            "Free Wi-Fi",
            "Writing desk",
            "En-suite bathroom",
        ],
    },
    "queen": {
        "label": "Queen Room",
        "base_price_cents": 18900,
        "capacity": 4,
        "beds": 2,
        "amenities": [
            "Two queen beds",
            "Microwave",
            "Work desk",
            "Sleeps up to 4",
        ],
    },
    "king": {
        "label": "King Room",
        "base_price_cents": 22900,
        "capacity": 2,
        "beds": 1,
        "amenities": [
            "King bed",
            "Walk-in shower",
            "Nespresso machine",
            "Sofa seating",
        ],
    },
    "suite": {
        "label": "Suite",
        "base_price_cents": 39900,
        "capacity": 4,
        "beds": 2,
        "amenities": [
            "Two king beds",
            "Living area",
            "Kitchenette",
            "Soaking tub",
        ],
    },
}

ROOM_TYPE_ALIASES: dict[str, str] = {
    "twin": "twin",
    "twins": "twin",
    "double": "twin",
    "queen": "queen",
    "queens": "queen",
    "family": "queen",
    "king": "king",
    "suite": "suite",
    "suites": "suite",
    "penthouse": "suite",
}


def subcategory_price_cents(type_base_cents: int, view: str) -> int:
    if view == "Lower Level":
        return LOWER_LEVEL_PRICE_CENTS
    if view == "Lake View":
        return math.ceil((type_base_cents * LAKE_VIEW_MULTIPLIER) / 100) * 100
    return type_base_cents


def format_cad(cents: int) -> str:
    return f"CA ${cents // 100:,}"


def get_all_listings() -> list[dict[str, Any]]:
    listings: list[dict[str, Any]] = []
    for slug, meta in ROOM_TYPES.items():
        for view in VIEWS:
            cents = subcategory_price_cents(meta["base_price_cents"], view)
            listings.append(
                {
                    "room": f"{meta['label']} · {view}",
                    "room_type_slug": slug,
                    "room_type_name": meta["label"],
                    "view": view,
                    "capacity": meta["capacity"],
                    "beds": meta["beds"],
                    "price_per_night_cents": cents,
                    "price_display": format_cad(cents),
                    "amenities": meta["amenities"],
                    "featured": view == "Lake View",
                }
            )
    return listings


def filter_listings(
    *,
    room_type_slug: str | None = None,
    view: str | None = None,
    min_capacity: int | None = None,
    max_results: int = 6,
) -> list[dict[str, Any]]:
    results = get_all_listings()

    if room_type_slug:
        results = [item for item in results if item["room_type_slug"] == room_type_slug]

    if view:
        results = [item for item in results if item["view"].lower() == view.lower()]

    if min_capacity:
        results = [item for item in results if item["capacity"] >= min_capacity]

    featured = [item for item in results if item["featured"]]
    regular = [item for item in results if not item["featured"]]
    ordered = featured + regular

    return ordered[:max_results]


def detect_room_type_slug(text: str) -> str | None:
    lowered = text.lower()
    for alias, slug in ROOM_TYPE_ALIASES.items():
        if re.search(rf"\b{re.escape(alias)}\b", lowered):
            return slug
    return None


def detect_view(text: str) -> str | None:
    lowered = text.lower()
    if "lake view" in lowered or "lake-view" in lowered:
        return "Lake View"
    if "city view" in lowered or "city-view" in lowered:
        return "City View"
    if "lower level" in lowered:
        return "Lower Level"
    return None


def detect_guest_count(text: str) -> int | None:
    match = re.search(
        r"\b(\d+)\s*(guests?|people|persons?|travelers?|travellers?)\b",
        text,
        re.IGNORECASE,
    )
    if match:
        return int(match.group(1))
    # Bare "for N" fallback: bound to 1-2 digits so 4-digit years never match,
    # and skip durations like "for 3 nights" / "for 5 days".
    match = re.search(
        r"\bfor\s+(\d{1,2})\b(?!\s*(?:night|day|week|month|year)s?)",
        text,
        re.IGNORECASE,
    )
    if match:
        return int(match.group(1))
    return None


def detect_iso_dates(text: str) -> list[str]:
    return re.findall(r"\b(20\d{2}-\d{2}-\d{2})\b", text)


MONTH_NAME_TO_NUMBER: dict[str, int] = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

MONTH_PATTERN = (
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"
    r"nov(?:ember)?|dec(?:ember)?)"
)


def conversation_mentions_explicit_year(text: str) -> bool:
    current_year = date.today().year
    for year in range(current_year - 1, current_year + 3):
        if re.search(rf"\b{year}\b", text):
            return True
    return False


def safe_date(year: int, month: int, day: int) -> date | None:
    """Construct a date, returning None for invalid month/day combinations."""
    try:
        return date(year, month, day)
    except ValueError:
        return None


def safe_iso(year: int, month: int, day: int) -> str | None:
    constructed = safe_date(year, month, day)
    return constructed.isoformat() if constructed is not None else None


def resolve_year_for_month_day(
    month: int, day: int, explicit_year: int | None = None
) -> int | None:
    if explicit_year is not None:
        return explicit_year

    today = date.today()
    candidate = safe_date(today.year, month, day)
    if candidate is None:
        return None
    if candidate >= today:
        return today.year
    return today.year + 1


def iso_from_parts(
    month: int,
    day: int,
    *,
    explicit_year: int | None = None,
) -> str | None:
    year = resolve_year_for_month_day(month, day, explicit_year)
    if year is None:
        return None
    return safe_iso(year, month, day)


def parse_month_name(raw: str) -> int | None:
    return MONTH_NAME_TO_NUMBER.get(raw.lower())


def normalize_booking_date(value: str | None, conversation: str) -> str | None:
    if not value or value in ("null", ""):
        return None

    try:
        parsed = date.fromisoformat(str(value)[:10])
    except ValueError:
        return None

    if conversation_mentions_explicit_year(conversation):
        return parsed.isoformat()

    year = resolve_year_for_month_day(parsed.month, parsed.day)
    if year is None:
        return parsed.isoformat()
    normalized = safe_iso(year, parsed.month, parsed.day)
    return normalized if normalized is not None else parsed.isoformat()


def detect_natural_stay_dates(text: str) -> tuple[str | None, str | None]:
    explicit_year: int | None = None
    year_match = re.search(r"\b(20\d{2})\b", text)
    if year_match:
        explicit_year = int(year_match.group(1))

    same_month_range = re.search(
        rf"\b{MONTH_PATTERN}\s+(\d{{1,2}})\s*(?:-|–|to|through)\s*(\d{{1,2}})\b",
        text,
        re.IGNORECASE,
    )
    if same_month_range:
        month = parse_month_name(same_month_range.group(1))
        if month:
            check_in_day = int(same_month_range.group(2))
            check_out_day = int(same_month_range.group(3))
            check_in_year = explicit_year or resolve_year_for_month_day(
                month, check_in_day
            )
            if check_in_year is None:
                return None, None
            if explicit_year is not None:
                check_out_year = explicit_year
            elif check_out_day <= check_in_day:
                check_out_year = check_in_year + 1
            else:
                check_out_year = check_in_year
            return (
                safe_iso(check_in_year, month, check_in_day),
                safe_iso(check_out_year, month, check_out_day),
            )

    cross_month_range = re.search(
        rf"\b{MONTH_PATTERN}\s+(\d{{1,2}})\s*(?:-|–|to|through)\s+{MONTH_PATTERN}\s+(\d{{1,2}})\b",
        text,
        re.IGNORECASE,
    )
    if cross_month_range:
        check_in_month = parse_month_name(cross_month_range.group(1))
        check_out_month = parse_month_name(cross_month_range.group(3))
        if check_in_month and check_out_month:
            check_in_day = int(cross_month_range.group(2))
            check_out_day = int(cross_month_range.group(4))
            check_in_year = explicit_year or resolve_year_for_month_day(
                check_in_month, check_in_day
            )
            if check_in_year is None:
                return None, None
            if explicit_year is not None:
                check_out_year = explicit_year
            elif check_out_month < check_in_month or (
                check_out_month == check_in_month and check_out_day <= check_in_day
            ):
                check_out_year = check_in_year + 1
            else:
                check_out_year = check_in_year
            return (
                safe_iso(check_in_year, check_in_month, check_in_day),
                safe_iso(check_out_year, check_out_month, check_out_day),
            )

    month_day_matches = re.findall(
        rf"\b{MONTH_PATTERN}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b",
        text,
        re.IGNORECASE,
    )
    if len(month_day_matches) >= 2:
        first_month = parse_month_name(month_day_matches[0][0])
        second_month = parse_month_name(month_day_matches[1][0])
        if first_month and second_month:
            first_day = int(month_day_matches[0][1])
            second_day = int(month_day_matches[1][1])
            check_in_year = explicit_year or resolve_year_for_month_day(
                first_month, first_day
            )
            if check_in_year is None:
                return None, None
            if explicit_year is not None:
                check_out_year = explicit_year
            elif second_month < first_month or (
                second_month == first_month and second_day <= first_day
            ):
                check_out_year = check_in_year + 1
            else:
                check_out_year = check_in_year
            return (
                safe_iso(check_in_year, first_month, first_day),
                safe_iso(check_out_year, second_month, second_day),
            )

    if len(month_day_matches) == 1:
        month = parse_month_name(month_day_matches[0][0])
        if month:
            day = int(month_day_matches[0][1])
            return iso_from_parts(month, day, explicit_year=explicit_year), None

    slash_range = re.search(
        r"\b(\d{1,2})/(\d{1,2})\s*(?:-|–|to|through)\s*(\d{1,2})/(\d{1,2})\b",
        text,
    )
    if slash_range:
        check_in_month = int(slash_range.group(1))
        check_in_day = int(slash_range.group(2))
        check_out_month = int(slash_range.group(3))
        check_out_day = int(slash_range.group(4))
        check_in_year = explicit_year or resolve_year_for_month_day(
            check_in_month, check_in_day
        )
        if check_in_year is None:
            return None, None
        if explicit_year is not None:
            check_out_year = explicit_year
        elif check_out_month < check_in_month or (
            check_out_month == check_in_month and check_out_day <= check_in_day
        ):
            check_out_year = check_in_year + 1
        else:
            check_out_year = check_in_year
        return (
            safe_iso(check_in_year, check_in_month, check_in_day),
            safe_iso(check_out_year, check_out_month, check_out_day),
        )

    return None, None


def detect_stay_dates(text: str) -> tuple[str | None, str | None]:
    iso_dates = detect_iso_dates(text)
    if len(iso_dates) >= 2:
        return (
            normalize_booking_date(iso_dates[0], text),
            normalize_booking_date(iso_dates[1], text),
        )
    if len(iso_dates) == 1:
        natural_check_in, natural_check_out = detect_natural_stay_dates(text)
        check_in = normalize_booking_date(iso_dates[0], text)
        check_out = natural_check_out or None
        return check_in, check_out

    return detect_natural_stay_dates(text)


def is_browse_intent(text: str) -> bool:
    lowered = text.lower()
    keywords = (
        "what room",
        "which room",
        "room type",
        "options",
        "available",
        "show me",
        "list",
        "price",
        "rates",
        "stay",
        "recommend",
    )
    return any(keyword in lowered for keyword in keywords)
