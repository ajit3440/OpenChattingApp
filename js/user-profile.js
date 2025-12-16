// User Profile Module (for viewing other users)
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    collection,
    doc, 
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let viewingUserId = null;
let targetUserUnsubscribe = null;
let currentUserUnsubscribe = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Get userId from URL
        const urlParams = new URLSearchParams(window.location.search);
        viewingUserId = urlParams.get('userId');
        
        if (!viewingUserId || viewingUserId === currentUser.uid) {
            // Redirect to own profile
            window.location.href = 'profile.html';
            return;
        }
        
        await loadUserProfile();
    } else {
        window.location.href = 'index.html';
    }
});

// Load user profile
async function loadUserProfile() {
    try {
        // Clean up previous listeners
        if (targetUserUnsubscribe) {
            targetUserUnsubscribe();
        }
        if (currentUserUnsubscribe) {
            currentUserUnsubscribe();
        }
        
        const userDoc = await getDoc(doc(db, 'users', viewingUserId));
        
        if (!userDoc.exists()) {
            alert('User not found');
            window.location.href = 'feed.html';
            return;
        }
        
        const userData = userDoc.data();
        
        // Display profile info
        document.getElementById('profileName').textContent = userData.displayName || 'User';
        document.getElementById('profileEmail').textContent = userData.email;
        document.getElementById('profileBio').textContent = userData.bio || 'No bio yet';
        
        if (userData.photoURL) {
            document.getElementById('profileAvatar').innerHTML = 
                `<img src="${userData.photoURL}" alt="Profile">`;
        }
        
        // Show private badge if private
        if (userData.isPrivate) {
            document.getElementById('accountTypeBadge').style.display = 'inline-block';
        } else {
            document.getElementById('accountTypeBadge').style.display = 'none';
        }
        
        // Update follow button state
        await updateFollowButton(userData);
        
        // Load stats
        await loadStats();
        
        // Load posts if account is public or user is following
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const currentUserData = currentUserDoc.data();
        const isFollowing = currentUserData.following?.includes(viewingUserId);
        
        if (!userData.isPrivate || isFollowing) {
            await loadPosts();
        } else {
            document.getElementById('postsGrid').innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-lock fs-1 d-block mb-3"></i>
                    <p>This account is private</p>
                    <small>Follow to see their posts</small>
                </div>
            `;
        }
        
        // Setup real-time listener for target user changes
        targetUserUnsubscribe = onSnapshot(doc(db, 'users', viewingUserId), async (docSnap) => {
            if (docSnap.exists()) {
                const updatedUserData = docSnap.data();
                await updateFollowButton(updatedUserData);
                
                // Show/hide private badge
                if (updatedUserData.isPrivate) {
                    document.getElementById('accountTypeBadge').style.display = 'inline-block';
                } else {
                    document.getElementById('accountTypeBadge').style.display = 'none';
                }
                
                // Reload posts if follow status changed
                const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const currentUserData = currentUserDoc.data();
                const isFollowing = currentUserData.following?.includes(viewingUserId);
                
                if (!updatedUserData.isPrivate || isFollowing) {
                    await loadPosts();
                } else {
                    document.getElementById('postsGrid').innerHTML = `
                        <div class="text-center py-5 text-muted">
                            <i class="bi bi-lock fs-1 d-block mb-3"></i>
                            <p>This account is private</p>
                            <small>Follow to see their posts</small>
                        </div>
                    `;
                }
                
                await loadStats();
            }
        });
        
        // Setup real-time listener for current user's following changes
        currentUserUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), async (docSnap) => {
            if (docSnap.exists()) {
                const currentUserData = docSnap.data();
                const targetUserDoc = await getDoc(doc(db, 'users', viewingUserId));
                if (targetUserDoc.exists()) {
                    const targetUserData = targetUserDoc.data();
                    await updateFollowButton(targetUserData);
                    
                    // Reload posts if follow status changed
                    const isFollowing = currentUserData.following?.includes(viewingUserId);
                    
                    if (!targetUserData.isPrivate || isFollowing) {
                        await loadPosts();
                    } else {
                        document.getElementById('postsGrid').innerHTML = `
                            <div class="text-center py-5 text-muted">
                                <i class="bi bi-lock fs-1 d-block mb-3"></i>
                                <p>This account is private</p>
                                <small>Follow to see their posts</small>
                            </div>
                        `;
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading user profile:', error);
        alert('Error loading profile');
        window.location.href = 'feed.html';
    }
}

// Update follow button
async function updateFollowButton(userData) {
    const followBtn = document.getElementById('followBtn');
    const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const currentUserData = currentUserDoc.data();
    const isFollowing = currentUserData.following?.includes(viewingUserId);
    const hasPendingRequest = userData.followRequests?.includes(currentUser.uid);
    
    if (isFollowing) {
        followBtn.innerHTML = '<i class="bi bi-person-check me-2"></i>Following';
        followBtn.classList.remove('btn-primary', 'btn-outline-secondary');
        followBtn.classList.add('btn-outline-primary');
        followBtn.dataset.status = 'following';
    } else if (hasPendingRequest) {
        followBtn.innerHTML = '<i class="bi bi-clock me-2"></i>Requested';
        followBtn.classList.remove('btn-primary', 'btn-outline-primary');
        followBtn.classList.add('btn-outline-secondary');
        followBtn.dataset.status = 'requested';
    } else if (userData.isPrivate) {
        followBtn.innerHTML = '<i class="bi bi-lock me-2"></i>Request to Follow';
        followBtn.classList.remove('btn-outline-primary', 'btn-outline-secondary');
        followBtn.classList.add('btn-primary');
        followBtn.dataset.status = 'request';
    } else {
        followBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Follow';
        followBtn.classList.remove('btn-outline-primary', 'btn-outline-secondary');
        followBtn.classList.add('btn-primary');
        followBtn.dataset.status = 'follow';
    }
}

// Load stats
async function loadStats() {
    try {
        const userDoc = await getDoc(doc(db, 'users', viewingUserId));
        const userData = userDoc.data();
        
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', viewingUserId)
        );
        const postsSnapshot = await getDocs(postsQuery);
        
        document.getElementById('postsCount').textContent = postsSnapshot.size;
        document.getElementById('followersCount').textContent = userData.followers?.length || 0;
        document.getElementById('followingCount').textContent = userData.following?.length || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load posts
async function loadPosts() {
    const postsGrid = document.getElementById('postsGrid');
    
    try {
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', viewingUserId)
        );
        
        const snapshot = await getDocs(postsQuery);
        
        if (snapshot.empty) {
            postsGrid.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-camera fs-1 d-block mb-3"></i>
                    <p>No posts yet</p>
                </div>
            `;
            return;
        }
        
        postsGrid.innerHTML = '';
        
        const posts = [];
        snapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() });
        });
        
        posts.sort((a, b) => {
            const timeA = a.createdAt?.toMillis() || 0;
            const timeB = b.createdAt?.toMillis() || 0;
            return timeB - timeA;
        });
        
        posts.forEach(post => renderPostThumbnail(post));
    } catch (error) {
        console.error('Error loading posts:', error);
        postsGrid.innerHTML = `
            <div class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>
                <p>Error loading posts</p>
            </div>
        `;
    }
}

