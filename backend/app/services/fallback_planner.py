"""Deterministic fallback planner.

Produces a complete itinerary without any LLM call so the product always
works in demos, tests and when the AI provider is down.
"""

from __future__ import annotations

from typing import Callable

from app.schemas import (
    ActivityKind,
    DayActivity,
    DayPlan,
    DestinationRecord,
    DietaryPreference,
    PlanRequest,
    RouteLeg,
)
from app.services.routing import (
    assign_nights,
    build_legs,
    build_stay_spans,
    nearest_neighbor_order,
)
from app.data.loader import require_destination
from app.services.recommendation import select_destinations

# Picks the next unused highlight for a destination (per-stop cursor).
HighlightPicker = Callable[[DestinationRecord], str]


def plan_fallback(request: PlanRequest) -> tuple[str, list[DayPlan], list[RouteLeg]]:
    """Convenience wrapper: select stops, route them and build the itinerary.

    Fully deterministic for a given request.
    """
    start = require_destination(request.start_city)
    final = None
    if request.final_destination:
        final = require_destination(request.final_destination)
        if final.id == start.id:
            final = None

    selected = [item.destination for item in select_destinations(request)]
    if start.id not in {d.id for d in selected}:
        selected.insert(0, start)
    if final is not None and final.id not in {d.id for d in selected}:
        selected.append(final)

    order = nearest_neighbor_order(selected, start)
    if final is not None:
        order = [d for d in order if d.id != final.id] + [final]

    if len(order) > request.days:
        if final is not None and order[-1].id == final.id:
            intermediates = order[1:-1]
            order = [order[0]] + intermediates[: max(0, request.days - 2)] + [final]
            if len(order) > request.days:
                order = [final]
        else:
            order = order[: request.days]

    nightly_plan = assign_nights(order, request.days, request.pace)
    legs = build_legs(nightly_plan, request.transport_preference)
    summary, itinerary = build_fallback_itinerary(request, nightly_plan, legs, order)
    return summary, itinerary, legs


# Curated Karnataka regional culinary highlights
DESTINATION_FOOD_SUGGESTIONS: dict[str, str] = {
    "bengaluru": "Crispy Benne Masala Dosa and filter coffee at Vidyarthi Bhavan or CTR; Bisi Bele Bath and Akki Rotti with coconut chutney.",
    "mysuru": "Original Mylari butter masala dosa at Hotel Original Vinayaka Mylari; warm Mysore Pak from Guru Sweet Mart; traditional plantain-leaf South Karnataka thali.",
    "srirangapatna": "Local Kaveri river freshwater fish curry or Mandya-style Ragi Mudde with Bassaru, and fresh tender coconut water along the riverbanks.",
    "ranganathittu": "Packed picnic breakfast or tender coconut water along the Kaveri river banks; traditional vegetarian thali in nearby Srirangapatna.",
    "hampi": "Mango Tree's special banana flower curry and thali; local Jolada Rotti (sorghum flatbread) with Yennegai (spiced stuffed baby brinjal) and Shenga chutney.",
    "badami": "Authentic North Karnataka Jolada Rotti meals with Yennegai, spicy peanut chutney, red chili thecha, and fresh thick buffalo curd.",
    "aihole": "Traditional Bagalkot-style Jowar rotti with roasted gram chutney, sprouts usli, and freshly churned butter.",
    "pattadakal": "Traditional North Karnataka rural meals with Jolada rotti, sprouts usli, and freshly churned butter.",
    "gokarna": "Coastal fish curry or Neer Dosa with vegetable gassi at Namaste Cafe on Om Beach; chilled Kokum sherbet and local cashew sweets.",
    "udupi": "World-famous satvik Udupi Brahmin oota at Mitra Samaj; Goli Baje, Neer Dosa, and authentic filter coffee near Sri Krishna Matha.",
    "mangaluru": "Iconic Mangalorean cuisine: Neer Dosa with Kori Gassi (chicken curry) or vegetable stew, Mangalore Buns, and Ghee Roast.",
    "murudeshwar": "Fresh coastal Karavali meals with red rice, fish fry / fried raw banana podi, and local Sol Kadi.",
    "madikeri": "Traditional Kodava spread: Akki Roti with Kadambuttu (steamed rice balls) and bamboo shoot curry (or Coorg Pandi curry), followed by fresh Coorg Arabica coffee.",
    "chikkamagaluru": "Malnad specialties: Akki Rotti with Kaayi chutney, steaming Pathrode (colocasia leaf roll), and estate-fresh roasted Arabica filter coffee.",
    "kabini": "Jungle resort buffet featuring Kodagu-Mysuru fusion dishes, steaming Ragi Mudde with soppina saaru, and herbal decoction tea.",
    "bandipur": "South Karnataka forest meals: steamed Ragi Mudde, vegetable sambar, freshly cooked country beans, and spiced buttermilk.",
    "hassan": "Hoysala region classics: Ragi Mudde with soppina saaru, sweet Obbattu/Holige, and crisp Akki Shavige.",
    "belur": "Authentic Hassan-style vegetarian lunch: hot Akki Rotti with coconut chutney and Obbattu.",
    "shravanabelagola": "Traditional Jain and satvik Karnataka oota: mild sambar, steamed rice, rasam, and fresh payasam.",
    "melkote": "Iconic Melkote Puliyogare (tangy tamarind rice) and sweet Sakkare Pongal from Subbanna Mess.",
    "somnathpur": "Traditional rural South Karnataka vegetarian meals with hot rice, huli (sambar), and spiced buttermilk.",
    "agumbe": "Malnad forest culinary special: Halasina Hannina Happala (jackfruit pappad), steaming Kashaya herbal drink, and Thambli.",
    "dandeli": "North Canara border cuisine: Jowar rotti with local greens, bamboo shoot stir fry, and kokum curry.",
    "jog-falls": "Simple Sahyadri hill-station canteen meals: hot Mirchi Bajji with chai, lemon rice, and curd rice.",
    "kudremukh": "Nutritious Malnad trekking meals: hot ganji (rice porridge) with mango pickle, neer dosa, and black pepper tea.",
    "nandi-hills": "Early morning hot Masala Dosa, vegetable upma, and steaming south Indian filter coffee after sunrise.",
    "ramanagara": "Silk city snacks: crispy Maddur Vada fresh from local vendors along the highway, with hot chai.",
}

