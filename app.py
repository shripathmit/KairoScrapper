import json
from datetime import datetime
from flask import Flask, render_template, request, send_file, session
import requests
from io import BytesIO

app = Flask(__name__)
app.secret_key = "secret-key"  # simple secret for session

OPENFOODFACTS_PRODUCT_API = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
OPENFOODFACTS_SEARCH_API = "https://world.openfoodfacts.org/cgi/search.pl"
PUBCHEM_NAME_API = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/JSON"


HEADERS = {
    "User-Agent": "KairoScrapper/1.0 (contact@example.com)"
}


def query_openfoodfacts_by_barcode(barcode: str):
    url = OPENFOODFACTS_PRODUCT_API.format(barcode=barcode)
    try:
        r = requests.get(url, headers=HEADERS, timeout=5)
        if r.status_code == 200:
            return r.json().get("product", {})
    except requests.RequestException:
        # Network error or timeout
        pass
    return {}


def search_openfoodfacts(name: str):
    params = {
        "search_terms": name,
        "search_simple": 1,
        "action": "process",
        "json": 1
    }
    try:
        r = requests.get(OPENFOODFACTS_SEARCH_API, params=params, headers=HEADERS, timeout=5)
        if r.status_code == 200:
            data = r.json()
            if data.get("products"):
                return data["products"][0]  # return first product
    except requests.RequestException:
        pass
    return {}


def query_pubchem(ingredient: str):
    url = PUBCHEM_NAME_API.format(name=ingredient)
    try:
        r = requests.get(url, headers=HEADERS, timeout=5)
        if r.status_code == 200:
            data = r.json()
            try:
                cid = data["PC_Compounds"][0]["id"]["id"].get("cid")
                return {"cid": cid, "source": url}
            except (KeyError, IndexError):
                pass
    except requests.RequestException:
        pass
    return {}


def build_json(product_data, ingredients_details):
    result = {
        "data_source": "Product Database Import",
        "import_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "version": "1.0",
        "products": [],
        "ingredients": [],
        "health_effects": []
    }

    product_entry = {
        "barcode": product_data.get("id", ""),
        "name": product_data.get("product_name", ""),
        "brand": product_data.get("brands", ""),
        "category": product_data.get("categories", ""),
        "description": product_data.get("generic_name", ""),
        "status": "active",
        "is_dummy": False,
        "sources": ["OpenFoodFacts"],
        "regulatory_claims": "",
        "active_ingredients": [],
        "inactive_ingredients": []
    }

    for ing in ingredients_details:
        ing_entry = {
            "name": ing.get("name"),
            "function": "",
            "sources": ["OpenFoodFacts"]
        }
        product_entry["inactive_ingredients"].append(ing_entry)

        ingredient_item = {
            "name": ing.get("name"),
            "scientific_name": "",
            "cas_number": "",
            "category": "",
            "safety_rating": "unknown",
            "description": "",
            "sources": ["OpenFoodFacts"],
            "health_effects": []
        }
        if ing.get("pubchem"):
            ingredient_item["sources"].append(ing["pubchem"]["source"])
        result["ingredients"].append(ingredient_item)

    result["products"].append(product_entry)
    return result


@app.route('/', methods=['GET', 'POST'])
def index():
    data = None
    error = None
    if request.method == 'POST':
        name = request.form.get('product_name', '').strip()
        barcode = request.form.get('barcode', '').strip()
        product = {}
        if barcode:
            product = query_openfoodfacts_by_barcode(barcode)
        elif name:
            product = search_openfoodfacts(name)
            if product:
                barcode = product.get("id")
                product = query_openfoodfacts_by_barcode(barcode)
        if product:
            ingredients = []
            for ing in product.get("ingredients", []):
                ing_name = ing.get("text")
                detail = {"name": ing_name}
                pubchem = query_pubchem(ing_name)
                if pubchem:
                    detail["pubchem"] = pubchem
                ingredients.append(detail)
            data = build_json(product, ingredients)
            session['data'] = data
        else:
            error = "No product found or unable to fetch data. Check your internet connection."
    return render_template('index.html', data=data, error=error)


@app.route('/download')
def download_json():
    data = session.get('data')
    if not data:
        return "No data", 400
    json_bytes = json.dumps(data, indent=2).encode('utf-8')
    return send_file(
        BytesIO(json_bytes),
        mimetype='application/json',
        as_attachment=True,
        download_name='data.json'
    )


if __name__ == '__main__':
    app.run(debug=True)
