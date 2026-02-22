"""
prediction/model.py — The Recipe Assembler

Takes a raw option (label + ingredients) and:
1. Enriches each ingredient with location context (sous chef)
2. Scores each enriched ingredient across all analyzers (critics)
3. Rolls everything up into a final recipe with a receipt

Returns a complete recipe Bob can read.
"""

from prediction.features import enrich_ingredient
from prediction.analyzers import score_ingredient


def assemble_recipe(option: dict, location: str) -> dict:
    label = option["label"]
    raw_ingredients = option.get("ingredients", [])

    # Status quo — short circuit
    if not raw_ingredients:
        return {
            "label": label,
            "total_impact": {
                "safety":     {"value": 0, "label": "No change", "direction": "neutral"},
                "traffic":    {"value": 0, "label": "No change", "direction": "neutral"},
                "pedestrian": {"value": 0, "label": "No change", "direction": "neutral"},
                "cost":       {"value": 0, "label": "$0",        "direction": "good"},
            },
            "receipt": [],
        }

    # Step 1: Sous chef enriches each ingredient with context
    enriched = [enrich_ingredient(ing, location) for ing in raw_ingredients]

    # Step 2: Critics score each enriched ingredient
    scored = [score_ingredient(ing) for ing in enriched]

    # Step 3: Roll up totals across all ingredients
    totals = _rollup_totals(scored)

    return {
        "label": label,
        "total_impact": totals,
        "receipt": scored,  # line-by-line breakdown Bob can drill into
    }


def _rollup_totals(scored_ingredients: list[dict]) -> dict:
    """
    Sums up scores across all ingredients per metric.
    """
    totals = {
        "safety":     0.0,
        "traffic":    0.0,
        "pedestrian": 0.0,
        "cost":       0,
    }

    for ingredient in scored_ingredients:
        for metric, result in ingredient["scores"].items():
            if metric in totals:
                totals[metric] += result["value"]

    return {
        "safety": {
            "value": round(totals["safety"], 1),
            "label": f"{round(totals['safety'])}% crash reduction" if totals["safety"] > 0 else "No change",
            "direction": "good" if totals["safety"] > 0 else "neutral",
        },
        "traffic": {
            "value": round(totals["traffic"], 1),
            "label": f"+{round(totals['traffic'], 1)} min avg delay" if totals["traffic"] > 0 else "No change",
            "direction": "bad" if totals["traffic"] > 1 else "neutral",
        },
        "pedestrian": {
            "value": round(totals["pedestrian"], 1),
            "label": f"+{round(totals['pedestrian'])}% foot traffic" if totals["pedestrian"] > 0 else "No change",
            "direction": "good" if totals["pedestrian"] > 0 else "neutral",
        },
        "cost": {
            "value": totals["cost"],
            "label": f"${totals['cost']:,}" if totals["cost"] > 0 else "$0",
            "direction": "neutral",
        },
    }