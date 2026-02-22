# City Decision Layer

A decision support tool for urban planners. Instead of relying on gut instinct or waiting months for a traffic study, a planner can click a street on a map, ask a question, and instantly get a set of intervention options with predicted safety, traffic, pedestrian, and cost impacts — broken down line by line so they can see exactly why each option scores the way it does.

> The system surfaces tradeoffs. The human makes the call.

---

## Interactive Architecture Walkthrough

Before diving in, this is a good way to understand how the system works end to end:

**[Click-through architecture diagram →](https://claude.ai/public/artifacts/789bed29-c2b1-46c0-afae-bb8fcd557ffc)**

---

## What it does

A planner asks: *"Should I add a bike lane on Lamar & 6th?"*

The system returns 2-3 intervention options (e.g. Protected Bike Lane, Painted Bike Lane, Status Quo), each with:

- A **total impact summary** across safety, traffic, pedestrian activity, and cost
- A **full receipt** showing which specific change caused which specific impact
- A **confidence score** per line item

Example response:

```
Protected Bike Lane
  safety:     44% crash reduction      ✓ High confidence
  traffic:    +2 min avg delay         ✓ High confidence  
  pedestrian: +25% foot traffic        ✓ High confidence
  cost:       $133,000

  receipt:
    add barrier bike lane      → 44% crash reduction, +25% foot traffic   [High]
    remove parking lane        → +0.5 min delay                           [High]
    reroute through-traffic    → +1.5 min delay                           [Medium]
```

---

## How it works (the recipe model)

The system is built around a recipe metaphor that maps cleanly to the architecture:

| Metaphor | Code | What it does |
|---|---|---|
| Head Chef | `ai/option_generator.py` | Generates intervention options with ingredients |
| Ingredient | each item in `ingredients[]` | One specific physical/policy change |
| Sous Chef | `prediction/features.py` | Fetches location context from Austin open data |
| Critics | `prediction/analyzers.py` | Safety / Traffic / Pedestrian / Cost scorers |
| Recipe | assembled result | Option + all scored ingredients |
| Receipt | `receipt[]` in response | Line-by-line breakdown of what caused what |

The key insight: **the head chef tags each ingredient with `needs_context`** — exactly which data the sous chef should fetch. A bike lane ingredient needs bike volume and crash history. A crosswalk ingredient needs pedestrian counts and signal proximity. They never fetch more than they need.

```
POST /api/decide
  │
  ├── option_generator.py   generates recipes with tagged ingredients
  │
  └── model.py              for each recipe:
        ├── features.py     fetches only the context each ingredient needs
        └── analyzers.py    scores each ingredient across all metrics
```

---

## File structure

```
city_decision_layer/
│
├── README.md
│
└── backend/
    ├── main.py                   ← FastAPI routes, front door
    ├── requirements.txt
    │
    ├── ai/
    │   ├── __init__.py
    │   ├── option_generator.py   ← head chef (mock + Claude API)
    │   └── prompts.py            ← system prompts for Claude
    │
    └── prediction/
        ├── __init__.py
        ├── features.py           ← sous chef, context fetchers
        ├── analyzers.py          ← safety / traffic / ped / cost
        └── model.py              ← assembles final recipes + receipts
```

---

## Running the project

**1. Install dependencies**
```bash
cd backend
python -m pip install -r requirements.txt
```

**2. Start the server**
```bash
python -m uvicorn main:app --reload
```

**3. Open the interactive docs**
```
http://127.0.0.1:8000/docs
```

Click `POST /api/decide` → Try it out → paste a request body → Execute.

**Example request:**
```json
{
  "question": "should I add a bike lane?",
  "location": "Lamar & 6th, Austin TX"
}
```

**Supported question keywords (v1 mock):**
| Keyword | Options returned |
|---|---|
| `bike` | Protected bike lane, Painted bike lane |
| `crosswalk` | Signalized crosswalk, Marked crosswalk |
| `speed` | Reduce 10mph, Reduce 5mph |
| `sidewalk` | Sidewalk + crosswalk, Sidewalk only |
| anything else | Pedestrian signal, Speed reduction |

---

## v1 vs v2

Everything is built so v2 upgrades are drop-in swaps — nothing structural changes.

| Component | v1 (now) | v2 (next) |
|---|---|---|
| Option generation | Keyword-matched mock responses | Real Claude API call |
| Location context | Hardcoded Austin defaults | Live Austin open data API |
| Impact scoring | Research-based rules | Trained on Austin crash data |
| Map validation | None | Mapbox click returns road features |

**To enable Claude API** — in `option_generator.py`, uncomment `real_generate()` and swap the return in `generate_options()`.

**To enable Austin open data** — in `features.py`, replace each `_fetch_*` function body with a real API call. Every function already has the dataset URL in its docstring.

---

## Data sources (v2)

All from Austin's open data portal:

- **Crash history** — Austin Crash Report Data
- **Bike volume** — Bluetooth Travel Sensors
- **Traffic volume** — Traffic Detectors / Radar counts
- **Signals** — Traffic Signals and Pedestrian Signals dataset
- **Road geometry** — Street Centerline GIS data
- **Transit stops** — CapMetro GTFS stops

Portal: [data.austintexas.gov](https://data.austintexas.gov) / [data.mobility.austin.gov](https://data.mobility.austin.gov)