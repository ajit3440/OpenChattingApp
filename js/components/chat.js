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
let groupsListener = null;
let selectedUserId = null;
let selectedChat = null; // { type: 'dm'|'group', chatId, otherUser?, group? }
let availableUsersById = new Map();
let dmMetaByUserId = new Map(); // otherUserId -> { unread, lastMessage, lastMs }
let pendingGifUrl = null;
let gifSearchTimeout = null;
let gifPanelOpen = false;

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
                        <div class="d-flex align-items-center justify-content-between mb-3">
                            <h5 class="mb-0">Messages</h5>
                            <button class="btn btn-sm btn-outline-primary" id="newGroupBtn" type="button">
                                <i class="bi bi-people"></i>
                            </button>
                        </div>
                        <input type="text" class="form-control" id="searchUsers" placeholder="Search users...">
                    </div>

                    <div class="px-3 pt-3">
                        <div class="d-flex align-items-center justify-content-between">
                            <small class="text-muted text-uppercase">Groups</small>
                        </div>
                    </div>
                    <div id="groupList" class="border-bottom">
                        <div class="text-center py-3 text-muted">
                            <div class="spinner-border spinner-border-sm" role="status"></div>
                        </div>
                    </div>

                    <div class="px-3 pt-3">
                        <small class="text-muted text-uppercase">Direct Messages</small>
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
                                <button class="btn btn-sm btn-outline-primary ms-2" id="newGroupBtnHeader" type="button" aria-label="New group">
                                    <i class="bi bi-people"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Messages Area -->
                        <div class="flex-grow-1 p-3" id="messagesArea" style="overflow-y: auto; background: var(--bg-light); min-height: 0;">
                            <!-- Messages will be loaded here -->
                        </div>

                        <!-- Message Input -->
                        <div class="border-top p-3" style="flex-shrink: 0;">
                            <form id="messageForm" class="d-flex gap-2">
                                <button type="button" class="btn btn-outline-secondary" id="newGroupBtnComposer" aria-label="New group">
                                    <i class="bi bi-people"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary" id="emojiBtn" aria-label="Emoji">
                                    <i class="bi bi-emoji-smile"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary" id="gifBtn" aria-label="GIF">
                                    GIF
                                </button>
                                <div class="message-input-wrap flex-grow-1" style="min-width: 0;" id="messageInputWrap">
                                    <div class="gif-preview-inbox" id="gifPreviewInBox" style="display: none;">
                                        <img id="gifInputThumb" alt="Selected GIF" />
                                        <button type="button" class="btn btn-sm btn-light p-0 gif-remove" id="removeGifBtn" aria-label="Remove GIF">
                                            <i class="bi bi-x-lg"></i>
                                        </button>
                                    </div>
                                    <input type="text" class="message-text-input" id="messageInput" placeholder="Type a message..." autocomplete="off">
                                </div>
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-send-fill"></i>
                                </button>
                            </form>
                            <div id="emojiPicker" class="emoji-picker border rounded p-2 mt-2 bg-body" style="display: none;"></div>
                            <div id="gifPanel" class="gif-panel border rounded mt-2 bg-body" style="display: none;">
                                <div class="p-2 border-bottom">
                                    <input type="text" class="form-control form-control-sm" id="gifSearchInput" placeholder="Search GIFs...">
                                </div>
                                <div id="gifResults" class="gif-grid p-2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Group Modal -->
        <div class="modal fade" id="groupModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h6 class="modal-title">New Group</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Group name</label>
                            <input type="text" class="form-control" id="groupNameInput" placeholder="Friends" maxlength="40">
                        </div>
                        <div class="mb-2 text-muted small">Select members</div>
                        <div id="groupMemberList" class="list-group"></div>
                        <div class="alert alert-danger d-none mt-3" id="groupError"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="createGroupBtn">Create</button>
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
                background-color: var(--bs-tertiary-bg, #f8f9fa);
            }
            .user-list-item.active {
                background-color: rgba(var(--bs-primary-rgb), 0.12);
                border-left: 3px solid var(--bs-primary);
            }
            .message {
                margin-bottom: 1rem;
                display: flex;
            }

            #messageForm {
                align-items: flex-end;
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
                background-color: var(--bs-primary);
                color: white;
                border-bottom-right-radius: 0.25rem;
            }
            .message.received .message-bubble {
                background-color: var(--bs-body-bg);
                border: 1px solid var(--bs-border-color);
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
                background-color: var(--bs-success);
                border-radius: 50%;
                display: inline-block;
                margin-left: 5px;
            }

            .unread-dot {
                width: 10px;
                height: 10px;
                border-radius: 999px;
                background-color: var(--bs-danger);
                box-shadow: 0 0 0 2px var(--bs-body-bg);
                display: inline-block;
            }

            .emoji-picker {
                max-height: 180px;
                overflow: auto;
            }
            .emoji-picker button {
                width: 36px;
                height: 36px;
                line-height: 1;
            }
            .group-list-item {
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .group-list-item:hover {
                background-color: var(--bs-tertiary-bg, #f8f9fa);
            }
            .group-list-item.active {
                background-color: rgba(var(--bs-primary-rgb), 0.12);
                border-left: 3px solid var(--bs-primary);
            }
            .gif-img {
                max-width: 240px;
                width: 100%;
                border-radius: 0.75rem;
                display: block;
            }

            .gif-panel {
                max-height: 320px;
                overflow: hidden;
            }
            .gif-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 6px;
                max-height: 260px;
                overflow: auto;
                align-items: start;
            }
            .gif-tile {
                border-radius: 0.5rem;
                overflow: hidden;
                cursor: pointer;
                background: var(--bs-tertiary-bg, #f8f9fa);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .gif-tile img {
                width: 100%;
                height: auto;
                display: block;
                object-fit: contain;
            }

            .message-input-wrap {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 8px;
                padding: 10px;
                border: 1px solid var(--bs-border-color);
                border-radius: var(--bs-border-radius);
                background: var(--bs-body-bg);
                min-height: 44px;
                max-width: 100%;
            }
            .message-input-wrap:focus-within {
                border-color: var(--bs-primary);
                box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.15);
            }
            .message-text-input {
                border: none;
                outline: none;
                background: transparent;
                width: 100%;
                min-width: 0;
                padding: 0;
            }

            .gif-preview-inbox {
                position: relative;
                width: 100%;
                max-width: 100%;
            }
            .gif-preview-inbox img {
                display: block;
                width: 100%;
                max-width: 260px;
                max-height: 170px;
                border-radius: 0.75rem;
                border: 1px solid var(--bs-border-color);
                background: var(--bs-tertiary-bg, #f8f9fa);
                object-fit: cover;
            }
            .gif-preview-inbox .gif-remove {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 30px;
                height: 30px;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.06);
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
    await loadGroups();

    // Event listeners
    document.getElementById('searchUsers').addEventListener('input', handleSearch);
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    document.getElementById('backToList')?.addEventListener('click', showUserList);
    document.getElementById('newGroupBtn')?.addEventListener('click', openGroupModal);
    document.getElementById('newGroupBtnHeader')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openGroupModal();
    });
    document.getElementById('newGroupBtnComposer')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openGroupModal();
    });
    document.getElementById('emojiBtn')?.addEventListener('click', toggleEmojiPicker);
    document.getElementById('gifBtn')?.addEventListener('click', toggleGifPanel);
    document.getElementById('removeGifBtn')?.addEventListener('click', clearPendingGif);
    document.getElementById('createGroupBtn')?.addEventListener('click', createGroupFromModal);
    document.getElementById('gifSearchInput')?.addEventListener('input', onGifSearchInput);

    // Close pickers/panels when clicking outside
    document.addEventListener('click', (e) => {
        const emojiPicker = document.getElementById('emojiPicker');
        const gifPanel = document.getElementById('gifPanel');
        const emojiBtn = document.getElementById('emojiBtn');
        const gifBtn = document.getElementById('gifBtn');

        if (emojiPicker?.style?.display === 'block' && !emojiPicker.contains(e.target) && !emojiBtn?.contains(e.target)) {
            emojiPicker.style.display = 'none';
        }
        if (gifPanelOpen && gifPanel && !gifPanel.contains(e.target) && !gifBtn?.contains(e.target)) {
            gifPanelOpen = false;
            gifPanel.style.display = 'none';
        }
    });

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

            availableUsersById = new Map();
            
            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            const following = currentUserData?.following || [];
            
            snapshot.forEach((doc) => {
                const user = doc.data();
                if (user?.uid) availableUsersById.set(user.uid, user);
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

    async function loadGroups() {
        if (groupsListener) groupsListener();

        const groupList = document.getElementById('groupList');
        if (!groupList) return;

        const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));

        groupsListener = onSnapshot(chatsQuery, (snapshot) => {
            const groups = [];
            dmMetaByUserId.clear();

            snapshot.forEach((d) => {
                const data = d.data() || {};
                const type = data.type || 'dm';

                if (type === 'group') {
                    const unread = isChatUnread(data, currentUser.uid);
                    groups.push({ id: d.id, ...data, __unread: unread });
                    return;
                }

                // DM: update the matching user row (if present) with unread + lastMessage preview.
                const participants = Array.isArray(data.participants) ? data.participants : [];
                const otherId = participants.find((uid) => uid && uid !== currentUser.uid);
                if (!otherId) return;

                const userRow = document.querySelector(`.user-list-item[data-user-id="${otherId}"]`);
                const unread = isChatUnread(data, currentUser.uid);

                let last = (data.lastMessage || '').trim();
                if (last.toLowerCase() === 'gif') last = '';
                const lastMs = data.lastMessageTime?.toMillis?.() || 0;
                const existing = dmMetaByUserId.get(otherId);
                if (!existing || lastMs > (existing.lastMs || 0)) {
                    dmMetaByUserId.set(otherId, { unread, lastMessage: last, lastMs });
                }

                if (!userRow) return;
                const dot = userRow.querySelector('.unread-dot');
                if (dot) dot.classList.toggle('d-none', !unread);

                const subtitleEl = userRow.querySelector('.dm-subtitle');
                if (subtitleEl) subtitleEl.textContent = last ? last : (subtitleEl.dataset.fallback || subtitleEl.textContent);
            });

            groups.sort((a, b) => {
                const ta = a.lastMessageTime?.toMillis?.() || 0;
                const tb = b.lastMessageTime?.toMillis?.() || 0;
                return tb - ta;
            });

            if (groups.length === 0) {
                groupList.innerHTML = `
                    <div class="text-center py-3 text-muted">
                        <small>No groups yet</small>
                    </div>
                `;
                return;
            }

            groupList.innerHTML = '';
            groups.forEach(renderGroupItem);
        });
    }

    function renderGroupItem(group) {
        const groupList = document.getElementById('groupList');
        if (!groupList) return;

        const el = document.createElement('div');
        el.className = 'group-list-item p-3 border-bottom';
        el.dataset.chatId = group.id;

        const name = group.name || 'Group';
        const membersCount = Array.isArray(group.participants) ? group.participants.length : 0;
        const last = (group.lastMessage || '').trim();
        const subtitle = last && last.toLowerCase() !== 'gif' ? last : `${membersCount} members`;
        const unread = !!group.__unread;

        el.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="rounded-circle bg-body-tertiary border d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                    <i class="bi bi-people"></i>
                </div>
                <div class="flex-grow-1">
                    <h6 class="mb-0">${escapeHtml(name)}</h6>
                    <small class="text-muted">${escapeHtml(subtitle)}</small>
                </div>
                <div class="ms-2 flex-shrink-0">
                    <span class="unread-dot ${unread ? '' : 'd-none'}"></span>
                </div>
            </div>
        `;

        el.onclick = () => selectGroup(group);
        groupList.appendChild(el);
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
        
        const fallbackSubtitle = user.online ? 'Online' : 'Offline';

        userItem.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="position-relative me-3">
                    ${photoHTML}
                    ${user.online ? '<span class="position-absolute bottom-0 end-0 status-indicator"></span>' : ''}
                </div>
                <div class="flex-grow-1" style="min-width: 0;">
                    <h6 class="mb-0 text-truncate">${escapeHtml(userName)}</h6>
                    <small class="text-muted text-truncate dm-subtitle" data-fallback="${escapeHtml(fallbackSubtitle)}">${escapeHtml(fallbackSubtitle)}</small>
                </div>
                <div class="ms-2 flex-shrink-0">
                    <span class="unread-dot d-none"></span>
                </div>
            </div>
        `;

        const meta = dmMetaByUserId.get(user.uid);
        if (meta) {
            const dot = userItem.querySelector('.unread-dot');
            if (dot) dot.classList.toggle('d-none', !meta.unread);

            const subtitleEl = userItem.querySelector('.dm-subtitle');
            if (subtitleEl && meta.lastMessage) subtitleEl.textContent = meta.lastMessage;
        }
        
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
        selectedChat = {
            type: 'dm',
            chatId: [currentUser.uid, user.uid].sort().join('_'),
            otherUser: user
        };
        
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
        
        // Update chat header (DM)
        const userName = user.displayName || 'User';
        const userInitials = userName.charAt(0).toUpperCase();
        
        const chatUserName = document.getElementById('chatUserName');
        const chatUserStatus = document.getElementById('chatUserStatus');
        
        if (chatUserName) chatUserName.textContent = userName;
        if (chatUserStatus) chatUserStatus.textContent = user.online ? 'Online' : 'Offline';
        
        const chatAvatar = document.getElementById('chatUserAvatar');
        // Remove any previously injected initials avatar
        if (chatAvatar?.previousElementSibling?.classList?.contains('chat-header-initials')) {
            chatAvatar.previousElementSibling.remove();
        }
        if (chatAvatar) {
            if (user.photoURL) {
                chatAvatar.src = user.photoURL;
                chatAvatar.style.display = 'block';
                chatAvatar.onerror = function() {
                    this.style.display = 'none';
                    const initialsDiv = document.createElement('div');
                    initialsDiv.className = 'rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3 chat-header-initials';
                    initialsDiv.style.cssText = 'width: 40px; height: 40px; font-weight: bold; min-width: 40px;';
                    initialsDiv.textContent = userInitials;
                    this.parentNode.insertBefore(initialsDiv, this);
                };
            } else {
                chatAvatar.style.display = 'none';
                const initialsDiv = document.createElement('div');
                initialsDiv.className = 'rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3 chat-header-initials';
                initialsDiv.style.cssText = 'width: 40px; height: 40px; font-weight: bold; min-width: 40px;';
                initialsDiv.textContent = userInitials;
                if (chatAvatar.parentNode) {
                    chatAvatar.parentNode.insertBefore(initialsDiv, chatAvatar);
                }
            }
        }
        
        // Mark read (optimistic UI)
        const selectedRow = document.querySelector(`.user-list-item[data-user-id="${user.uid}"] .unread-dot`);
        if (selectedRow) selectedRow.classList.add('d-none');

        await markChatRead(selectedChat.chatId);

        // Load messages
        await loadMessages(selectedChat.chatId);
        
        // Show chat on mobile
        const chatLayout = document.getElementById('chatLayout');
        if (chatLayout) chatLayout.classList.add('show-chat');
    }

    async function selectGroup(group) {
        selectedUserId = null;
        selectedChat = {
            type: 'group',
            chatId: group.id,
            group
        };

        document.querySelectorAll('.user-list-item, .group-list-item').forEach(item => item.classList.remove('active'));
        const selectedItem = document.querySelector(`[data-chat-id="${group.id}"]`);
        if (selectedItem) selectedItem.classList.add('active');

        const welcomeScreen = document.getElementById('welcomeScreen');
        const chatContainer = document.getElementById('chatContainer');
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (chatContainer) chatContainer.style.display = 'flex';

        const chatUserName = document.getElementById('chatUserName');
        const chatUserStatus = document.getElementById('chatUserStatus');
        if (chatUserName) chatUserName.textContent = group.name || 'Group';
        if (chatUserStatus) {
            const membersCount = Array.isArray(group.participants) ? group.participants.length : 0;
            chatUserStatus.textContent = `${membersCount} members`;
        }

        const chatAvatar = document.getElementById('chatUserAvatar');
        if (chatAvatar) chatAvatar.style.display = 'none';
        // Remove any inserted initials avatar from previous DM selections
        const possibleInitial = chatAvatar?.previousElementSibling;
        if (possibleInitial && possibleInitial.classList?.contains('bg-primary')) {
            possibleInitial.remove();
        }

        // Mark read (optimistic UI)
        const selectedDot = document.querySelector(`.group-list-item[data-chat-id="${group.id}"] .unread-dot`);
        if (selectedDot) selectedDot.classList.add('d-none');

        await markChatRead(selectedChat.chatId);

        await loadMessages(selectedChat.chatId);

        const chatLayout = document.getElementById('chatLayout');
        if (chatLayout) chatLayout.classList.add('show-chat');
    }

    async function loadMessages(chatId) {
        // Unsubscribe from previous listener
        if (messagesListener) {
            messagesListener();
        }
        
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

            // If the latest message is from someone else, mark chat read while viewing.
            try {
                const last = snapshot.docs[snapshot.docs.length - 1]?.data?.();
                if (last && last.senderId && last.senderId !== currentUser.uid) {
                    markChatRead(chatId);
                }
            } catch {
                // ignore
            }
            
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
        
        const showSender = selectedChat?.type === 'group' && !isOwnMessage;
        const senderLabel = message.senderName ? escapeHtml(message.senderName) : 'User';

        const safeGif = sanitizeHttpUrl(message.gifUrl);
        const textHtml = message.text ? `<div>${escapeHtml(message.text)}</div>` : '';
        const gifHtml = safeGif ? `<img class="gif-img mt-2" src="${escapeHtml(safeGif)}" alt="GIF" loading="lazy" referrerpolicy="no-referrer">` : '';

        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${showSender ? `<div class="small text-muted mb-1">${senderLabel}</div>` : ''}
                ${textHtml}
                ${gifHtml}
                <small class="message-time">${timestamp}</small>
            </div>
        `;
        
        messagesArea.appendChild(messageDiv);
    }

    async function sendMessage(e) {
        e.preventDefault();
        
        const messageInput = document.getElementById('messageInput');
        const messageText = messageInput.value.trim();

        if (!selectedChat) return;

        const hasContent = !!messageText || !!pendingGifUrl;
        if (!hasContent) return;

        const chatId = selectedChat.chatId;
        
        try {
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const currentUserData = currentUserDoc.exists() ? currentUserDoc.data() : {};

            const messageData = {
                text: messageText,
                gifUrl: pendingGifUrl || '',
                senderId: currentUser.uid,
                senderName: currentUserData.displayName || currentUser.displayName || 'User',
                senderPhotoURL: currentUserData.photoURL || '',
                receiverId: selectedChat.type === 'dm' ? selectedUserId : '',
                timestamp: serverTimestamp(),
                read: false
            };
            
            await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
            
            // Update chat metadata
            if (selectedChat.type === 'dm') {
                await setDoc(doc(db, 'chats', chatId), {
                    type: 'dm',
                    participants: [currentUser.uid, selectedUserId],
                    lastMessage: messageText || '',
                    lastMessageTime: serverTimestamp(),
                    lastMessageBy: currentUser.uid
                }, { merge: true });
            } else {
                await setDoc(doc(db, 'chats', chatId), {
                    type: 'group',
                    lastMessage: messageText || '',
                    lastMessageTime: serverTimestamp(),
                    lastMessageBy: currentUser.uid
                }, { merge: true });
            }

            await markChatRead(chatId);
            
            messageInput.value = '';
            clearPendingGif();
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        }
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const userItems = document.querySelectorAll('.user-list-item');
        const groupItems = document.querySelectorAll('.group-list-item');
        
        userItems.forEach(item => {
            const userName = item.querySelector('h6').textContent.toLowerCase();
            item.style.display = userName.includes(searchTerm) ? 'block' : 'none';
        });

        groupItems.forEach(item => {
            const groupName = item.querySelector('h6')?.textContent?.toLowerCase?.() || '';
            item.style.display = groupName.includes(searchTerm) ? 'block' : 'none';
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

    function toggleEmojiPicker() {
        const picker = document.getElementById('emojiPicker');
        if (!picker) return;

        if (!picker.dataset.initialized) {
            const emojis = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','😅','😢','😭','😡','👍','👎','🙏','👏','🔥','💯','🎉','❤️','🤍','💔','✨','😴','🤝','🙌','👋'];
            picker.innerHTML = emojis.map(e => `<button type="button" class="btn btn-light btn-sm me-1 mb-1" data-emoji="${e}">${e}</button>`).join('');
            picker.addEventListener('click', (ev) => {
                const btn = ev.target.closest('button[data-emoji]');
                if (!btn) return;
                const emoji = btn.getAttribute('data-emoji');
                const input = document.getElementById('messageInput');
                if (!input) return;
                input.value = `${input.value}${emoji}`;
                input.focus();
            });
            picker.dataset.initialized = '1';
        }

        picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    }

    function toggleGifPanel() {
        const panel = document.getElementById('gifPanel');
        const emojiPicker = document.getElementById('emojiPicker');
        if (!panel) return;

        // Close emoji picker when opening GIFs
        if (emojiPicker) emojiPicker.style.display = 'none';

        gifPanelOpen = !gifPanelOpen;
        panel.style.display = gifPanelOpen ? 'block' : 'none';

        if (gifPanelOpen) {
            const input = document.getElementById('gifSearchInput');
            if (input) {
                input.value = '';
                input.focus();
            }
            loadTrendingGifs();
        }
    }

    function onGifSearchInput(e) {
        clearTimeout(gifSearchTimeout);
        const term = e.target.value.trim();
        gifSearchTimeout = setTimeout(() => {
            if (term) searchGifs(term);
            else loadTrendingGifs();
        }, 400);
    }

    async function loadTrendingGifs() {
        await searchGifs('trending');
    }

    async function searchGifs(searchTerm) {
        const apiKey = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';
        const limit = 24;

        const endpoint = searchTerm === 'trending'
            ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=g`
            : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchTerm)}&limit=${limit}&rating=g`;

        const results = document.getElementById('gifResults');
        if (!results) return;
        results.innerHTML = `
            <div class="text-center text-muted py-3" style="grid-column: 1 / -1;">
                <div class="spinner-border spinner-border-sm" role="status"></div>
                <div class="small mt-2">Loading GIFs...</div>
            </div>
        `;

        try {
            const resp = await fetch(endpoint);
            const data = await resp.json();
            const gifs = Array.isArray(data?.data) ? data.data : [];
            renderGifResults(gifs);
        } catch (err) {
            console.error('Error fetching GIFs:', err);
            results.innerHTML = `
                <div class="text-center text-muted py-3" style="grid-column: 1 / -1;">
                    <div class="fw-semibold">Failed to load GIFs</div>
                    <div class="small">Check your internet connection</div>
                </div>
            `;
        }
    }

    function renderGifResults(gifs) {
        const results = document.getElementById('gifResults');
        if (!results) return;

        if (!gifs.length) {
            results.innerHTML = `
                <div class="text-center text-muted py-3" style="grid-column: 1 / -1;">
                    <div class="fw-semibold">No GIFs found</div>
                    <div class="small">Try another search</div>
                </div>
            `;
            return;
        }

        results.innerHTML = '';
        gifs.forEach((gif) => {
            const thumb = sanitizeHttpUrl(gif?.images?.fixed_height_small?.url);
            const full = sanitizeHttpUrl(gif?.images?.fixed_height?.url) || sanitizeHttpUrl(gif?.images?.original?.url);
            if (!thumb || !full) return;

            const tile = document.createElement('div');
            tile.className = 'gif-tile';
            tile.innerHTML = `<img src="${escapeHtml(thumb)}" alt="GIF" loading="lazy" referrerpolicy="no-referrer">`;
            tile.onclick = () => {
                pendingGifUrl = full;
                updateGifPreview();
                const panel = document.getElementById('gifPanel');
                if (panel) panel.style.display = 'none';
                gifPanelOpen = false;
            };
            results.appendChild(tile);
        });
    }

    function updateGifPreview() {
        const preview = document.getElementById('gifPreviewInBox');
        const thumb = document.getElementById('gifInputThumb');
        const safe = sanitizeHttpUrl(pendingGifUrl);

        if (preview) preview.style.display = safe ? 'block' : 'none';
        if (thumb) {
            if (safe) {
                thumb.src = safe;
                thumb.referrerPolicy = 'no-referrer';
                thumb.loading = 'lazy';
            } else {
                thumb.removeAttribute('src');
            }
        }
    }

    function clearPendingGif() {
        pendingGifUrl = null;
        updateGifPreview();
    }

    function openGroupModal() {
        const list = document.getElementById('groupMemberList');
        const error = document.getElementById('groupError');
        const nameInput = document.getElementById('groupNameInput');
        if (error) {
            error.classList.add('d-none');
            error.textContent = '';
        }
        if (nameInput) nameInput.value = '';

        if (list) {
            const users = Array.from(availableUsersById.values());
            if (users.length === 0) {
                list.innerHTML = `<div class="text-muted small">No users available.</div>`;
            } else {
                list.innerHTML = users.map(u => {
                    const name = u.displayName || 'User';
                    return `
                        <label class="list-group-item d-flex align-items-center gap-2">
                            <input class="form-check-input m-0" type="checkbox" value="${u.uid}">
                            <span class="flex-grow-1">${escapeHtml(name)}</span>
                        </label>
                    `;
                }).join('');
            }
        }

        const modalEl = document.getElementById('groupModal');
        if (!modalEl) return;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    async function createGroupFromModal() {
        const nameInput = document.getElementById('groupNameInput');
        const list = document.getElementById('groupMemberList');
        const error = document.getElementById('groupError');

        const name = nameInput?.value?.trim?.() || '';
        const selected = Array.from(list?.querySelectorAll?.('input[type="checkbox"]:checked') || []).map(i => i.value);

        if (!name) {
            if (error) {
                error.textContent = 'Group name is required.';
                error.classList.remove('d-none');
            }
            return;
        }
        if (selected.length < 2) {
            if (error) {
                error.textContent = 'Select at least 2 members.';
                error.classList.remove('d-none');
            }
            return;
        }

        try {
            const participants = Array.from(new Set([currentUser.uid, ...selected]));
            const newChatRef = await addDoc(collection(db, 'chats'), {
                type: 'group',
                name,
                participants,
                createdAt: serverTimestamp(),
                createdBy: currentUser.uid,
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                lastMessageBy: currentUser.uid
            });

            const modalEl = document.getElementById('groupModal');
            if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();

            // Auto-open the new group
            selectGroup({ id: newChatRef.id, name, participants });
        } catch (err) {
            console.error('Error creating group:', err);
            if (error) {
                error.textContent = 'Failed to create group.';
                error.classList.remove('d-none');
            }
        }
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

    function isChatUnread(chatData, currentUid) {
        if (!chatData?.lastMessageTime) return false;
        if (chatData?.lastMessageBy === currentUid) return false;

        const lastMs = chatData.lastMessageTime?.toMillis?.();
        if (!lastMs) return false;

        const readAt = chatData.readAt?.[currentUid];
        const readMs = readAt?.toMillis?.() || 0;
        return lastMs > readMs;
    }

    async function markChatRead(chatId) {
        if (!chatId) return;
        try {
            await updateDoc(doc(db, 'chats', chatId), {
                [`readAt.${currentUser.uid}`]: serverTimestamp()
            });
        } catch (err) {
            // It's ok if the doc doesn't exist yet; it'll get created on first send.
            console.debug('markChatRead skipped:', err?.message || err);
        }
    }

    function sanitizeHttpUrl(url) {
        if (!url) return null;
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
            return parsed.toString();
        } catch {
            return null;
        }
    }

    // Cleanup function
    return () => {
        if (usersListener) usersListener();
        if (messagesListener) messagesListener();
        if (groupsListener) groupsListener();
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        updateUserStatus(false);
    };
}
