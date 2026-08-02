// ============================================
//  STATE
// ============================================
const STATE = {
    myId: localStorage.getItem('pm_user_id') || '',
    token: localStorage.getItem('pm_token') || '',
    myName: localStorage.getItem('pm_username') || '',
    myBio: localStorage.getItem('pm_bio') || '',
    myAge: localStorage.getItem('pm_age') || '',
    myEmail: localStorage.getItem('pm_email') || '',
    myColor: localStorage.getItem('pm_color') || '#c4956a',
    myAvatar: localStorage.getItem('pm_avatar') || null,
    theme: localStorage.getItem('pm_theme') || 'dark',
    fontSize: parseInt(localStorage.getItem('pm_font_size')) || 15,
    messages: [],
    contacts: [],
    onlineCount: 0,
    replyTarget: null,
    ctxTarget: null,
    lastSendTime: 0,
    isLoggedIn: false,
    privateChatWith: null,   // the currently open chat (uid / group id / 'global')
    chatType: null,          // 'global' | 'private' | 'group' | 'saved' | 'files'
    socket: null,
    _popupUserId: null,
    _popupUsername: null,
    savedMessages: [],
    groups: [],              // list of groups I'm a member of
    savedFiles: [],          // locally saved files
    pendingUploads: [],   // files currently uploading (for preview + spinner)
    hamyarTyping: false,
    globalAItyping: false,
    vidPending: false,
};

// ============================================
//  EMOJIS & STICKERS
// ============================================
const EMOJIS = ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚',
    '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜',
    '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩',
    '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐',
    '🤲', '🤝', '🙏', '✌️', '🤟', '🤘', '👌', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❤️‍🔥', '💕', '💞', '💓', '💗',
    '💖', '✨', '⭐', '🌟', '💫', '🔥', '💯', '🎉', '🎊', '🎁', '🎈', '🎀', '🎂', '🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍩', '🍪'
];

const STICKERS = ['😊', '😂', '🤣', '❤️', '🔥', '💯', '🎉', '✨', '⭐', '🌟',
    '👋', '🙏', '🤝', '✌️', '🤟', '👌', '👍', '👎', '👊', '✊',
    '🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
    '🍕', '🍔', '🌭', '🍿', '🎂', '🍩', '🍪', '☕', '🍵', '🍺'
];

const REACTIONS = ['❤️', '🔥', '👍', '😊', '😂', '🤣', '😍', '🥰', '💯', '🎉', '✨', '⭐', '😱', '🤯', '💔', '🙏'];

// Special contact IDs (must match server)
const HAMYAR_ID = '00000000-0000-0000-0000-0000000000a1';
const SAVED_ID = '00000000-0000-0000-0000-0000000000a2';
const VID_ID = '00000000-0000-0000-0000-0000000000a3';
const FILES_ID = '00000000-0000-0000-0000-0000000000a4';
const HAMYAR_ALIASES = ['همیار', 'کا.جی', 'کا جی', 'کجی', 'kg', 'k.g', 'hamyar'];
const GLOBAL_ID = 'global';

// ============================================
//  DOM
// ============================================
const $ = id => document.getElementById(id);
const chatEl = $('chat');
const messageEl = $('message');
const counterEl = $('counter-small');
const headerAv = $('header-avatar');
const hdrAvText = $('hdr-av-text');
const headerTitle = $('header-title');
const headerStatus = $('header-status');
const loginModal = $('login-modal');
const signupModal = $('signup-modal');
const ctxMenu = $('ctx-menu');
const ctxDelAllItem = $('ctx-delete-all-item');
const replyBar = $('reply-bar');
const replyBarName = $('reply-bar-name');
const replyBarText = $('reply-bar-text');
const settingsPanel = $('settings-panel');
const userPopup = $('user-popup');
const toastEl = $('toast');
const toastText = $('toast-text');
const fileInput = $('file-input');

// ============================================
//  UTILITY
// ============================================
function escapeHtml(t) {
    if (!t) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function avatarLetter(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
}

// Safe, minimal markdown renderer (applies to all messages)
function renderMarkdown(md) {
    if (!md) return '';
    let s = String(md);
    s = escapeHtml(s);
    // fenced code blocks
    s = s.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre style="background:#111;color:#e6e6e6;border-radius:10px;padding:12px;overflow-x:auto;direction:ltr;text-align:left;font-family:monospace;font-size:12.5px;margin:8px 0;"><code>${code.replace(/\n$/,'')}</code></pre>`;
    });
    // inline code
    s = s.replace(/`([^`\n]+)`/g, '<code style="background:var(--bg-tertiary);color:var(--accent-light);border-radius:5px;padding:1px 6px;font-family:monospace;font-size:.88em;direction:ltr;unicode-bidi:isolate;">$1</code>');
    // headings
    s = s.replace(/^######\s+(.*)$/gm, '<b>$1</b>');
    s = s.replace(/^#####\s+(.*)$/gm, '<b>$1</b>');
    s = s.replace(/^####\s+(.*)$/gm, '<b>$1</b>');
    s = s.replace(/^###\s+(.*)$/gm, '<b>$1</b>');
    s = s.replace(/^##\s+(.*)$/gm, '<b>$1</b>');
    s = s.replace(/^#\s+(.*)$/gm, '<b>$1</b>');
    // bold
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    // italic (avoid interfering with bold)
    s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    // bullet lists
    s = s.replace(/(^|\n)[-*]\s+(.*)/g, '$1• $2');
    // numbered lists basic
    s = s.replace(/(^|\n)\d+\.\s+(.*)/g, '$1$2');
    // line breaks
    s = s.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    return s;
}

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (today - msgD) / 86400000;
    if (diff === 0) return 'امروز';
    if (diff === 1) return 'دیروز';
    return d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', year: diff > 365 ? 'numeric' : undefined });
}

function truncate(t, n = 60) {
    return t && t.length > n ? t.slice(0, n) + '…' : t;
}

function randomColor() {
    const colors = ['#c4956a', '#8a6a4a', '#b88a60', '#7aa88a', '#a890b8', '#e8c9a8', '#6B8F71', '#9B8EA8', '#c47a7a', '#7a8ac4'];
    return colors[Math.floor(Math.random() * colors.length)];
}

let toastTimer;

function showToast(msg, icon = '✨', dur = 2800) {
    toastText.textContent = msg;
    toastEl.querySelector('.toast-icon').textContent = icon;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

function highlightText(text, query) {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark style="background:var(--accent);color:#fff;padding:0 4px;border-radius:4px;">$1</mark>');
}

// ============================================
//  SERVER URL (PWA)
// ============================================
function getServerUrl() {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isPWA) {
        return 'http://YOUR_SERVER_IP:3000'; // ← آدرس سرور واقعی رو بذار
    }
    return window.location.origin;
}

// ============================================
//  AUTH (ایمیل + رمز عبور)
// ============================================
window.showSignup = function() {
    loginModal.classList.add('hidden');
    signupModal.classList.remove('hidden');
};

window.goBackToLogin = function() {
    signupModal.classList.add('hidden');
    loginModal.classList.remove('hidden');
};

function saveSession(data) {
    STATE.token = data.token;
    STATE.myId = data.uid;
    STATE.myEmail = data.email || '';
    localStorage.setItem('pm_token', data.token);
    localStorage.setItem('pm_user_id', data.uid);
    localStorage.setItem('pm_email', STATE.myEmail);
}

function applyProfile(profile) {
    STATE.myName = profile.username || 'کاربر';
    STATE.myBio = profile.bio || '';
    STATE.myAge = profile.age || '';
    STATE.myColor = profile.avatar_color || '#c4956a';
    STATE.myAvatar = profile.avatar_url || null;
    localStorage.setItem('pm_username', STATE.myName);
    localStorage.setItem('pm_bio', STATE.myBio);
    localStorage.setItem('pm_age', STATE.myAge);
    localStorage.setItem('pm_color', STATE.myColor);
    if (STATE.myAvatar) localStorage.setItem('pm_avatar', STATE.myAvatar);
    else localStorage.removeItem('pm_avatar');
}

window.doLogin = async function() {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    if (!email || !password) { showToast('ایمیل و رمز را وارد کنید', '⚠️'); return; }
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'خطا در ورود', '❌'); return; }
        saveSession(data);
        applyProfile(data.profile || {});
        showToast(`خوش آمدید ${STATE.myName}`, '👋');
        initApp();
    } catch (e) { showToast('خطا در اتصال به سرور', '❌'); }
};

window.doSignup = async function() {
    const email = $('signup-email').value.trim();
    const password = $('signup-password').value;
    const name = $('signup-name').value.trim();
    const bio = $('signup-bio').value.trim();
    const age = $('signup-age').value.trim();
    if (!email || !password) { showToast('ایمیل و رمز لازم است', '⚠️'); return; }
    if (password.length < 6) { showToast('رمز عبور حداقل ۶ کاراکتر باشد', '⚠️'); return; }
    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username: name, bio, age })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'خطا در ساخت حساب', '❌'); return; }
        saveSession(data);
        STATE.myName = name || 'کاربر';
        STATE.myBio = bio;
        STATE.myAge = age;
        localStorage.setItem('pm_username', STATE.myName);
        localStorage.setItem('pm_bio', STATE.myBio);
        localStorage.setItem('pm_age', STATE.myAge);
        showToast(`خوش آمدید ${STATE.myName}`, '👋');
        initApp();
    } catch (e) { showToast('خطا در اتصال به سرور', '❌'); }
};

