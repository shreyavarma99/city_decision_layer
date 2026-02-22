"""
ai/option_generator.py — The Head Chef

Generates intervention options (recipes) for a planner's question.
Each option contains a list of ingredients, and each ingredient is tagged
with needs_context — telling the sous chef exactly what data to fetch.

v1: Mocked responses keyed by question keywords.
v2: Swap mock_generate() for real_generate() to use Claude API.
"""

# ---------------------------------------------------------------------------
# MOCK RESPONSES
# Each ingredient has:
#   action       — human readable description
#   type         — machine readable tag used by analyzers
#   needs_context — list of keys the sous chef should fetch for this ingredient
# ---------------------------------------------------------------------------

MOCK_OPTIONS = {
    "bike": [
        {
            "label": "Protected Bike Lane",
            "ingredients": [
                {
                    "action": "Add concrete-barrier bike lane",
                    "type": "adds_bike_lane",
                    "needs_context": ["bike_volume", "crash_history", "road_width"],
                    "properties": {"adds_barrier": True},
                },
                {
                    "action": "Remove parking lane to make room",
                    "type": "removes_parking_lane",
                    "needs_context": ["vehicle_volume", "road_width"],
                    "properties": {},
                },
                {
                    "action": "Reroute through-traffic to parallel street",
                    "type": "traffic_reroute",
                    "needs_context": ["vehicle_volume", "road_width"],
                    "properties": {"reduces_car_lanes": 1},
                },
            ],
        },
        {
            "label": "Painted Bike Lane",
            "ingredients": [
                {
                    "action": "Paint bike lane markings",
                    "type": "adds_bike_lane",
                    "needs_context": ["bike_volume", "crash_history", "road_width"],
                    "properties": {"adds_barrier": False},
                },
                {
                    "action": "Reduce speed limit by 5mph",
                    "type": "reduces_speed_limit",
                    "needs_context": ["crash_history", "vehicle_volume"],
                    "properties": {"value": 5},
                },
            ],
        },
        {
            "label": "Status Quo",
            "ingredients": [],
        },
    ],

    "crosswalk": [
        {
            "label": "Signalized Crosswalk",
            "ingredients": [
                {
                    "action": "Install pedestrian signal",
                    "type": "adds_signal",
                    "needs_context": ["pedestrian_vol", "crash_history", "signal_nearby"],
                    "properties": {},
                },
                {
                    "action": "Add marked crosswalk",
                    "type": "adds_crosswalk",
                    "needs_context": ["pedestrian_vol", "crash_history"],
                    "properties": {},
                },
            ],
        },
        {
            "label": "Marked Crosswalk Only",
            "ingredients": [
                {
                    "action": "Add high-visibility crosswalk markings",
                    "type": "adds_crosswalk",
                    "needs_context": ["pedestrian_vol", "crash_history"],
                    "properties": {},
                },
            ],
        },
        {
            "label": "Status Quo",
            "ingredients": [],
        },
    ],

    "speed": [
        {
            "label": "Reduce Speed Limit 10mph",
            "ingredients": [
                {
                    "action": "Lower posted speed limit by 10mph",
                    "type": "reduces_speed_limit",
                    "needs_context": ["crash_history", "vehicle_volume"],
                    "properties": {"value": 10},
                },
                {
                    "action": "Install speed feedback signs",
                    "type": "adds_signal",
                    "needs_context": ["vehicle_volume"],
                    "properties": {},
                },
            ],
        },
        {
            "label": "Reduce Speed Limit 5mph",
            "ingredients": [
                {
                    "action": "Lower posted speed limit by 5mph",
                    "type": "reduces_speed_limit",
                    "needs_context": ["crash_history", "vehicle_volume"],
                    "properties": {"value": 5},
                },
            ],
        },
        {
            "label": "Status Quo",
            "ingredients": [],
        },
    ],

    "sidewalk": [
        {
            "label": "New Sidewalk + Crosswalk",
            "ingredients": [
                {
                    "action": "Construct sidewalk along corridor",
                    "type": "adds_sidewalk",
                    "needs_context": ["pedestrian_vol", "road_width", "transit_nearby"],
                    "properties": {},
                },
                {
                    "action": "Add marked crosswalk at intersection",
                    "type": "adds_crosswalk",
                    "needs_context": ["pedestrian_vol", "crash_history"],
                    "properties": {},
                },
            ],
        },
        {
            "label": "Sidewalk Only",
            "ingredients": [
                {
                    "action": "Construct sidewalk along corridor",
                    "type": "adds_sidewalk",
                    "needs_context": ["pedestrian_vol", "road_width", "transit_nearby"],
                    "properties": {},
                },
            ],
        },
        {
            "label": "Status Quo",
            "ingredients": [],
        },
    ],
}

DEFAULT_OPTIONS = [
    {
        "label": "Add Pedestrian Signal",
        "ingredients": [
            {
                "action": "Install pedestrian crossing signal",
                "type": "adds_signal",
                "needs_context": ["pedestrian_vol", "crash_history", "signal_nearby"],
                "properties": {},
            },
        ],
    },
    {
        "label": "Reduce Speed Limit 5mph",
        "ingredients": [
            {
                "action": "Lower posted speed limit by 5mph",
                "type": "reduces_speed_limit",
                "needs_context": ["crash_history", "vehicle_volume"],
                "properties": {"value": 5},
            },
        ],
    },
    {
        "label": "Status Quo",
        "ingredients": [],
    },
]


def mock_generate(question: str, location: str) -> list[dict]:
    q = question.lower()
    for keyword, options in MOCK_OPTIONS.items():
        if keyword in q:
            return options
    return DEFAULT_OPTIONS


# ---------------------------------------------------------------------------
# v2: Uncomment this and swap mock_generate for real_generate
# ---------------------------------------------------------------------------
# import anthropic, json
# from .prompts import OPTION_GENERATOR_SYSTEM_PROMPT
#
# client = anthropic.Anthropic()
#
# def real_generate(question: str, location: str) -> list[dict]:
#     message = client.messages.create(
#         model="claude-opus-4-6",
#         max_tokens=2048,
#         system=OPTION_GENERATOR_SYSTEM_PROMPT,
#         messages=[{"role": "user", "content": f"Location: {location}\nQuestion: {question}"}],
#     )
#     raw = message.content[0].text
#     if "```json" in raw:
#         raw = raw.split("```json")[1].split("```")[0].strip()
#     return json.loads(raw)


def generate_options(question: str, location: str) -> list[dict]:
    return mock_generate(question, location)
    # v2: return real_generate(question, location)