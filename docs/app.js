async function queryOpenFoodFactsByBarcode(barcode) {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (resp.ok) {
        const data = await resp.json();
        console.log('Raw barcode product data:', data.product);
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
        console.log('Raw search data:', data);
        if (data.products && data.products.length > 0) {
            const product = data.products[0];
            console.log('Selected product from search:', product);
            // Get full product details by barcode
            if (product.code) {
                return await queryOpenFoodFactsByBarcode(product.code);
            }
            return product;
        }
    }
    return {};
}

function extractIngredients(product) {
    console.log('Extracting ingredients from product:', {
        ingredients_text: product.ingredients_text,
        ingredients: product.ingredients,
        ingredients_tags: product.ingredients_tags,
        ingredients_text_en: product.ingredients_text_en,
        ingredients_text_fr: product.ingredients_text_fr
    });

    let ingredients = [];
    
    // Try multiple sources for ingredients
    if (product.ingredients_text || product.ingredients_text_en || product.ingredients_text_fr) {
        const ingredientText = product.ingredients_text || product.ingredients_text_en || product.ingredients_text_fr || '';
        // Split by common separators and clean up
        ingredients = ingredientText
            .split(/[,;.\n]/)
            .map(ing => ing.trim().replace(/^\d+\.?\s*/, '').replace(/\([^)]*\)/g, '').trim())
            .filter(ing => ing.length > 2 && !ing.match(/^\d+%?$/));
    } else if (product.ingredients && Array.isArray(product.ingredients)) {
        // Use ingredients array if available
        ingredients = product.ingredients
            .map(ing => {
                if (typeof ing === 'string') return ing;
                return ing.text || ing.id || ing.name || String(ing);
            })
            .filter(ing => ing && ing.length > 2);
    } else if (product.ingredients_tags && Array.isArray(product.ingredients_tags)) {
        // Use ingredients tags as fallback
        ingredients = product.ingredients_tags
            .map(tag => {
                if (typeof tag !== 'string') return '';
                return tag.replace(/^en:/, '').replace(/^fr:/, '').replace(/-/g, ' ').replace(/_/g, ' ');
            })
            .filter(ing => ing.length > 2);
    }
    
    console.log('Extracted ingredients:', ingredients);
    return ingredients.slice(0, 20); // Limit to first 20 ingredients
}

async function queryPubChem(ingredient) {
    const resp = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(ingredient)}/JSON`);
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
    console.log('Building JSON with product data:', productData);
    console.log('Ingredients details:', ingredientsDetails);

    const result = {
        data_source: 'Product Database Import',
        import_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        products: [],
        ingredients: [],
        health_effects: []
    };

    const productEntry = {
        barcode: productData.code || productData._id || productData.id || 'N/A',
        name: productData.product_name || productData.product_name_en || 'Unknown Product',
        brand: productData.brands || 'Unknown Brand',
        category: productData.categories || 'Unknown Category',
        description: productData.generic_name || productData.generic_name_en || '',
        status: 'active',
        is_dummy: false,
        sources: ['OpenFoodFacts'],
        regulatory_claims: productData.labels || '',
        active_ingredients: ingredientsDetails.map(ing => ({ name: ing.name, function: '', sources: ['OpenFoodFacts'] })),
        inactive_ingredients: [],
        // Add debugging info
        debug_info: {
            raw_ingredients_text: productData.ingredients_text || '',
            raw_ingredients_tags: productData.ingredients_tags || [],
            nutrition_grades: productData.nutrition_grades || '',
            nova_group: productData.nova_group || ''
        }
    };

    for (const ing of ingredientsDetails) {
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
        if (ing.pubchem && ing.pubchem.cid) {
            ingredientItem.pubchem_cid = ing.pubchem.cid;
            ingredientItem.sources.push('PubChem');
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
    
    resultSection.classList.remove('hidden');
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    results.textContent = '';
    download.classList.add('hidden');
    
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

        console.log('Final product data received:', product);
        
        // Extract ingredients using improved logic
        const ingredientNames = extractIngredients(product);
        const ingredients = [];
        
        for (const ingName of ingredientNames) {
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
        loading.classList.add('hidden');
        
        // Display results with clickable ingredients
        const ingredientsHtml = renderIngredientsClickable(product, ingredients);
        results.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre><div>Ingredients: ${ingredientsHtml}</div>`;
        
        // Create download link
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        download.href = url;
        download.download = `product_${product.id || 'data'}_${new Date().toISOString().split('T')[0]}.json`;
        download.classList.remove('hidden');
        
    } catch (err) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        error.textContent = `Error: ${err.message}`;
        console.error('Search error:', err);
    }
}

