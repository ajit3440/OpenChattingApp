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
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let editProfileModal = null;
let createPostModal = null;

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
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Display profile info
            document.getElementById('profileName').textContent = userData.displayName || 'User';
            document.getElementById('profileEmail').textContent = userData.email;
            document.getElementById('profileBio').textContent = userData.bio || 'No bio yet';
            
            if (userData.photoURL) {
                document.getElementById('profileAvatar').innerHTML = 
                    `<img src="${userData.photoURL}" alt="Profile">`;
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
        // Count posts
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid)
        );
        const postsSnapshot = await getDocs(postsQuery);
        document.getElementById('postsCount').textContent = postsSnapshot.size;
        
        // For now, set followers/following to 0 (can be enhanced)
        document.getElementById('followersCount').textContent = '0';
        document.getElementById('followingCount').textContent = '0';
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
