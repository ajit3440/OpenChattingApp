// Feed Module
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
    increment,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let commentsModal = null;
let currentPostId = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loadFeed();
    } else {
        window.location.href = 'index.html';
    }
});

// Load feed posts
function loadFeed() {
    const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
    );
    
    onSnapshot(postsQuery, (snapshot) => {
        const feedContainer = document.getElementById('feedContainer');
        
        if (snapshot.empty) {
            feedContainer.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-collection fs-1 d-block mb-3"></i>
                    <p>No posts yet. Be the first to post!</p>
                    <a href="profile.html" class="btn btn-primary mt-3">Create Post</a>
                </div>
            `;
            return;
        }
        
        feedContainer.innerHTML = '';
        snapshot.forEach((doc) => {
            const post = { id: doc.id, ...doc.data() };
            renderPost(post);
        });
    });
}

// Render a single post
function renderPost(post) {
    const feedContainer = document.getElementById('feedContainer');
    const postElement = document.createElement('div');
    postElement.className = 'post-card mb-4';
    postElement.id = `post-${post.id}`;
    
    const timestamp = post.createdAt ? 
        formatTimestamp(post.createdAt.toDate()) : 
        'Just now';
    
    const isLiked = post.likedBy?.includes(currentUser.uid) || false;
    const likeIcon = isLiked ? 'bi-heart-fill text-danger' : 'bi-heart';
    
    postElement.innerHTML = `
        <!-- Post Header -->
        <div class="post-header">
            <div class="d-flex align-items-center">
                <div class="user-avatar-small me-2">
                    <i class="bi bi-person-circle"></i>
                </div>
                <div>
                    <h6 class="mb-0">${post.userName || 'User'}</h6>
                    <small class="text-muted">${timestamp}</small>
                </div>
            </div>
        </div>
        
        <!-- Post Image -->
        ${post.imageUrl ? `
        <div class="post-image">
            <img src="${post.imageUrl}" alt="Post">
        </div>
        ` : ''}
        
        <!-- Post Actions -->
        <div class="post-actions">
            <button class="btn btn-link text-dark p-0 me-3 like-btn" data-post-id="${post.id}">
                <i class="bi ${likeIcon} fs-4"></i>
            </button>
            <button class="btn btn-link text-dark p-0 me-3 comment-btn" data-post-id="${post.id}">
                <i class="bi bi-chat fs-4"></i>
            </button>
            <button class="btn btn-link text-dark p-0 share-btn">
                <i class="bi bi-send fs-4"></i>
            </button>
        </div>
        
        <!-- Post Content -->
        <div class="post-content">
            <p class="mb-1"><strong>${post.likes || 0}</strong> likes</p>
            <p class="mb-1">
                <strong>${post.userName || 'User'}</strong> 
                ${escapeHtml(post.caption || '')}
            </p>
            ${post.commentsCount > 0 ? `
            <button class="btn btn-link text-muted p-0 view-comments-btn" data-post-id="${post.id}">
                View all ${post.commentsCount} comments
            </button>
            ` : ''}
        </div>
    `;
    
    feedContainer.appendChild(postElement);
    
    // Add event listeners
    postElement.querySelector('.like-btn')?.addEventListener('click', () => toggleLike(post.id));
    postElement.querySelector('.comment-btn')?.addEventListener('click', () => openComments(post.id));
    postElement.querySelector('.view-comments-btn')?.addEventListener('click', () => openComments(post.id));
    postElement.querySelector('.share-btn')?.addEventListener('click', () => sharePost(post));
}

// Toggle like on post
async function toggleLike(postId) {
    try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        
        if (!postSnap.exists()) return;
        
        const postData = postSnap.data();
        const likedBy = postData.likedBy || [];
        const isLiked = likedBy.includes(currentUser.uid);
        
        if (isLiked) {
            // Unlike
            await updateDoc(postRef, {
                likes: increment(-1),
                likedBy: likedBy.filter(uid => uid !== currentUser.uid)
            });
        } else {
            // Like
            await updateDoc(postRef, {
                likes: increment(1),
                likedBy: [...likedBy, currentUser.uid]
            });
        }
    } catch (error) {
        console.error('Error liking post:', error);
    }
}

// Open comments modal
function openComments(postId) {
    currentPostId = postId;
    if (!commentsModal) {
        commentsModal = new bootstrap.Modal(document.getElementById('commentsModal'));
    }
    loadComments(postId);
    commentsModal.show();
}

// Load comments for a post
function loadComments(postId) {
    const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'asc')
    );
    
    onSnapshot(commentsQuery, (snapshot) => {
        const commentsContainer = document.getElementById('commentsContainer');
        
        if (snapshot.empty) {
            commentsContainer.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <p>No comments yet. Be the first to comment!</p>
                </div>
            `;
            return;
        }
        
        commentsContainer.innerHTML = '';
        snapshot.forEach((doc) => {
            const comment = doc.data();
            renderComment(comment);
        });
    });
}

// Render a single comment
function renderComment(comment) {
    const commentsContainer = document.getElementById('commentsContainer');
    const commentElement = document.createElement('div');
    commentElement.className = 'comment-item mb-3';
    
    const timestamp = comment.createdAt ? 
        formatTimestamp(comment.createdAt.toDate()) : 
        'Just now';
    
    commentElement.innerHTML = `
        <div class="d-flex">
            <div class="user-avatar-small me-2">
                <i class="bi bi-person-circle"></i>
            </div>
            <div class="flex-grow-1">
                <p class="mb-0">
                    <strong>${comment.userName || 'User'}</strong> 
                    ${escapeHtml(comment.text)}
                </p>
                <small class="text-muted">${timestamp}</small>
            </div>
        </div>
    `;
    
    commentsContainer.appendChild(commentElement);
}

// Add comment
document.getElementById('addCommentBtn')?.addEventListener('click', async () => {
    const commentInput = document.getElementById('commentInput');
    const commentText = commentInput.value.trim();
    
    if (!commentText || !currentPostId) return;
    
    try {
        await addDoc(collection(db, 'posts', currentPostId, 'comments'), {
            text: commentText,
            userId: currentUser.uid,
            userName: currentUser.displayName || 'User',
            createdAt: serverTimestamp()
        });
        
        // Update comment count
        await updateDoc(doc(db, 'posts', currentPostId), {
            commentsCount: increment(1)
        });
        
        commentInput.value = '';
    } catch (error) {
        console.error('Error adding comment:', error);
    }
});

// Share post
function sharePost(post) {
    if (navigator.share) {
        navigator.share({
            title: 'Check out this post!',
            text: post.caption,
            url: window.location.href + '#post-' + post.id
        }).catch(() => {
            // Fallback: copy link
            copyToClipboard(window.location.href + '#post-' + post.id);
        });
    } else {
        copyToClipboard(window.location.href + '#post-' + post.id);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link copied to clipboard!');
    });
}

// Helper functions
function formatTimestamp(date) {
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
