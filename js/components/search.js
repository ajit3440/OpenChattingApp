// Search Component
import { auth, db } from '../firebase-config.js';
import { router } from '../router.js';
import { 
    collection,
    doc, 
    getDoc,
    getDocs,
    updateDoc,
    addDoc,
    query,
    limit,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUserData = null;
let searchTimeout = null;

export async function SearchComponent(container) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        router.navigate('/login');
        return;
    }

    container.innerHTML = `
        <div class="container py-3" style="max-width: 600px; padding-bottom: 100px;">
            <!-- Search Bar -->
            <div class="position-relative mb-4">
                <input type="text" class="form-control" id="searchInput" placeholder="Search users...">
                <button class="btn btn-link position-absolute end-0 top-0" id="clearSearch" style="display: none;">
                    <i class="bi bi-x-circle"></i>
                </button>
            </div>

            <!-- Search Results -->
            <div id="searchResults">
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-search fs-1 d-block mb-3"></i>
                    <p>Search for users to follow</p>
                </div>
            </div>

            <!-- Suggested Users -->
            <div class="mt-5">
                <h6 class="mb-3">Suggested for you</h6>
                <div id="suggestedList"></div>
            </div>
        </div>
    `;

    // Load current user data
    await loadCurrentUserData();
    await loadSuggestedUsers();

    // Search input listener
    document.getElementById('searchInput').addEventListener('input', (e) => {
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

    // Clear button
    document.getElementById('clearSearch').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('clearSearch').style.display = 'none';
        document.getElementById('searchResults').innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-search fs-1 d-block mb-3"></i>
                <p>Search for users to follow</p>
            </div>
        `;
    });

    async function loadCurrentUserData() {
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                currentUserData.followers = currentUserData.followers || [];
                currentUserData.following = currentUserData.following || [];
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

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
                if (doc.id === currentUser.uid) return;
                
                const userData = doc.data();
                const displayName = (userData.displayName || '').toLowerCase();
                const email = (userData.email || '').toLowerCase();
                
                if (displayName.includes(searchLower) || email.includes(searchLower)) {
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
        }
    }

    async function loadSuggestedUsers() {
        const suggestedList = document.getElementById('suggestedList');
        
        try {
            const usersQuery = query(collection(db, 'users'), limit(10));
            const snapshot = await getDocs(usersQuery);
            
            const suggested = [];
            snapshot.forEach((doc) => {
                if (doc.id === currentUser.uid) return;
                
                if (!currentUserData.following?.includes(doc.id)) {
                    suggested.push({ id: doc.id, ...doc.data() });
                }
            });
            
            if (suggested.length === 0) {
                suggestedList.innerHTML = '<div class="text-center py-3 text-muted"><p>No suggestions</p></div>';
                return;
            }
            
            suggestedList.innerHTML = '';
            suggested.forEach(user => renderUserItem(user, suggestedList));
            
        } catch (error) {
            console.error('Error loading suggestions:', error);
        }
    }

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
        userItem.className = 'd-flex align-items-center justify-content-between p-3 border-bottom';
        
        userItem.innerHTML = `
            <div class="d-flex align-items-center flex-grow-1" style="cursor: pointer;" data-user-id="${user.id}">
                <img src="${user.photoURL || 'https://via.placeholder.com/40'}" 
                     class="rounded-circle me-3" 
                     width="40" 
                     height="40" 
                     alt="User">
                <div>
                    <h6 class="mb-0">
                        ${user.displayName || 'User'}
                        ${user.isPrivate ? '<i class="bi bi-lock-fill text-muted ms-1" style="font-size: 0.8rem;"></i>' : ''}
                    </h6>
                    <small class="text-muted">${user.email}</small>
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
        
        userItem.querySelector('[data-user-id]').addEventListener('click', () => {
            router.navigate(`/user-profile/${user.id}`);
        });
        
        const followBtn = userItem.querySelector('.follow-btn');
        followBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleFollowToggle(user.id, followBtn);
        });
        
        container.appendChild(userItem);
    }

    async function handleFollowToggle(userId, button) {
        button.disabled = true;
        const isFollowing = button.dataset.following === 'true';
        const isPending = button.dataset.pending === 'true';
        
        try {
            if (isFollowing) {
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
                currentUserData.following = currentUserData.following.filter(id => id !== userId);
                
            } else if (isPending) {
                await updateDoc(doc(db, 'users', userId), {
                    followRequests: arrayRemove(currentUser.uid)
                });
                
                button.textContent = 'Follow';
                button.classList.remove('btn-outline-secondary');
                button.classList.add('btn-primary');
                button.dataset.pending = 'false';
                
            } else {
                const targetUserDoc = await getDoc(doc(db, 'users', userId));
                const targetUserData = targetUserDoc.data();
                
                if (targetUserData && targetUserData.isPrivate === true) {
                    await updateDoc(doc(db, 'users', userId), {
                        followRequests: arrayUnion(currentUser.uid)
                    });
                    
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
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        following: arrayUnion(userId)
                    });
                    await updateDoc(doc(db, 'users', userId), {
                        followers: arrayUnion(currentUser.uid)
                    });
                    
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
                    currentUserData.following.push(userId);
                }
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
        } finally {
            button.disabled = false;
        }
    }

    return () => {
        if (searchTimeout) clearTimeout(searchTimeout);
    };
}