window.logout = function() {
    localStorage.removeItem('pm_token');
    localStorage.removeItem('pm_user_id');
    STATE.token = '';
    STATE.myId = '';
    STATE.isLoggedIn = false;
    STATE.myName = '';
    STATE.privateChatWith = null;
    STATE.chatType = null;
    STATE.messages = [];
    STATE.contacts = [];
    STATE.groups = [];
    if (STATE.socket) STATE.socket.disconnect();
    document.querySelectorAll('.back-btn').forEach(b => b.remove());
    document.querySelectorAll('.clear-bot-btn').forEach(b => b.remove());
    $('chat-screen').classList.add('hidden');
    $('chat-list').classList.add('hidden');
    headerTitle.textContent = 'Persia Messenger';
    updateHeaderStatus();
    loginModal.classList.remove('hidden');
};

async function saveProfileToServer(patch) {
    try {
        await fetch('/api/profile', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: STATE.token, ...patch })
        });
    } catch (e) {}
}

// ============================================
//  SOCKET.IO
// ============================================
function connectSocket() {
    const serverUrl = getServerUrl();
    STATE.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 60000
    });

    STATE.socket.on('connect', () => {
        console.log('✅ متصل به سرور');
        if (STATE.isLoggedIn) {
            STATE.socket.emit('user_join', {
                token: STATE.token,
                username: STATE.myName,
                avatar_color: STATE.myColor,
                avatar_url: STATE.myAvatar,
                bio: STATE.myBio,
                age: STATE.myAge,
                email: STATE.myEmail
            });
            // request groups after a moment
            setTimeout(() => STATE.socket.emit('get_groups'), 500);
        }
    });

    STATE.socket.on('groups_update', (g) => {
        STATE.groups = g || [];
        if (!$('chat-list').classList.contains('hidden')) renderChatList();
        updateHeaderStatus();
    });

    STATE.socket.on('auth_error', (msg) => {
        showToast(msg || 'نشست نامعتبر', '❌');
        localStorage.removeItem('pm_token');
        localStorage.removeItem('pm_user_id');
        STATE.token = '';
        STATE.isLoggedIn = false;
    });

    STATE.socket.on('load_messages', (msgs) => { STATE.messages = msgs || [];
        renderMessages(); });
    STATE.socket.on('new_message', (msg) => {
        if (msg.sender_id === HAMYAR_ID) clearAItyping();
        STATE.messages.push(msg);
        renderMessages();
        scrollToBottom();
        // private notification card when in Global chat
        if (msg.is_private && msg.recipient_id === STATE.myId && STATE.chatType !== 'private') {
            showNotifCard(msg);
        }
    });
    STATE.socket.on('message_updated', (msg) => {
        const idx = STATE.messages.findIndex(m => m.id === msg.id);
        if (idx > -1) { STATE.messages[idx] = msg;
            renderMessages(); }
    });
    STATE.socket.on('online_count', (count) => { STATE.onlineCount = count;
        updateHeaderStatus(); });
    STATE.socket.on('user_joined', (user) => { showToast(`${user.username} وارد شد`, '👤', 1500); });
    STATE.socket.on('spam_warning', (msg) => { showToast(msg, '⚠️', 3000); });
    STATE.socket.on('messages_cleared', () => { showToast('🧹 تاریخچه شما پاک شد', '🧹');
        renderMessages(); });
    STATE.socket.on('delete_confirmed', (msgId) => { showToast('✅ پیام برای همه حذف شد', '✅'); });
    STATE.socket.on('clear_confirmed', () => { showToast('🧹 تاریخچه پاک شد', '🧹'); });
    STATE.socket.on('history_cleared', (contactId) => {
        STATE.messages = STATE.messages.filter(m =>
            !((m.sender_id === STATE.myId && m.recipient_id === contactId) ||
              (m.sender_id === contactId && m.recipient_id === STATE.myId))
        );
        renderMessages();
    });

    // contacts (persistent)
    STATE.socket.on('contacts_update', (list) => {
        STATE.contacts = list || [];
        if (!$('chat-list').classList.contains('hidden')) renderChatList();
    });
    STATE.socket.on('contact_added', (c) => {
        const i = STATE.contacts.findIndex(x => x.contact_id === c.contact_id);
        if (i > -1) STATE.contacts[i] = c;
        else STATE.contacts.unshift(c);
        STATE.contacts.sort((a, b) => new Date(b.last_time) - new Date(a.last_time));
        if (!$('chat-list').classList.contains('hidden')) renderChatList();
    });
}

// ============================================
//  NOTIFICATION CARDS
// ============================================
const notifSenders = {};

function showNotifCard(msg) {
    const container = $('notif-cards');
    document.querySelectorAll(`#notif-cards .notif-card[data-from="${msg.sender_id}"]`).forEach(el => el.remove());
    notifSenders[msg.sender_id] = msg.username || 'کاربر';
    const card = document.createElement('div');
    card.className = 'notif-card';
    card.dataset.from = msg.sender_id;
    card.innerHTML = `
        <div class="notif-av" style="background:${msg.avatar_color || '#c4956a'}">${msg.avatar_url ? `<img src="${msg.avatar_url}" alt="">` : escapeHtml(avatarLetter(msg.username))}</div>
        <div class="notif-body">
            <div class="notif-name">${escapeHtml(msg.username || 'کاربر')}</div>
            <div class="notif-text">${escapeHtml(msg.sticker || msg.message || '📎 فایل')}</div>
        </div>
        <div class="notif-actions">
            <button class="notif-open" onclick="openNotif('${msg.sender_id}')">باز کن</button>
            <button class="notif-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>`;
    container.appendChild(card);
}

window.openNotif = function(uid) {
    openPrivateChat(uid, notifSenders[uid] || 'کاربر');
    document.querySelectorAll('#notif-cards .notif-card').forEach(el => el.remove());
};

// ============================================
//  THEME & SETTINGS
// ============================================
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    STATE.theme = theme;
    localStorage.setItem('pm_theme', theme);
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === theme);
    });
}

function applyFontSize(size) {
    document.documentElement.style.setProperty('--font-size', size + 'px');
    STATE.fontSize = size;
    localStorage.setItem('pm_font_size', size);
    $('font-size-label').textContent = size;
}

applyTheme(STATE.theme);
applyFontSize(STATE.fontSize);

document.querySelectorAll('.theme-option').forEach(el => {
    el.addEventListener('click', function() { applyTheme(this.dataset.theme); });
});

$('font-size-range').addEventListener('input', function() { applyFontSize(parseInt(this.value)); });

window.openSettings = function() {
    if (!STATE.isLoggedIn) { showToast('لطفاً ابتدا وارد شوید', '⚠️'); return; }
    settingsPanel.classList.remove('hidden');
    $('font-size-range').value = STATE.fontSize;
    $('font-size-label').textContent = STATE.fontSize;
};

window.closeSettings = function() { settingsPanel.classList.add('hidden'); };
window.saveSettings = function() { showToast('تنظیمات ذخیره شد', '✅');
    closeSettings(); };
settingsPanel.addEventListener('click', function(e) { if (e.target === this) closeSettings(); });

// ============================================
//  HEADER
// ============================================
function updateHeader() {
    hdrAvText.textContent = avatarLetter(STATE.myName);
    if (STATE.myAvatar) {
        headerAv.style.backgroundImage = `url('${STATE.myAvatar}')`;
        headerAv.style.backgroundSize = 'cover';
        hdrAvText.style.display = 'none';
    } else {
        headerAv.style.background = STATE.myColor || '#c4956a';
        hdrAvText.style.display = 'flex';
    }
}

function setHeaderTitle(t) { headerTitle.textContent = t || 'Persia Messenger'; }