DESTINATION_LOCAL_TIPS: dict[str, str] = {
    "bengaluru": "Use the Namma Metro (Purple & Green lines) to beat peak-hour road traffic between central sights; early morning weekend walks are ideal for parks.",
    "mysuru": "Mysore Palace illumination occurs on Sundays and public holidays (7:00 PM – 7:45 PM); visit Chamundi Hill before 8:00 AM to beat pilgrimage lines.",
    "srirangapatna": "Hire a certified local ASI guide outside the fort gate for 45 minutes to appreciate Tipu Sultan's rocket launching posts and river defences.",
    "ranganathittu": "Early morning (8:30 AM) boat rides offer the best bird photography and closest crocodile sightings with calm river currents.",
    "hampi": "Rent an electric scooter or bicycle to navigate the 26 sq km heritage complex; wear comfortable slip-on walking shoes as temple sanctums require removing footwear.",
    "badami": "Visit the Cave Temples at 7:00 AM when the morning sun lights up the red sandstone carvings and the site is free of tour buses.",
    "aihole": "Aihole is known as the 'cradle of Hindu temple architecture'—start at the Durga Temple complex which has the museum and site orientation.",
    "pattadakal": "The temples showcase both Dravidian and Nagara northern architectural styles side-by-side; carry an umbrella as shade between monuments is limited.",
    "gokarna": "Carry cash as beach shacks frequently have erratic digital payment connectivity; the cliff trail between Kudle and Om beach is best walked at low tide.",
    "udupi": "Dress code at Sri Krishna Matha requires men to remove shirts and women to dress modestly (salwar/saree); visit Kanakana Kindi window on the outer wall.",
    "mangaluru": "Panambur Beach is best for sunset and watersports; try to reach central seafood and food markets before 1:00 PM.",
    "murudeshwar": "Take the 18-storey elevator inside the Raja Gopura for a panoramic 360-degree aerial view of the colossal Shiva statue and Arabian Sea.",
    "madikeri": "Carry a light sweater or rain jacket year-round; visit Abbey Falls early morning and book a private estate coffee tour.",
    "chikkamagaluru": "Drive up Mullayanagiri peak before 8:00 AM; after 9:30 AM narrow mountain passes suffer vehicle congestion and heavy mist.",
    "kabini": "Kabini jungle safaris should be pre-booked online through the forest department; evening boat safaris along the backwaters offer the highest elephant herd sightings.",
    "bandipur": "Wear neutral earth-toned clothing (khaki, olive, brown) on safaris and avoid speaking loudly; maintain absolute silence around elephant crossings.",
    "hassan": "Belur and Halebidu are 30 mins apart; visit Belur in the morning and Halebidu in late afternoon when warm sunlight brings out the soapstone carvings.",
    "belur": "Don't miss the 42 Madanika bracket figures under the eaves of Chennakeshava Temple—each represents a unique classical dance pose.",
    "shravanabelagola": "There are 600+ stone steps carved into the bare granite hill to reach the Gommateshwara statue; climb before 8:30 AM to avoid burning your feet on heated stone.",
    "melkote": "Melkote is famed for handloom cotton dhotis and sarees; the Yoga Narasimha Temple atop the rocky hill provides panoramic plains views.",
    "somnathpur": "The Keshava Temple here is one of the most complete and best-preserved Hoysala marvels, with 3 star-shaped sanctums and star plinths.",
    "agumbe": "Known as the 'Cherrapunji of the South', visit the Sunset Point viewpoint overlooking the Western Ghats; apply insect repellent on rainforest trails.",
    "dandeli": "River rafting on the Kali River depends on upstream dam water release (usually between 9:00 AM and 1:00 PM); confirm water release schedules with your guide.",
    "nandi-hills": "Entry gate opens at 6:00 AM; arrive by 5:30 AM on weekends to secure a spot at the sunrise viewpoint above the cloud bed.",
    "ramanagara": "Famous as the filming location for 'Sholay'; great for rock climbing and bouldering, but avoid afternoon heat as rocks heat up quickly.",
}

