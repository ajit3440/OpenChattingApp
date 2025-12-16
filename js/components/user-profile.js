// User Profile Component (Other Users)
import { auth, db } from '../firebase-config.js';
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
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let targetUserUnsubscribe = null;
let currentUserUnsubscribe = null;

export async function UserProfileComponent(container, params) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        router.navigate('/login');
        return;
    }

    const userId = params.userId;
    
    // If viewing own profile, redirect to profile page
    if (userId === currentUser.uid) {
        router.navigate('/profile');
        return;
    }

    container.innerHTML = `
        <div class=\"container py-4\" style=\"max-width: 600px;\">
            <div class=\"profile-header text-center mb-4\">
                <div class=\"mb-3\" id=\"profileAvatar\" style=\"width: 100px; height: 100px; margin: 0 auto; border-radius: 50%; overflow: hidden; background: #f0f0f0; display: flex; align-items: center; justify-content: center;\">
                    <i class=\"bi bi-person-circle\" style=\"font-size: 100px;\"></i>
                </div>
                <div class=\"d-flex align-items-center justify-content-center gap-2 mb-2\">
                    <h3 class=\"mb-0\" id=\"profileName\">Loading...</h3>
                    <span class=\"badge bg-secondary\" id=\"accountTypeBadge\" style=\"display: none;\">
                        <i class=\"bi bi-lock-fill\"></i> Private
                    </span>
                </div>
                <p class=\"text-muted\" id=\"profileEmail\"></p>
                <p id=\"profileBio\">No bio yet</p>
                
                <div class=\"row text-center my-4\">
                    <div class=\"col-4\">
                        <h5 id=\"postsCount\">0</h5>
                        <small class=\"text-muted\">Posts</small>
                    </div>
                    <div class=\"col-4\">
                        <h5 id=\"followersCount\">0</h5>
                        <small class=\"text-muted\">Followers</small>
                    </div>
                    <div class=\"col-4\">
                        <h5 id=\"followingCount\">0</h5>
                        <small class=\"text-muted\">Following</small>
                    </div>
                </div>

                <div class=\"d-grid gap-2 mb-4\">
                    <button class=\"btn btn-primary\" id=\"followBtn\">
                        <i class=\"bi bi-person-plus me-2\"></i>Follow
                    </button>
                    <button class=\"btn btn-outline-primary\" id=\"messageBtn\">
                        <i class=\"bi bi-chat-dots me-2\"></i>Message
                    </button>
                </div>
            </div>

            <div id=\"postsGrid\" style=\"display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;\">
                <div class=\"text-center py-5 text-muted\" style=\"grid-column: 1 / -1;\">
                    <i class=\"bi bi-camera fs-1 d-block mb-3\"></i>
                    <p>Loading...</p>
                </div>
            </div>
        </div>
    `;

    // Load user profile
    await loadUserProfile(userId);

    // Event listeners
    document.getElementById('followBtn').addEventListener('click', handleFollowToggle);
    document.getElementById('messageBtn').addEventListener('click', () => router.navigate('/chat'));

    async function loadUserProfile(userId) {
        try {
            // Clean up previous listeners
            if (targetUserUnsubscribe) targetUserUnsubscribe();
            if (currentUserUnsubscribe) currentUserUnsubscribe();
            
            const userDoc = await getDoc(doc(db, 'users', userId));
            
            if (!userDoc.exists()) {
                container.innerHTML = `
                    <div class=\"container text-center py-5\">
                        <i class=\"bi bi-person-x fs-1 d-block mb-3 text-muted\"></i>
                        <h5>User not found</h5>
                        <button class=\"btn btn-primary mt-3\" onclick=\"window.history.back()\">Go Back</button>
                    </div>
                `;
                return;
            }
            
            const userData = userDoc.data();
            
            // Display profile info
            document.getElementById('profileName').textContent = userData.displayName || 'User';
            document.getElementById('profileEmail').textContent = userData.email;
            document.getElementById('profileBio').textContent = userData.bio || 'No bio yet';
            
            if (userData.photoURL) {
                document.getElementById('profileAvatar').innerHTML = 
                    `<img src=\"${userData.photoURL}\" alt=\"Profile\" style=\"width: 100%; height: 100%; object-fit: cover;\">`;
            }
            
            if (userData.isPrivate) {
                document.getElementById('accountTypeBadge').style.display = 'inline-block';
            }
            
            await updateFollowButton(userData);
            await loadStats(userId);
            
            // Check if can view posts
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            const isFollowing = currentUserData.following?.includes(userId);
            
            if (!userData.isPrivate || isFollowing) {
                await loadPosts(userId);
            } else {
                document.getElementById('postsGrid').innerHTML = `
                    <div class=\"text-center py-5 text-muted\" style=\"grid-column: 1 / -1;\">
                        <i class=\"bi bi-lock fs-1 d-block mb-3\"></i>
                        <p>This account is private</p>
                        <small>Follow to see their posts</small>
                    </div>
                `;
            }
            
            // Setup real-time listeners
            targetUserUnsubscribe = onSnapshot(doc(db, 'users', userId), async (docSnap) => {
                if (docSnap.exists()) {
                    const updatedUserData = docSnap.data();
                    await updateFollowButton(updatedUserData);
                    
                    if (updatedUserData.isPrivate) {
                        document.getElementById('accountTypeBadge').style.display = 'inline-block';
                    } else {
                        document.getElementById('accountTypeBadge').style.display = 'none';
                    }
                    
                    await loadStats(userId);
                }
            });
            
            currentUserUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), async (docSnap) => {
                if (docSnap.exists()) {
                    const currentUserData = docSnap.data();
                    const targetUserDoc = await getDoc(doc(db, 'users', userId));
                    if (targetUserDoc.exists()) {
                        const targetUserData = targetUserDoc.data();
                        await updateFollowButton(targetUserData);
                        
                        const isFollowing = currentUserData.following?.includes(userId);
                        if (!targetUserData.isPrivate || isFollowing) {
                            await loadPosts(userId);
                        } else {
                            document.getElementById('postsGrid').innerHTML = `
                                <div class=\"text-center py-5 text-muted\" style=\"grid-column: 1 / -1;\">
                                    <i class=\"bi bi-lock fs-1 d-block mb-3\"></i>
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
        }
    }

    async function updateFollowButton(userData) {
        const followBtn = document.getElementById('followBtn');
        if (!followBtn) return;
        
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const currentUserData = currentUserDoc.data();
        const isFollowing = currentUserData.following?.includes(userId);
        const hasPendingRequest = userData.followRequests?.includes(currentUser.uid);
        
        if (isFollowing) {
            followBtn.innerHTML = '<i class=\"bi bi-person-check me-2\"></i>Following';
            followBtn.classList.remove('btn-primary', 'btn-outline-secondary');
            followBtn.classList.add('btn-outline-primary');
            followBtn.dataset.status = 'following';
        } else if (hasPendingRequest) {
            followBtn.innerHTML = '<i class=\"bi bi-clock me-2\"></i>Requested';
            followBtn.classList.remove('btn-primary', 'btn-outline-primary');
            followBtn.classList.add('btn-outline-secondary');
            followBtn.dataset.status = 'requested';
        } else if (userData.isPrivate) {
            followBtn.innerHTML = '<i class=\"bi bi-lock me-2\"></i>Request to Follow';
            followBtn.classList.remove('btn-outline-primary', 'btn-outline-secondary');
            followBtn.classList.add('btn-primary');
            followBtn.dataset.status = 'request';
        } else {
            followBtn.innerHTML = '<i class=\"bi bi-person-plus me-2\"></i>Follow';
            followBtn.classList.remove('btn-outline-primary', 'btn-outline-secondary');
            followBtn.classList.add('btn-primary');
            followBtn.dataset.status = 'follow';
        }
    }

    async function loadStats(userId) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.data();
            
            const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId));
            const postsSnapshot = await getDocs(postsQuery);
            
            document.getElementById('postsCount').textContent = postsSnapshot.size;
            document.getElementById('followersCount').textContent = userData.followers?.length || 0;
            document.getElementById('followingCount').textContent = userData.following?.length || 0;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async function loadPosts(userId) {
        const postsGrid = document.getElementById('postsGrid');
        
        try {
            const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId));
            const snapshot = await getDocs(postsQuery);
            
            if (snapshot.empty) {
                postsGrid.innerHTML = `
                    <div class=\"text-center py-5 text-muted\" style=\"grid-column: 1 / -1;\">
                        <i class=\"bi bi-camera fs-1 d-block mb-3\"></i>
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
            
            posts.forEach(post => {
                const postThumb = document.createElement('div');
                postThumb.style.cssText = 'position: relative; padding-bottom: 100%; overflow: hidden; cursor: pointer; background: #f0f0f0;';
                
                postThumb.innerHTML = `
                    <img src=\"${post.imageUrl || 'https://via.placeholder.com/300'}\" 
                         alt=\"Post\" 
                         style=\"position: absolute; width: 100%; height: 100%; object-fit: cover;\">
                    <div style=\"position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; color: white; gap: 20px;\" class=\"post-overlay\">
                        <span><i class=\"bi bi-heart-fill\"></i> ${post.likes || 0}</span>
                        <span><i class=\"bi bi-chat-fill\"></i> ${post.commentsCount || 0}</span>
                    </div>
                `;
                
                postThumb.addEventListener('mouseenter', () => {
                    postThumb.querySelector('.post-overlay').style.display = 'flex';
                });
                postThumb.addEventListener('mouseleave', () => {
                    postThumb.querySelector('.post-overlay').style.display = 'none';
                });
                postThumb.addEventListener('click', () => router.navigate('/feed'));
                
                postsGrid.appendChild(postThumb);
            });
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    }

    async function handleFollowToggle() {
        const followBtn = document.getElementById('followBtn');
        const status = followBtn.dataset.status;
        followBtn.disabled = true;
        
        try {
            const targetUserDoc = await getDoc(doc(db, 'users', userId));
            const targetUserData = targetUserDoc.data();
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            
            if (status === 'following') {
                // Unfollow
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    following: arrayRemove(userId)
                });
                await updateDoc(doc(db, 'users', userId), {
                    followers: arrayRemove(currentUser.uid)
                });
            } else if (status === 'requested') {
                // Cancel request
                await updateDoc(doc(db, 'users', userId), {
                    followRequests: arrayRemove(currentUser.uid)
                });
            } else {
                // Follow or request
                if (targetUserData.isPrivate) {
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
                }
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
        } finally {
            followBtn.disabled = false;
        }
    }

    return () => {
        if (targetUserUnsubscribe) targetUserUnsubscribe();
        if (currentUserUnsubscribe) currentUserUnsubscribe();
    };
}