function updateHeaderStatus() {
    const ct = STATE.chatType;
    if (!ct) {
        // main list screen
        setHeaderTitle('Persia Messenger');
        headerStatus.innerHTML = `<span class="dot"></span><span>Global chat</span><span style="margin-right:8px;font-size:11px;color:var(--text-muted);" id="online-count"></span>`;
        const oc = $('online-count');
        if (oc) oc.textContent = STATE.onlineCount ? `(${STATE.onlineCount} آنلاین)` : '';
    } else if (ct === 'global') {
        setHeaderTitle('Global chat');
        headerStatus.innerHTML = `<span class="dot"></span><span>${STATE.onlineCount} آنلاین</span>`;
    } else if (ct === 'group') {
        const g = STATE.groups.find(x => x.id === STATE.privateChatWith);
        setHeaderTitle(g ? g.title : 'گروه');
        headerStatus.innerHTML = `<span class="dot"></span><span>${g ? g.memberCount + ' عضو' : 'گروه'}</span>`;
    } else {
        setHeaderTitle(chatNameFor(STATE.privateChatWith));
        headerStatus.innerHTML = `<span class="dot"></span><span>چت</span>`;
    }
}

function chatNameFor(id) {
    if (id === GLOBAL_ID) return 'Global chat';
    if (id === HAMYAR_ID) return 'همیار';
    if (id === VID_ID) return 'دانلودر ویدیو';
    if (id === SAVED_ID) return 'پیام‌های ذخیره‌شده';
    const c = STATE.contacts.find(x => x.contact_id === id);
    if (c) return c.username;
    const g = STATE.groups.find(x => x.id === id);
    if (g) return g.title;
    return 'کاربر';
}

// ============================================
//  RENDER MESSAGES
// ============================================
function renderMessages() {
    // Saved Messages view — show the permanently stored messages
    if (STATE.privateChatWith === SAVED_ID) {
        if (!STATE.savedMessages.length) {
            chatEl.innerHTML =
                `<div style="text-align:center;color:var(--text-muted);margin-top:80px;font-size:15px;"><div style="font-size:56px;margin-bottom:16px;">📌</div><div style="font-weight:600;font-size:18px;">پیام‌های ذخیره‌شده</div><div style="font-size:13px;margin-top:6px;">برای ذخیره، روی پیام راست‌کلیک کنید → Forward</div></div>`;
            return;
        }
        let html = '';
        const nearBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 140;
        STATE.savedMessages.forEach(sm => {
            const bubble = buildSavedBubble(sm);
            if (bubble) html += bubble;
        });
        chatEl.innerHTML = html;
        if (nearBottom) scrollToBottom();
        return;
    }

    let filtered = STATE.messages;
    const pid = STATE.privateChatWith;
    if (STATE.chatType === 'group') {
        filtered = STATE.messages.filter(m => m.is_group && m.recipient_id === pid);
        if (filtered.length === 0) {
            chatEl.innerHTML = emptyHtml('👥', 'هنوز پیامی در گروه نیست', 'اولین پیام را بفرستید!');
            return;
        }
    } else if (STATE.chatType === 'global') {
        filtered = STATE.messages.filter(m => !m.is_private && !m.is_group);
        if (filtered.length === 0) {
            if (STATE.globalAItyping) { chatEl.innerHTML = hamyarTypingHtml(); scrollToBottom(); return; }
            chatEl.innerHTML = emptyHtml('💬', 'هنوز پیامی نیست', 'اولین پیام را شما بفرستید!');
            return;
        }
    } else if (pid) {
        filtered = STATE.messages.filter(m =>
            (m.sender_id === pid && m.recipient_id === STATE.myId) ||
            (m.sender_id === STATE.myId && m.recipient_id === pid) ||
            (m.is_private && m.sender_id === pid) ||
            (m.is_private && m.recipient_id === pid)
        );
        if (filtered.length === 0) {
            if (pid === HAMYAR_ID && STATE.hamyarTyping) {
                chatEl.innerHTML = hamyarTypingHtml();
                scrollToBottom();
                return;
            }
            const icon = pid === VID_ID ? '🎬' : '🔒';
            chatEl.innerHTML = emptyHtml(icon, 'هنوز پیامی ارسال نشده', '');
            return;
        }
    } else {
        // Global chat shows NO private messages (even our own) — private only in private
        filtered = STATE.messages.filter(m => !m.is_private);
    }
    if (filtered.length === 0) {
        if (STATE.globalAItyping) { chatEl.innerHTML = hamyarTypingHtml(); scrollToBottom(); return; }
        chatEl.innerHTML =
            `<div style="text-align:center;color:var(--text-muted);margin-top:80px;font-size:15px;"><div style="font-size:56px;margin-bottom:16px;">💬</div><div style="font-weight:600;font-size:18px;">هنوز پیامی نیست</div><div style="font-size:13px;margin-top:6px;">اولین پیام را شما بفرستید!</div></div>`;
        return;
    }
    const nearBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 140;
    let html = '',
        lastDate = '';
    filtered.forEach(msg => {
        const day = formatDate(msg.created_at || msg.timestamp);
        if (day !== lastDate) { html += `<div class="date-sep">${day}</div>`;
            lastDate = day; }
        html += buildBubble(msg);
    });
    if (STATE.privateChatWith === HAMYAR_ID && STATE.hamyarTyping) html += hamyarTypingHtml();
    if (STATE.chatType === 'global' && STATE.globalAItyping) html += hamyarTypingHtml();
    chatEl.innerHTML = html;
    if (nearBottom || filtered.length === 0) scrollToBottom();
}

function setAItyping(where) {
    if (where === 'private') { STATE.hamyarTyping = true; STATE.globalAItyping = false; }
    else { STATE.globalAItyping = true; STATE.hamyarTyping = false; }
    renderMessages(); scrollToBottom();
}
function clearAItyping() {
    const changed = STATE.hamyarTyping || STATE.globalAItyping;
    STATE.hamyarTyping = false; STATE.globalAItyping = false;
    if (changed) renderMessages();
}

function emptyHtml(icon, title, sub) {
    return `<div style="text-align:center;color:var(--text-muted);margin-top:80px;font-size:15px;"><div style="font-size:56px;margin-bottom:16px;">${icon}</div><div style="font-weight:600;font-size:18px;">${title}</div><div style="font-size:13px;margin-top:6px;">${sub}</div></div>`;
}

// ---- Save to device (actual download) ----
function ctxSave() {
    const msg = STATE.ctxTarget;
    if (!msg) { return; }
    ctxMenu.classList.add('hidden');
    // media file -> download it to the device
    if (msg.media && msg.media.url) {
        downloadToDevice(msg.media.url, msg.media.name || 'file');
        return;
    }
    // sticker
    if (msg.sticker) {
        downloadTextToDevice(msg.sticker, 'sticker.txt');
        return;
    }
    // text -> download as .txt
    if (msg.message) {
        downloadTextToDevice(msg.message, 'message.txt');
    } else {
        showToast('چیزی برای ذخیره نیست', '⚠️');
    }
}

async function downloadToDevice(url, filename) {
    showToast('💾 در حال ذخیره...', '💾');
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fail');
        const blob = await res.blob();
        triggerDownload(blob, filename);
        showToast('💾 ذخیره شد', '✅');
    } catch (e) {
        // fallback: open the url so the user can save it
        window.open(url, '_blank');
        showToast('فایل باز شد — آن را ذخیره کنید', '💾');
    }
}

function downloadTextToDevice(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, filename);
    showToast('💾 ذخیره شد', '✅');
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Groups ----
function openGroupModal() {
    const box = $('group-members');
    let html = '';
    STATE.contacts.forEach(c => {
        if (c.contact_id === SAVED_ID || c.contact_id === HAMYAR_ID || c.contact_id === VID_ID || c.contact_id === FILES_ID || c.contact_id === STATE.myId) return;
        html += `
        <label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;cursor:pointer;background:var(--bg-input);margin-bottom:6px;">
            <input type="checkbox" class="grp-member" value="${c.contact_id}">
            <div style="width:36px;height:36px;border-radius:50%;background:${c.avatar_color||'#c4956a'};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0;">${avatarLetter(c.username)}</div>
            <span style="font-weight:600;font-size:14px;">${escapeHtml(c.username)}</span>
        </label>`;
    });
    if (!STATE.contacts.filter(c => ![SAVED_ID,HAMYAR_ID,VID_ID,FILES_ID,STATE.myId].includes(c.contact_id)).length) {
        html = '<div style="text-align:center;color:var(--text-muted);padding:20px;">برای ساخت گروه ابتدا با چند نفر چت کنید</div>';
    }
    box.innerHTML = html;
    $('group-title').value = '';
    $('group-info').value = '';
    $('group-modal').classList.remove('hidden');
}
window.closeGroupModal = function() { $('group-modal').classList.add('hidden'); };

