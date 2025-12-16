// Client-side Router
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.cleanup = null;
    }

    // Register a route
    register(path, component) {
        this.routes[path] = component;
    }

    // Initialize router
    init() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
        
        // Handle initial route
        this.handleRoute();
    }

    // Handle route change
    async handleRoute() {
        const path = window.location.hash.slice(1) || '/feed';

        // If the user clicks the active tab/link again, some browsers still
        // fire a hashchange event; avoid re-mounting the same route.
        if (path === this.currentRoute) {
            return;
        }
        
        // Cleanup previous route
        if (this.cleanup) {
            await this.cleanup();
            this.cleanup = null;
        }

        // Update body class for chat page (prevents scrolling on chat)
        if (path === '/chat') {
            document.documentElement.classList.add('chat-page');
            document.body.classList.add('chat-page');
        } else {
            document.documentElement.classList.remove('chat-page');
            document.body.classList.remove('chat-page');
        }

        // Find matching route
        let route = this.routes[path];
        
        // Check for dynamic routes (e.g., /user-profile/:userId)
        if (!route) {
            for (const routePath in this.routes) {
                const regex = this.pathToRegex(routePath);
                const match = path.match(regex);
                if (match) {
                    route = this.routes[routePath];
                    route.params = this.extractParams(routePath, match);
                    break;
                }
            }
        }

        if (route) {
            this.currentRoute = path;
            const contentDiv = document.getElementById('app-content');
            
            // Show loading
            this.showLoading();
            
            try {
                // Render component
                if (typeof route === 'function') {
                    this.cleanup = await route(contentDiv, route.params || {});
                } else if (route.render) {
                    this.cleanup = await route.render(contentDiv, route.params || {});
                }
            } catch (error) {
                console.error('Error rendering route:', error);
                contentDiv.innerHTML = `
                    <div class="container mt-5 text-center">
                        <h3>Error loading page</h3>
                        <p class="text-muted">${error.message}</p>
                        <button class="btn btn-primary" onclick="window.location.reload()">Reload</button>
                    </div>
                `;
            }
            
            // Hide loading
            this.hideLoading();
        } else {
            this.navigate('/feed');
        }
    }

    // Convert path to regex for dynamic routes
    pathToRegex(path) {
        return new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$');
    }

    // Extract params from path
    extractParams(routePath, match) {
        const keys = routePath.match(/:\w+/g) || [];
        const params = {};
        keys.forEach((key, i) => {
            params[key.slice(1)] = match[i + 1];
        });
        return params;
    }

    // Navigate to a route
    navigate(path) {
        const currentPath = window.location.hash.slice(1) || '/feed';
        if (currentPath === path) return;

        window.location.hash = path;
    }

    // Show loading spinner
    showLoading() {
        document.getElementById('loading-spinner').style.display = 'block';
    }

    // Hide loading spinner
    hideLoading() {
        document.getElementById('loading-spinner').style.display = 'none';
    }
}

// Create router instance
export const router = new Router();

// Register routes
import { LoginComponent } from './components/login.js';
import { FeedComponent } from './components/feed.js';
import { ProfileComponent } from './components/profile.js';
import { UserProfileComponent } from './components/user-profile.js';
import { SearchComponent } from './components/search.js';
import { NotificationsComponent } from './components/notifications.js';
import { ChatComponent } from './components/chat.js';
import { PostComponent } from './components/post.js';

router.register('/', LoginComponent);
router.register('/login', LoginComponent);
router.register('/feed', FeedComponent);
router.register('/profile', ProfileComponent);
router.register('/user-profile/:userId', UserProfileComponent);
router.register('/search', SearchComponent);
router.register('/notifications', NotificationsComponent);
router.register('/chat', ChatComponent);
router.register('/post/:postId', PostComponent);
