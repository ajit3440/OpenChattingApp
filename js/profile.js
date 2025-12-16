// Profile Module
import { auth, db, storage } from './firebase-config.js';
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
    setDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    increment,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
    signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

let currentUser = null;
let editProfileModal = null;
let createPostModal = null;
let settingsModal = null;
let followersModal = null;
let followingModal = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadProfile();
    } else {
        window.location.href = 'index.html';
    }
});

// Load user profile
async function loadProfile() {
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Initialize followers/following arrays if they don't exist
            if (!userData.followers || !userData.following) {
                await updateDoc(userDocRef, {
                    followers: userData.followers || [],
                    following: userData.following || [],
                    isPrivate: userData.isPrivate || false
                });
            }
            
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
            }
            
            // Set edit form values
            document.getElementById('editName').value = userData.displayName || '';
            document.getElementById('editBio').value = userData.bio || '';
            
            // Load stats
            loadStats();
            loadUserPosts();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}


// Load profile stats
async function loadStats() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        // Count posts
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid)
        );
        const postsSnapshot = await getDocs(postsQuery);
        document.getElementById('postsCount').textContent = postsSnapshot.size;
        
        // Update followers and following counts
        document.getElementById('followersCount').textContent = userData.followers?.length || 0;
        document.getElementById('followingCount').textContent = userData.following?.length || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load user posts
async function loadUserPosts() {
    const postsGrid = document.getElementById('postsGrid');
    
    try {
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(postsQuery);
        
        if (snapshot.empty) {
            postsGrid.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-camera fs-1 d-block mb-3"></i>
                    <p>No posts yet. Create your first post!</p>
                </div>
            `;
            return;
        }
        
        postsGrid.innerHTML = '';
        snapshot.forEach((doc) => {
            const post = { id: doc.id, ...doc.data() };
            renderPostThumbnail(post);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        
        // If orderBy fails (missing index), try without ordering
        try {
            const fallbackQuery = query(
                collection(db, 'posts'),
                where('userId', '==', currentUser.uid)
            );
            
            const snapshot = await getDocs(fallbackQuery);
            
            if (snapshot.empty) {
                postsGrid.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="bi bi-camera fs-1 d-block mb-3"></i>
                        <p>No posts yet. Create your first post!</p>
                    </div>
                `;
                return;
            }
            
            postsGrid.innerHTML = '';
            
            // Sort manually by createdAt
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
            
        } catch (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            postsGrid.innerHTML = `
                <div class="text-center py-5 text-danger">
                    <i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>
                    <p>Error loading posts. Please try again.</p>
                    <small>${fallbackError.message}</small>
                </div>
            `;
        }
    }
}

// Render post thumbnail in grid
function renderPostThumbnail(post) {
    const postsGrid = document.getElementById('postsGrid');
    const postThumb = document.createElement('div');
    postThumb.className = 'post-thumbnail';
    
    postThumb.innerHTML = `
        <img src="${post.imageUrl || 'https://via.placeholder.com/300'}" alt="Post">
        <div class="post-overlay">
            <span><i class="bi bi-heart-fill"></i> ${post.likes || 0}</span>
            <span><i class="bi bi-chat-fill"></i> ${post.commentsCount || 0}</span>
        </div>
    `;
    
    postThumb.addEventListener('click', () => {
        window.location.href = `feed.html#post-${post.id}`;
    });
    
    postsGrid.appendChild(postThumb);
}

// Initialize modals
window.addEventListener('DOMContentLoaded', () => {
    editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));
    createPostModal = new bootstrap.Modal(document.getElementById('createPostModal'));
});

// Save profile changes
document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('editName').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    
    if (!name) {
        showError('editError', 'Name is required');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            displayName: name,
            bio: bio
        });
        
        editProfileModal.hide();
        await loadProfile();
    } catch (error) {
        console.error('Error updating profile:', error);
        showError('editError', 'Failed to update profile');
    }
});

// Image preview
document.getElementById('postImage')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('imagePreview').innerHTML = 
                `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; border-radius: 8px;">`;
        };
        reader.readAsDataURL(file);
    }
});

// Create post (UI only for now - can add Firebase Storage later)
document.getElementById('createPostBtn')?.addEventListener('click', async () => {
    const caption = document.getElementById('postCaption').value.trim();
    const imageFile = document.getElementById('postImage').files[0];
    const createBtn = document.getElementById('createPostBtn');
    const btnText = createBtn.querySelector('.btn-text');
    const spinner = createBtn.querySelector('.spinner-border');
    
    if (!caption && !imageFile) {
        showError('postError', 'Please add a caption or image');
        return;
    }
    
    // Show loading
    createBtn.disabled = true;
    btnText.classList.add('d-none');
    spinner.classList.remove('d-none');
    
    try {
        const userData = (await getDoc(doc(db, 'users', currentUser.uid))).data();
        
        // Create post document
        const postData = {
            userId: currentUser.uid,
            userName: userData.displayName || 'User',
            userPhoto: userData.photoURL || '',
            caption: caption,
            imageUrl: imageFile ? await uploadImage(imageFile) : '',
            likes: 0,
            likedBy: [],
            commentsCount: 0,
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'posts'), postData);
        
        // Reset form and close modal
        document.getElementById('postCaption').value = '';
        document.getElementById('postImage').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        
        createPostModal.hide();
        
        // Reload profile to show new post
        await loadStats();
        await loadUserPosts();
        
    } catch (error) {
        console.error('Error creating post:', error);
        showError('postError', 'Failed to create post. Please try again.');
    } finally {
        createBtn.disabled = false;
        btnText.classList.remove('d-none');
        spinner.classList.add('d-none');
    }
});

