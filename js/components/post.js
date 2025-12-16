// Post Page Component (Shows posts from the same author)
import { auth, db } from '../firebase-config.js';
import { router } from '../router.js';
import {
    collection,
    doc,
    getDoc,
    query,
    where,
    onSnapshot,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let unsubscribeAuthorPosts = null;

export async function PostComponent(container, params) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        router.navigate('/login');
        return;
    }

    const postId = params?.postId;

    container.innerHTML = `
        <div class="container py-3" style="max-width: 600px; padding-bottom: 100px;">
            <div class="d-flex align-items-center gap-2 mb-3">
                <button class="btn btn-link p-0" id="backBtn" aria-label="Back">
                    <i class="bi bi-arrow-left fs-4"></i>
                </button>
                <h5 class="mb-0">Posts</h5>
            </div>

            <div id="postPageTitle" class="text-muted mb-3" style="display:none;"></div>
            <div id="postsContainer"></div>
        </div>
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => window.history.back());

    if (!postId) {
        container.innerHTML = `
            <div class="container py-5 text-center">
                <h5>Post not found</h5>
            </div>
        `;
        return;
    }

    // Load the clicked post to find the author.
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
        container.innerHTML = `
            <div class="container py-5 text-center">
                <h5>Post not found</h5>
            </div>
        `;
        return;
    }

    const postData = postDoc.data();
    const authorId = postData.userId;
    const authorName = postData.userName || 'User';

    const titleEl = document.getElementById('postPageTitle');
    if (titleEl) {
        titleEl.textContent = `Showing posts by ${authorName}`;
        titleEl.style.display = 'block';
    }

    // Cleanup previous listener (if any)
    if (unsubscribeAuthorPosts) {
        unsubscribeAuthorPosts();
        unsubscribeAuthorPosts = null;
    }

    // Listen to only this author's posts (client-side sort to avoid composite index needs).
    const authorPostsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', authorId)
    );

    unsubscribeAuthorPosts = onSnapshot(authorPostsQuery, (snapshot) => {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;

        if (snapshot.empty) {
            postsContainer.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-camera fs-1 d-block mb-3"></i>
                    <p>No posts yet</p>
                </div>
            `;
            return;
        }

        const posts = [];
        snapshot.forEach((docSnap) => posts.push({ id: docSnap.id, ...docSnap.data() }));
        posts.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });

        postsContainer.innerHTML = '';
        posts.forEach((post) => renderPostCard(postsContainer, post, currentUser));
    });

    // Cleanup
    return () => {
        if (unsubscribeAuthorPosts) {
            unsubscribeAuthorPosts();
            unsubscribeAuthorPosts = null;
        }
    };
}

function renderPostCard(parent, post, currentUser) {
    const postElement = document.createElement('div');
    postElement.className = 'card mb-3';

    const timestamp = post.createdAt ? formatTimestamp(post.createdAt.toDate()) : 'Just now';
    const isLiked = post.likedBy?.includes(currentUser.uid) || false;
    const likeIcon = isLiked ? 'bi-heart-fill text-danger' : 'bi-heart';

    const userName = post.userName || 'User';
    const userInitials = userName.charAt(0).toUpperCase();

    const userPhotoHTML = post.userPhotoURL ?
        `<img src="${post.userPhotoURL}"
             class="rounded-circle me-2"
             width="32"
             height="32"
             style="cursor: pointer; object-fit: cover;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
             data-user-id="${post.userId}"
             alt="${userName}">
        <div class="rounded-circle me-2 bg-primary text-white d-none align-items-center justify-content-center"
             style="cursor: pointer; width: 32px; height: 32px; font-weight: bold; min-width: 32px;"
             data-user-id="${post.userId}">${userInitials}</div>` :
        `<div class="rounded-circle me-2 bg-primary text-white d-flex align-items-center justify-content-center"
             style="cursor: pointer; width: 32px; height: 32px; font-weight: bold; min-width: 32px;"
             data-user-id="${post.userId}">${userInitials}</div>`;

    postElement.innerHTML = `
        <div class="card-body">
            <div class="d-flex align-items-center mb-3">
                ${userPhotoHTML}
                <div>
                    <h6 class="mb-0" style="cursor: pointer;" data-user-id="${post.userId}">${userName}</h6>
                    <small class="text-muted">${timestamp}</small>
                </div>
            </div>

            ${post.imageUrl ? `
            <div class="mb-3">
                <img src="${post.imageUrl}" class="w-100 rounded" alt="Post">
            </div>
            ` : ''}

            <div class="mb-2">
                <button class="btn btn-link text-dark p-0 me-3 like-btn" data-post-id="${post.id}">
                    <i class="bi ${likeIcon} fs-4"></i>
                </button>
            </div>

            <p class="mb-1"><strong>${post.likes || 0}</strong> likes</p>
            <p class="mb-1">
                <strong>${userName}</strong>
                ${escapeHtml(post.caption || '')}
            </p>
        </div>
    `;

    parent.appendChild(postElement);

    postElement.querySelector('.like-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLike(post.id, currentUser.uid);
    });

    postElement.querySelectorAll('[data-user-id]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const userId = el.dataset.userId;
            if (userId === currentUser.uid) {
                router.navigate('/profile');
            } else {
                router.navigate(`/user-profile/${userId}`);
            }
        });
    });
}

async function toggleLike(postId, currentUserId) {
    try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;

        const postData = postSnap.data();
        const likedBy = postData.likedBy || [];
        const isLiked = likedBy.includes(currentUserId);

        if (isLiked) {
            await updateDoc(postRef, {
                likes: increment(-1),
                likedBy: likedBy.filter((uid) => uid !== currentUserId)
            });
        } else {
            await updateDoc(postRef, {
                likes: increment(1),
                likedBy: [...likedBy, currentUserId]
            });
        }
    } catch (error) {
        console.error('Error liking post:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimestamp(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}
