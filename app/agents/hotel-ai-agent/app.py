import json
import logging
import re
from datetime import date
from typing import Any, TypedDict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_ollama import OllamaLLM
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END

from catalog import (
    detect_guest_count,
    detect_room_type_slug,
    detect_stay_dates,
    detect_view,
    filter_listings,
    format_cad,
    get_all_listings,
    is_browse_intent,
    normalize_booking_date,
)

logger = logging.getLogger(__name__)

api = FastAPI(title="Hotel Concierge Agent Bridge")
model = OllamaLLM(model="llama3", temperature=0.2)

HOTEL_NAME = "Hôtel Levio"

ROOM_TYPE_LABELS = {
    "twin": "Twin Room",
    "queen": "Queen Room",
    "king": "King Room",
    "suite": "Suite",
}


class BookingDetails(TypedDict, total=False):
    check_in_date: str | None
    check_out_date: str | None
    guests: int | None
    room_type_slug: str | None
    room_type: str | None
    view: str | None
    reason_for_trip: str | None
    intent: str
    all_details_collected: bool


class HotelReservationState(TypedDict):
    messages: List[BaseMessage]
    booking_details: BookingDetails
    available_rooms: List[dict[str, Any]]
    personalized_offer: str


def format_conversation(messages: List[BaseMessage]) -> str:
    lines: list[str] = []
    for message in messages:
        role = "Guest" if isinstance(message, HumanMessage) else "Concierge"
        lines.append(f"{role}: {message.content}")
    return "\n".join(lines)


