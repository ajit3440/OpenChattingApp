// Chat Component
import { auth, db } from '../firebase-config.js';
import { router } from '../router.js';
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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let usersListener = null;
let messagesListener = null;
let selectedUserId = null;

export async function ChatComponent(container) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        router.navigate('/login');
        return;
    }

    container.innerHTML = `
        <div class="container-fluid p-0" style="height: calc(100vh - 126px); position: relative;">
            <div class="row g-0 h-100" id="chatLayout">
                <!-- User List Sidebar -->
                <div class="col-md-4 col-lg-3 border-end h-100" id="userListSidebar" style="overflow-y: auto;">
                    <div class="p-3 border-bottom">
                        <h5 class="mb-3">Messages</h5>
                        <input type="text" class="form-control" id="searchUsers" placeholder="Search users...">
                    </div>
                    <div id="userList">
                        <div class="text-center py-4 text-muted">
                            <div class="spinner-border spinner-border-sm" role="status"></div>
                            <p class="mt-2">Loading...</p>
                        </div>
                    </div>
                </div>

                <!-- Chat Area -->
                <div class="col-md-8 col-lg-9 h-100 position-relative" id="chatArea" style="background: white;">
                    <!-- Welcome Screen -->
                    <div class="position-absolute w-100 h-100 d-flex align-items-center justify-content-center" id="welcomeScreen" style="top: 0; left: 0; z-index: 1;">
                        <div class="text-center">
                            <i class="bi bi-chat-heart fs-1 text-primary mb-3 d-block"></i>
                            <h5>Welcome to Messages</h5>
                            <p class="text-muted">Select a conversation to start messaging</p>
                        </div>
                    </div>

                    <!-- Chat Container -->
                    <div class="flex-column w-100 h-100" id="chatContainer" style="position: absolute; top: 0; left: 0; z-index: 2; background: white; display: none;">
                        <!-- Chat Header -->
                        <div class="border-bottom p-3" style="flex-shrink: 0;">
                            <div class="d-flex align-items-center">
                                <button class="btn btn-link d-md-none p-0 me-2" id="backToList">
                                    <i class="bi bi-arrow-left fs-4"></i>
                                </button>
                                <img id="chatUserAvatar" src="" class="rounded-circle me-3" width="40" height="40" alt="User" style="display: none;">
                                <div class="flex-grow-1">
                                    <h6 class="mb-0" id="chatUserName">User</h6>
                                    <small class="text-muted" id="chatUserStatus">Offline</small>
                                </div>
                            </div>
                        </div>

                        <!-- Messages Area -->
                        <div class="flex-grow-1 p-3" id="messagesArea" style="overflow-y: auto; background: #f8f9fa; min-height: 0;">
                            <!-- Messages will be loaded here -->
                        </div>

                        <!-- Message Input -->
                        <div class="border-top p-3" style="flex-shrink: 0;">
                            <form id="messageForm" class="d-flex gap-2">
                                <input type="text" class="form-control" id="messageInput" placeholder="Type a message..." autocomplete="off">
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-send-fill"></i>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .user-list-item {
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .user-list-item:hover {
                background-color: #f8f9fa;
            }
            .user-list-item.active {
                background-color: #e7f3ff;
                border-left: 3px solid #0d6efd;
            }
            .message {
                margin-bottom: 1rem;
                display: flex;
            }
            .message.sent {
                justify-content: flex-end;
            }
            .message.received {
                justify-content: flex-start;
            }
            .message-bubble {
                max-width: 70%;
                padding: 0.75rem 1rem;
                border-radius: 1rem;
                word-wrap: break-word;
            }
            .message.sent .message-bubble {
                background-color: #0d6efd;
                color: white;
                border-bottom-right-radius: 0.25rem;
            }
            .message.received .message-bubble {
                background-color: white;
                border: 1px solid #dee2e6;
                border-bottom-left-radius: 0.25rem;
            }
            .message-time {
                font-size: 0.7rem;
                opacity: 0.7;
                display: block;
                margin-top: 0.25rem;
            }
            .status-indicator {
                width: 10px;
                height: 10px;
                background-color: #44b700;
                border-radius: 50%;
                display: inline-block;
                margin-left: 5px;
            }
            @media (max-width: 767px) {
                /* On mobile, show either the list OR the chat (not stacked). */
                #chatArea {
                    display: none !important;
                }
                #chatLayout.show-chat #userListSidebar {
                    display: none !important;
                }
                #chatLayout.show-chat #chatArea {
                    display: block !important;
                }
                #chatLayout.show-chat #chatContainer {
                    display: flex !important;
                }
            }
        </style>
    `;

    // Initialize
    await updateUserStatus(true);
    await loadUsers();

    // Event listeners
    document.getElementById('searchUsers').addEventListener('input', handleSearch);
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    document.getElementById('backToList')?.addEventListener('click', showUserList);

    // Update status on page unload
    const beforeUnloadHandler = () => updateUserStatus(false);
    window.addEventListener('beforeunload', beforeUnloadHandler);

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

    async function loadUsers() {
        const usersQuery = query(
            collection(db, 'users'),
            where('uid', '!=', currentUser.uid)
        );
        
        usersListener = onSnapshot(usersQuery, async (snapshot) => {
            const userListElement = document.getElementById('userList');
            
            if (snapshot.empty) {
                userListElement.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        <i class="bi bi-person-x fs-1 d-block mb-3"></i>
                        <p>No users found</p>
                        <small>Search for users to start chatting</small>
                    </div>
                `;
                return;
            }
            
            userListElement.innerHTML = '';
            
            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            const following = currentUserData?.following || [];
            
            snapshot.forEach((doc) => {
                const user = doc.data();
                // Show users we're following
                if (following.includes(user.uid)) {
                    renderUserItem(user);
                }
            });
            
            // If no following, show all users
            if (following.length === 0) {
                snapshot.forEach((doc) => {
                    renderUserItem(doc.data());
                });
            }
        });
    }

    function renderUserItem(user) {
        const userListElement = document.getElementById('userList');
        const userItem = document.createElement('div');
        userItem.className = 'user-list-item p-3 border-bottom';
        userItem.dataset.userId = user.uid;
        
        const userName = user.displayName || 'User';
        const userInitials = userName.charAt(0).toUpperCase();
        const photoHTML = user.photoURL ?
            `<img src="${user.photoURL}" 
                 class="rounded-circle" 
                 width="40" 
                 height="40" 
                 style="object-fit: cover;"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                 alt="${userName}">
            <div class="rounded-circle bg-primary text-white d-none align-items-center justify-content-center" 
                 style="width: 40px; height: 40px; font-weight: bold; min-width: 40px;">${userInitials}</div>` :
            `<div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" 
                 style="width: 40px; height: 40px; font-weight: bold; min-width: 40px;">${userInitials}</div>`;
        
        userItem.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="position-relative me-3">
                    ${photoHTML}
                    ${user.online ? '<span class="position-absolute bottom-0 end-0 status-indicator"></span>' : ''}
                </div>
                <div class="flex-grow-1">
                    <h6 class="mb-0">${userName}</h6>
                    <small class="text-muted">${user.online ? 'Online' : 'Offline'}</small>
                </div>
            </div>
        `;
        
        // Simple click handler
        userItem.onclick = function() {
            console.log('User clicked!', user.displayName);
            selectUser(user);
        };
        
        userListElement.appendChild(userItem);
    }

    async function selectUser(user) {
        console.log('Selecting user:', user.uid, user.displayName);
        selectedUserId = user.uid;
        
        // Update UI - remove active from all
        document.querySelectorAll('.user-list-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active to selected
        const selectedItem = document.querySelector(`[data-user-id="${user.uid}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }
        
        // Get elements
        const welcomeScreen = document.getElementById('welcomeScreen');
        const chatContainer = document.getElementById('chatContainer');
        
        console.log('Welcome screen:', welcomeScreen);
        console.log('Chat container:', chatContainer);
        
        // Hide welcome screen completely
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
        
        // Show chat container with flex display
        if (chatContainer) {
            chatContainer.style.display = 'flex';
        }
        
        console.log('Chat container display:', chatContainer?.style.display);
        
        // Update chat header
        const userName = user.displayName || 'User';
        const userInitials = userName.charAt(0).toUpperCase();
        
        const chatUserName = document.getElementById('chatUserName');
        const chatUserStatus = document.getElementById('chatUserStatus');
        
        if (chatUserName) chatUserName.textContent = userName;
        if (chatUserStatus) chatUserStatus.textContent = user.online ? 'Online' : 'Offline';
        
        const chatAvatar = document.getElementById('chatUserAvatar');
        if (chatAvatar) {
            if (user.photoURL) {
                chatAvatar.src = user.photoURL;
                chatAvatar.style.display = 'block';
                chatAvatar.onerror = function() {
                    this.style.display = 'none';
                    const initialsDiv = document.createElement('div');
                    initialsDiv.className = 'rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3';
                    initialsDiv.style.cssText = 'width: 40px; height: 40px; font-weight: bold; min-width: 40px;';
                    initialsDiv.textContent = userInitials;
                    this.parentNode.insertBefore(initialsDiv, this);
                };
            } else {
                chatAvatar.style.display = 'none';
                const initialsDiv = document.createElement('div');
                initialsDiv.className = 'rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3';
                initialsDiv.style.cssText = 'width: 40px; height: 40px; font-weight: bold; min-width: 40px;';
                initialsDiv.textContent = userInitials;
                if (chatAvatar.parentNode) {
                    chatAvatar.parentNode.insertBefore(initialsDiv, chatAvatar);
                }
            }
        }
        
        // Load messages
        await loadMessages(user.uid);
        
        // Show chat on mobile
        const chatLayout = document.getElementById('chatLayout');
        if (chatLayout) chatLayout.classList.add('show-chat');
    }

    async function loadMessages(otherUserId) {
        // Unsubscribe from previous listener
        if (messagesListener) {
            messagesListener();
        }
        
        // Create chat ID (alphabetically sorted)
        const chatId = [currentUser.uid, otherUserId].sort().join('_');
        
        // Listen for messages
        const messagesQuery = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('timestamp', 'asc')
        );
        
        messagesListener = onSnapshot(messagesQuery, (snapshot) => {
            const messagesArea = document.getElementById('messagesArea');
            messagesArea.innerHTML = '';
            
            if (snapshot.empty) {
                messagesArea.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-chat-dots fs-3 d-block mb-2"></i>
                        <p>No messages yet. Say hi! 👋</p>
                    </div>
                `;
                return;
            }
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                renderMessage(message);
            });
            
            // Scroll to bottom
            messagesArea.scrollTop = messagesArea.scrollHeight;
        });
    }

    function renderMessage(message) {
        const messagesArea = document.getElementById('messagesArea');
        const messageDiv = document.createElement('div');
        
        const isOwnMessage = message.senderId === currentUser.uid;
        messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
        
        const timestamp = message.timestamp ? 
            formatTimestamp(message.timestamp.toDate()) : 
            'Just now';
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div>${escapeHtml(message.text)}</div>
                <small class="message-time">${timestamp}</small>
            </div>
        `;
        
        messagesArea.appendChild(messageDiv);
    }

    async function sendMessage(e) {
        e.preventDefault();
        
        const messageInput = document.getElementById('messageInput');
        const messageText = messageInput.value.trim();
        
        if (!messageText || !selectedUserId) return;
        
        const chatId = [currentUser.uid, selectedUserId].sort().join('_');
        
        try {
            const messageData = {
                text: messageText,
                senderId: currentUser.uid,
                receiverId: selectedUserId,
                timestamp: serverTimestamp(),
                read: false
            };
            
            await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
            
            // Update chat metadata
            await setDoc(doc(db, 'chats', chatId), {
                participants: [currentUser.uid, selectedUserId],
                lastMessage: messageText,
                lastMessageTime: serverTimestamp(),
                lastMessageBy: currentUser.uid
            }, { merge: true });
            
            messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        }
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const userItems = document.querySelectorAll('.user-list-item');
        
        userItems.forEach(item => {
            const userName = item.querySelector('h6').textContent.toLowerCase();
            item.style.display = userName.includes(searchTerm) ? 'block' : 'none';
        });
    }

    function showUserList() {
        const chatLayout = document.getElementById('chatLayout');
        if (chatLayout) chatLayout.classList.remove('show-chat');

        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.style.display = 'flex';

        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) chatContainer.style.display = 'none';
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Cleanup function
    return () => {
        if (usersListener) usersListener();
        if (messagesListener) messagesListener();
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        updateUserStatus(false);
    };
}
