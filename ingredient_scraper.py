import csv
import json
from pathlib import Path


def scrape_ingredients(csv_path: str) -> dict:
    ingredients = []
    health_effects_map = {}
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse health effect details
            effect_data = {}
            effects_raw = row.get("health_effects", "")
            for part in effects_raw.split(';'):
                if '=' in part:
                    key, value = part.split('=', 1)
                    effect_data[key.strip()] = value.strip()

            ingredient = {
                "name": row.get("name", ""),
                "scientific_name": row.get("scientific_name", ""),
                "cas_number": row.get("cas_number", ""),
                "category": row.get("category", ""),
                "safety_rating": row.get("safety_rating", "unknown"),
                "description": row.get("description", ""),
                "sources": row.get("sources", "").split('|'),
                "health_effects": [
                    {
                        "effect_type": effect_data.get("effect_type", ""),
                        "condition": effect_data.get("condition", ""),
                        "severity": effect_data.get("severity", ""),
                        "description": effect_data.get("description", ""),
                    }
                ],
            }
            ingredients.append(ingredient)

            # Aggregate overall health effects
            condition = effect_data.get("condition")
            if condition and condition not in health_effects_map:
                health_effects_map[condition] = {
                    "condition": condition,
                    "description": effect_data.get("description", ""),
                    "sources": row.get("sources", "").split('|'),
                }

    return {
        "products": [],
        "ingredients": ingredients,
        "health_effects": list(health_effects_map.values()),
    }


def main():
    csv_file = Path(__file__).resolve().parent / "data" / "ingredients.csv"
    data = scrape_ingredients(str(csv_file))
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
