// Main App Controller
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { router } from './router.js';
import { renderHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';

let currentUser = null;

// Initialize app
async function init() {
    showLoading();
    
    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        
        if (!user && !isPublicRoute()) {
            // Redirect to login
            router.navigate('/login');
        } else if (user && isAuthRoute()) {
            // Already logged in, redirect to feed
            router.navigate('/feed');
        } else {
            // Render app
            await renderApp();
        }
        
        hideLoading();
    });
    
    // Initialize router
    router.init();
}

// Render app layout
async function renderApp() {
    const path = window.location.hash.slice(1) || '/feed';
    
    // Render header and footer if user is logged in
    if (currentUser) {
        renderHeader();
        renderFooter();
    } else {
        // Clear header and footer for auth pages
        document.getElementById('app-header').innerHTML = '';
        document.getElementById('app-footer').innerHTML = '';
    }
}

// Check if current route is public
function isPublicRoute() {
    const path = window.location.hash.slice(1) || '/';
    return ['/', '/login', '/signup'].includes(path);
}

// Check if current route is auth page
function isAuthRoute() {
    const path = window.location.hash.slice(1) || '/';
    return ['/', '/login', '/signup'].includes(path);
}

// Show loading spinner
function showLoading() {
    document.getElementById('loading-spinner').style.display = 'block';
}

// Hide loading spinner
function hideLoading() {
    document.getElementById('loading-spinner').style.display = 'none';
}

// Export current user getter
export function getCurrentUser() {
    return currentUser;
}

// Start the app
init();

// Listen for route changes
window.addEventListener('hashchange', () => {
    renderApp();
});