def parse_json_from_llm(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def merge_booking_details(
    messages: List[BaseMessage],
    llm_details: dict[str, Any] | None = None,
) -> BookingDetails:
    conversation = format_conversation(messages)
    latest_user = next(
        (message.content for message in reversed(messages) if isinstance(message, HumanMessage)),
        "",
    )

    check_in, check_out = detect_stay_dates(conversation)
    room_type_slug = detect_room_type_slug(conversation)
    view = detect_view(conversation)
    guests = detect_guest_count(conversation)

    details: BookingDetails = {
        "check_in_date": check_in,
        "check_out_date": check_out,
        "guests": guests,
        "room_type_slug": room_type_slug,
        "room_type": ROOM_TYPE_LABELS.get(room_type_slug or "", None),
        "view": view,
        "reason_for_trip": None,
        "intent": "browse" if is_browse_intent(latest_user) else "book",
        "all_details_collected": False,
    }

    if llm_details:
        for key in (
            "check_in_date",
            "check_out_date",
            "guests",
            "room_type",
            "view",
            "reason_for_trip",
        ):
            value = llm_details.get(key)
            if value not in (None, "", "null"):
                if key == "guests":
                    try:
                        details["guests"] = int(value)
                    except (ValueError, TypeError):
                        # Keep the heuristic guest count when the LLM returns
                        # a non-numeric value like "two".
                        pass
                elif key == "room_type":
                    slug = detect_room_type_slug(str(value)) or room_type_slug
                    details["room_type_slug"] = slug
                    details["room_type"] = str(value)
                else:
                    details[key] = value  # type: ignore[literal-required]

        if llm_details.get("all_details_collected") is True:
            details["all_details_collected"] = True

    if details.get("room_type_slug"):
        slug = details["room_type_slug"]
        details["room_type"] = ROOM_TYPE_LABELS.get(slug, details.get("room_type"))

    details["check_in_date"] = normalize_booking_date(
        details.get("check_in_date"),
        conversation,
    )
    details["check_out_date"] = normalize_booking_date(
        details.get("check_out_date"),
        conversation,
    )

    details["all_details_collected"] = bool(
        details.get("check_in_date")
        and details.get("check_out_date")
        and details.get("guests")
        and details.get("room_type_slug")
    )

    return details


def extract_booking_details(messages: List[BaseMessage]) -> BookingDetails:
    llm_details: dict[str, Any] | None = None
    current_year = date.today().year
    extraction_prompt = (
        "You extract structured hotel booking facts from a concierge chat.\n"
        f"Hotel: {HOTEL_NAME} in Old Port Montréal.\n"
        f"Today's date: {date.today().isoformat()}.\n"
        f"Conversation:\n{format_conversation(messages)}\n\n"
        "Return ONLY valid JSON with keys:\n"
        "check_in_date (YYYY-MM-DD or null),\n"
        "check_out_date (YYYY-MM-DD or null),\n"
        "guests (integer or null),\n"
        "room_type (Twin Room | Queen Room | King Room | Suite | null),\n"
        "view (Lower Level | Lake View | City View | null),\n"
        "reason_for_trip (string or null),\n"
        "all_details_collected (boolean).\n"
        f"If the guest omits a year, use {current_year}. "
        "If that month/day is already past this year, use the next calendar year.\n"
        "Use null when unknown."
    )

    try:
        raw_json_response = model.invoke(extraction_prompt)
        llm_details = parse_json_from_llm(str(raw_json_response))
    except Exception:
        logger.warning("LLM extraction failed; falling back to heuristics")

    return merge_booking_details(messages, llm_details)


def build_concierge_reply(
    details: BookingDetails,
    listings: list[dict[str, Any]],
) -> str:
    if details.get("all_details_collected") and listings:
        lead = listings[0]
        return (
            f"Perfect — I found {len(listings)} matching option(s) for "
            f"{details['guests']} guest(s) from {details['check_in_date']} to {details['check_out_date']}.\n\n"
            f"My top recommendation is {lead['room']} from {lead['price_display']}/night. "
            "Browse the site to add your preferred listing to the cart, or tell me if you'd like another view."
        )

    if listings and details.get("intent") == "browse":
        lines = [
            f"At {HOTEL_NAME}, we offer Twin, Queen, King, and Suite categories — each in Lower Level, Lake View, and City View.",
            "",
            "Here are some options that may suit you:",
        ]
        for item in listings[:4]:
            lines.append(
                f"• {item['room']} — from {item['price_display']}/night · sleeps {item['capacity']}"
            )
        lines.append("")
        lines.append(
            "Share your check-in, check-out, guest count, and preferred room type if you'd like me to narrow this further."
        )
        return "\n".join(lines)

    missing: list[str] = []
    if not details.get("check_in_date"):
        missing.append("check-in date")
    if not details.get("check_out_date"):
        missing.append("check-out date")
    if not details.get("guests"):
        missing.append("number of guests")
    if not details.get("room_type_slug"):
        missing.append("room type (Twin, Queen, King, or Suite)")

    if missing:
        return (
            f"Welcome to {HOTEL_NAME}. I'd be delighted to help you plan your stay in Old Port Montréal.\n\n"
            f"To recommend the best room, could you share your {' and '.join(missing)}?"
        )

    return (
        f"Thank you — I'm reviewing options at {HOTEL_NAME} for your stay. "
        "Ask me to show room types or rates any time."
    )


def concierge_chat(state: HotelReservationState):
    messages = state["messages"]
    details = extract_booking_details(messages)
    listings = select_listings(details)

    reply = build_concierge_reply(details, listings)

    return {
        "messages": [AIMessage(content=reply)],
        "booking_details": details,
        "available_rooms": listings,
    }


def select_listings(details: BookingDetails) -> list[dict[str, Any]]:
    min_capacity = details.get("guests")
    room_type_slug = details.get("room_type_slug")
    view = details.get("view")

    if details.get("intent") == "browse" and not room_type_slug and not view:
        return filter_listings(max_results=6)

    if details.get("all_details_collected"):
        return filter_listings(
            room_type_slug=room_type_slug,
            view=view,
            min_capacity=min_capacity,
            max_results=4,
        )

    if room_type_slug or view or min_capacity:
        return filter_listings(
            room_type_slug=room_type_slug,
            view=view,
            min_capacity=min_capacity,
            max_results=4,
        )

    return []


def dynamic_upsell(state: HotelReservationState):
    details = state["booking_details"]
    listings = state.get("available_rooms") or []
    room_info = listings[0] if listings else {"room": "Suite", "price_display": format_cad(39900)}

    upsell_prompt = (
        f"Guest at {HOTEL_NAME} booked {room_info['room']} "
        f"from {details.get('check_in_date')} to {details.get('check_out_date')} "
        f"for {details.get('reason_for_trip') or 'a special stay'}. "
        "Write a 2-sentence luxury upsell (champagne, late checkout, spa, etc.). "
        "Mention CAD pricing only if suggesting a paid add-on under $100."
    )

    try:
        offer = str(model.invoke(upsell_prompt)).strip()
    except Exception:
        offer = (
            f"May we arrange a welcome amenity in your {room_info['room']}? "
            "Our team can add sparkling wine or late checkout on request."
        )

    return {"personalized_offer": offer}


def route_after_chat(state: HotelReservationState):
    if state["booking_details"].get("all_details_collected"):
        return "upsell"
    return "end"


workflow = StateGraph(HotelReservationState)
workflow.add_node("concierge", concierge_chat)
workflow.add_node("upsell", dynamic_upsell)
workflow.set_entry_point("concierge")
workflow.add_conditional_edges(
    "concierge",
    route_after_chat,
    {"upsell": "upsell", "end": END},
)
workflow.add_edge("upsell", END)
agent_app = workflow.compile()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatPayload(BaseModel):
    messages: List[ChatMessage]


@api.get("/api/agent/catalog")
async def get_catalog():
    return {"listings": get_all_listings()}


@api.post("/api/agent")
async def handle_chat(payload: ChatPayload):
    try:
        langchain_messages: list[BaseMessage] = []
        for msg in payload.messages:
            if msg.role == "user":
                langchain_messages.append(HumanMessage(content=msg.content))
            else:
                langchain_messages.append(AIMessage(content=msg.content))

        result = await agent_app.ainvoke(
            {
                "messages": langchain_messages,
                "booking_details": {},
                "available_rooms": [],
                "personalized_offer": "",
            }
        )

        booking_details = result.get("booking_details", {})
        available_rooms = result.get("available_rooms", [])

        return {
            "reply": result["messages"][-1].content,
            "booking_details": booking_details,
            "available_rooms": available_rooms,
            "personalized_offer": result.get("personalized_offer", ""),
            "meta": {
                "hotel": HOTEL_NAME,
                "listing_count": len(available_rooms),
                "currency": "CAD",
            },
        }
    except Exception as exc:
        logger.exception("Agent request failed")
        raise HTTPException(
            status_code=500,
            detail=(
                "The concierge agent is temporarily unavailable. "
                "Please try again in a moment."
            ),
        ) from exc
