async function queryOpenFoodFactsByBarcode(barcode) {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (resp.ok) {
        const data = await resp.json();
        console.log('Raw barcode product data:', data.product);
        return data.product || {};
    }
    return {};
}

function isEnglishProduct(product) {
    // Check if product has English name or description
    const englishName = product.product_name_en || product.product_name;
    const englishGeneric = product.generic_name_en || product.generic_name;
    
    // Must have at least an English product name
    if (!englishName || englishName.trim().length === 0) {
        return false;
    }
    
    // Check if the name contains mostly Latin characters (English-like)
    const latinRegex = /^[a-zA-Z0-9\s\-.,&'()%]+$/;
    const nameIsLatin = latinRegex.test(englishName);
    
    // Also check if it's not just numbers or very short
    const hasValidName = englishName.length >= 3 && !/^\d+$/.test(englishName.trim());
    
    return nameIsLatin && hasValidName;
}

async function searchOpenFoodFacts(name, limit = 20) {
    const params = new URLSearchParams({
        search_terms: name,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: limit
    });
    const resp = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
    if (resp.ok) {
        const data = await resp.json();
        console.log('Raw search data:', data);
        if (data.products && data.products.length > 0) {
            // Filter for English products
            const englishProducts = data.products.filter(product => {
                const isEnglish = isEnglishProduct(product);
                if (!isEnglish) {
                    console.log(`Filtering out non-English product: ${product.product_name || product.product_name_en || 'Unknown'}`);
                }
                return isEnglish;
            });
            
            console.log(`Found ${data.products.length} total products, ${englishProducts.length} English products for search term "${name}"`);
            return englishProducts.slice(0, 10); // Limit to 10 English products
        }
    }
    return [];
}

async function searchOpenFoodFactsSingle(name) {
    const products = await searchOpenFoodFacts(name, 1);
    if (products.length > 0) {
        const product = products[0];
        console.log('Selected product from search:', product);
        // Get full product details by barcode
        if (product.code) {
            return await queryOpenFoodFactsByBarcode(product.code);
        }
        return product;
    }
    return {};
}

function extractIngredients(product) {
    console.log('Extracting ingredients from product:', {
        ingredients_text_en: product.ingredients_text_en,
        ingredients_text: product.ingredients_text,
        ingredients: product.ingredients,
        ingredients_tags: product.ingredients_tags,
        ingredients_text_fr: product.ingredients_text_fr
    });

    let ingredients = [];
    
    // Try multiple sources for ingredients, prioritizing English
    if (product.ingredients_text_en || product.ingredients_text || product.ingredients_text_fr) {
        // Prioritize English ingredients text
        const ingredientText = product.ingredients_text_en || product.ingredients_text || product.ingredients_text_fr || '';
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

function buildJson(products, ingredientsMap) {
    console.log('Building JSON with products:', products.length, 'products');
    console.log('Ingredients map:', ingredientsMap);

    const result = {
        data_source: 'Product Database Import',
        import_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        products: [],
        ingredients: [],
        health_effects: []
    };

    const allIngredients = new Map(); // To avoid duplicate ingredients

    // Process each product
    for (let i = 0; i < products.length; i++) {
        const productData = products[i];
        const ingredientsDetails = ingredientsMap[i] || [];

        const productEntry = {
            barcode: productData.code || productData._id || productData.id || 'N/A',
            name: productData.product_name_en || productData.product_name || 'Unknown Product',
            brand: productData.brands || 'Unknown Brand',
            category: productData.categories_en || productData.categories || 'Unknown Category',
            description: productData.generic_name_en || productData.generic_name || '',
            status: 'active',
            is_dummy: false,
            sources: ['OpenFoodFacts'],
            regulatory_claims: productData.labels_en || productData.labels || '',
            active_ingredients: ingredientsDetails.map(ing => ({ name: ing.name, function: '', sources: ['OpenFoodFacts'] })),
            inactive_ingredients: [],
            // Add debugging info
            debug_info: {
                raw_ingredients_text: productData.ingredients_text_en || productData.ingredients_text || '',
                raw_ingredients_tags: productData.ingredients_tags || [],
                nutrition_grades: productData.nutrition_grades || '',
                nova_group: productData.nova_group || ''
            }
        };

        // Add ingredients to the global ingredients list (avoid duplicates)
        for (const ing of ingredientsDetails) {
            if (!allIngredients.has(ing.name)) {
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
                allIngredients.set(ing.name, ingredientItem);
            }
        }

        result.products.push(productEntry);
    }

    // Add all unique ingredients to the result
    result.ingredients = Array.from(allIngredients.values());
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
        
        let products = [];
        
        if (barcode) {
            // Single barcode search
            const product = await queryOpenFoodFactsByBarcode(barcode);
            if (product && Object.keys(product).length > 0) {
                products = [product];
            }
        } else if (name) {
            // Multiple product search
            const searchResults = await searchOpenFoodFacts(name, 10);
            console.log(`Search for "${name}" returned ${searchResults.length} products`);
            
            // Get full details for each product
            for (const searchResult of searchResults) {
                if (searchResult.code) {
                    try {
                        const fullProduct = await queryOpenFoodFactsByBarcode(searchResult.code);
                        if (fullProduct && Object.keys(fullProduct).length > 0) {
                            products.push(fullProduct);
                        }
                    } catch (e) {
                        console.warn(`Failed to get details for product ${searchResult.code}:`, e);
                        // Use search result as fallback
                        products.push(searchResult);
                    }
                } else {
                    // Use search result as is
                    products.push(searchResult);
                }
            }
        }
        
        if (!products || products.length === 0) {
            throw new Error('No products found. Please try a different search term or barcode.');
        }

        console.log(`Processing ${products.length} products`);
        
        // Extract ingredients for all products
        const ingredientsMap = {};
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`Processing product ${i + 1}:`, product.product_name_en || product.product_name || 'Unknown');
            
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
            
            ingredientsMap[i] = ingredients;
        }
        
        const data = buildJson(products, ingredientsMap);
        loading.classList.add('hidden');
        
        // Display results with clickable ingredients for each product
        let resultsHtml = `<div style="margin-bottom: 20px;"><strong>Found ${products.length} product(s):</strong></div>`;
        
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const ingredients = ingredientsMap[i] || [];
            const productName = product.product_name_en || product.product_name || 'Unknown Product';
            const brand = product.brands || 'Unknown Brand';
            
            const ingredientsHtml = renderIngredientsClickable(product, ingredients);
            
            resultsHtml += `
                <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">${productName}</h4>
                    <p style="margin: 5px 0; color: #666;"><strong>Brand:</strong> ${brand}</p>
                    <p style="margin: 5px 0; color: #666;"><strong>Barcode:</strong> ${product.code || 'N/A'}</p>
                    <p style="margin: 10px 0 5px 0; color: #333;"><strong>Ingredients:</strong></p>
                    <div style="margin-left: 10px;">${ingredientsHtml || 'No ingredients found'}</div>
                </div>
            `;
        }
        
        resultsHtml += `<div style="margin-top: 30px;"><strong>Full JSON Data:</strong><pre style="background:#f8f8f8; padding:10px; border-radius:5px; margin-top: 10px;">${JSON.stringify(data, null, 2)}</pre></div>`;
        
        results.innerHTML = resultsHtml;
        
        // Create download link
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        download.href = url;
        download.download = `products_${name || barcode}_${new Date().toISOString().split('T')[0]}.json`;
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
            product = await searchOpenFoodFactsSingle(entry);
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
            
            const data = buildJson([product], [ingredients]);
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