window.createGroup = async function() {
    const title = $('group-title').value.trim();
    if (!title) { showToast('نام گروه را وارد کنید', '⚠️'); return; }
    const memberIds = Array.from(document.querySelectorAll('.grp-member:checked')).map(cb => cb.value);
    try {
        const res = await fetch('/api/groups/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: STATE.token, title, memberIds, info: $('group-info').value.trim() })
        });
        const d = await res.json();
        if (!d.ok) { showToast(d.error || 'خطا', '❌'); return; }
        STATE.groups.push(d.group);
        closeGroupModal();
        showToast('👥 گروه ساخته شد', '👥');
        renderChatList();
    } catch (e) { showToast('خطا در ساخت گروه', '❌'); }
};

function hamyarTypingHtml() {
    return `
        <div class="msg-row other">
            <div class="msg-avatar" style="background:#7a8ac4;">هم</div>
            <div class="bubble" style="background:var(--bg-card);">
                <span class="bubble-name" style="color:#7a8ac4;">همیار</span>
                <span class="typing-dots"><span></span><span></span><span></span></span>
            </div>
        </div>`;
}

function buildBubble(msg) {
    const isOwn = msg.sender_id === STATE.myId;
    const deleted = msg.deleted === true;
    const edited = msg.edited === true;
    const color = msg.avatar_color || '#c4956a';
    const name = escapeHtml(msg.username || 'کاربر');
    const time = formatTime(msg.created_at || msg.timestamp || Date.now());

    let nameLine = '';
    if (!isOwn && !deleted) {
        nameLine =
            `<span class="bubble-name" style="color:${color};" onclick="showUserProfile('${msg.sender_id}')">${name}</span>`;
    }

    let replyHtml = '';
    if (msg.reply_to) {
        const ref = STATE.messages.find(m => m.id === msg.reply_to);
        if (ref && !ref.deleted) {
            replyHtml =
                `<div class="reply-preview" onclick="scrollToMsg('${msg.reply_to}')"><div class="reply-preview-name">${escapeHtml(ref.username || 'کاربر')}</div><div class="reply-preview-text">${escapeHtml(truncate(ref.message || 'پیام', 60))}</div></div>`;
        }
    }

    let content = '';
    if (deleted) {
        content = `<span class="bubble-text" style="color:var(--text-muted);font-style:italic;">🚫 پیام حذف شد</span>`;
    } else {
        if (msg.sticker) content += `<div class="bubble-sticker">${msg.sticker}</div>`;
        if (msg.media) content += buildMediaHtml(msg.media);
        if (msg.message) content += `<span class="bubble-text">${renderMarkdown(msg.message)}</span>`;
        if (!content) content = `<span class="bubble-text" style="color:var(--text-muted);">(پیام خالی)</span>`;
    }

    let reactionsHtml = '';
    if (msg.reactions && msg.reactions.length > 0) {
        const grouped = {};
        msg.reactions.forEach(r => { grouped[r] = (grouped[r] || 0) + 1; });
        reactionsHtml = `<div class="reactions">`;
        for (const [emoji, count] of Object.entries(grouped)) {
            reactionsHtml +=
                `<span class="reaction" onclick="addReaction('${msg.id}','${emoji}')">${emoji} <span class="reaction-count">${count}</span></span>`;
        }
        reactionsHtml += `</div>`;
    }

    const editBadge = edited ? `<span class="bubble-edited" style="font-size:10px;color:var(--text-muted);">ویرایش</span>` : '';
    const isPrivate = msg.is_private ? '🔒 ' : '';

    const avatarHtml = !isOwn && !deleted ?
        `<div class="msg-avatar" style="background:${color};${msg.avatar_url ? `background-image:url('${msg.avatar_url}');background-size:cover;` : ''}" onclick="showUserProfile('${msg.sender_id}')" title="مشاهده پروفایل">${msg.avatar_url ? '' : avatarLetter(msg.username)}</div>` :
        '';

    return `
        <div class="msg-row ${isOwn ? 'own' : 'other'}" data-id="${msg.id}"
             oncontextmenu="handleCtxMenu(event,'${msg.id}')"
             ondblclick="handleDblClick(event,'${msg.id}')">
            ${avatarHtml}
            <div class="bubble${deleted ? ' deleted-msg' : ''}">
                ${nameLine}
                ${replyHtml}
                ${content}
                <div class="bubble-meta">
                    ${editBadge}
                    <span class="bubble-time">${isPrivate}${time}</span>
                </div>
                ${reactionsHtml}
            </div>
        </div>
    `;
}

function buildMediaHtml(media) {
    if (!media) return '';
    const type = media.type || 'file';
    const url = media.url || '#';
    const name = media.name || 'فایل';
    const size = media.size || '';
    if (type === 'image') {
        return `<div class="bubble-media"><img src="${url}" alt="تصویر" loading="lazy" onclick="window.open('${url}','_blank')"></div>`;
    }
    if (type === 'video') {
        return `<div class="bubble-media"><video controls src="${url}" onclick="this.paused?this.play():this.pause()"></video></div>`;
    }
    if (type === 'audio') {
        return `<div class="bubble-media"><audio controls src="${url}"></audio></div>`;
    }
    return `
        <div class="bubble-media">
            <div class="file-attachment">
                <span class="file-icon">📄</span>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(name)}</div>
                    <span class="file-size">${size}</span>
                </div>
            </div>
        </div>
    `;
}

function scrollToBottom() {
    setTimeout(() => { chatEl.scrollTop = chatEl.scrollHeight; }, 50);
}

// ============================================
//  SEND MESSAGE
// ============================================
window.sendMessage = function() {
    const text = messageEl.value.trim();
    if (!text && !fileInput.files.length) { showToast('پیام یا فایل وارد کنید', '⚠️'); return; }
    if (Date.now() - STATE.lastSendTime < 1500) { showToast('لطفاً کمی صبر کنید', '⏳'); return; }
    STATE.lastSendTime = Date.now();

    const inGroup = STATE.chatType === 'group';
    const inPrivate = STATE.chatType === 'private';
    const rcpt = (STATE.chatType === 'private' || STATE.chatType === 'group') ? STATE.privateChatWith : null;
    const msg = {
        message: text || '',
        reply_to: STATE.replyTarget ? STATE.replyTarget.id : null,
        is_private: inPrivate,
        is_group: inGroup,
        recipient_id: rcpt,
        media: null,
        sticker: null,
    };

    if (fileInput.files.length > 0) {
        // upload all selected files with live preview + spinner
        const files = Array.from(fileInput.files);
        files.forEach((file, i) => {
            const previewId = 'upl_' + Date.now() + '_' + i;
            addUploadPreview(previewId, file);
            const formData = new FormData();
            formData.append('file', file);
            fetch('/api/upload-file', { method: 'POST', body: formData })
                .then(res => res.json())
                .then(data => {
                    if (data.url) {
                        const m = {
                            message: i === 0 ? text : '',
                            reply_to: i === 0 ? (STATE.replyTarget ? STATE.replyTarget.id : null) : null,
                            is_private: STATE.chatType === 'private',
                            is_group: STATE.chatType === 'group',
                            recipient_id: (STATE.chatType === 'private' || STATE.chatType === 'group') ? STATE.privateChatWith : null,
                            media: { type: data.type, url: data.url, name: data.name, size: data.size },
                            sticker: null,
                        };
                        sendToSocket(m);
                    }
                    markUploadDone(previewId);
                })
                .catch(() => { markUploadFailed(previewId); });
        });
        fileInput.value = '';
        messageEl.value = '';
        messageEl.style.height = 'auto';
        counterEl.textContent = '';
        counterEl.className = '';
        clearReply();
        return;
    }

    sendToSocket(msg);
    messageEl.value = '';
    messageEl.style.height = 'auto';
    counterEl.textContent = '';
    counterEl.className = '';
    clearReply();
    messageEl.focus();
};

function sendToSocket(msg) {
    if (STATE.socket && STATE.socket.connected) {
        STATE.socket.emit('send_message', msg);
        // show AI typing if this message will trigger همیار
        const triggersAI = msg.is_private && msg.recipient_id === HAMYAR_ID ||
            (msg.is_group === false && msg.is_private === false && (isHamyarMsg(msg.message) || msg.reply_to));
        if (triggersAI) setAItyping(msg.is_private ? 'private' : 'global');
    } else {
        showToast('ارسال نشد! اتصال برقرار نیست', '❌');
    }
}

