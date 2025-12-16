// Chat Module
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    serverTimestamp,
    arrayUnion 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let selectedUserId = null;
let selectedGroupId = null;
let isGroupChat = false;
let messagesListener = null;
let createGroupModal = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await initializeChat();
    } else {
        window.location.href = 'index.html';
    }
});

// Initialize chat
async function initializeChat() {
    // Set current user info
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    // If user document doesn't exist, create it
    if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            email: currentUser.email,
            photoURL: currentUser.photoURL || '',
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            online: true
        });
    }
    
    const userData = userDoc.exists() ? userDoc.data() : {
        displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User'
    };
    
    document.getElementById('currentUserName').textContent = userData.displayName || 'User';
    
    // Set welcome screen user info (for mobile)
    document.getElementById('welcomeUserName').textContent = userData.displayName || 'User';
    if (userData.photoURL) {
        document.getElementById('welcomeUserAvatar').innerHTML = 
            `<img src="${userData.photoURL}" alt="Avatar">`;
    }
    
    // Set user online status
    await updateUserStatus(true);
    
    // Initialize Bootstrap modal
    createGroupModal = new bootstrap.Modal(document.getElementById('createGroupModal'));
    
    // Load users and groups
    loadUsers();
    loadGroups();
    
    // Setup event listeners
    setupEventListeners();
    
    // Handle page unload - set user offline
    window.addEventListener('beforeunload', () => {
        updateUserStatus(false);
    });
}

