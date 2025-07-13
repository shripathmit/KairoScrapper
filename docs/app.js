async function queryOpenFoodFactsByBarcode(barcode) {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (resp.ok) {
        const data = await resp.json();
        return data.product || {};
    }
    return {};
}

async function searchOpenFoodFacts(name) {
    const params = new URLSearchParams({
        search_terms: name,
        search_simple: 1,
        action: 'process',
        json: 1
    });
    const resp = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
    if (resp.ok) {
        const data = await resp.json();
        if (data.products && data.products.length > 0) {
            return data.products[0];
        }
    }
    return {};
}

async function queryPubChem(ingredient) {
    const resp = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${ingredient}/JSON`);
    if (resp.ok) {
        const data = await resp.json();
        try {
            const cid = data.PC_Compounds[0].id.id.cid;
            return { cid: cid, source: resp.url };
        } catch (e) {}
    }
    return {};
}

function buildJson(productData, ingredientsDetails) {
    const result = {
        data_source: 'Product Database Import',
        import_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        products: [],
        ingredients: [],
        health_effects: []
    };

    const productEntry = {
        barcode: productData.id || '',
        name: productData.product_name || '',
        brand: productData.brands || '',
        category: productData.categories || '',
        description: productData.generic_name || '',
        status: 'active',
        is_dummy: false,
        sources: ['OpenFoodFacts'],
        regulatory_claims: '',
        active_ingredients: [],
        inactive_ingredients: []
    };

    for (const ing of ingredientsDetails) {
        const ingEntry = {
            name: ing.name,
            function: '',
            sources: ['OpenFoodFacts']
        };
        productEntry.inactive_ingredients.push(ingEntry);

        const ingredientItem = {
            name: ing.name,
            scientific_name: '',
            cas_number: '',
            category: '',
            safety_rating: 'unknown',
            description: '',
            sources: ['OpenFoodFacts'],
            health_effects: []
        };
        if (ing.pubchem) {
            ingredientItem.sources.push(ing.pubchem.source);
        }
        result.ingredients.push(ingredientItem);
    }

    result.products.push(productEntry);
    return result;
}

async function handleForm(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.product_name.value.trim();
    const barcode = form.barcode.value.trim();
    let product = {};
    if (barcode) {
        product = await queryOpenFoodFactsByBarcode(barcode);
    } else if (name) {
        const searchResult = await searchOpenFoodFacts(name);
        if (searchResult && searchResult.id) {
            product = await queryOpenFoodFactsByBarcode(searchResult.id);
        }
    }
    if (product && Object.keys(product).length > 0) {
        const ingredients = [];
        for (const ing of product.ingredients || []) {
            const ingName = ing.text;
            const detail = { name: ingName };
            const pubchem = await queryPubChem(ingName);
            if (Object.keys(pubchem).length) detail.pubchem = pubchem;
            ingredients.push(detail);
        }
        const data = buildJson(product, ingredients);
        document.getElementById('results').textContent = JSON.stringify(data, null, 2);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dl = document.getElementById('download');
        dl.href = url;
        dl.style.display = 'inline';
        document.getElementById('result-section').style.display = 'block';
    }
}

document.getElementById('search-form').addEventListener('submit', handleForm);
