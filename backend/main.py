from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ai.option_generator import generate_options
from prediction.model import assemble_recipe

app = FastAPI(title="Decision Layer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DecisionRequest(BaseModel):
    question: str
    location: str


@app.post("/api/decide")
def decide(req: DecisionRequest):
    # Step 1: Head chef generates recipes (options with ingredients)
    options = generate_options(req.question, req.location)

    # Step 2: For each recipe, enrich ingredients + score them
    recipes = []
    for option in options:
        recipe = assemble_recipe(option, req.location)
        recipes.append(recipe)

    return {
        "question": req.question,
        "location": req.location,
        "recipes": recipes,
    }


@app.get("/health")
def health():
    return {"status": "ok"}