"""
prediction/features.py — The Sous Chef

Takes an ingredient and fetches only the context it needs,
based on the ingredient's needs_context list.

v1: All fetchers return hardcoded Austin defaults.
v2: Each fetcher makes a real Austin open data API call.
"""

# ---------------------------------------------------------------------------
# CONTEXT FETCHERS
# Each key maps to a function that takes (lat, lng) and returns a value.
# The head chef controls which of these get called per ingredient via needs_context.
# ---------------------------------------------------------------------------

def _fetch_bike_volume(lat: float, lng: float) -> int:
    """
    Daily cyclist count near this location.
    v2: Query Austin Bluetooth sensor dataset
        https://data.austintexas.gov/Transportation-and-Mobility/Bluetooth-Travel-Sensors
    """
    return 150  # daily cyclists


def _fetch_crash_history(lat: float, lng: float) -> int:
    """
    Number of crashes within 500ft in the last 5 years.
    v2: Query Austin crash dataset filtered by lat/lng radius
        https://data.austintexas.gov/Transportation-and-Mobility/Austin-Crash-Report-Data
    """
    return 12  # crashes in last 5 years


def _fetch_road_width(lat: float, lng: float) -> float:
    """
    Road width in feet.
    v2: Query Austin road geometry / GIS dataset
        https://data.austintexas.gov/Locations-and-Maps/Street-Centerline
    """
    return 60.0  # feet


def _fetch_vehicle_volume(lat: float, lng: float) -> int:
    """
    Daily vehicle count.
    v2: Query Austin traffic count sensors
        https://data.austintexas.gov/Transportation-and-Mobility/Traffic-Detectors
    """
    return 18000  # daily vehicles


def _fetch_pedestrian_vol(lat: float, lng: float) -> int:
    """
    Estimated daily pedestrian count.
    v2: Proxy from land use data + transit proximity
        (Austin open data doesn't have direct ped counts everywhere)
    """
    return 800  # daily pedestrians


def _fetch_signal_nearby(lat: float, lng: float) -> bool:
    """
    Whether a traffic/pedestrian signal already exists nearby.
    v2: Query Austin signals dataset
        https://data.austintexas.gov/Transportation-and-Mobility/Traffic-Signals-and-Pedestrian-Signals
    """
    return False


def _fetch_school_nearby(lat: float, lng: float) -> bool:
    """
    Whether a school is within 0.25 miles.
    v2: Query Austin school locations dataset
        https://data.austintexas.gov/locations/Schools
    """
    return False


def _fetch_transit_nearby(lat: float, lng: float) -> bool:
    """
    Whether a CapMetro bus/rail stop is within 0.25 miles.
    v2: Query CapMetro GTFS stops data
        https://data.austintexas.gov/Transportation-and-Mobility/Capital-Metro-Bus-Stops
    """
    return True


# Map context keys → fetcher functions
CONTEXT_FETCHERS = {
    "bike_volume":    _fetch_bike_volume,
    "crash_history":  _fetch_crash_history,
    "road_width":     _fetch_road_width,
    "vehicle_volume": _fetch_vehicle_volume,
    "pedestrian_vol": _fetch_pedestrian_vol,
    "signal_nearby":  _fetch_signal_nearby,
    "school_nearby":  _fetch_school_nearby,
    "transit_nearby": _fetch_transit_nearby,
}


def geocode(location: str) -> tuple[float, float]:
    """
    Convert a location string to lat/lng.
    v1: Hardcoded to central Austin.
    v2: Call Google Maps Geocoding API or Austin's geocoder.
    """
    return (30.2672, -97.7431)


def enrich_ingredient(ingredient: dict, location: str) -> dict:
    """
    Takes an ingredient and returns it enriched with location context.
    Only fetches what needs_context specifies — nothing more.
    """
    lat, lng = geocode(location)
    needs = ingredient.get("needs_context", [])

    context = {}
    for key in needs:
        if key in CONTEXT_FETCHERS:
            context[key] = CONTEXT_FETCHERS[key](lat, lng)
        else:
            print(f"Warning: unknown context key '{key}' — skipping")

    return {**ingredient, "context": context}