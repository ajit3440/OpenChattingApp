// Notifications Module
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    collection,
    doc, 
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    addDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadCurrentUserData();
        setupRealtimeListeners();
    } else {
        window.location.href = 'index.html';
    }
});

// Setup real-time listeners
function setupRealtimeListeners() {
    // Listen to user data changes for follow requests
    onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            loadFollowRequests();
        }
    });
    
    // Listen to notifications in real-time
    const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        limit(50)
    );
    
    onSnapshot(notificationsQuery, (snapshot) => {
        loadNotificationsFromSnapshot(snapshot);
    });
}

// Load current user data
async function loadCurrentUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            
            // Initialize followRequests if needed
            if (!currentUserData.followRequests) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    followRequests: []
                });
                currentUserData.followRequests = [];
            }
        }
    } catch (error) {
        console.error('Error loading current user data:', error);
    }
}

// Load follow requests
async function loadFollowRequests() {
    const followRequestsList = document.getElementById('followRequestsList');
    const followRequestsSection = document.getElementById('followRequestsSection');
    
    try {
        const requests = currentUserData.followRequests || [];
        
        if (requests.length === 0) {
            followRequestsSection.style.display = 'none';
            return;
        }
        
        followRequestsSection.style.display = 'block';
        followRequestsList.innerHTML = '';
        
        for (const requesterId of requests) {
            const requesterDoc = await getDoc(doc(db, 'users', requesterId));
            if (requesterDoc.exists()) {
                const requesterData = requesterDoc.data();
                renderFollowRequest({ id: requesterId, ...requesterData });
            }
        }
        
    } catch (error) {
        console.error('Error loading follow requests:', error);
    }
}

// Render follow request
function renderFollowRequest(user) {
    const followRequestsList = document.getElementById('followRequestsList');
    
    const requestItem = document.createElement('div');
    requestItem.className = 'd-flex align-items-center justify-content-between p-3 border-bottom bg-light';
    requestItem.id = `request-${user.id}`;
    
    requestItem.innerHTML = `
        <div class="d-flex align-items-center flex-grow-1" style="cursor: pointer;" onclick="window.location.href='user-profile.html?userId=${user.id}'">
            <div class="user-avatar me-3">
                ${user.photoURL ? `<img src="${user.photoURL}" alt="${user.displayName}">` : '<i class="bi bi-person-circle"></i>'}
            </div>
            <div>
                <h6 class="mb-0">${user.displayName || 'User'}</h6>
                <small class="text-muted">wants to follow you</small>
            </div>
        </div>
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-primary accept-btn" data-user-id="${user.id}">
                Accept
            </button>
            <button class="btn btn-sm btn-outline-secondary reject-btn" data-user-id="${user.id}">
                Reject
            </button>
        </div>
    `;
    
    followRequestsList.appendChild(requestItem);
    
    // Handle accept
    requestItem.querySelector('.accept-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleAcceptRequest(user.id, e.target);
    });
    
    // Handle reject
    requestItem.querySelector('.reject-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleRejectRequest(user.id, e.target);
    });
}

// Handle accept follow request
async function handleAcceptRequest(requesterId, button) {
    button.disabled = true;
    
    try {
        // Add requester to followers
        await updateDoc(doc(db, 'users', currentUser.uid), {
            followers: arrayUnion(requesterId),
            followRequests: arrayRemove(requesterId)
        });
        
        // Add current user to requester's following
        await updateDoc(doc(db, 'users', requesterId), {
            following: arrayUnion(currentUser.uid)
        });
        
        // Create notification for requester
        await addDoc(collection(db, 'notifications'), {
            userId: requesterId,
            type: 'follow_accepted',
            fromUserId: currentUser.uid,
            message: `${currentUserData.displayName} accepted your follow request`,
            createdAt: serverTimestamp(),
            read: false
        });
        
        // Remove from UI
        document.getElementById(`request-${requesterId}`)?.remove();
        
        // Check if there are more requests
        const remainingRequests = document.querySelectorAll('#followRequestsList > div').length;
        if (remainingRequests === 0) {
            document.getElementById('followRequestsSection').style.display = 'none';
        }
        
        // Update local data
        currentUserData.followRequests = currentUserData.followRequests.filter(id => id !== requesterId);
        
    } catch (error) {
        console.error('Error accepting follow request:', error);
        alert('Failed to accept request. Please try again.');
        button.disabled = false;
    }
}

// Handle reject follow request
async function handleRejectRequest(requesterId, button) {
    button.disabled = true;
    
    try {
        // Remove from follow requests
        await updateDoc(doc(db, 'users', currentUser.uid), {
            followRequests: arrayRemove(requesterId)
        });
        
        // Remove from UI
        document.getElementById(`request-${requesterId}`)?.remove();
        
        // Check if there are more requests
        const remainingRequests = document.querySelectorAll('#followRequestsList > div').length;
        if (remainingRequests === 0) {
            document.getElementById('followRequestsSection').style.display = 'none';
        }
        
        // Update local data
        currentUserData.followRequests = currentUserData.followRequests.filter(id => id !== requesterId);
        
    } catch (error) {
        console.error('Error rejecting follow request:', error);
        alert('Failed to reject request. Please try again.');
        button.disabled = false;
    }
}

// Load notifications from snapshot (real-time)
async function loadNotificationsFromSnapshot(snapshot) {
    const notificationsList = document.getElementById('notificationsList');
    
    if (snapshot.empty) {
        notificationsList.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-bell fs-1 d-block mb-3"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = '';
    
    for (const docSnap of snapshot.docs) {
        const notification = docSnap.data();
        await renderNotification({ id: docSnap.id, ...notification });
    }
}

// Render notification
async function renderNotification(notification) {
    const notificationsList = document.getElementById('notificationsList');
    
    // Get user who triggered the notification
    let fromUser = null;
    if (notification.fromUserId) {
        const userDoc = await getDoc(doc(db, 'users', notification.fromUserId));
        if (userDoc.exists()) {
            fromUser = userDoc.data();
        }
    }
    
    const notifItem = document.createElement('div');
    notifItem.className = `d-flex align-items-center p-3 border-bottom ${notification.read ? '' : 'bg-light'}`;
    
    let icon = 'bi-bell';
    if (notification.type === 'follow_accepted') icon = 'bi-person-check-fill text-success';
    else if (notification.type === 'new_follower') icon = 'bi-person-plus-fill text-primary';
    else if (notification.type === 'like') icon = 'bi-heart-fill text-danger';
    else if (notification.type === 'comment') icon = 'bi-chat-fill text-primary';
    
    notifItem.innerHTML = `
        <div class="me-3">
            ${fromUser && fromUser.photoURL 
                ? `<div class="user-avatar"><img src="${fromUser.photoURL}" alt="${fromUser.displayName}"></div>` 
                : `<i class="${icon} fs-4"></i>`}
        </div>
        <div class="flex-grow-1">
            <p class="mb-0">${notification.message}</p>
            ${notification.createdAt ? `<small class="text-muted">${formatTimestamp(notification.createdAt)}</small>` : ''}
        </div>
    `;
    
    // Click to navigate if applicable
    if (notification.postId) {
        notifItem.style.cursor = 'pointer';
        notifItem.addEventListener('click', () => {
            window.location.href = `post.html?id=${notification.postId}`;
        });
    } else if (notification.fromUserId) {
        notifItem.style.cursor = 'pointer';
        notifItem.addEventListener('click', () => {
            window.location.href = `user-profile.html?userId=${notification.fromUserId}`;
        });
    }
    
    notificationsList.appendChild(notifItem);
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