REGION_FOOD_DEFAULTS: dict[str, str] = {
    "Coastal Karnataka": "Fresh Karavali coastal thali with Neer Dosa, coconut vegetable curry, and refreshing Kokum juice.",
    "Malnad": "Authentic Malnad Akki Rotti with fresh coconut chutney, steaming herbal Kashaya, and estate coffee.",
    "North Karnataka": "Classic North Karnataka Jolada Rotti meal with Yennegai (brinjal curry), Shenga chutney, and fresh buttermilk.",
    "South Karnataka": "Traditional Karnataka plantain leaf oota with Bisi Bele Bath, Ragi Mudde, and Mysore Pak.",
    "Central Karnataka": "Crispy Davangere Benne Dosa with spiced potato palya and coconut chutney.",
    "Capital Region": "South Indian filter coffee, crispy Masala Dosa, and regional thalis.",
}

REGION_TIP_DEFAULTS: dict[str, str] = {
    "Coastal Karnataka": "Swim only in designated lifeguard zones; carry cash as beach shacks frequently have spotty card networks.",
    "Malnad": "Start outdoor nature walks before 9:00 AM; carry hydration and a light jacket as mountain temperatures drop swiftly in the evening.",
    "North Karnataka": "Visit open monument complexes early morning to avoid peak afternoon sun; carry hydration and wear slip-on walking shoes.",
    "South Karnataka": "Check temple opening hours in advance; dress modestly covering shoulders and knees when entering temple precincts.",
    "Capital Region": "Use public transit or metro during peak office rush hours (8:30-10:30 AM, 5:30-8:00 PM) for effortless navigation.",
}


def get_food_suggestion(destination: DestinationRecord, dietary: DietaryPreference) -> str:
    base = destination.local_dish or DESTINATION_FOOD_SUGGESTIONS.get(
        destination.id,
        REGION_FOOD_DEFAULTS.get(destination.region, "Regional Karnataka thali with local specialties.")
    )
    if dietary is DietaryPreference.vegetarian:
        return f"{base} (Vegetarian options prioritized: satvik preparation, vegetable curries, and regional sweets.)"
    if dietary is DietaryPreference.vegan:
        return f"{base} (Vegan options prioritized: dairy-free coconut gravies, steamed neer dosa, and fresh local fruit.)"
    if dietary is DietaryPreference.jain:
        return f"{base} (Jain options prioritized: prepared without onion, garlic, or root vegetables.)"
    if dietary is DietaryPreference.non_vegetarian:
        return f"{base} (Non-vegetarian specialties included: local coastal fish or regional country meat preparations.)"
    return base


