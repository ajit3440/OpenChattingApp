// Notifications Component
import { auth, db } from '../firebase-config.js';
import { router } from '../router.js';
import { 
    collection,
    doc, 
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    arrayUnion,
    arrayRemove,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let unsubscribeUser = null;
let unsubscribeNotifications = null;

export async function NotificationsComponent(container) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        router.navigate('/login');
        return;
    }

    container.innerHTML = `
        <div class="container py-3" style="max-width: 600px; padding-bottom: 100px;">
            <h4 class="mb-4">Notifications</h4>
            
            <!-- Follow Requests -->
            <div id="followRequestsSection" class="mb-4">
                <h6 class="mb-3">Follow Requests</h6>
                <div id="followRequestsList">
                    <div class="text-center text-muted py-3">
                        <p>Loading...</p>
                    </div>
                </div>
            </div>

            <!-- Activity Feed -->
            <div>
                <h6 class="mb-3">Activity</h6>
                <div id="notificationsList">
                    <div class="text-center text-muted py-3">
                        <p>Loading...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupRealtimeListeners();

    function setupRealtimeListeners() {
        const userRef = doc(db, 'users', currentUser.uid);
        
        unsubscribeUser = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                loadFollowRequests(userData.followRequests || []);
            }
        });
        
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );
        
        unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notifications = [];
            snapshot.forEach((doc) => {
                notifications.push({ id: doc.id, ...doc.data() });
            });
            
            notifications.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
            
            renderNotifications(notifications);
        });
    }

    async function loadFollowRequests(followRequests) {
        const requestsList = document.getElementById('followRequestsList');
        
        if (followRequests.length === 0) {
            requestsList.innerHTML = '<div class="text-center text-muted py-3"><p>No follow requests</p></div>';
            document.getElementById('followRequestsSection').style.display = 'none';
            return;
        }
        
        document.getElementById('followRequestsSection').style.display = 'block';
        requestsList.innerHTML = '';
        
        for (const requesterId of followRequests) {
            const userDoc = await getDoc(doc(db, 'users', requesterId));
            if (userDoc.exists()) {
                const requester = userDoc.data();
                const requestItem = document.createElement('div');
                requestItem.className = 'card mb-2';
                requestItem.innerHTML = `
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <img src="${requester.photoURL || 'https://via.placeholder.com/40'}" 
                                 class="rounded-circle me-3" 
                                 width="40" 
                                 height="40" 
                                 alt="User"
                                 style="cursor: pointer;"
                                 data-user-id="${requesterId}">
                            <div class="flex-grow-1">
                                <h6 class="mb-0">${requester.displayName || 'User'}</h6>
                                <small class="text-muted">${requester.email}</small>
                            </div>
                        </div>
                        <div class="d-flex gap-2 mt-3">
                            <button class="btn btn-sm btn-primary flex-fill" data-action="accept" data-user-id="${requesterId}">
                                Accept
                            </button>
                            <button class="btn btn-sm btn-outline-secondary flex-fill" data-action="reject" data-user-id="${requesterId}">
                                Reject
                            </button>
                        </div>
                    </div>
                `;
                
                requestItem.querySelector('[data-user-id]').addEventListener('click', () => {
                    router.navigate(`/user-profile/${requesterId}`);
                });
                
                requestItem.querySelector('[data-action="accept"]').addEventListener('click', () => handleFollowRequest(requesterId, true));
                requestItem.querySelector('[data-action="reject"]').addEventListener('click', () => handleFollowRequest(requesterId, false));
                
                requestsList.appendChild(requestItem);
            }
        }
    }

    async function handleFollowRequest(requesterId, accept) {
        try {
            if (accept) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    followRequests: arrayRemove(requesterId),
                    followers: arrayUnion(requesterId)
                });
                await updateDoc(doc(db, 'users', requesterId), {
                    following: arrayUnion(currentUser.uid)
                });
            } else {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    followRequests: arrayRemove(requesterId)
                });
            }
        } catch (error) {
            console.error('Error handling follow request:', error);
        }
    }

    async function renderNotifications(notifications) {
        const notificationsList = document.getElementById('notificationsList');
        
        if (notifications.length === 0) {
            notificationsList.innerHTML = '<div class="text-center text-muted py-3"><p>No notifications</p></div>';
            return;
        }
        
        notificationsList.innerHTML = '';
        
        for (const notification of notifications) {
            const userDoc = await getDoc(doc(db, 'users', notification.fromUserId));
            const userData = userDoc.exists() ? userDoc.data() : {};
            
            const notifItem = document.createElement('div');
            notifItem.className = `card mb-2 ${!notification.read ? 'border-primary' : ''}`;
            notifItem.innerHTML = `
                <div class="card-body">
                    <div class="d-flex align-items-center">
                        <img src="${userData.photoURL || 'https://via.placeholder.com/40'}" 
                             class="rounded-circle me-3" 
                             width="40" 
                             height="40" 
                             alt="User"
                             style="cursor: pointer;"
                             data-user-id="${notification.fromUserId}">
                        <div class="flex-grow-1">
                            <p class="mb-0">${notification.message}</p>
                            <small class="text-muted">${formatTimestamp(notification.createdAt)}</small>
                        </div>
                        ${!notification.read ? '<span class="badge bg-primary">New</span>' : ''}
                    </div>
                </div>
            `;
            
            notifItem.querySelector('[data-user-id]').addEventListener('click', () => {
                router.navigate(`/user-profile/${notification.fromUserId}`);
                if (!notification.read) {
                    updateDoc(doc(db, 'notifications', notification.id), { read: true });
                }
            });
            
            notificationsList.appendChild(notifItem);
        }
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    return () => {
        if (unsubscribeUser) unsubscribeUser();
        if (unsubscribeNotifications) unsubscribeNotifications();
    };
}
