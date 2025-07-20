console.log('KairoScrapper app.js loaded successfully');

// Test if DOM elements exist when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    console.log('Search form exists:', !!document.getElementById('search-form'));
    console.log('Batch form exists:', !!document.getElementById('batch-form'));
    console.log('Result section exists:', !!document.getElementById('result-section'));
    console.log('Modal exists:', !!document.getElementById('ingredient-modal'));
});