document.getElementById('search-form').addEventListener('submit', handleForm);

// --- Ingredient Details Modal ---
function showIngredientModal(ingredientName) {
    const modal = document.getElementById('ingredient-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    modalTitle.textContent = `Ingredient Details: ${ingredientName}`;
    modalContent.innerHTML = 'Loading...';
    modal.style.display = 'flex';
    queryPubChem(ingredientName).then(data => {
        if (data.cid) {
            modalContent.innerHTML = `
                <p><strong>PubChem CID:</strong> ${data.cid}</p>
                <p><a href="https://pubchem.ncbi.nlm.nih.gov/compound/${data.cid}" target="_blank">View on PubChem</a></p>
            `;
        } else {
            modalContent.innerHTML = '<p>No PubChem data found.</p>';
        }
    }).catch(() => {
        modalContent.innerHTML = '<p>Error fetching PubChem data.</p>';
    });
}

document.getElementById('close-modal').onclick = function() {
    document.getElementById('ingredient-modal').style.display = 'none';
};
window.onclick = function(event) {
    const modal = document.getElementById('ingredient-modal');
    if (event.target === modal) modal.style.display = 'none';
};

// --- Batch Search ---
async function handleBatchForm(event) {
    event.preventDefault();
    const batchResults = document.getElementById('batch-results');
    batchResults.innerHTML = '';
    batchResults.classList.remove('hidden');
    let entries = [];
    const textarea = document.getElementById('batch-input').value.trim();
    if (textarea) {
        entries = textarea.split(/\r?\n/).map(e => e.trim()).filter(Boolean);
    }
    const fileInput = document.getElementById('batch-file');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const text = await file.text();
        entries = entries.concat(text.split(/\r?\n|,/).map(e => e.trim()).filter(Boolean));
    }
    if (entries.length === 0) {
        batchResults.innerHTML = '<div class="error">Please enter or upload at least one barcode or product name.</div>';
        return;
    }
    batchResults.innerHTML = '<div class="loading">Processing batch search...</div>';
    const allResults = [];
    for (const entry of entries) {
        let product = {};
        if (/^\d+$/.test(entry)) {
            product = await queryOpenFoodFactsByBarcode(entry);
        } else {
            const searchResult = await searchOpenFoodFacts(entry);
            if (searchResult && searchResult.id) {
                product = await queryOpenFoodFactsByBarcode(searchResult.id);
            }
        }
        if (product && Object.keys(product).length > 0) {
            // Extract ingredients using improved logic
            const ingredientNames = extractIngredients(product);
            const ingredients = [];
            
            for (const ingName of ingredientNames) {
                const detail = { name: ingName };
                try {
                    const pubchem = await queryPubChem(ingName);
                    if (Object.keys(pubchem).length) detail.pubchem = pubchem;
                } catch (e) {}
                ingredients.push(detail);
            }
            
            const data = buildJson(product, ingredients);
            allResults.push({ entry, data });
        } else {
            allResults.push({ entry, error: 'No product found.' });
        }
    }
    // Render results
    batchResults.innerHTML = allResults.map(r => {
        if (r.error) {
            return `<div><strong>${r.entry}:</strong> <span class="error">${r.error}</span></div>`;
        } else {
            // Render clickable ingredient names
            const ingredientsHtml = r.data.ingredients.map(ing =>
                `<span class="ingredient-link" style="color:#007cba;cursor:pointer;" onclick="showIngredientModal('${ing.name.replace(/'/g, "\\'")}')">${ing.name}</span>`
            ).join(', ');
            return `<div style="margin-bottom:20px;"><strong>${r.entry}:</strong><br>
                <pre style="background:#f8f8f8; padding:10px; border-radius:5px;">${JSON.stringify(r.data, null, 2)}</pre>
                <div>Ingredients: ${ingredientsHtml}</div>
            </div>`;
        }
    }).join('');
}
document.getElementById('batch-form').addEventListener('submit', handleBatchForm);

// --- Enhance single search ingredient rendering ---
function renderIngredientsClickable(product, ingredients) {
    if (!product || !ingredients || ingredients.length === 0) return '';
    return ingredients.map(ing =>
        `<span class="ingredient-link" style="color:#007cba;cursor:pointer;" onclick="showIngredientModal('${ing.name.replace(/'/g, "\\'")}')">${ing.name}</span>`
    ).join(', ');
}