// Render post thumbnail
function renderPostThumbnail(post) {
    const postsGrid = document.getElementById('postsGrid');
    const postCard = document.createElement('div');
    postCard.className = 'post-thumbnail';
    postCard.style.cursor = 'pointer';
    
    if (post.imageUrl) {
        postCard.innerHTML = `<img src="${post.imageUrl}" alt="Post">`;
    } else {
        postCard.innerHTML = `
            <div class="d-flex align-items-center justify-content-center h-100 bg-light">
                <p class="text-muted">${post.caption?.substring(0, 50) || 'Post'}</p>
            </div>
        `;
    }
    
    postsGrid.appendChild(postCard);
}

// Handle follow button click
document.getElementById('followBtn')?.addEventListener('click', async () => {
    const followBtn = document.getElementById('followBtn');
    followBtn.disabled = true;
    
    try {
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const currentUserData = currentUserDoc.data();
        const targetUserDoc = await getDoc(doc(db, 'users', viewingUserId));
        const targetUserData = targetUserDoc.data();
        
        const isFollowing = currentUserData.following?.includes(viewingUserId);
        const hasPendingRequest = targetUserData.followRequests?.includes(currentUser.uid);
        
        if (isFollowing) {
            // Unfollow
            await updateDoc(doc(db, 'users', currentUser.uid), {
                following: arrayRemove(viewingUserId)
            });
            
            await updateDoc(doc(db, 'users', viewingUserId), {
                followers: arrayRemove(currentUser.uid)
            });
        } else if (hasPendingRequest) {
            // Cancel follow request
            await updateDoc(doc(db, 'users', viewingUserId), {
                followRequests: arrayRemove(currentUser.uid)
            });
        } else if (targetUserData.isPrivate) {
            // Send follow request for private account
            await updateDoc(doc(db, 'users', viewingUserId), {
                followRequests: arrayUnion(currentUser.uid)
            });
            
            // Create notification
            await addDoc(collection(db, 'notifications'), {
                userId: viewingUserId,
                type: 'follow_request',
                fromUserId: currentUser.uid,
                message: `${currentUserData.displayName} wants to follow you`,
                createdAt: serverTimestamp(),
                read: false
            });
        } else {
            // Follow public account immediately
            await updateDoc(doc(db, 'users', currentUser.uid), {
                following: arrayUnion(viewingUserId)
            });
            
            await updateDoc(doc(db, 'users', viewingUserId), {
                followers: arrayUnion(currentUser.uid)
            });
            
            // Create notification
            await addDoc(collection(db, 'notifications'), {
                userId: viewingUserId,
                type: 'new_follower',
                fromUserId: currentUser.uid,
                message: `${currentUserData.displayName} started following you`,
                createdAt: serverTimestamp(),
                read: false
            });
        }
    } catch (error) {
        console.error('Error following/unfollowing:', error);
        alert('Failed to update. Please try again.');
    } finally {
        followBtn.disabled = false;
    }
});

