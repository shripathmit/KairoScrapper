# Multi-API Product & Ingredient Aggregator

This application searches across multiple APIs to provide comprehensive product and ingredient information. Here's how to set up API keys for maximum functionality.

## Integrated APIs

### 1. OpenFoodFacts (✅ No API Key Required)
- **Purpose**: Global food products database with detailed ingredient lists
- **API**: Free and open
- **Data**: Product names, brands, categories, ingredients, nutrition grades
- **Status**: ✅ Working out of the box

### 2. USDA FoodData Central
- **Purpose**: Official US nutrition and food composition data
- **API Key Required**: Yes (free)
- **Setup**: 
  1. Go to https://fdc.nal.usda.gov/api-key-signup.html
  2. Sign up for free API key
  3. Replace `"DEMO_KEY"` in `app.js` with your actual key
- **Data**: Food composition, nutritional information, ingredients

### 3. Spoonacular Food API
- **Purpose**: Recipe and food product database
- **API Key Required**: Yes (freemium)
- **Setup**:
  1. Go to https://spoonacular.com/food-api
  2. Create account and get API key
  3. Replace `"demo"` values in `app.js` with your credentials
- **Free Tier**: 150 requests/day
- **Data**: Food products, recipes, nutritional analysis

### 4. UPC Database (✅ Limited Free Tier)
- **Purpose**: Universal product codes and retail product information
- **API**: Free tier available
- **Status**: ✅ Working with limited requests
- **Data**: Product names, brands, descriptions, UPC/EAN codes

### 5. Walmart Open API
- **Purpose**: Retail product catalog
- **API Key Required**: No (but limited)
- **Status**: ⚠️ May have restrictions
- **Data**: Product names, brands, retail information

### 6. PubChem (✅ No API Key Required)
- **Purpose**: Chemical compound information for ingredients
- **API**: Free and open (NIH/NCBI)
- **Status**: ✅ Working out of the box
- **Data**: Chemical identifiers, compound information, safety data

## Setup Instructions

### Quick Start (No API Keys)
The app works immediately with:
- OpenFoodFacts
- UPC Database (limited)
- PubChem

### Full Setup (All APIs)

1. **Get USDA API Key**:
   ```javascript
   // In app.js, line ~32
   const apiKey = "YOUR_USDA_API_KEY_HERE";
   ```

2. **Get Spoonacular API Key**:
   ```javascript
   // In app.js, line ~55
   const apiKey = "YOUR_SPOONACULAR_API_KEY_HERE";
   ```

3. **Optional: Get Edamam API Keys** (if you want to enable it):
   ```javascript
   // In app.js, lines ~45-46
   app_id: "YOUR_EDAMAM_APP_ID",
   app_key: "YOUR_EDAMAM_APP_KEY"
   ```

## API Response Examples

### Search Results Include:
- **Product Name**: English product names
- **Brand**: Manufacturer or brand information
- **Barcode/UPC**: Product identification codes
- **Ingredients**: Detailed ingredient lists
- **Source**: Which API provided the data
- **Categories**: Product classifications
- **Nutritional Data**: When available

### Multi-Source Benefits:
- **Comprehensive Coverage**: More products found across different databases
- **Cross-Validation**: Same products from multiple sources for accuracy
- **Specialized Data**: Each API provides unique information types
- **Redundancy**: If one API fails, others continue working

## Rate Limits & Costs

| API | Free Tier | Paid Plans | Rate Limits |
|-----|-----------|------------|-------------|
| OpenFoodFacts | ✅ Unlimited | N/A | None |
| USDA FoodData | ✅ 1000/hour | N/A | 1000/hour |
| Spoonacular | ✅ 150/day | $0.004/req | 150/day free |
| UPC Database | ✅ 100/day | Various | 100/day free |
| Walmart API | ⚠️ Limited | Enterprise | Varies |
| PubChem | ✅ Unlimited | N/A | Fair use |

## Production Deployment

For production use:
1. Get all API keys
2. Update rate limiting in code
3. Add error handling for API quotas
4. Consider caching responses
5. Monitor API usage

## Troubleshooting

### Common Issues:
1. **"DEMO_KEY" errors**: Replace with actual API keys
2. **CORS errors**: APIs may block browser requests (consider proxy)
3. **Rate limits**: Implement delays between requests
4. **Empty results**: Some APIs may be regional or have different product catalogs

### Debug Mode:
The app includes extensive console logging. Open browser DevTools → Console to see:
- API response counts
- Filtering information
- Error messages
- Processing status
