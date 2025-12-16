// Profile Component (Own Profile)
import { auth, db, storage } from '../firebase-config.js';
import { router } from '../router.js';
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
    serverTimestamp,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { signOut, updateProfile } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

let editProfileModal = null;
let createPostModal = null;
let settingsModal = null;
let followersModal = null;
let followingModal = null;

export async function ProfileComponent(container) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        router.navigate('/login');
        return;
    }

    container.innerHTML = `
        <div class="container py-4 app-container">
            <!-- Profile Header -->
            <div class="card shadow-sm mb-4">
                <div class="card-body">
                    <div class="d-flex align-items-start gap-3">
                        <div class="position-relative flex-shrink-0">
                            <div id="profileAvatar" class="profile-avatar profile-avatar--lg">
                                <i class="bi bi-person-circle" style="font-size: 100px;"></i>
                            </div>
                            <button class="btn btn-primary btn-sm rounded-circle position-absolute shadow-sm profile-camera-btn"
                                    id="cameraBtn"
                                    type="button"
                                    aria-label="Change profile photo">
                                <i class="bi bi-camera-fill"></i>
                            </button>
                            <input type="file" id="profileImageInput" accept="image/*" style="display: none;">
                        </div>

                        <div class="flex-grow-1" style="min-width: 0;">
                            <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                                    <h3 class="mb-0 text-truncate" id="profileName">Loading...</h3>
                                    <span class="badge bg-secondary" id="accountTypeBadge" style="display: none;">
                                        <i class="bi bi-lock-fill"></i> Private
                                    </span>
                                </div>
                            </div>

                            <div class="d-flex justify-content-between text-center mt-3">
                                <div class="flex-fill">
                                    <div class="fw-semibold" id="postsCount">0</div>
                                    <div class="text-muted small">Posts</div>
                                </div>
                                <div class="flex-fill cursor-pointer" role="button" data-bs-toggle="modal" data-bs-target="#followersModal">
                                    <div class="fw-semibold" id="followersCount">0</div>
                                    <div class="text-muted small">Followers</div>
                                </div>
                                <div class="flex-fill cursor-pointer" role="button" data-bs-toggle="modal" data-bs-target="#followingModal">
                                    <div class="fw-semibold" id="followingCount">0</div>
                                    <div class="text-muted small">Following</div>
                                </div>
                            </div>

                            <div class="d-flex flex-wrap gap-2 mt-3">
                                <button class="btn btn-primary rounded-pill px-3 flex-grow-1" data-bs-toggle="modal" data-bs-target="#editProfileModal">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </button>
                                <button class="btn btn-outline-primary rounded-pill px-3 flex-grow-1" data-bs-toggle="modal" data-bs-target="#createPostModal">
                                    <i class="bi bi-plus-square me-2"></i>Post
                                </button>
                                <button class="btn btn-outline-secondary rounded-pill px-3 flex-grow-1" data-bs-toggle="modal" data-bs-target="#settingsModal">
                                    <i class="bi bi-gear me-2"></i>Settings
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="mt-3">
                        <div class="text-muted small" id="profileEmail"></div>
                        <div class="mt-1" id="profileBio">No bio yet</div>
                    </div>
                </div>
            </div>

            <!-- Posts Grid -->
            <div id="postsGrid" class="posts-grid">
                <div class="text-center py-5 text-muted posts-grid__empty">
                    <i class="bi bi-camera fs-1 d-block mb-3"></i>
                    <p>No posts yet</p>
                </div>
            </div>
        </div>

        <!-- Edit Profile Modal -->
        <div class="modal fade" id="editProfileModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Edit Profile</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3 text-center">
                            <div id="editProfileAvatar" class="mx-auto mb-2 profile-avatar profile-avatar--md">
                                <i class="bi bi-person-circle" style="font-size: 80px;"></i>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-primary" onclick="document.getElementById('editProfileImage').click()">
                                <i class="bi bi-camera me-1"></i>Change Photo
                            </button>
                            <input type="file" id="editProfileImage" accept="image/*" style="display: none;">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Name</label>
                            <input type="text" class="form-control" id="editName" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Bio</label>
                            <textarea class="form-control" id="editBio" rows="3" maxlength="150"></textarea>
                            <small class="text-muted">Max 150 characters</small>
                        </div>
                        <div class="alert alert-danger d-none" id="editError"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="saveProfileBtn">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Post Modal -->
        <div class="modal fade" id="createPostModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Create Post</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Image</label>
                            <input type="file" class="form-control" id="postImage" accept="image/*">
                            <div class="mt-2" id="imagePreview"></div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Caption</label>
                            <textarea class="form-control" id="postCaption" rows="3" placeholder="Write a caption..."></textarea>
                        </div>
                        <div class="alert alert-danger d-none" id="postError"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="createPostBtn">
                            <span class="btn-text">Post</span>
                            <span class="spinner-border spinner-border-sm d-none"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Settings Modal -->
        <div class="modal fade" id="settingsModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Account Settings</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <h6 class="mb-3">Privacy</h6>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="privateAccountToggle">
                                <label class="form-check-label" for="privateAccountToggle">
                                    <strong>Private Account</strong>
                                    <p class="text-muted small mb-0">When your account is private, only people you approve can see your posts</p>
                                </label>
                            </div>
                        </div>
                        <div class="mb-3">
                            <h6 class="mb-3">Account Actions</h6>
                            <button class="btn btn-outline-danger w-100" id="logoutBtn">
                                <i class="bi bi-box-arrow-right me-2"></i>Logout
                            </button>
                        </div>
                        <div class="alert alert-success d-none" id="settingsSuccess"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Followers Modal -->
        <div class="modal fade" id="followersModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Followers</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="followersList">
                            <div class="text-center text-muted py-4">
                                <p>Loading...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Following Modal -->
        <div class="modal fade" id="followingModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Following</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="followingList">
                            <div class="text-center text-muted py-4">
                                <p>Loading...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize modals
    editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));
    createPostModal = new bootstrap.Modal(document.getElementById('createPostModal'));
    settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    followersModal = new bootstrap.Modal(document.getElementById('followersModal'));
    followingModal = new bootstrap.Modal(document.getElementById('followingModal'));

    // Load profile data
    await loadProfile();

    // Event listeners
    document.getElementById('cameraBtn').addEventListener('click', () => {
        document.getElementById('profileImageInput').click();
    });
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    document.getElementById('createPostBtn').addEventListener('click', createPost);
    document.getElementById('postImage').addEventListener('change', handleImagePreview);
    document.getElementById('privateAccountToggle').addEventListener('change', togglePrivacy);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('profileImageInput').addEventListener('change', handleProfileImageUpload);
    document.getElementById('editProfileImage').addEventListener('change', handleEditProfileImagePreview);
    
    // Modal listeners
    document.getElementById('followersModal').addEventListener('show.bs.modal', loadFollowersList);
    document.getElementById('followingModal').addEventListener('show.bs.modal', loadFollowingList);

    // Load user profile
    async function loadProfile() {
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Display profile info
                const displayName = userData.displayName || 'User';
                const initials = displayName.charAt(0).toUpperCase();
                
                document.getElementById('profileName').textContent = displayName;
                document.getElementById('profileEmail').textContent = userData.email;
                document.getElementById('profileBio').textContent = userData.bio || 'No bio yet';
                
                // Set avatar with fallback to initials
                const profileAvatar = document.getElementById('profileAvatar');
                const editProfileAvatar = document.getElementById('editProfileAvatar');
                
                if (userData.photoURL) {
                    profileAvatar.innerHTML = 
                        `<img src="${userData.photoURL}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="bg-primary text-white d-none align-items-center justify-content-center" style="width: 100%; height: 100%; font-size: 40px; font-weight: bold;">${initials}</div>`;
                    editProfileAvatar.innerHTML = 
                        `<img src="${userData.photoURL}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;">`;
                } else {
                    profileAvatar.innerHTML = 
                        `<div class="bg-primary text-white d-flex align-items-center justify-content-center" style="width: 100%; height: 100%; font-size: 40px; font-weight: bold;">${initials}</div>`;
                    editProfileAvatar.innerHTML = 
                        `<div class="bg-primary text-white d-flex align-items-center justify-content-center" style="width: 100%; height: 100%; font-size: 32px; font-weight: bold;">${initials}</div>`;
                }
                
                // Show private badge
                if (userData.isPrivate) {
                    document.getElementById('accountTypeBadge').style.display = 'inline-block';
                }
                
                // Set edit form values
                document.getElementById('editName').value = userData.displayName || '';
                document.getElementById('editBio').value = userData.bio || '';
                document.getElementById('privateAccountToggle').checked = userData.isPrivate || false;
                
                // Load stats
                await loadStats();
                await loadUserPosts();
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
                where('userId', '==', currentUser.uid)
            );
            
            const snapshot = await getDocs(postsQuery);
            
            if (snapshot.empty) {
                postsGrid.innerHTML = `
                    <div class="text-center py-5 text-muted posts-grid__empty">
                        <i class="bi bi-camera fs-1 d-block mb-3"></i>
                        <p>No posts yet. Create your first post!</p>
                    </div>
                `;
                return;
            }
            
            postsGrid.innerHTML = '';
            const posts = [];
            snapshot.forEach((doc) => {
                posts.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort manually by createdAt
            posts.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
            
            posts.forEach(post => renderPostThumbnail(post));
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    }

    // Render post thumbnail
    function renderPostThumbnail(post) {
        const postsGrid = document.getElementById('postsGrid');
        const postThumb = document.createElement('div');
        postThumb.className = 'post-thumb';
        
        postThumb.innerHTML = `
            <img src="${post.imageUrl || 'https://via.placeholder.com/300'}" 
                 alt="Post" 
                 class="post-thumb__img">
            <div class="post-thumb__overlay">
                <span><i class="bi bi-heart-fill"></i> ${post.likes || 0}</span>
                <span><i class="bi bi-chat-fill"></i> ${post.commentsCount || 0}</span>
            </div>
        `;

        postThumb.addEventListener('click', () => {
            router.navigate(`/post/${post.id}`);
        });
        
        postsGrid.appendChild(postThumb);
    }

    // Save profile
    async function saveProfile() {
        const saveBtn = document.getElementById('saveProfileBtn');
        const name = document.getElementById('editName').value.trim();
        const bio = document.getElementById('editBio').value.trim();
        const imageFile = document.getElementById('editProfileImage').files[0];
        
        if (!name) {
            showError('editError', 'Name is required');
            return;
        }
        
        saveBtn.disabled = true;
        
        try {
            let photoURL = currentUser.photoURL;
            
            // Upload new image if selected (base64 only)
            if (imageFile) {
                const reader = new FileReader();
                photoURL = await new Promise((resolve, reject) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                });
            }
            
            // Update Firestore
            await updateDoc(doc(db, 'users', currentUser.uid), {
                displayName: name,
                bio: bio,
                photoURL: photoURL
            });
            
            // Update Auth profile (name only - base64 too long for photoURL)
            await updateProfile(currentUser, {
                displayName: name
            });
            
            editProfileModal.hide();
            await loadProfile();
        } catch (error) {
            console.error('Error updating profile:', error);
            showError('editError', 'Failed to update profile: ' + error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }

    // Handle profile image upload (from main profile)
    async function handleProfileImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Image size must be less than 5MB');
            return;
        }
        
        // Show loading state
        const avatar = document.getElementById('profileAvatar');
        const originalContent = avatar.innerHTML;
        avatar.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
        
        try {
            // Use base64 only (no Storage needed)
            const reader = new FileReader();
            const photoURL = await new Promise((resolve, reject) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // Update ONLY Firestore (base64 too long for Auth)
            await updateDoc(doc(db, 'users', currentUser.uid), {
                photoURL: photoURL
            });
            
            avatar.innerHTML = 
                `<img src="${photoURL}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;">`;
        } catch (error) {
            console.error('Error uploading profile image:', error);
            alert('Failed to upload image: ' + error.message);
            avatar.innerHTML = originalContent;
        }
    }

    // Handle edit profile image preview
    function handleEditProfileImagePreview(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('editProfileAvatar').innerHTML = 
                `<img src="${e.target.result}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
        };
        reader.readAsDataURL(file);
    }

    // Upload profile image to Firebase Storage
    async function uploadProfileImage(file) {
        const timestamp = Date.now();
        const storageRef = ref(storage, `profile-images/${currentUser.uid}/${timestamp}_${file.name}`);
        
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        
        return downloadURL;
    }

    // Handle image preview
    function handleImagePreview(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('imagePreview').innerHTML = 
                    `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; border-radius: 8px;">`;
            };
            reader.readAsDataURL(file);
        }
    }

    // Create post
    async function createPost() {
        const caption = document.getElementById('postCaption').value.trim();
        const imageFile = document.getElementById('postImage').files[0];
        const createBtn = document.getElementById('createPostBtn');
        const btnText = createBtn.querySelector('.btn-text');
        const spinner = createBtn.querySelector('.spinner-border');
        
        if (!caption && !imageFile) {
            showError('postError', 'Please add a caption or image');
            return;
        }
        
        createBtn.disabled = true;
        btnText.classList.add('d-none');
        spinner.classList.remove('d-none');
        
        try {
            const userData = (await getDoc(doc(db, 'users', currentUser.uid))).data();
            
            const postData = {
                userId: currentUser.uid,
                userName: userData.displayName || 'User',
                userPhotoURL: userData.photoURL || '',
                caption: caption,
                imageUrl: imageFile ? await uploadImage(imageFile) : '',
                likes: 0,
                likedBy: [],
                commentsCount: 0,
                createdAt: serverTimestamp()
            };
            
            await addDoc(collection(db, 'posts'), postData);
            
            document.getElementById('postCaption').value = '';
            document.getElementById('postImage').value = '';
            document.getElementById('imagePreview').innerHTML = '';
            
            createPostModal.hide();
            
            await loadStats();
            await loadUserPosts();
        } catch (error) {
            console.error('Error creating post:', error);
            showError('postError', 'Failed to create post');
        } finally {
            createBtn.disabled = false;
            btnText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    }

    // Upload image (simplified)
    async function uploadImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    // Toggle privacy
    async function togglePrivacy(e) {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                isPrivate: e.target.checked
            });
            
            showSuccess('settingsSuccess', 'Privacy setting updated');
            
            if (e.target.checked) {
                document.getElementById('accountTypeBadge').style.display = 'inline-block';
            } else {
                document.getElementById('accountTypeBadge').style.display = 'none';
            }
        } catch (error) {
            console.error('Error updating privacy:', error);
            e.target.checked = !e.target.checked;
        }
    }

    // Handle logout
    async function handleLogout() {
        try {
            await signOut(auth);
            router.navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

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
                followerItem.className = 'p-3 border-bottom';
                followerItem.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center flex-grow-1" style="cursor: pointer;" data-user-id="${followerId}">
                            <img src="${follower.photoURL || 'https://via.placeholder.com/40'}" 
                                 class="rounded-circle me-3" 
                                 width="40" 
                                 height="40" 
                                 alt="User">
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
                
                followerItem.querySelector('[data-user-id]').addEventListener('click', () => {
                    router.navigate(`/user-profile/${followerId}`);
                    followersModal.hide();
                });
                
                followerItem.querySelector('.remove-follower-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Remove ${follower.displayName} from your followers?`)) {
                        try {
                            await updateDoc(doc(db, 'users', currentUser.uid), {
                                followers: arrayRemove(followerId)
                            });
                            await updateDoc(doc(db, 'users', followerId), {
                                following: arrayRemove(currentUser.uid)
                            });
                            followerItem.remove();
                            if (document.querySelectorAll('#followersList > div').length === 0) {
                                followersList.innerHTML = '<div class="text-center text-muted py-4"><p>No followers yet</p></div>';
                            }
                            await loadStats();
                        } catch (error) {
                            console.error('Error removing follower:', error);
                        }
                    }
                });
                
                followersList.appendChild(followerItem);
            }
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
                followingItem.className = 'p-3 border-bottom';
                followingItem.style.cursor = 'pointer';
                followingItem.innerHTML = `
                    <div class="d-flex align-items-center">
                        <img src="${followedUser.photoURL || 'https://via.placeholder.com/40'}" 
                             class="rounded-circle me-3" 
                             width="40" 
                             height="40" 
                             alt="User">
                        <div class="flex-grow-1">
                            <h6 class="mb-0">${followedUser.displayName || 'User'}</h6>
                            <small class="text-muted">${followedUser.email}</small>
                        </div>
                    </div>
                `;
                followingItem.addEventListener('click', () => {
                    router.navigate(`/user-profile/${followingId}`);
                    followingModal.hide();
                });
                followingList.appendChild(followingItem);
            }
        }
    }

    // Helper functions
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

    // Cleanup function
    return () => {
        // Dispose modals
        if (editProfileModal) editProfileModal.dispose();
        if (createPostModal) createPostModal.dispose();
        if (settingsModal) settingsModal.dispose();
        if (followersModal) followersModal.dispose();
        if (followingModal) followingModal.dispose();
    };
}
