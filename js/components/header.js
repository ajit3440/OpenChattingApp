// Header Component
import { auth, db } from '../firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { router } from '../router.js';

let unsubscribeNotifications = null;

export function renderHeader() {
    const user = auth.currentUser;
    if (!user) return;

    const headerDiv = document.getElementById('app-header');
    const currentPath = window.location.hash.slice(1) || '/feed';
    
    // Don't show header on login/auth pages
    if (['/', '/login', '/signup'].includes(currentPath)) {
        headerDiv.innerHTML = '';
        return;
    }

    const userName = user.displayName || user.email || 'U';
    const initials = userName.charAt(0).toUpperCase();
    
    headerDiv.innerHTML = `
        <nav class="navbar navbar-light bg-white border-bottom sticky-top">
            <div class="container-fluid">
                <a class="navbar-brand fw-bold" href="#/feed">
                    <i class="bi bi-chat-dots-fill me-2"></i>ChatApp
                </a>
                <div class="d-flex align-items-center gap-3">
                    <button class="btn btn-link position-relative p-0" onclick="window.location.hash='/notifications'">
                        <i class="bi bi-bell fs-4 text-dark"></i>
                        <span id="notification-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="display: none;">
                            0
                        </span>
                    </button>
                    <div class="rounded-circle cursor-pointer bg-primary text-white d-flex align-items-center justify-content-center" 
                         width="32" 
                         height="32" 
                         style="cursor: pointer; width: 32px; height: 32px; font-weight: bold;"
                         onclick="window.location.hash='/profile'"
                         id="header-avatar">
                        ${initials}
                    </div>
                </div>
            </div>
        </nav>
    `;
    
    // Load image if available
    if (user.photoURL) {
        const img = new Image();
        img.onload = function() {
            const avatar = document.getElementById('header-avatar');
            if (avatar) {
                avatar.innerHTML = '';
                avatar.style.backgroundImage = `url(${user.photoURL})`;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
            }
        };
        img.src = user.photoURL;
    }

    // Setup notification badge
    setupNotificationBadge();
}

function setupNotificationBadge() {
    const user = auth.currentUser;
    if (!user) return;

    // Cleanup previous listener
    if (unsubscribeNotifications) {
        unsubscribeNotifications();
    }

    const userRef = doc(db, 'users', user.uid);
    
    unsubscribeNotifications = onSnapshot(userRef, async (userDoc) => {
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const followRequests = userData.followRequests || [];
            
            // Count unread notifications
            const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
            const notificationsRef = collection(db, 'notifications');
            const q = query(notificationsRef, where('userId', '==', user.uid), where('read', '==', false));
            const snapshot = await getDocs(q);
            
            const unreadCount = snapshot.size;
            const totalCount = unreadCount + followRequests.length;
            
            const badge = document.getElementById('notification-badge');
            if (badge) {
                if (totalCount > 0) {
                    badge.textContent = totalCount > 99 ? '99+' : totalCount;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    });
}

export function cleanupHeader() {
    if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
    }
}