function isHamyarMsg(text) {
    if (!text) return false;
    const t = text.toLowerCase().trim();
    if (t === 'همیار' || t === '@همیار') return true;
    return HAMYAR_ALIASES.some(a => t.includes(a));
}

fileInput.addEventListener('change', function() {
    if (this.files.length > 0) sendMessage();
});

// ---- File upload preview + loading ----
function addUploadPreview(id, file) {
    const box = $('upload-preview');
    const isImg = file && file.type && file.type.startsWith('image/');
    const card = document.createElement('div');
    card.className = 'upload-item';
    card.id = id;
    card.innerHTML = `
        ${isImg ? `<div class="up-thumb" style="background-image:url('${URL.createObjectURL(file)}')"></div>` : `<div class="up-thumb up-file">📄</div>`}
        <div class="up-info">
            <div class="up-name">${escapeHtml(file ? file.name : 'فایل')}</div>
            <div class="up-status"><span class="up-spin"></span><span class="up-text">در حال ارسال…</span></div>
        </div>
        <button class="up-cancel" onclick="cancelUpload('${id}')">✕</button>`;
    box.appendChild(card);
}

function markUploadDone(id) {
    const el = document.getElementById(id);
    if (el) {
        el.querySelector('.up-text').textContent = 'ارسال شد ✓';
        el.querySelector('.up-spin').classList.remove('up-spin');
        setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(() => el.remove(), 300); }, 500);
    }
}
function markUploadFailed(id) {
    const el = document.getElementById(id);
    if (el) {
        el.querySelector('.up-text').textContent = 'خطا در ارسال';
        el.style.borderColor = '#c47a7a';
        el.querySelector('.up-spin').classList.remove('up-spin');
    }
}
window.cancelUpload = function(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
};

// ============================================
//  EMOJI PICKER
// ============================================
window.openEmojiPicker = function() {
    const grid = $('emoji-grid');
    grid.innerHTML = EMOJIS.map(e =>
        `<span style="cursor:pointer;padding:6px;border-radius:8px;transition:all .15s;font-size:32px;" 
              onmouseover="this.style.background='var(--bg-tertiary)';this.style.transform='scale(1.15)'" 
              onmouseout="this.style.background='transparent';this.style.transform='scale(1)'"
              onclick="insertEmoji('${e}')">${e}</span>`
    ).join('');
    $('emoji-picker').classList.remove('hidden');
};

window.closeEmojiPicker = function() { $('emoji-picker').classList.add('hidden'); };

window.insertEmoji = function(emoji) {
    const start = messageEl.selectionStart;
    const end = messageEl.selectionEnd;
    const text = messageEl.value;
    messageEl.value = text.substring(0, start) + emoji + text.substring(end);
    messageEl.focus();
    messageEl.selectionStart = messageEl.selectionEnd = start + emoji.length;
    closeEmojiPicker();
    messageEl.dispatchEvent(new Event('input'));
};

// ============================================
//  STICKER PICKER
// ============================================
window.openStickerPicker = function() {
    const grid = $('sticker-grid');
    grid.innerHTML = STICKERS.map(s =>
        `<span style="cursor:pointer;padding:8px;border-radius:12px;font-size:44px;transition:all .15s;display:inline-block;"
              onmouseover="this.style.background='var(--bg-tertiary)';this.style.transform='scale(1.15)'" 
              onmouseout="this.style.background='transparent';this.style.transform='scale(1)'"
              onclick="sendSticker('${s}')">${s}</span>`
    ).join('');
    $('sticker-picker').classList.remove('hidden');
};

window.closeStickerPicker = function() { $('sticker-picker').classList.add('hidden'); };

window.sendSticker = function(sticker) {
    closeStickerPicker();
    const msg = { message: '', sticker: sticker, reply_to: STATE.replyTarget ? STATE.replyTarget.id : null,
        is_private: !!STATE.privateChatWith, recipient_id: STATE.privateChatWith || null, media: null };
    sendToSocket(msg);
};

// ============================================
//  REACTION PICKER
// ============================================
window.openReactionPicker = function() {
    const grid = $('reaction-grid');
    grid.innerHTML = REACTIONS.map(r =>
        `<span style="cursor:pointer;padding:8px;border-radius:12px;font-size:36px;transition:all .15s;display:inline-block;"
              onmouseover="this.style.background='var(--bg-tertiary)';this.style.transform='scale(1.2)'" 
              onmouseout="this.style.background='transparent';this.style.transform='scale(1)'"
              onclick="sendReaction('${r}')">${r}</span>`
    ).join('');
    $('reaction-picker').classList.remove('hidden');
};

window.closeReactionPicker = function() { $('reaction-picker').classList.add('hidden'); };

let reactionTargetMsg = null;

window.sendReaction = function(emoji) {
    closeReactionPicker();
    if (reactionTargetMsg) {
        addReaction(reactionTargetMsg, emoji);
        reactionTargetMsg = null;
    } else {
        const lastMsg = STATE.messages.filter(m => m.sender_id === STATE.myId).pop();
        if (lastMsg) addReaction(lastMsg.id, emoji);
    }
};

// ============================================
//  CONTEXT MENU
// ============================================
window.handleCtxMenu = function(e, msgId) {
    e.preventDefault();
    const msg = STATE.messages.find(m => m.id === msgId);
    if (!msg) return;
    STATE.ctxTarget = msg;
    ctxDelAllItem.style.display = msg.sender_id === STATE.myId ? 'flex' : 'none';
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 240);
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';
    ctxMenu.classList.remove('hidden');
};

window.handleDblClick = function(e, msgId) {
    const msg = STATE.messages.find(m => m.id === msgId);
    if (msg && msg.sender_id === STATE.myId && !msg.deleted) {
        const bubble = e.target.closest('.bubble');
        if (!bubble) return;
        const textEl = bubble.querySelector('.bubble-text');
        if (!textEl) return;
        const currentText = msg.message || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.cssText =
            `width:100%;padding:6px 10px;border-radius:8px;background:var(--bg-input);color:var(--text);border:2px solid var(--accent);font-family:var(--font);font-size:var(--font-size);outline:none;`;
        textEl.replaceWith(input);
        input.focus();
        input.select();
        input.addEventListener('blur', () => {
            if (input.value.trim() && input.value.trim() !== currentText) {
                if (STATE.socket && STATE.socket.connected) {
                    STATE.socket.emit('edit_message', { msgId, text: input.value.trim() });
                }
            }
            renderMessages();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { input.blur(); }
            if (e.key === 'Escape') { renderMessages(); }
        });
    }
};

document.addEventListener('click', function(e) {
    if (!ctxMenu.contains(e.target)) { ctxMenu.classList.add('hidden');
        STATE.ctxTarget = null; }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        ctxMenu.classList.add('hidden');
        clearReply();
        closeUserPopup();
        closeSettings();
        closeMyProfile();
        closeEditProfile();
        closeChatList();
        closeEmojiPicker();
        closeStickerPicker();
        closeReactionPicker();
        closeSearch();
        closeMenu();
        STATE.ctxTarget = null;
    }
});

window.ctxReply = function() {
    if (STATE.ctxTarget) { setReply(STATE.ctxTarget);
        ctxMenu.classList.add('hidden'); }
};

window.ctxReact = function() {
    if (STATE.ctxTarget) { addReaction(STATE.ctxTarget.id, '❤️');
        ctxMenu.classList.add('hidden'); }
};

window.ctxReactCustom = function() {
    if (STATE.ctxTarget) {
        reactionTargetMsg = STATE.ctxTarget.id;
        ctxMenu.classList.add('hidden');
        openReactionPicker();
    }
};

window.ctxCopy = function() {
    if (STATE.ctxTarget && STATE.ctxTarget.message) {
        navigator.clipboard.writeText(STATE.ctxTarget.message).then(() => { showToast('📋 کپی شد', '📋'); });
        ctxMenu.classList.add('hidden');
    }
};

window.ctxDeleteForMe = function() {
    if (STATE.ctxTarget) {
        const el = chatEl.querySelector(`[data-id="${STATE.ctxTarget.id}"]`);
        if (el) el.style.display = 'none';
        ctxMenu.classList.add('hidden');
        showToast('🗑️ حذف شد', '🗑️');
    }
};

