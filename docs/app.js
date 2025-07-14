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
    
    // Show loading state
    const resultSection = document.getElementById('result-section');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const results = document.getElementById('results');
    const download = document.getElementById('download');
    
    resultSection.style.display = 'block';
    loading.style.display = 'block';
    error.style.display = 'none';
    results.textContent = '';
    download.style.display = 'none';
    
    try {
        const form = event.target;
        const name = form.product_name.value.trim();
        const barcode = form.barcode.value.trim();
        
        if (!name && !barcode) {
            throw new Error('Please enter either a product name or barcode');
        }
        
        let product = {};
        
        if (barcode) {
            product = await queryOpenFoodFactsByBarcode(barcode);
        } else if (name) {
            const searchResult = await searchOpenFoodFacts(name);
            if (searchResult && searchResult.id) {
                product = await queryOpenFoodFactsByBarcode(searchResult.id);
            }
        }
        
        if (!product || Object.keys(product).length === 0) {
            throw new Error('No product found. Please try a different search term or barcode.');
        }
        
        const ingredients = [];
        for (const ing of product.ingredients || []) {
            const ingName = ing.text;
            const detail = { name: ingName };
            try {
                const pubchem = await queryPubChem(ingName);
                if (Object.keys(pubchem).length) detail.pubchem = pubchem;
            } catch (e) {
                console.warn(`Could not fetch PubChem data for ${ingName}:`, e);
            }
            ingredients.push(detail);
        }
        
        const data = buildJson(product, ingredients);
        loading.style.display = 'none';
        results.textContent = JSON.stringify(data, null, 2);
        
        // Create download link
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        download.href = url;
        download.download = `product_${product.id || 'data'}_${new Date().toISOString().split('T')[0]}.json`;
        download.style.display = 'inline';
        
    } catch (err) {
        loading.style.display = 'none';
        error.style.display = 'block';
        error.textContent = `Error: ${err.message}`;
        console.error('Search error:', err);
    }
}

document.getElementById('search-form').addEventListener('submit', handleForm);
