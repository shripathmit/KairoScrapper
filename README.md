# KairoScrapper

This repository contains a simple Flask web application that queries public APIs to gather product and ingredient data. Users can enter a product name or barcode and receive aggregated results in a JSON structure. The data can be viewed on the page and downloaded as a file.

## Running the App

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the application:

```bash
python app.py
```

Then open `http://localhost:5000` in your browser.

## Ingredient Scraper Task

The repository also includes a simple offline ingredient scraper located in
`ingredient_scraper.py`. It reads ingredient details from `data/ingredients.csv`
and outputs a JSON structure with `products`, `ingredients` and
`health_effects` sections.

Run it with:

```bash
python ingredient_scraper.py
```

## GitHub Pages

A static version of the application is available under the `docs/` directory.
It performs the API queries in the browser using JavaScript. The included
GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically deploys
this directory to GitHub Pages whenever changes are pushed to the `main`
branch. Enable GitHub Pages in the repository settings and select **GitHub
Actions** as the source.
