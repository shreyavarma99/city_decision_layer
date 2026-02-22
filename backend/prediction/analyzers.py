"""
prediction/analyzers.py — The Critics

Each analyzer looks at one enriched ingredient and scores it on one metric.
An ingredient can be passed to multiple analyzers.

Each analyzer returns:
  { "value": float, "label": str, "direction": "good"|"bad"|"neutral" }
or None if this analyzer doesn't apply to this ingredient type.
"""

# ---------------------------------------------------------------------------
# SAFETY ANALYZER
# Sources: FHWA bike safety studies, NHTSA pedestrian research
# ---------------------------------------------------------------------------

def analyze_safety(ingredient: dict) -> dict | None:
    itype = ingredient["type"]
    ctx = ingredient.get("context", {})
    props = ingredient.get("properties", {})

    reduction = 0.0

    if itype == "adds_bike_lane":
        reduction += 18.0  # FHWA: painted lane baseline
        if props.get("adds_barrier"):
            reduction += 22.0  # protected lane adds ~22% on top

    elif itype == "adds_crosswalk":
        reduction += 25.0  # marked crosswalks reduce ped crashes ~25%

    elif itype == "adds_signal":
        reduction += 30.0  # ped signals reduce ped crashes ~30%

    elif itype == "reduces_speed_limit":
        mph = props.get("value", 5)
        reduction += (mph / 5) * 8.0  # each 5mph cut → ~8% crash reduction

    elif itype == "adds_sidewalk":
        reduction += 20.0  # sidewalks reduce pedestrian road fatalities

    elif itype == "closes_street":
        reduction += 95.0

    elif itype in ("removes_parking_lane", "traffic_reroute"):
        return None  # no direct safety impact modeled yet

    if reduction == 0:
        return None

    # Boost slightly if there's a high crash history at this location
    crash_history = ctx.get("crash_history", 0)
    if crash_history > 10:
        reduction *= 1.1  # higher baseline risk = more room to improve

    reduction = min(round(reduction, 1), 99.0)

    return {
        "value": reduction,
        "label": f"{round(reduction)}% crash reduction",
        "direction": "good",
    }


# ---------------------------------------------------------------------------
# TRAFFIC ANALYZER
# ---------------------------------------------------------------------------

def analyze_traffic(ingredient: dict) -> dict | None:
    itype = ingredient["type"]
    ctx = ingredient.get("context", {})
    props = ingredient.get("properties", {})

    delay = 0.0

    if itype == "traffic_reroute":
        lanes_reduced = props.get("reduces_car_lanes", 1)
        delay += lanes_reduced * 1.5

    elif itype == "removes_parking_lane":
        delay += 0.5  # minor disruption during transition

    elif itype == "adds_signal":
        delay += 0.8

    elif itype == "adds_crosswalk":
        delay += 0.3

    elif itype == "reduces_speed_limit":
        mph = props.get("value", 5)
        delay += (mph / 5) * 0.5

    elif itype == "closes_street":
        delay += 8.0

    elif itype in ("adds_bike_lane", "adds_sidewalk"):
        return None  # no direct traffic delay impact

    if delay == 0:
        return None

    return {
        "value": round(delay, 1),
        "label": f"+{round(delay, 1)} min avg delay",
        "direction": "bad" if delay > 1 else "neutral",
    }


# ---------------------------------------------------------------------------
# PEDESTRIAN ANALYZER
# ---------------------------------------------------------------------------

def analyze_pedestrian(ingredient: dict) -> dict | None:
    itype = ingredient["type"]
    ctx = ingredient.get("context", {})
    props = ingredient.get("properties", {})

    increase = 0.0

    if itype == "adds_bike_lane":
        increase += 10.0
        if props.get("adds_barrier"):
            increase += 15.0  # protected infra signals street is safe

    elif itype == "adds_crosswalk":
        increase += 20.0

    elif itype == "adds_sidewalk":
        increase += 35.0
        if ctx.get("transit_nearby"):
            increase += 10.0  # transit access amplifies sidewalk impact

    elif itype == "adds_signal":
        increase += 12.0

    elif itype == "reduces_speed_limit":
        mph = props.get("value", 5)
        increase += (mph / 5) * 5.0

    elif itype == "closes_street":
        increase += 60.0

    elif itype in ("removes_parking_lane", "traffic_reroute"):
        return None

    if increase == 0:
        return None

    return {
        "value": round(increase, 1),
        "label": f"+{round(increase)}% foot traffic",
        "direction": "good",
    }


# ---------------------------------------------------------------------------
# COST ANALYZER
# Rough estimates based on typical Austin project costs
# ---------------------------------------------------------------------------

def analyze_cost(ingredient: dict) -> dict | None:
    itype = ingredient["type"]
    props = ingredient.get("properties", {})

    cost = 0

    if itype == "adds_bike_lane":
        if props.get("adds_barrier"):
            cost += 120000  # protected lane per block
        else:
            cost += 15000   # painted lane per block

    elif itype == "adds_crosswalk":
        cost += 8000

    elif itype == "adds_signal":
        cost += 80000

    elif itype == "adds_sidewalk":
        cost += 50000

    elif itype == "removes_parking_lane":
        cost += 3000  # signage + restriping

    elif itype == "reduces_speed_limit":
        cost += 5000  # signage + enforcement

    elif itype == "traffic_reroute":
        cost += 10000  # signage + monitoring

    elif itype == "closes_street":
        cost += 200000

    if cost == 0:
        return None

    return {
        "value": cost,
        "label": f"${cost:,}",
        "direction": "neutral",
    }


# ---------------------------------------------------------------------------
# ROUTER — runs all analyzers on a single enriched ingredient
# ---------------------------------------------------------------------------

ANALYZERS = {
    "safety":     analyze_safety,
    "traffic":    analyze_traffic,
    "pedestrian": analyze_pedestrian,
    "cost":       analyze_cost,
}

def score_ingredient(ingredient: dict) -> dict:
    """
    Runs all analyzers on one enriched ingredient.
    Returns only the analyzers that produced a result.
    """
    scores = {}
    for metric, fn in ANALYZERS.items():
        result = fn(ingredient)
        if result is not None:
            scores[metric] = result

    return {
        "action": ingredient["action"],
        "type": ingredient["type"],
        "scores": scores,
        "confidence": get_confidence(ingredient),
    }


def get_confidence(ingredient: dict) -> str:
    """
    Confidence based on ingredient type and available context.
    More context data = higher confidence.
    """
    context_count = len(ingredient.get("context", {}))
    itype = ingredient["type"]

    if itype == "traffic_reroute":
        return "Medium"  # depends on driver behavior
    if context_count == 0:
        return "Low"
    if context_count >= 2:
        return "High"
    return "Medium"