// Update user online status
async function updateUserStatus(online) {
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            online: online,
            lastSeen: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Load all users except current user
function loadUsers() {
    const usersQuery = query(
        collection(db, 'users'),
        where('uid', '!=', currentUser.uid)
    );
    
    onSnapshot(usersQuery, (snapshot) => {
            const userListElement = document.getElementById('userList');
            userListElement.innerHTML = '';
            
            if (snapshot.empty) {
                userListElement.innerHTML = `
                    <div class="text-center p-4 text-muted">
                        <i class="bi bi-person-x fs-1 d-block mb-2"></i>
                        <p>No users found</p>
                    </div>
                `;
                return;
            }
            
            snapshot.forEach((doc) => {
                const user = doc.data();
                renderUserItem(user);
            });
        });
}

// Render user item in list
function renderUserItem(user) {
    const userListElement = document.getElementById('userList');
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset.userId = user.uid;
    
    const statusClass = user.online ? 'online' : '';
    const statusText = user.online ? 'Online' : 'Offline';
    
    userItem.innerHTML = `
        <div class="d-flex align-items-center p-3">
            <div class="position-relative me-3">
                <div class="user-avatar">
                    ${user.photoURL ? `<img src="${user.photoURL}" alt="${user.displayName}">` : '<i class="bi bi-person-circle"></i>'}
                </div>
                ${user.online ? '<span class="status-indicator"></span>' : ''}
            </div>
            <div class="flex-grow-1">
                <h6 class="mb-0">${user.displayName}</h6>
                <small class="text-muted ${statusClass}">${statusText}</small>
            </div>
        </div>
    `;
    
    userItem.addEventListener('click', () => selectUser(user));
    userListElement.appendChild(userItem);
}

// Select user to chat with
function selectUser(user) {
    selectedUserId = user.uid;
    selectedGroupId = null;
    isGroupChat = false;
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-user-id="${user.uid}"]`)?.classList.add('active');
    
    // Show chat container
    document.getElementById('welcomeScreen').classList.add('d-none');
    document.getElementById('chatContainer').classList.remove('d-none');
    
    // Update chat header
    document.getElementById('chatUserName').textContent = user.displayName;
    document.getElementById('chatUserStatus').textContent = user.online ? 'Online' : 'Offline';
    
    const avatarHtml = user.photoURL ? 
        `<img src="${user.photoURL}" alt="${user.displayName}">` : 
        '<i class="bi bi-person-circle"></i>';
    document.getElementById('chatUserAvatar').innerHTML = avatarHtml;
    
    // Load messages
    loadMessages(user.uid);
    
    // Show chat on mobile
    showChatOnMobile();
}

// Load messages between current user and selected user
function loadMessages(otherUserId) {
    // Unsubscribe from previous listener
    if (messagesListener) {
        messagesListener();
    }
    
    // Create chat ID (alphabetically sorted to ensure consistency)
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    // Listen for messages
    const messagesQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc')
    );
    
    messagesListener = onSnapshot(messagesQuery, (snapshot) => {
            const messagesArea = document.getElementById('messagesArea');
            messagesArea.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                renderMessage(message);
            });
            
            // Scroll to bottom
            scrollToBottom();
        });
}

// Render a single message
function renderMessage(message) {
    const messagesArea = document.getElementById('messagesArea');
    const messageDiv = document.createElement('div');
    
    const isOwnMessage = message.senderId === currentUser.uid;
    messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
    
    const timestamp = message.timestamp ? 
        formatTimestamp(message.timestamp.toDate()) : 
        'Just now';
    
    // For group messages, show sender name
    const senderName = isGroupChat && !isOwnMessage && message.senderName ? 
        `<small class="text-muted d-block mb-1"><strong>${message.senderName}</strong></small>` : '';
    
    // Render different message types
    let messageContent = '';
    if (message.type === 'gif') {
        messageContent = `<div class="message-media"><img src="${message.gifUrl}" alt="GIF"></div>`;
    } else {
        messageContent = `<p class="mb-1">${escapeHtml(message.text)}</p>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            ${senderName}
            ${messageContent}
            <small class="message-time">${timestamp}</small>
        </div>
    `;
    
    messagesArea.appendChild(messageDiv);
}

// Send message
document.getElementById('messageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    if (isGroupChat && selectedGroupId) {
        // Send group message
        await sendGroupMessage(messageText);
    } else if (selectedUserId) {
        // Send direct message
        await sendDirectMessage(messageText);
    }
    
    messageInput.value = '';
});

// Send direct message
async function sendDirectMessage(messageText, type = 'text', gifUrl = '') {
    const chatId = [currentUser.uid, selectedUserId].sort().join('_');
    
    try {
        const messageData = {
            text: messageText,
            senderId: currentUser.uid,
            receiverId: selectedUserId,
            timestamp: serverTimestamp(),
            read: false,
            type: type
        };
        
        if (type === 'gif') {
            messageData.gifUrl = gifUrl;
        }
        
        await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
        
        await setDoc(doc(db, 'chats', chatId), {
            participants: [currentUser.uid, selectedUserId],
            lastMessage: messageText,
            lastMessageTime: serverTimestamp(),
            lastMessageBy: currentUser.uid
        }, { merge: true });
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Send group message
async function sendGroupMessage(messageText, type = 'text', gifUrl = '') {
    try {
        const messageData = {
            text: messageText,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'User',
            timestamp: serverTimestamp(),
            type: type
        };
        
        if (type === 'gif') {
            messageData.gifUrl = gifUrl;
        }
        
        await addDoc(collection(db, 'groups', selectedGroupId, 'messages'), messageData);
        
        await updateDoc(doc(db, 'groups', selectedGroupId), {
            lastMessage: type === 'gif' ? 'GIF' : messageText,
            lastMessageTime: serverTimestamp(),
            lastMessageBy: currentUser.uid
        });
    } catch (error) {
        console.error('Error sending group message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Search users
document.getElementById('searchUsers')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const userName = item.querySelector('h6').textContent.toLowerCase();
        if (userName.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await updateUserStatus(false);
            await signOut(auth);
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }
});

// Helper functions
function scrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

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

// ========== GROUP CHAT FUNCTIONS ==========

// Load all groups where current user is a member
function loadGroups() {
    const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', currentUser.uid)
    );
    
    onSnapshot(groupsQuery, (snapshot) => {
        const groupListElement = document.getElementById('groupList');
        groupListElement.innerHTML = '';
        
        if (snapshot.empty) {
            groupListElement.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="bi bi-people fs-1 d-block mb-2"></i>
                    <p>No groups yet. Create one!</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach((doc) => {
            const group = { id: doc.id, ...doc.data() };
            renderGroupItem(group);
        });
    });
}

// Render group item in list
function renderGroupItem(group) {
    const groupListElement = document.getElementById('groupList');
    const groupItem = document.createElement('div');
    groupItem.className = 'user-item';
    groupItem.dataset.groupId = group.id;
    
    groupItem.innerHTML = `
        <div class="d-flex align-items-center p-3">
            <div class="me-3">
                <div class="user-avatar bg-primary text-white">
                    <i class="bi bi-people-fill"></i>
                </div>
            </div>
            <div class="flex-grow-1">
                <h6 class="mb-0">
                    ${group.name}
                    <span class="group-badge">${group.members.length}</span>
                </h6>
                <small class="text-muted">${group.lastMessage || 'No messages yet'}</small>
            </div>
        </div>
    `;
    
    groupItem.addEventListener('click', () => selectGroup(group));
    groupListElement.appendChild(groupItem);
}

// Select group to chat with
function selectGroup(group) {
    selectedGroupId = group.id;
    selectedUserId = null;
    isGroupChat = true;
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-group-id="${group.id}"]`)?.classList.add('active');
    
    // Show chat container
    document.getElementById('welcomeScreen').classList.add('d-none');
    document.getElementById('chatContainer').classList.remove('d-none');
    
    // Update chat header
    document.getElementById('chatUserName').textContent = group.name;
    document.getElementById('chatUserStatus').textContent = `${group.members.length} members`;
    document.getElementById('chatUserAvatar').innerHTML = '<i class="bi bi-people-fill"></i>';
    
    // Load group messages
    loadGroupMessages(group.id);
    
    // Show chat on mobile
    showChatOnMobile();
}