window.ctxDeleteForAll = function() {
    if (STATE.ctxTarget) {
        const msg = STATE.ctxTarget;
        if (msg.sender_id !== STATE.myId) {
            showToast('فقط فرستنده می‌تواند حذف کند', '❌');
            ctxMenu.classList.add('hidden');
            return;
        }
        if (!confirm('حذف برای همه؟ این کار غیرقابل برگشت است!')) {
            ctxMenu.classList.add('hidden');
            return;
        }
        if (STATE.socket && STATE.socket.connected) {
            STATE.socket.emit('delete_for_all', msg.id);
            showToast('✅ در حال حذف...', '⏳');
        }
        ctxMenu.classList.add('hidden');
    }
};

window.ctxForward = function() {
    if (STATE.ctxTarget) {
        ctxMenu.classList.add('hidden');
        openForward();
    }
};

// ---- Forward ----
window.openForward = function() {
    if (!STATE.ctxTarget) { showToast('پیامی انتخاب نشده', '⚠️'); return; }
    const box = $('forward-targets');
    let html = `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--radius);background:var(--bg-input);border:1px solid var(--border);margin-bottom:6px;cursor:pointer;" onclick="doForward('${SAVED_ID}')">
            <div style="width:44px;height:44px;border-radius:50%;background:#c47a7a;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📌</div>
            <div style="font-weight:600;font-size:14px;">پیام‌های ذخیره‌شده</div>
        </div>`;
    // other contacts (excluding special ones)
    STATE.contacts.forEach(c => {
        if (c.contact_id === SAVED_ID || c.contact_id === HAMYAR_ID || c.contact_id === STATE.myId) return;
        html += `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--radius);background:var(--bg-input);border:1px solid var(--border);margin-bottom:6px;cursor:pointer;" onclick="doForward('${c.contact_id}')">
            <div style="width:44px;height:44px;border-radius:50%;background:${c.avatar_color||'#c4956a'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;flex-shrink:0;${c.avatar_url?`background-image:url('${c.avatar_url}');background-size:cover;`:''}">${c.avatar_url?'':avatarLetter(c.username)}</div>
            <div style="font-weight:600;font-size:14px;">${escapeHtml(c.username)}</div>
        </div>`;
    });
    box.innerHTML = html;
    $('forward-modal').classList.remove('hidden');
};

window.closeForward = function() { $('forward-modal').classList.add('hidden'); };

window.doForward = function(targetId) {
    const msg = STATE.ctxTarget;
    if (!msg) { closeForward(); return; }
    const content = {
        sender_name: msg.username || 'کاربر',
        text: msg.message || '',
        media_url: msg.media ? msg.media.url : null,
        media_type: msg.media ? msg.media.type : null,
        sticker: msg.sticker || null
    };
    if (targetId === SAVED_ID) {
        forwardToSaved(content);
    } else {
        // forward to a contact = send as a private message to that contact
        sendToSocket({
            message: content.text || '',
            sticker: content.sticker || null,
            media: (content.media_type && content.media_url) ? { type: content.media_type, url: content.media_url } : null,
            reply_to: null,
            is_private: true,
            recipient_id: targetId
        });
        showToast('↗️ ارسال شد', '↗️');
    }
    closeForward();
};

// ---- Saved Messages ----
function buildSavedBubble(sm) {
    if (!sm) return '';
    const time = formatTime(sm.created_at || Date.now());
    let content = '';
    if (sm.sticker) content += `<div class="bubble-sticker">${sm.sticker}</div>`;
    if (sm.media_type && sm.media_url) {
        if (sm.media_type === 'image') content += `<div class="bubble-media"><img src="${sm.media_url}" alt="تصویر" loading="lazy" onclick="window.open('${sm.media_url}','_blank')"></div>`;
        else content += `<div class="bubble-media"><a href="${sm.media_url}" target="_blank" rel="noopener" style="display:block;padding:14px;color:var(--text-secondary);text-decoration:none;">📎 ${escapeHtml(sm.media_type)}</a></div>`;
    }
    if (sm.text) content += `<span class="bubble-text">${escapeHtml(sm.text)}</span>`;
    if (!content) content = `<span class="bubble-text" style="color:var(--text-muted);">(پیام خالی)</span>`;
    return `
        <div class="msg-row other" data-saved>
            <div class="msg-avatar" style="background:#c47a7a;">📌</div>
            <div class="bubble">
                <span class="bubble-name" style="color:#c47a7a;">${escapeHtml(sm.sender_name || 'کاربر')}</span>
                ${content}
                <div class="bubble-meta"><span class="bubble-time">${time}</span></div>
            </div>
        </div>`;
}

function forwardToSaved(content) {
    // optimistic local add + persist
    const item = {
        sender_name: content.sender_name || 'کاربر',
        text: content.text || '',
        media_url: content.media_url || null,
        media_type: content.media_type || null,
        sticker: content.sticker || null,
        created_at: new Date().toISOString()
    };
    STATE.savedMessages.push(item);
    if (STATE.savedMessages.length > 10) STATE.savedMessages = STATE.savedMessages.slice(-10);
    saveSavedLocal();
    // persist to server (Supabase); if table missing, stays local
    fetch('/api/saved-messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: STATE.token, message: content })
    }).then(r => r.json()).then(d => {
        if (!d.ok) saveSavedLocal();
    }).catch(() => {});
    if (STATE.privateChatWith === SAVED_ID) renderMessages();
    showToast('📌 در پیام‌های ذخیره‌شده', '📌');
}

function saveSavedLocal() {
    try { localStorage.setItem('pm_saved_' + STATE.myId, JSON.stringify(STATE.savedMessages)); } catch (e) {}
}

function loadSavedMessages() {
    // load from localStorage first (fast), then refresh from server
    try {
        const local = localStorage.getItem('pm_saved_' + STATE.myId);
        if (local) { STATE.savedMessages = JSON.parse(local) || []; renderMessages(); }
    } catch (e) {}
    fetch('/api/saved-messages', { headers: { 'Authorization': 'Bearer ' + STATE.token } })
        .then(r => r.json())
        .then(d => {
            if (d.ok) {
                // map server rows to bubble shape
                STATE.savedMessages = (d.data || []).slice(0, 10).map(row => ({
                    sender_name: row.sender_name || 'کاربر',
                    text: row.text || '',
                    media_url: row.media_url || null,
                    media_type: row.media_type || null,
                    sticker: row.sticker || null,
                    created_at: row.created_at || new Date().toISOString()
                }));
                saveSavedLocal();
                if (STATE.privateChatWith === SAVED_ID) renderMessages();
            }
        })
        .catch(() => {});
}

// ============================================
//  REPLY
// ============================================
function setReply(msg) {
    STATE.replyTarget = msg;
    replyBarName.textContent = msg.username || 'کاربر';
    replyBarText.textContent = truncate(msg.message || 'پیام', 70);
    replyBar.classList.remove('hidden');
    messageEl.focus();
}

window.clearReply = function() {
    STATE.replyTarget = null;
    replyBar.classList.add('hidden');
};

