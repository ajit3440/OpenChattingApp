// Notification Badge Real-time Updates
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    collection,
    doc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let unsubscribeNotifications = null;
let unsubscribeUserData = null;

// Check authentication and setup listeners
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        setupNotificationBadge();
    } else {
        // Clean up listeners if user logs out
        if (unsubscribeNotifications) unsubscribeNotifications();
        if (unsubscribeUserData) unsubscribeUserData();
    }
});

// Setup notification badge
function setupNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    // Listen to user data for follow requests count
    unsubscribeUserData = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const followRequestsCount = userData.followRequests?.length || 0;
            
            // Listen to notifications
            const notificationsQuery = query(
                collection(db, 'notifications'),
                where('userId', '==', currentUser.uid),
                where('read', '==', false)
            );
            
            if (unsubscribeNotifications) unsubscribeNotifications();
            
            unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
                const unreadCount = snapshot.size;
                const totalCount = followRequestsCount + unreadCount;
                
                if (totalCount > 0) {
                    badge.textContent = totalCount > 99 ? '99+' : totalCount;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            });
        }
    });
}