// Handle message button
document.getElementById('messageBtn')?.addEventListener('click', () => {
    window.location.href = `chat.html?userId=${viewingUserId}`;
});

// Load followers list
async function loadFollowersList() {
    const userDoc = await getDoc(doc(db, 'users', viewingUserId));
    const userData = userDoc.data();
    const followers = userData.followers || [];
    
    const followersList = document.getElementById('followersList');
    
    if (followers.length === 0) {
        followersList.innerHTML = '<div class="text-center text-muted py-4"><p>No followers yet</p></div>';
        return;
    }
    
    followersList.innerHTML = '';
    
    for (const followerId of followers) {
        const followerDoc = await getDoc(doc(db, 'users', followerId));
        if (followerDoc.exists()) {
            const follower = followerDoc.data();
            const followerItem = document.createElement('div');
            followerItem.className = 'user-item p-3 border-bottom';
            followerItem.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="user-avatar me-3">
                        ${follower.photoURL ? `<img src="${follower.photoURL}" alt="${follower.displayName}">` : '<i class="bi bi-person-circle"></i>'}
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${follower.displayName || 'User'}</h6>
                        <small class="text-muted">${follower.email}</small>
                    </div>
                </div>
            `;
            followerItem.style.cursor = 'pointer';
            followerItem.addEventListener('click', () => {
                window.location.href = `user-profile.html?userId=${followerId}`;
            });
            followersList.appendChild(followerItem);
        }
    }
}

// Load following list
async function loadFollowingList() {
    const userDoc = await getDoc(doc(db, 'users', viewingUserId));
    const userData = userDoc.data();
    const following = userData.following || [];
    
    const followingList = document.getElementById('followingList');
    
    if (following.length === 0) {
        followingList.innerHTML = '<div class="text-center text-muted py-4"><p>Not following anyone yet</p></div>';
        return;
    }
    
    followingList.innerHTML = '';
    
    for (const followingId of following) {
        const followingDoc = await getDoc(doc(db, 'users', followingId));
        if (followingDoc.exists()) {
            const followedUser = followingDoc.data();
            const followingItem = document.createElement('div');
            followingItem.className = 'user-item p-3 border-bottom';
            followingItem.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="user-avatar me-3">
                        ${followedUser.photoURL ? `<img src="${followedUser.photoURL}" alt="${followedUser.displayName}">` : '<i class="bi bi-person-circle"></i>'}
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${followedUser.displayName || 'User'}</h6>
                        <small class="text-muted">${followedUser.email}</small>
                    </div>
                </div>
            `;
            followingItem.style.cursor = 'pointer';
            followingItem.addEventListener('click', () => {
                window.location.href = `user-profile.html?userId=${followingId}`;
            });
            followingList.appendChild(followingItem);
        }
    }
}

// Load modals
document.getElementById('followersModal')?.addEventListener('show.bs.modal', loadFollowersList);
document.getElementById('followingModal')?.addEventListener('show.bs.modal', loadFollowingList);