def get_local_tip(destination: DestinationRecord) -> str:
    return destination.practical_tip or DESTINATION_LOCAL_TIPS.get(
        destination.id,
        REGION_TIP_DEFAULTS.get(
            destination.region,
            f"Start your visits early in {destination.name} to enjoy cooler hours and unhurried exploration."
        )
    )


def get_best_time_tip(destination: DestinationRecord) -> str:
    return destination.best_time_tip or f"Best visited during the pleasant post-monsoon and winter months for comfortable sightseeing in {destination.name}."


def get_primary_dish(destination: DestinationRecord) -> str:
    sugg = destination.local_dish or DESTINATION_FOOD_SUGGESTIONS.get(destination.id, "")
    if not sugg:
        return f"authentic {destination.region} cuisine"
    first_part = sugg.split(";")[0].split(" accompanied")[0].strip()
    if len(first_part) > 60:
        first_part = first_part.split(",")[0].strip()
    return first_part or f"regional specialties of {destination.name}"


def build_fallback_itinerary(
    request: PlanRequest,
    nightly_plan: list[tuple[int, DestinationRecord]],
    legs: list[RouteLeg],
    order: list[DestinationRecord],
) -> tuple[str, list[DayPlan]]:
    """Turn a day allocation into narrative day plans (no I/O, fully deterministic)."""
    legs_by_day = {leg.day: leg for leg in legs}

    # Contiguous stays, so a multi-day stop knows its position in the stay.
    stays = build_stay_spans(nightly_plan)
    stay_by_day: dict[int, StaySpan] = {
        day: span for span in stays for day in range(span.first_day, span.last_day + 1)
    }

    # Each destination gets its own highlight cursor so two days at the same
    # stop never repeat the same sightseeing highlight.
    highlight_offsets: dict[str, int] = {}

    def next_highlight(destination: DestinationRecord) -> str:
        highlights = destination.highlights or [destination.name]
        offset = highlight_offsets.get(destination.id, 0)
        highlight_offsets[destination.id] = offset + 1
        return highlights[offset % len(highlights)]

    itinerary: list[DayPlan] = []

    for day, destination in nightly_plan:
        span = stay_by_day[day]
        stay_day = day - span.first_day + 1
        leg = legs_by_day.get(day)

        if leg is not None:
            activities = _travel_day_activities(
                day, destination, leg, is_first=day == 1, pick=next_highlight
            )
            travel_time = f"Highway transit: ~{leg.duration_hours} hrs ({leg.distance_km} km) from {leg.origin.name} to {destination.name}"
        elif day == 1 and request.days == 1:
            activities = _arrival_day_activities(day, destination, pick=next_highlight)
            travel_time = "Local transit: ~15–20 mins between city sights (auto-rickshaw or taxi recommended)"
        elif day == 1:
            activities = _arrival_day_activities(day, destination, pick=next_highlight)
            travel_time = f"Local transit: ~15–20 mins between sights in {destination.name}"
        elif day == request.days:
            activities = _departure_day_activities(day, destination, pick=next_highlight)
            travel_time = f"Local transit: ~15–20 mins to transit hub / airport / station in {destination.name}"
        else:
            activities = _regular_day_activities(day, destination, pick=next_highlight)
            travel_time = f"Local transit: ~15–25 mins between attractions in {destination.name}"

        sightseeing_acts = [
            a.title for a in activities
            if a.kind.value in ("sightseeing", "leisure", "arrival") and not any(
                w in a.title for w in ("Start trip", "Arrival", "Arrive in", "Departure", "Check-out", "Dinner", "Lunch")
            )
        ]
        h_morning = sightseeing_acts[0] if sightseeing_acts else (destination.highlights[0] if destination.highlights else destination.name)
        h_afternoon = sightseeing_acts[1] if len(sightseeing_acts) > 1 else (destination.highlights[1] if len(destination.highlights) > 1 else h_morning)
        h_evening = sightseeing_acts[2] if len(sightseeing_acts) > 2 else (destination.highlights[2] if len(destination.highlights) > 2 else f"panoramic viewpoints in {destination.name}")

        dish = get_primary_dish(destination)
        food_suggestion = get_food_suggestion(destination, request.dietary_preference)
        local_tip = get_local_tip(destination)
        best_time_tip = get_best_time_tip(destination)

        # Practical notes without duplicating local insider tip
        day_travel_tips = [best_time_tip]
        is_temple = any(c in destination.categories for c in ("spiritual", "pilgrimage")) or "temple" in destination.name.lower()
        if is_temple:
            day_travel_tips.append(f"Dress code at {destination.name}: Dress modestly covering shoulders and knees; footwear must be removed at temple sanctums.")

        if leg is not None:
            morning_plan = f"08:00 AM – 11:30 AM: Scenic road transfer from {leg.origin.name} to {destination.name} ({leg.distance_km} km, ~{leg.duration_hours} hrs)."
            afternoon_plan = f"01:30 PM – 05:00 PM: Check-in, settle in, and explore {h_morning} in {destination.name}."
            evening_plan = f"06:00 PM – 09:00 PM: Evening at {h_afternoon}, followed by dinner featuring {dish}."
        elif day == 1 and request.days == 1:
            morning_plan = f"09:00 AM – 12:30 PM: Morning exploration of {h_morning} during prime cool sightseeing hours."
            afternoon_plan = f"02:00 PM – 05:00 PM: Afternoon cultural visit to {h_afternoon}."
            evening_plan = f"06:00 PM – 09:00 PM: Sunset visit to {h_evening}, followed by authentic dinner featuring {dish}."
        elif day == 1:
            morning_plan = f"09:00 AM – 12:30 PM: Orientation and morning exploration of {h_morning} in {destination.name}."
            afternoon_plan = f"02:00 PM – 05:00 PM: Afternoon discovery at {h_afternoon}."
            evening_plan = f"06:00 PM – 09:00 PM: Evening at {h_evening}, followed by dinner featuring {dish}."
        elif day == request.days:
            morning_plan = f"08:30 AM – 11:30 AM: Final morning visit to {h_morning} and panoramic lookout."
            afternoon_plan = f"12:30 PM – 03:30 PM: Farewell regional lunch and artisan shopping for local specialties in {destination.name}."
            evening_plan = f"05:00 PM onwards: Check-out and evening departure from {destination.name} with your journey complete."
        else:
            morning_plan = f"08:30 AM – 12:30 PM: Early morning visit to {h_morning} in pleasant cool weather."
            afternoon_plan = f"02:00 PM – 05:00 PM: Afternoon exploration of {h_afternoon}."
            evening_plan = f"06:00 PM – 09:00 PM: Evening leisure at {h_evening}, followed by dinner featuring {dish}."

        cats_str = " and ".join(destination.categories[:2]) if destination.categories else "cultural"
        itinerary.append(
            DayPlan(
                day=day,
                place=_place(destination),
                stay_day=stay_day,
                stay_days=span.days,
                day_title=f"Day {day}: {destination.name} Discovery & Highlights",
                narrative=f"Immerse in the {cats_str} atmosphere of {destination.name}, taking in {h_morning} and savoring {dish}.",
                morning_plan=morning_plan,
                afternoon_plan=afternoon_plan,
                evening_plan=evening_plan,
                travel_time=travel_time,
                food_suggestion=food_suggestion,
                local_tip=local_tip,
                activities=activities,
                travel_tips=day_travel_tips,
            )
        )

    route_text = " -> ".join(d.name for d in order)

    # Reflect the traveller's dietary preference in food activities
    dietary_note = _DIETARY_NOTES.get(request.dietary_preference, "")
    if dietary_note:
        for day in itinerary:
            for activity in day.activities:
                if activity.kind is ActivityKind.food:
                    activity.description = activity.description + dietary_note

    summary = (
        f"{request.days}-day Karnataka trip ({request.pace.value} pace) covering "
        f"{len(order)} stops: {route_text}. Interests: "
        f"{', '.join(i.value for i in request.interests)}; budget tier: {request.budget_tier.value}."
    )
    return summary, itinerary


