// Search Module
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
    addDoc,
    query,
    where,
    limit,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let searchTimeout = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadCurrentUserData();
        await loadSuggestedUsers();
    } else {
        window.location.href = 'index.html';
    }
});

// Load current user data
async function loadCurrentUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            
            // Initialize followers/following if needed
            if (!currentUserData.followers || !currentUserData.following) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    followers: currentUserData.followers || [],
                    following: currentUserData.following || []
                });
                currentUserData.followers = currentUserData.followers || [];
                currentUserData.following = currentUserData.following || [];
            }
        }
    } catch (error) {
        console.error('Error loading current user data:', error);
    }
}

// Search users with debounce
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim();
    const clearBtn = document.getElementById('clearSearch');
    
    if (searchTerm) {
        clearBtn.style.display = 'block';
    } else {
        clearBtn.style.display = 'none';
        document.getElementById('searchResults').innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-search fs-1 d-block mb-3"></i>
                <p>Search for users to follow</p>
            </div>
        `;
        return;
    }
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchUsers(searchTerm);
    }, 300);
});

// Clear search
document.getElementById('clearSearch')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    document.getElementById('searchResults').innerHTML = `
        <div class="text-center py-5 text-muted">
            <i class="bi bi-search fs-1 d-block mb-3"></i>
            <p>Search for users to follow</p>
        </div>
    `;
});

// Search users
async function searchUsers(searchTerm) {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = `
        <div class="text-center py-3 text-muted">
            <div class="spinner-border spinner-border-sm" role="status"></div>
            <p class="mt-2">Searching...</p>
        </div>
    `;
    
    try {
        const usersQuery = query(collection(db, 'users'));
        const snapshot = await getDocs(usersQuery);
        
        const results = [];
        const searchLower = searchTerm.toLowerCase();
        
        snapshot.forEach((doc) => {
            if (doc.id === currentUser.uid) return; // Skip current user
            
            const userData = doc.data();
            const displayName = (userData.displayName || '').toLowerCase();
            const email = (userData.email || '').toLowerCase();
            
            if (displayName.includes(searchLower) || email.includes(searchLower)) {
                // Ensure all required fields exist
                results.push({ 
                    id: doc.id, 
                    ...userData,
                    isPrivate: userData.isPrivate || false,
                    followRequests: userData.followRequests || []
                });
            }
        });
        
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-person-x fs-1 d-block mb-3"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        searchResults.innerHTML = '';
        results.forEach(user => renderUserItem(user, searchResults));
        
    } catch (error) {
        console.error('Error searching users:', error);
        searchResults.innerHTML = `
            <div class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>
                <p>Error searching users</p>
            </div>
        `;
    }
}

// Load suggested users
async function loadSuggestedUsers() {
    const suggestedList = document.getElementById('suggestedList');
    
    try {
        const usersQuery = query(
            collection(db, 'users'),
            limit(10)
        );
        const snapshot = await getDocs(usersQuery);
        
        const suggested = [];
        snapshot.forEach((doc) => {
            if (doc.id === currentUser.uid) return; // Skip current user
            
            const userData = doc.data();
            // Only suggest users not already followed
            if (!currentUserData.following?.includes(doc.id)) {
                suggested.push({ id: doc.id, ...userData });
            }
        });
        
        if (suggested.length === 0) {
            suggestedList.innerHTML = `
                <div class="text-center py-3 text-muted">
                    <p>No suggestions available</p>
                </div>
            `;
            return;
        }
        
        suggestedList.innerHTML = '';
        suggested.forEach(user => renderUserItem(user, suggestedList));
        
    } catch (error) {
        console.error('Error loading suggested users:', error);
        suggestedList.innerHTML = `
            <div class="text-center py-3 text-muted">
                <p>Error loading suggestions</p>
            </div>
        `;
    }
}

// Render user item
function renderUserItem(user, container) {
    const isFollowing = currentUserData.following?.includes(user.id);
    const hasPendingRequest = user.followRequests?.includes(currentUser.uid);
    
    let buttonText = 'Follow';
    let buttonClass = 'btn-primary';
    
    if (isFollowing) {
        buttonText = 'Following';
        buttonClass = 'btn-outline-primary';
    } else if (hasPendingRequest) {
        buttonText = 'Requested';
        buttonClass = 'btn-outline-secondary';
    }
    
    const userItem = document.createElement('div');
    userItem.className = 'd-flex align-items-center justify-content-between p-3 border-bottom user-item-hover';
    
    userItem.innerHTML = `
        <div class="d-flex align-items-center flex-grow-1" style="cursor: pointer;" data-user-id="${user.id}">
            <div class="user-avatar me-3">
                ${user.photoURL ? `<img src="${user.photoURL}" alt="${user.displayName}">` : '<i class="bi bi-person-circle"></i>'}
            </div>
            <div>
                <h6 class="mb-0">
                    ${user.displayName || 'User'}
                    ${user.isPrivate ? '<i class="bi bi-lock-fill text-muted ms-1" style="font-size: 0.8rem;"></i>' : ''}
                </h6>
                <small class="text-muted">${user.email}</small>
                ${user.bio ? `<p class="mb-0 text-muted small">${user.bio.substring(0, 50)}${user.bio.length > 50 ? '...' : ''}</p>` : ''}
            </div>
        </div>
        <button class="btn btn-sm ${buttonClass} follow-btn" 
                data-user-id="${user.id}" 
                data-following="${isFollowing}"
                data-is-private="${user.isPrivate || false}"
                data-pending="${hasPendingRequest}">
            ${buttonText}
        </button>
    `;
    
    // Navigate to profile on click
    userItem.querySelector('[data-user-id]').addEventListener('click', () => {
        window.location.href = `user-profile.html?userId=${user.id}`;
    });
    
    // Handle follow/unfollow
    const followBtn = userItem.querySelector('.follow-btn');
    followBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleFollowToggle(user.id, followBtn, user.isPrivate);
    });
    
    container.appendChild(userItem);
}

// Handle follow/unfollow
async function handleFollowToggle(userId, button, isPrivate) {
    button.disabled = true;
    const isFollowing = button.dataset.following === 'true';
    const isPending = button.dataset.pending === 'true';
    
    try {
        if (isFollowing) {
            // Unfollow
            await updateDoc(doc(db, 'users', currentUser.uid), {
                following: arrayRemove(userId)
            });
            
            await updateDoc(doc(db, 'users', userId), {
                followers: arrayRemove(currentUser.uid)
            });
            
            button.textContent = 'Follow';
            button.classList.remove('btn-outline-primary');
            button.classList.add('btn-primary');
            button.dataset.following = 'false';
            
            // Update local data
            currentUserData.following = currentUserData.following.filter(id => id !== userId);
            
        } else if (isPending) {
            // Cancel follow request
            await updateDoc(doc(db, 'users', userId), {
                followRequests: arrayRemove(currentUser.uid)
            });
            
            button.textContent = 'Follow';
            button.classList.remove('btn-outline-secondary');
            button.classList.add('btn-primary');
            button.dataset.pending = 'false';
            
        } else {
            // Check if account is private by fetching fresh data
            const targetUserDoc = await getDoc(doc(db, 'users', userId));
            const targetUserData = targetUserDoc.data();
            
            console.log('Target user data:', targetUserData);
            console.log('Is private:', targetUserData?.isPrivate);
            
            if (targetUserData && targetUserData.isPrivate === true) {
                // Initialize followRequests if it doesn't exist
                if (!targetUserData.followRequests) {
                    await updateDoc(doc(db, 'users', userId), {
                        followRequests: [currentUser.uid]
                    });
                } else {
                    // Send follow request
                    await updateDoc(doc(db, 'users', userId), {
                        followRequests: arrayUnion(currentUser.uid)
                    });
                }
                
                // Create notification
                await addDoc(collection(db, 'notifications'), {
                    userId: userId,
                    type: 'follow_request',
                    fromUserId: currentUser.uid,
                    message: `${currentUserData.displayName} wants to follow you`,
                    createdAt: serverTimestamp(),
                    read: false
                });
                
                button.textContent = 'Requested';
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline-secondary');
                button.dataset.pending = 'true';
                
            } else {
                // Follow immediately (public account)
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    following: arrayUnion(userId)
                });
                
                await updateDoc(doc(db, 'users', userId), {
                    followers: arrayUnion(currentUser.uid)
                });
                
                // Create notification
                await addDoc(collection(db, 'notifications'), {
                    userId: userId,
                    type: 'new_follower',
                    fromUserId: currentUser.uid,
                    message: `${currentUserData.displayName} started following you`,
                    createdAt: serverTimestamp(),
                    read: false
                });
                
                button.textContent = 'Following';
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline-primary');
                button.dataset.following = 'true';
                
                // Update local data
                currentUserData.following.push(userId);
            }
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        alert('Failed to update. Please try again.');
    } finally {
        button.disabled = false;
    }
}