// Load group messages
function loadGroupMessages(groupId) {
    if (messagesListener) {
        messagesListener();
    }
    
    const messagesQuery = query(
        collection(db, 'groups', groupId, 'messages'),
        orderBy('timestamp', 'asc')
    );
    
    messagesListener = onSnapshot(messagesQuery, (snapshot) => {
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const message = doc.data();
            renderMessage(message);
        });
        
        scrollToBottom();
    });
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.chat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show/hide lists
            if (tabType === 'direct') {
                document.getElementById('userList').classList.remove('d-none');
                document.getElementById('groupList').classList.add('d-none');
            } else {
                document.getElementById('userList').classList.add('d-none');
                document.getElementById('groupList').classList.remove('d-none');
            }
        });
    });
    
    // Create group button
    document.getElementById('createGroupBtn')?.addEventListener('click', openCreateGroupModal);
    
    // Submit group form
    document.getElementById('submitGroupBtn')?.addEventListener('click', createGroup);
}

// Open create group modal
async function openCreateGroupModal() {
    // Clear previous data
    document.getElementById('groupName').value = '';
    document.getElementById('groupError').classList.add('d-none');
    
    // Load all users for member selection
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = '<p class="text-muted">Loading users...</p>';
    
    try {
        const usersQuery = query(
            collection(db, 'users'),
            where('uid', '!=', currentUser.uid)
        );
        
        const snapshot = await getDocs(usersQuery);
        membersList.innerHTML = '';
        
        if (snapshot.empty) {
            membersList.innerHTML = '<p class="text-muted">No other users found</p>';
        } else {
            snapshot.forEach((doc) => {
                const user = doc.data();
                const memberItem = document.createElement('div');
                memberItem.className = 'member-checkbox form-check';
                memberItem.innerHTML = `
                    <input class="form-check-input" type="checkbox" value="${user.uid}" id="member_${user.uid}">
                    <label class="form-check-label w-100" for="member_${user.uid}">
                        ${user.displayName}
                    </label>
                `;
                membersList.appendChild(memberItem);
            });
        }
        
        createGroupModal.show();
    } catch (error) {
        console.error('Error loading users:', error);
        alert('Failed to load users. Please try again.');
    }
}