// Upload image to Firebase Storage (simplified - using data URL for now)
async function uploadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            // For now, store as data URL
            // In production, use Firebase Storage
            resolve(e.target.result);
        };
        reader.readAsDataURL(file);
    });
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.remove('d-none');
    setTimeout(() => errorElement.classList.add('d-none'), 3000);
}

function showSuccess(elementId, message) {
    const successElement = document.getElementById(elementId);
    successElement.textContent = message;
    successElement.classList.remove('d-none');
    setTimeout(() => successElement.classList.add('d-none'), 3000);
}

// ========== FOLLOWER/FOLLOWING FUNCTIONALITY ==========

// Load other user's profile
// Load followers list
async function loadFollowersList() {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
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
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center flex-grow-1" style="cursor: pointer;" data-user-id="${followerId}">
                        <div class="user-avatar me-3">
                            ${follower.photoURL ? `<img src="${follower.photoURL}" alt="${follower.displayName}">` : '<i class="bi bi-person-circle"></i>'}
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-0">${follower.displayName || 'User'}</h6>
                            <small class="text-muted">${follower.email}</small>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-danger remove-follower-btn" data-follower-id="${followerId}">
                        Remove
                    </button>
                </div>
            `;
            
            // Navigate to profile on click (only on user info, not button)
            const userInfoDiv = followerItem.querySelector('[data-user-id]');
            userInfoDiv.addEventListener('click', () => {
                window.location.href = `user-profile.html?userId=${followerId}`;
            });
            
            // Handle remove follower
            const removeBtn = followerItem.querySelector('.remove-follower-btn');
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleRemoveFollower(followerId, followerItem, follower.displayName);
            });
            
            followersList.appendChild(followerItem);
        }
    }
}

// Handle remove follower
async function handleRemoveFollower(followerId, followerElement, followerName) {
    if (!confirm(`Remove ${followerName} from your followers?`)) {
        return;
    }
    
    try {
        // Remove follower from current user's followers list
        await updateDoc(doc(db, 'users', currentUser.uid), {
            followers: arrayRemove(followerId)
        });
        
        // Remove current user from follower's following list
        await updateDoc(doc(db, 'users', followerId), {
            following: arrayRemove(currentUser.uid)
        });
        
        // Remove from UI
        followerElement.remove();
        
        // Check if there are no more followers
        const remainingFollowers = document.querySelectorAll('#followersList .user-item').length;
        if (remainingFollowers === 0) {
            document.getElementById('followersList').innerHTML = 
                '<div class="text-center text-muted py-4"><p>No followers yet</p></div>';
        }
        
        // Update stats
        await loadStats();
        
    } catch (error) {
        console.error('Error removing follower:', error);
        alert('Failed to remove follower. Please try again.');
    }
}

// Load following list
async function loadFollowingList() {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
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

// Load followers when modal opens
document.getElementById('followersModal')?.addEventListener('show.bs.modal', loadFollowersList);

// Load following when modal opens
document.getElementById('followingModal')?.addEventListener('show.bs.modal', loadFollowingList);

// ========== SETTINGS ==========

// Initialize settings modal
window.addEventListener('DOMContentLoaded', async () => {
    editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));
    createPostModal = new bootstrap.Modal(document.getElementById('createPostModal'));
    settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    followersModal = new bootstrap.Modal(document.getElementById('followersModal'));
    followingModal = new bootstrap.Modal(document.getElementById('followingModal'));
    
    // Load current privacy setting
    if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('privateAccountToggle').checked = userData.isPrivate || false;
            
            if (userData.isPrivate && !viewingUserId) {
                document.getElementById('accountTypeBadge').style.display = 'inline-block';
            }
        }
    }
});

// Handle privacy toggle
document.getElementById('privateAccountToggle')?.addEventListener('change', async (e) => {
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            isPrivate: e.target.checked
        });
        
        showSuccess('settingsSuccess', 'Privacy setting updated');
        
        // Update badge
        if (e.target.checked) {
            document.getElementById('accountTypeBadge').style.display = 'inline-block';
        } else {
            document.getElementById('accountTypeBadge').style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating privacy:', error);
        e.target.checked = !e.target.checked;
    }
});

// Handle logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
});