window.scrollToMsg = function(msgId) {
    const el = chatEl.querySelector(`[data-id="${msgId}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background .3s';
        el.style.background = 'var(--bg-tertiary)';
        setTimeout(() => { el.style.background = ''; }, 1000);
    }
};

// ============================================
//  REACTIONS
// ============================================
window.addReaction = function(msgId, emoji) {
    if (STATE.socket && STATE.socket.connected) {
        STATE.socket.emit('add_reaction', { msgId, emoji });
    }
};

// ============================================
//  USER PROFILE
// ============================================
window.showUserProfile = function(userId) {
    const userMsg = STATE.messages.find(m => m.sender_id === userId);
    if (!userMsg) { showToast('اطلاعات کاربر در دسترس نیست', '⚠️'); return; }
    const popupAv = $('popup-avatar');
    if (userMsg.avatar_url) {
        popupAv.style.backgroundImage = `url('${userMsg.avatar_url}')`;
        popupAv.style.backgroundSize = 'cover';
        popupAv.textContent = '';
    } else {
        popupAv.textContent = avatarLetter(userMsg.username);
        popupAv.style.background = userMsg.avatar_color || '#c4956a';
    }
    $('popup-name').textContent = userMsg.username || 'کاربر';
    $('popup-bio').textContent = userMsg.bio || 'بیوگرافی موجود نیست';
    $('popup-age').textContent = userMsg.age ? `🎂 ${userMsg.age} سال` : '';
    $('popup-email').innerHTML = userMsg.email ?
        `📧 <a href="mailto:${escapeHtml(userMsg.email)}" style="color:var(--accent-light);text-decoration:none;">${escapeHtml(userMsg.email)}</a>` :
        '';
    $('popup-level').textContent = userMsg.level ? `🏅 ${userMsg.level.name}` : '';
    STATE._popupUserId = userId;
    STATE._popupUsername = userMsg.username;
    userPopup.classList.remove('hidden');
};

window.closeUserPopup = function() { userPopup.classList.add('hidden'); };

// ============================================
//  PRIVATE CHAT / GO HOME
// ============================================
// ---- Navigation: list <-> chat ----
function showList() {
    STATE.privateChatWith = null;
    STATE.chatType = null;
    $('chat-screen').classList.add('hidden');
    $('chat-list').classList.remove('hidden');
    document.querySelectorAll('.back-btn').forEach(b => b.remove());
    document.querySelectorAll('.clear-bot-btn').forEach(b => b.remove());
    renderChatList();
    updateHeaderStatus();
}

window.goHome = function() { showList(); };

// open a chat: id + type ('global'|'private'|'group'|'saved'|'files')
function openChat(id, type) {
    STATE.privateChatWith = id;
    STATE.chatType = type;
    $('chat-list').classList.add('hidden');
    $('chat-screen').classList.remove('hidden');
    // back button
    if (!document.querySelector('.back-btn')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'hdr-btn back-btn';
        backBtn.textContent = '←';
        backBtn.title = 'بازگشت به لیست';
        backBtn.style.fontSize = '20px';
        backBtn.onclick = function() { showList(); };
        document.querySelector('.header-actions').prepend(backBtn);
    }
    document.querySelectorAll('.clear-bot-btn').forEach(b => b.remove());
    // clear-bot button only in همیار chat
    if (id === HAMYAR_ID) {
        const clr = document.createElement('button');
        clr.className = 'hdr-btn clear-bot-btn';
        clr.textContent = '🧹';
        clr.title = 'پاک کردن کل تاریخچه با همیار';
        clr.onclick = function() { clearBotHistory(); };
        document.querySelector('.header-actions').appendChild(clr);
    }
    if (type === 'saved') loadSavedMessages();
    updateHeaderStatus();
    renderMessages();
    scrollToBottom();
}

function openPrivateChat(uid, username) {
    openChat(uid, uid.startsWith('grp_') ? 'group' : 'private');
}

window.clearBotHistory = function() {
    if (STATE.privateChatWith !== HAMYAR_ID) return;
    if (!confirm('کل تاریخچه گفت‌وگو با همیار (برای شما و همیار) پاک شود؟')) return;
    if (STATE.socket && STATE.socket.connected) {
        STATE.socket.emit('clear_contact_history', HAMYAR_ID);
        showToast('🧹 در حال پاک کردن...', '⏳');
    }
};

window.startPrivateChat = function() {
    if (STATE._popupUserId) {
        openPrivateChat(STATE._popupUserId, STATE._popupUsername || 'کاربر');
        closeUserPopup();
    }
};

// ============================================
//  MY PROFILE
// ============================================
window.openMyProfile = function() {
    if (!STATE.isLoggedIn) {
        showToast('لطفاً وارد شوید', '⚠️');
        return;
    }
    const av = $('my-profile-avatar');
    if (STATE.myAvatar) {
        av.style.backgroundImage = `url('${STATE.myAvatar}')`;
        av.style.backgroundSize = 'cover';
        av.textContent = '';
    } else {
        av.textContent = avatarLetter(STATE.myName);
        av.style.background = STATE.myColor || '#c4956a';
    }
    $('my-profile-name').textContent = STATE.myName || 'نام تنظیم نشده';
    $('my-profile-bio').textContent = STATE.myBio || 'بیوگرافی تنظیم نشده';
    $('my-profile-age').textContent = STATE.myAge ? `${STATE.myAge} سال` : 'سن تنظیم نشده';
    $('my-profile-id').textContent = STATE.myId;
    $('my-profile-modal').classList.remove('hidden');
};

window.closeMyProfile = function() { $('my-profile-modal').classList.add('hidden'); };

document.getElementById('avatar-input-edit')?.addEventListener('change', async function() {
    if (this.files.length > 0) {
        const formData = new FormData();
        formData.append('avatar', this.files[0]);
        const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
            STATE.myAvatar = data.url;
            localStorage.setItem('pm_avatar', data.url);
            updateHeader();
            saveProfileToServer({ avatar_url: data.url });
            const av = $('my-profile-avatar');
            av.style.backgroundImage = `url('${data.url}')`;
            av.style.backgroundSize = 'cover';
            av.textContent = '';
            if (STATE.socket) {
                STATE.socket.emit('user_join', {
                    token: STATE.token, username: STATE.myName, avatar_color: STATE.myColor,
                    avatar_url: data.url, bio: STATE.myBio, age: STATE.myAge, email: STATE.myEmail
                });
            }
            showToast('✅ عکس پروفایل به‌روز شد', '📸');
        }
    }
    this.value = '';
});

document.getElementById('avatar-input-edit2')?.addEventListener('change', async function() {
    if (this.files.length > 0) {
        const formData = new FormData();
        formData.append('avatar', this.files[0]);
        const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
            STATE.myAvatar = data.url;
            localStorage.setItem('pm_avatar', data.url);
            updateHeader();
            saveProfileToServer({ avatar_url: data.url });
            const av = $('edit-profile-avatar');
            av.style.backgroundImage = `url('${data.url}')`;
            av.style.backgroundSize = 'cover';
            av.textContent = '';
            showToast('✅ عکس پروفایل به‌روز شد', '📸');
        }
    }
    this.value = '';
});

window.editMyProfile = function() {
    closeMyProfile();
    $('edit-profile-name').value = STATE.myName || '';
    $('edit-profile-bio').value = STATE.myBio || '';
    $('edit-profile-age').value = STATE.myAge || '';
    const av = $('edit-profile-avatar');
    if (STATE.myAvatar) {
        av.style.backgroundImage = `url('${STATE.myAvatar}')`;
        av.style.backgroundSize = 'cover';
        av.textContent = '';
    } else {
        av.textContent = avatarLetter(STATE.myName);
        av.style.background = STATE.myColor || '#c4956a';
    }
    $('edit-profile-modal').classList.remove('hidden');
};

window.closeEditProfile = function() { $('edit-profile-modal').classList.add('hidden'); };

window.saveEditProfile = function() {
    const name = $('edit-profile-name').value.trim();
    const bio = $('edit-profile-bio').value.trim();
    const age = $('edit-profile-age').value.trim();
    if (!name) { showToast('نام نمی‌تواند خالی باشد', '⚠️'); return; }
    STATE.myName = name;
    STATE.myBio = bio;
    STATE.myAge = age;
    localStorage.setItem('pm_username', STATE.myName);
    localStorage.setItem('pm_bio', STATE.myBio);
    localStorage.setItem('pm_age', STATE.myAge);
    saveProfileToServer({ username: name, bio, age });
    if (STATE.socket) {
        STATE.socket.emit('user_join', {
            token: STATE.token, username: STATE.myName, avatar_color: STATE.myColor,
            avatar_url: STATE.myAvatar, bio: STATE.myBio, age: STATE.myAge, email: STATE.myEmail
        });
    }
    updateHeader();
    closeEditProfile();
    showToast('پروفایل به‌روز شد', '✅');
    renderMessages();
};

// ============================================
//  CHAT LIST (Contacts — persistent)
// ============================================
// ---- Combined chat list (main screen) ----
function renderChatList() {
    const container = $('chat-list-items');
    let items = [];

    // Global chat
    const lastGlobal = STATE.messages.filter(m => !m.is_private).slice(-1)[0];
    items.push({
        id: GLOBAL_ID, type: 'global', name: 'Global chat', icon: '🌐', color: '#c4956a',
        lastMsg: lastGlobal ? lastGlobal.message || (lastGlobal.sticker||'📎') : 'گفتگوی عمومی',
        time: lastGlobal ? lastGlobal.created_at : null
    });

    // Special bots/contacts
    items.push({ id: HAMYAR_ID, type: 'private', name: 'همیار', icon: '🤖', color: '#7a8ac4', lastMsg: 'دستیار هوشمند' });
    items.push({ id: VID_ID, type: 'private', name: 'دانلودر ویدیو', icon: '🎬', color: '#6B8F71', lastMsg: 'لینک ویدیو بفرستید' });
    items.push({ id: SAVED_ID, type: 'saved', name: 'پیام‌های ذخیره‌شده', icon: '📌', color: '#c47a7a', lastMsg: '۱۰ پیام اخیر' });

    // Groups
    STATE.groups.forEach(g => {
        const gm = STATE.messages.filter(m => m.is_group && m.recipient_id === g.id).slice(-1)[0];
        items.push({ id: g.id, type: 'group', name: g.title, icon: '👥', color: g.avatar_color||'#7a8ac4',
            lastMsg: gm ? (gm.username+': '+(gm.message||'📎')) : 'گروه', time: gm ? gm.created_at : null });
    });

    // Contacts (private) excluding special
    STATE.contacts.forEach(c => {
        if ([SAVED_ID,HAMYAR_ID,VID_ID,FILES_ID,STATE.myId].includes(c.contact_id)) return;
        items.push({ id: c.contact_id, type: 'private', name: c.username, color: c.avatar_color||'#c4956a',
            avatar_url: c.avatar_url, lastMsg: c.last_message||'', time: c.last_time });
    });

    // sort by last activity (global/special without time go last)
    items.sort((a,b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
    });

    if (!items.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">هنوز چتی نیست</div>';
        return;
    }

    container.innerHTML = items.map(it => `
        <div class="chat-row" onclick="openChat('${it.id}','${it.type}')">
            <div class="chat-row-av" style="background:${it.color};${it.avatar_url?`background-image:url('${it.avatar_url}');background-size:cover;`:''}">${it.avatar_url?'':(it.icon||avatarLetter(it.name))}</div>
            <div class="chat-row-info">
                <div class="chat-row-top">
                    <span class="chat-row-name">${escapeHtml(it.name)}</span>
                    ${it.time?`<span class="chat-row-time">${formatTime(it.time)}</span>`:''}
                </div>
                <div class="chat-row-last">${escapeHtml(truncate(it.lastMsg||'',40))}</div>
            </div>
        </div>
    `).join('');
}

window.startChatWith = function(userId, username) {
    openChat(userId, userId.startsWith('grp_') ? 'group' : 'private');
};

window.openChatList = function() { renderChatList(); };
window.closeChatList = function() {};
window.filterContacts = function() {};

// ============================================
//  SEARCH
// ============================================
window.openSearch = function() {
    $('search-modal').classList.remove('hidden');
    $('search-input').value = '';
    $('search-results').innerHTML = '';
    $('search-input').focus();
};

window.closeSearch = function() { $('search-modal').classList.add('hidden'); };

window.searchMessages = function(query) {
    const results = $('search-results');
    if (!query.trim()) {
        results.innerHTML =
            '<div style="text-align:center;color:var(--text-muted);padding:20px;">عبارت جستجو را وارد کنید</div>';
        return;
    }
    const filtered = STATE.messages.filter(m => m.message?.toLowerCase().includes(query.toLowerCase()) && !m.deleted);
    if (filtered.length === 0) {
        results.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">نتیجه‌ای یافت نشد</div>';
        return;
    }
    results.innerHTML = filtered.slice(0, 20).map(m => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border);cursor:pointer;transition:var(--transition);"
             onmouseover="this.style.background='var(--bg-tertiary)'" 
             onmouseout="this.style.background='transparent'"
             onclick="scrollToMsg('${m.id}');closeSearch();">
            <div style="width:36px;height:36px;border-radius:50%;background:${m.avatar_color || '#c4956a'};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0;${m.avatar_url ? `background-image:url('${m.avatar_url}');background-size:cover;` : ''}">
                ${m.avatar_url ? '' : avatarLetter(m.username)}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:13px;">${escapeHtml(m.username)}</div>
                <div style="font-size:12px;color:var(--text-muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                    ${highlightText(escapeHtml(m.message || ''), query)}
                </div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);flex-shrink:0;">${formatTime(m.created_at)}</div>
        </div>
    `).join('');
};