// Create new group
async function createGroup() {
    const groupName = document.getElementById('groupName').value.trim();
    const selectedMembers = Array.from(document.querySelectorAll('#membersList input:checked'))
        .map(input => input.value);
    
    // Validation
    if (!groupName) {
        showGroupError('Please enter a group name');
        return;
    }
    
    if (selectedMembers.length === 0) {
        showGroupError('Please select at least one member');
        return;
    }
    
    // Add current user to members
    selectedMembers.push(currentUser.uid);
    
    try {
        // Create group document
        await addDoc(collection(db, 'groups'), {
            name: groupName,
            members: selectedMembers,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            lastMessage: '',
            lastMessageTime: serverTimestamp()
        });
        
        createGroupModal.hide();
        
        // Switch to groups tab
        document.getElementById('groupChatsTab').click();
    } catch (error) {
        console.error('Error creating group:', error);
        showGroupError('Failed to create group. Please try again.');
    }
}

function showGroupError(message) {
    const errorElement = document.getElementById('groupError');
    errorElement.textContent = message;
    errorElement.classList.remove('d-none');
}

// ========== MOBILE NAVIGATION ==========

// Mobile back button - show sidebar
document.getElementById('mobileBackBtn')?.addEventListener('click', () => {
    document.getElementById('chatContainer').classList.add('d-none');
    document.getElementById('welcomeScreen').classList.add('d-none');
    
    // Hide chat and show sidebar on mobile
    hideChatOnMobile();
    
    // Reset selections
    selectedUserId = null;
    selectedGroupId = null;
    isGroupChat = false;
    
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
});

// Mobile menu button - show options (future feature: group info, etc)
document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    // For now, show alert with options
    const options = ['View Profile', 'Mute Notifications', 'Block User'];
    // This can be enhanced with a modal or bottom sheet
    alert('Menu options coming soon!');
});

// Show chat on mobile
function showChatOnMobile() {
    if (window.innerWidth <= 768) {
        document.querySelector('.chat-sidebar')?.classList.add('chat-active');
        document.querySelector('.chat-main')?.classList.add('chat-active');
    }
}

// Hide chat and show sidebar on mobile
function hideChatOnMobile() {
    if (window.innerWidth <= 768) {
        document.querySelector('.chat-sidebar')?.classList.remove('chat-active');
        document.querySelector('.chat-main')?.classList.remove('chat-active');
    }
}

// ========== EMOJI AND GIF FUNCTIONALITY ==========

