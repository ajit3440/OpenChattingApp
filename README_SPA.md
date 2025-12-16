# ChatApp - Single Page Application

## 🚀 Major Refactoring Complete!

The app has been refactored from a multi-page architecture to a **Single Page Application (SPA)** with dynamic component rendering.

## ✨ What's New?

### Single HTML File
- All pages now render dynamically in **[index.html](index.html)**
- No more page reloads when navigating
- Faster, smoother user experience

### Component-Based Architecture
- Each page is now a JavaScript component in `js/components/`
- Components handle their own setup and cleanup
- Proper memory management with Firestore listener cleanup

### Client-Side Routing
- Hash-based navigation (e.g., `#/feed`, `#/profile`, `#/user-profile/123`)
- Browser back/forward buttons work correctly
- Supports dynamic routes with parameters

### Dynamic Layout
- Header and footer render dynamically based on authentication
- Bottom navigation with active state highlighting
- Real-time notification badge in header

## 📂 New File Structure

```
index.html                      # Main SPA shell
js/
  ├── app.js                    # App bootstrap & auth state
  ├── router.js                 # Client-side router
  ├── firebase-config.js        # Firebase setup
  └── components/
      ├── header.js             # ✅ Navigation header
      ├── footer.js             # ✅ Bottom navigation
      ├── login.js              # ✅ Login & signup
      ├── feed.js               # ✅ Post feed
      ├── profile.js            # 🔶 Your profile (stub)
      ├── user-profile.js       # 🔶 Other users (stub)
      ├── search.js             # 🔶 User search (stub)
      ├── notifications.js      # 🔶 Notifications (stub)
      └── chat.js               # 🔶 Messaging (stub)
```

## 🎯 Current Status

### ✅ Fully Working:
- Login/Signup (email/password + Google)
- Feed with real-time posts
- Like/comment functionality
- Navigation routing
- Header with notification badge
- Bottom navigation bar

### 🔶 To Be Implemented:
- Profile page (own + other users)
- Search functionality
- Notifications page
- Chat/messaging
- Create post modal

## 🔧 How to Use

### Start the Server
```powershell
cd d:\NewProject\OpenChattingApp
python -m http.server 8000
```

### Open in Browser
```
http://localhost:8000
```

### Navigation
- Login/signup on home page
- After login, you're redirected to feed
- Use bottom navigation to switch between pages
- Click user profiles to view their pages
- All navigation uses hash routes (no page reload!)

## 🛠️ Development Guide

### Adding a New Component

1. **Create component file** in `js/components/`:
```javascript
// js/components/my-page.js
import { auth, db } from '../firebase-config.js';
import { router } from '../router.js';

export async function MyPageComponent(container, params) {
    // Check authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
        router.navigate('/login');
        return;
    }

    // Render UI
    container.innerHTML = `
        <div class="container">
            <h1>My Page</h1>
        </div>
    `;

    // Setup listeners
    const unsubscribe = onSnapshot(query, (snapshot) => {
        // Handle updates
    });

    // Return cleanup function
    return () => {
        if (unsubscribe) unsubscribe();
    };
}
```

2. **Register route** in `js/router.js`:
```javascript
import { MyPageComponent } from './components/my-page.js';
router.register('/my-page', MyPageComponent);
```

3. **Navigate to it**:
```javascript
router.navigate('/my-page');
// Or in HTML:
<a href="#/my-page">Go to My Page</a>
```

### Component Lifecycle

```
Route Change → Cleanup Old Component → Show Loading → 
Render New Component → Setup Listeners → Hide Loading
```

### Key Principles

1. **Always return cleanup function** to prevent memory leaks
2. **Use onSnapshot** for real-time Firestore data
3. **Check authentication** before rendering
4. **Use router.navigate()** for programmatic navigation
5. **Clean up ALL listeners** in cleanup function

## 📚 Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` or `/login` | LoginComponent | Authentication |
| `/feed` | FeedComponent | Home feed |
| `/profile` | ProfileComponent | Your profile |
| `/user-profile/:userId` | UserProfileComponent | Other user's profile |
| `/search` | SearchComponent | Search users |
| `/notifications` | NotificationsComponent | Notifications |
| `/chat` | ChatComponent | Messages |

## 🔍 Debugging

### Check Console
Open browser DevTools (F12) and check console for errors.

### Common Issues

1. **"Cannot read property of undefined"**
   - Check if Firebase auth is initialized
   - Verify user is logged in

2. **Component not rendering**
   - Check if route is registered in router.js
   - Verify import path is correct

3. **Memory leaks**
   - Ensure cleanup function unsubscribes all listeners
   - Check router cleanup is being called

### View Loaded Modules
In browser console:
```javascript
console.log(window.location.hash); // Current route
```

## 📖 Documentation

- **[SPA_MIGRATION_GUIDE.md](SPA_MIGRATION_GUIDE.md)** - Complete migration guide with detailed architecture explanation
- **[.gitignore](.gitignore)** - Git ignore rules
- **Old files** (*.html, js/*.js) - Keep as reference for migrating remaining components

## 🎨 Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules)
- **UI**: Bootstrap 5.3.0 + Bootstrap Icons
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Routing**: Custom hash-based router
- **Real-time**: Firestore onSnapshot
- **External APIs**: Giphy API for GIFs

## 🚧 Next Steps

See [SPA_MIGRATION_GUIDE.md](SPA_MIGRATION_GUIDE.md) for detailed migration checklist.

1. Implement Profile Component
2. Implement User Profile Component
3. Implement Search Component
4. Implement Notifications Component
5. Implement Chat Component
6. Add Create Post Modal
7. Final testing & optimization

---

**Status**: Foundation Complete ✅ | Ready for Component Migration 🚀