_DIETARY_NOTES: dict[DietaryPreference, str] = {
    DietaryPreference.no_preference: "",
    DietaryPreference.vegetarian: " Vegetarian options prioritised.",
    DietaryPreference.vegan: " Vegan options prioritised.",
    DietaryPreference.jain: " Jain (no onion/garlic) options prioritised.",
    DietaryPreference.non_vegetarian: " Local non-vegetarian specialities included.",
}


def _place(destination: DestinationRecord):
    from app.schemas import Place

    return Place(
        destination_id=destination.id,
        name=destination.name,
        lat=destination.lat,
        lng=destination.lng,
        region=destination.region,
    )


def _arrival_day_activities(
    day: int, destination: DestinationRecord, *, pick: HighlightPicker
) -> list[DayActivity]:
    highlight = pick(destination)
    dish = get_primary_dish(destination)
    return [
        DayActivity(
            time="10:00",
            title=f"Arrive in {destination.name}",
            description=f"Settle in and get oriented in {destination.name} ({destination.region}).",
            destination_id=destination.id,
            kind=ActivityKind.arrival,
        ),
        DayActivity(
            time="15:00",
            title=highlight,
            description=f"Afternoon visit: {highlight}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="19:30",
            title=f"Dinner featuring {dish}",
            description=f"Authentic evening dinner in {destination.name} featuring {dish}.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
    ]


def _travel_day_activities(
    day: int,
    destination: DestinationRecord,
    leg: RouteLeg,
    is_first: bool,
    *,
    pick: HighlightPicker,
) -> list[DayActivity]:
    first_look = pick(destination)
    evening = pick(destination)
    dish = get_primary_dish(destination)
    activities = [
        DayActivity(
            time="08:00",
            title=f"Travel to {destination.name}",
            description=(
                f"Scenic highway drive from {leg.origin.name} to {destination.name}: "
                f"{leg.distance_km} km, approx {leg.duration_hours} hrs."
            ),
            destination_id=destination.id,
            kind=ActivityKind.travel,
        ),
        DayActivity(
            time="12:30",
            title="Highway lunch stop",
            description=f"Midday meal and refreshment stop en route to {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
        DayActivity(
            time="14:30",
            title=first_look,
            description=f"Afternoon exploration of {first_look} in {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="17:30",
            title=evening,
            description=f"Sunset and evening visit to {evening}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="20:00",
            title=f"Dinner featuring {dish}",
            description=f"Authentic dinner in {destination.name} featuring {dish}.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
    ]
    if is_first:
        activities.insert(
            0,
            DayActivity(
                time="06:00",
                title="Start trip",
                description="Departure day — head out for the first leg of the Karnataka circuit.",
                destination_id=destination.id,
                kind=ActivityKind.arrival,
            ),
        )
    return activities


def _regular_day_activities(
    day: int, destination: DestinationRecord, *, pick: HighlightPicker
) -> list[DayActivity]:
    morning = pick(destination)
    afternoon = pick(destination)
    dish = get_primary_dish(destination)
    if "nature" in destination.categories or "hills" in destination.categories:
        morning_kind = ActivityKind.leisure
        morning_title = f"Morning walk around {morning}"
        morning_desc = f"Fresh morning outdoors around {morning} before the midday sun."
    else:
        morning_kind = ActivityKind.sightseeing
        morning_title = morning
        morning_desc = f"Morning sightseeing: {morning}."
    return [
        DayActivity(
            time="09:00",
            title=morning_title,
            description=morning_desc,
            destination_id=destination.id,
            kind=morning_kind,
        ),
        DayActivity(
            time="13:00",
            title="Lunch break",
            description=f"Regional lunch in {destination.name} featuring local specialties.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
        DayActivity(
            time="15:30",
            title=afternoon,
            description=f"Afternoon exploration: {afternoon}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="19:30",
            title=f"Dinner featuring {dish}",
            description=f"Evening dinner in {destination.name} sampling {dish}.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
    ]


def _departure_day_activities(
    day: int, destination: DestinationRecord, *, pick: HighlightPicker
) -> list[DayActivity]:
    final_morning = pick(destination)
    return [
        DayActivity(
            time="09:00",
            title=final_morning,
            description=f"Final morning at {final_morning}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="12:00",
            title="Check-out and souvenirs",
            description=f"Pick up local produce or crafts from {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.leisure,
        ),
        DayActivity(
            time="16:00",
            title="Departure",
            description=f"Leave from {destination.name} with your Karnataka itinerary complete.",
            destination_id=destination.id,
            kind=ActivityKind.departure,
        ),
    ]