// ============================================
//  MENU
// ============================================
// ---- Donation (حمایت از توسعه) ----
const DONATE_CARD = '6219861957204273'; // without spaces

window.openDonation = function() {
    const m = $('donation-modal');
    m.classList.remove('hidden');
    // mark shown so it won't auto-popup again
    localStorage.setItem('pm_donate_seen', Date.now());
};
window.closeDonation = function() { $('donation-modal').classList.add('hidden'); };
window.copyDonationCard = function() {
    navigator.clipboard.writeText(DONATE_CARD).then(() => {
        showToast('📋 شماره کارت کپی شد', '📋');
    });
};

// Auto-popup once after a few uses (e.g. after 3 app sessions / logins)
function maybeAutoDonate() {
    try {
        const seen = parseInt(localStorage.getItem('pm_donate_seen') || '0');
        if (seen) return; // already opened once
        let count = parseInt(localStorage.getItem('pm_uses') || '0') + 1;
        localStorage.setItem('pm_uses', count);
        if (count >= 3) {
            setTimeout(() => { openDonation(); }, 4000);
            localStorage.setItem('pm_donate_seen', Date.now());
        }
    } catch (e) {}
}

window.openMenu = function() { $('menu-modal').classList.remove('hidden'); };
window.closeMenu = function() { $('menu-modal').classList.add('hidden'); };

window.clearMyMessages = function() {
    if (!confirm('همه پیام‌های شما حذف می‌شوند. ادامه؟')) return;
    if (STATE.socket && STATE.socket.connected) {
        STATE.socket.emit('clear_my_messages');
        showToast('🧹 در حال پاک کردن...', '⏳');
    }
};

window.exportChat = function() {
    const filtered = STATE.messages.filter(m => !m.deleted);
    if (filtered.length === 0) { showToast('هیچ پیامی برای خروجی وجود ندارد', '⚠️'); return; }
    let text = '📋 خروجی چت - Persia Messenger\n';
    text += '='.repeat(40) + '\n';
    text += `📅 تاریخ: ${new Date().toLocaleDateString('fa-IR')}\n`;
    text += `👤 کاربر: ${STATE.myName}\n`;
    text += `📝 تعداد پیام‌ها: ${filtered.length}\n`;
    text += '='.repeat(40) + '\n\n';
    filtered.forEach(m => {
        const time = formatTime(m.created_at);
        const name = m.username || 'کاربر';
        const msg = m.deleted ? '🚫 [حذف شده]' : (m.message || m.sticker || '📎 فایل');
        text += `[${time}] ${name}: ${msg}\n`;
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_export_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 خروجی چت دانلود شد', '📤');
};

// ============================================
//  نصب برنامه (PWA)
// ============================================
window.installApp = function() {
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('✅ برنامه نصب شد!', '🎉');
            } else {
                showToast('❌ نصب لغو شد', '❌');
            }
            window.deferredPrompt = null;
        });
    } else {
        showToast('📱 از منوی مرورگر گزینه "نصب برنامه" را انتخاب کنید', '📱');
    }
};

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    console.log('📲 برنامه قابل نصب است');
});

window.addEventListener('appinstalled', () => {
    console.log('✅ برنامه نصب شد!');
    showToast('✅ برنامه با موفقیت نصب شد!', '🎉', 4000);
});

// ============================================
//  TEXTAREA EVENTS
// ============================================
messageEl.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    const len = this.value.length;
    if (len === 0) { counterEl.textContent = '';
        counterEl.className = ''; } else if (len >= 450) { counterEl.textContent = `${len}/500`;
        counterEl.className = 'danger'; } else if (len >= 350) { counterEl.textContent = `${len}/500`;
        counterEl.className = 'warn'; } else { counterEl.textContent = '';
        counterEl.className = ''; }
    if (STATE.socket && STATE.socket.connected) {
        STATE.socket.emit('typing', { isTyping: this.value.length > 0 });
    }
});

messageEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault();
        sendMessage(); }
});

$('login-password').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
});
$('login-email').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
});
$('signup-password').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSignup();
});

// ============================================
//  INIT
// ============================================
function initApp() {
    updateHeader();
    if (STATE.myName && STATE.token) {
        STATE.isLoggedIn = true;
        loginModal.classList.add('hidden');
        signupModal.classList.add('hidden');
        updateHeader();
        showList();
        updateHeaderStatus();
        connectSocket();
    } else {
        loginModal.classList.remove('hidden');
        updateHeaderStatus();
    }
    console.log('🚀 Persia Messenger v6.0 - نسخه نهایی');
    console.log('👤 کاربر:', STATE.myName || 'وارد نشده');
    console.log('🆔 شناسه:', STATE.myId);
    console.log('🎨 تم:', STATE.theme);
    maybeAutoDonate();
}

// ── Start ──
document.documentElement.style.setProperty('--font-family', "'Inter', -apple-system, sans-serif");
initApp();

console.log('✨ Persia Messenger - نسخه کامل با همه امکانات');
console.log('📱 برای تبدیل به APK: npm run build:pwa');
console.log('📱 برای تبدیل با Capacitor: npm run build:android');