// Popular GIFs from CDN (Giphy media URLs)
const popularGifs = [
    { url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', title: 'Thumbs Up' },
    { url: 'https://media.giphy.com/media/3oz8xAFtqoOUUrsh7W/giphy.gif', title: 'Clapping' },
    { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', title: 'Happy Dance' },
    { url: 'https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif', title: 'Excited' },
    { url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', title: 'Dancing' },
    { url: 'https://media.giphy.com/media/26gsspfbt1HfVQ9va/giphy.gif', title: 'LOL' },
    { url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif', title: 'Heart' },
    { url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', title: 'High Five' },
    { url: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif', title: 'OK' },
    { url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', title: 'Shocked' },
    { url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', title: 'Thinking' },
    { url: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif', title: 'Cool' },
    { url: 'https://media.giphy.com/media/3o7btZ1Gm7ZL25pLMs/giphy.gif', title: 'Celebrate' },
    { url: 'https://media.giphy.com/media/KYElw07kzDspaBOwf9/giphy.gif', title: 'Fire' },
    { url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', title: 'Crying Laugh' },
    { url: 'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif', title: 'Yes!' },
    { url: 'https://media.giphy.com/media/26tknCqiJrBQG6bxC/giphy.gif', title: 'Wave' },
    { url: 'https://media.giphy.com/media/26gsjCZpPolPr3sBy/giphy.gif', title: 'Mind Blown' },
    { url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', title: 'Sleepy' },
    { url: 'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif', title: 'Love' }
];

// Common emojis
const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳', '😎',
    '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
    '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
    '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '👆', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
    '🔥', '⭐', '🌟', '✨', '💫', '💥', '💯', '✅', '❌', '⚠️'
];

let emojiPickerOpen = false;
let gifPickerOpen = false;
let gifSearchTimeout = null;

// Initialize emoji picker
function initializeEmojiPicker() {
    const emojiPickerBody = document.querySelector('.emoji-picker-body');
    emojiPickerBody.innerHTML = '';
    
    emojis.forEach(emoji => {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;
        emojiItem.addEventListener('click', () => {
            insertEmoji(emoji);
        });
        emojiPickerBody.appendChild(emojiItem);
    });
}

// Insert emoji at cursor position
function insertEmoji(emoji) {
    const messageInput = document.getElementById('messageInput');
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const text = messageInput.value;
    
    messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    messageInput.focus();
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
}

// Toggle emoji picker
document.getElementById('emojiBtn')?.addEventListener('click', () => {
    const emojiPicker = document.getElementById('emojiPicker');
    const gifPicker = document.getElementById('gifPicker');
    
    if (!emojiPickerOpen) {
        initializeEmojiPicker();
    }
    
    emojiPicker.classList.toggle('d-none');
    gifPicker.classList.add('d-none');
    emojiPickerOpen = !emojiPickerOpen;
    gifPickerOpen = false;
});

// Emoji search
document.getElementById('emojiSearch')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const emojiItems = document.querySelectorAll('.emoji-item');
    
    emojiItems.forEach(item => {
        // Simple filter - can be enhanced with emoji names
        item.style.display = searchTerm ? 'none' : 'block';
    });
});

// Toggle GIF picker
document.getElementById('gifBtn')?.addEventListener('click', () => {
    const gifPicker = document.getElementById('gifPicker');
    const emojiPicker = document.getElementById('emojiPicker');
    
    gifPicker.classList.toggle('d-none');
    emojiPicker.classList.add('d-none');
    gifPickerOpen = !gifPickerOpen;
    emojiPickerOpen = false;
    
    if (gifPickerOpen) {
        // Show popular GIFs by default
        loadPopularGifs();
    }
});

// Load popular GIFs from CDN
function loadPopularGifs() {
    const gifPickerBody = document.getElementById('gifPickerBody');
    gifPickerBody.innerHTML = '';
    
    popularGifs.forEach(gif => {
        const gifItem = document.createElement('div');
        gifItem.className = 'gif-item';
        gifItem.title = gif.title;
        
        const img = document.createElement('img');
        img.src = gif.url;
        img.alt = gif.title;
        img.loading = 'lazy';
        
        gifItem.appendChild(img);
        gifItem.addEventListener('click', () => {
            sendGif(gif.url);
        });
        
        gifPickerBody.appendChild(gifItem);
    });
}

// Search GIFs using Giphy API
async function searchGifs(searchTerm) {
    // Using Giphy's public beta key for demo - replace with your own key for production
    const apiKey = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh'; // Giphy public beta key
    const limit = 20;
    const endpoint = searchTerm === 'trending' 
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=g`
        : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchTerm)}&limit=${limit}&rating=g`;
    
    const gifPickerBody = document.getElementById('gifPickerBody');
    gifPickerBody.innerHTML = '<div class="text-center text-muted p-3"><div class="spinner-border spinner-border-sm"></div><p class="mt-2">Loading...</p></div>';
    
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            renderGifs(data.data);
        } else {
            gifPickerBody.innerHTML = `
                <div class="text-center text-muted p-3">
                    <p>No GIFs found</p>
                    <small>Try a different search term</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching GIFs:', error);
        gifPickerBody.innerHTML = `
            <div class="text-center text-muted p-3">
                <p>Failed to load GIFs</p>
                <small>Check your internet connection</small>
                <br>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="document.getElementById('popularGifTab').click()">Show Popular GIFs</button>
            </div>
        `;
    }
}

// Render GIFs in picker
function renderGifs(gifs) {
    const gifPickerBody = document.getElementById('gifPickerBody');
    gifPickerBody.innerHTML = '';
    
    if (gifs.length === 0) {
        gifPickerBody.innerHTML = '<div class="text-center text-muted p-3">No GIFs found</div>';
        return;
    }
    
    gifs.forEach(gif => {
        const gifItem = document.createElement('div');
        gifItem.className = 'gif-item';
        
        const img = document.createElement('img');
        img.src = gif.images.fixed_height_small.url;
        img.alt = gif.title;
        img.loading = 'lazy';
        
        gifItem.appendChild(img);
        gifItem.addEventListener('click', () => {
            sendGif(gif.images.fixed_height.url);
        });
        
        gifPickerBody.appendChild(gifItem);
    });
}

// Send GIF as message
async function sendGif(gifUrl) {
    if (isGroupChat && selectedGroupId) {
        await sendGroupMessage('', 'gif', gifUrl);
    } else if (selectedUserId) {
        await sendDirectMessage('', 'gif', gifUrl);
    }
    
    // Close GIF picker
    document.getElementById('gifPicker').classList.add('d-none');
    gifPickerOpen = false;
}

// GIF search with debounce
document.getElementById('gifSearch')?.addEventListener('input', (e) => {
    clearTimeout(gifSearchTimeout);
    const searchTerm = e.target.value.trim();
    
    gifSearchTimeout = setTimeout(() => {
        if (searchTerm) {
            searchGifs(searchTerm);
        } else {
            searchGifs('trending');
        }
    }, 500);
});

// Tab switching for GIF picker
document.getElementById('popularGifTab')?.addEventListener('click', () => {
    loadPopularGifs();
});

document.getElementById('searchGifTab')?.addEventListener('click', () => {
    const searchInput = document.getElementById('gifSearch');
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        searchGifs(searchTerm);
    } else {
        searchGifs('trending');
    }
});

// Close pickers when clicking outside
document.addEventListener('click', (e) => {
    const emojiPicker = document.getElementById('emojiPicker');
    const gifPicker = document.getElementById('gifPicker');
    const emojiBtn = document.getElementById('emojiBtn');
    const gifBtn = document.getElementById('gifBtn');
    
    if (emojiPickerOpen && !emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
        emojiPicker.classList.add('d-none');
        emojiPickerOpen = false;
    }
    
    if (gifPickerOpen && !gifPicker.contains(e.target) && !gifBtn.contains(e.target)) {
        gifPicker.classList.add('d-none');
        gifPickerOpen = false;
    }
});

// Send GIF from URL
document.getElementById('sendGifUrl')?.addEventListener('click', () => {
    const gifUrlInput = document.getElementById('gifUrl');
    const url = gifUrlInput.value.trim();
    
    if (!url) {
        alert('Please enter a GIF URL');
        return;
    }
    
    // Validate URL
    if (!isValidGifUrl(url)) {
        alert('Please enter a valid GIF URL (.gif, .webp, or giphy.com link)');
        return;
    }
    
    sendGif(url);
    gifUrlInput.value = '';
});

// Validate GIF URL
function isValidGifUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        
        // Check if it's a valid image URL
        return pathname.endsWith('.gif') || 
               pathname.endsWith('.webp') || 
               pathname.endsWith('.mp4') ||
               urlObj.hostname.includes('giphy.com') ||
               urlObj.hostname.includes('tenor.com') ||
               urlObj.hostname.includes('imgur.com');
    } catch {
        return false;
    }
}

// Allow Enter key to send GIF URL
document.getElementById('gifUrl')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('sendGifUrl').click();
    }
});


