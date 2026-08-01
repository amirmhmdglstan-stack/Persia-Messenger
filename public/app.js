// ============================================
//  STATE
// ============================================
const STATE = {
    myId: localStorage.getItem('pm_user_id') || 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    myName: localStorage.getItem('pm_username') || '',
    myBio: localStorage.getItem('pm_bio') || '',
    myAge: localStorage.getItem('pm_age') || '',
    myEmail: localStorage.getItem('pm_email') || '',
    myColor: localStorage.getItem('pm_color') || '#c4956a',
    myAvatar: localStorage.getItem('pm_avatar') || null,
    theme: localStorage.getItem('pm_theme') || 'dark',
    fontSize: parseInt(localStorage.getItem('pm_font_size')) || 15,
    messages: [],
    replyTarget: null,
    ctxTarget: null,
    lastSendTime: 0,
    isLoggedIn: false,
    pendingCode: '',
    privateChatWith: null,
    socket: null,
};

localStorage.setItem('pm_user_id', STATE.myId);

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
const onlineCount = $('online-count');
const loginModal = $('login-modal');
const verifyModal = $('verify-modal');
const profileModal = $('profile-modal');
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
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function avatarLetter(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
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

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
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
                username: STATE.myName,
                avatar_color: STATE.myColor,
                avatar_url: STATE.myAvatar,
                bio: STATE.myBio,
                age: STATE.myAge,
                email: STATE.myEmail
            });
        }
    });
    
    STATE.socket.on('load_messages', (msgs) => { STATE.messages = msgs || [];
        renderMessages(); });
    STATE.socket.on('new_message', (msg) => { STATE.messages.push(msg);
        renderMessages();
        scrollToBottom(); });
    STATE.socket.on('message_updated', (msg) => {
        const idx = STATE.messages.findIndex(m => m.id === msg.id);
        if (idx > -1) { STATE.messages[idx] = msg;
            renderMessages(); }
    });
    STATE.socket.on('online_count', (count) => { onlineCount.textContent = `(${count} آنلاین)`; });
    STATE.socket.on('user_joined', (user) => { showToast(`${user.username} وارد شد`, '👤', 1500); });
    STATE.socket.on('spam_warning', (msg) => { showToast(msg, '⚠️', 3000); });
    STATE.socket.on('messages_cleared', () => { showToast('🧹 تاریخچه شما پاک شد', '🧹');
        renderMessages(); });
    STATE.socket.on('delete_confirmed', (msgId) => { showToast('✅ پیام برای همه حذف شد', '✅'); });
    STATE.socket.on('clear_confirmed', () => { showToast('🧹 تاریخچه پاک شد', '🧹'); });
}

// ============================================
//  LOGIN
// ============================================
window.requestCode = function() {
    const identifier = $('login-identifier').value.trim();
    if (!identifier) { showToast('لطفاً شماره یا ایمیل را وارد کنید', '⚠️'); return; }
    STATE.pendingIdentifier = identifier;
    const code = generateCode();
    STATE.pendingCode = code;
    console.log('🔑 کد تایید شما:', code);
    $('code-display').textContent = code;
    loginModal.classList.add('hidden');
    verifyModal.classList.remove('hidden');
    showToast(`کد: ${code} (در کنسول هم هست)`, '📱', 4000);
    $('verify-code').value = '';
    $('verify-code').focus();
};

window.verifyCode = function() {
    const input = $('verify-code').value.trim();
    if (input === STATE.pendingCode) {
        verifyModal.classList.add('hidden');
        profileModal.classList.remove('hidden');
        $('profile-name').value = STATE.myName || '';
        $('profile-bio').value = STATE.myBio || '';
        $('profile-age').value = STATE.myAge || '';
        updateProfilePreview();
    } else {
        showToast('کد نادرست است', '❌');
        $('verify-code').value = '';
        $('verify-code').focus();
    }
};

window.goBackToLogin = function() {
    verifyModal.classList.add('hidden');
    loginModal.classList.remove('hidden');
};

function updateProfilePreview() {
    const name = $('profile-name').value || '?';
    const av = $('profile-avatar-preview');
    av.textContent = avatarLetter(name);
    av.style.background = STATE.myColor || randomColor();
}

$('profile-name').addEventListener('input', updateProfilePreview);

document.getElementById('avatar-input')?.addEventListener('change', async function() {
    if (this.files.length > 0) {
        const formData = new FormData();
        formData.append('avatar', this.files[0]);
        const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
            STATE.myAvatar = data.url;
            const av = $('profile-avatar-preview');
            av.style.backgroundImage = `url('${data.url}')`;
            av.style.backgroundSize = 'cover';
            av.textContent = '';
        }
    }
});

window.saveProfile = function() {
    const name = $('profile-name').value.trim();
    const bio = $('profile-bio').value.trim();
    const age = $('profile-age').value.trim();
    if (!name) { showToast('لطفاً نام خود را وارد کنید', '⚠️'); return; }
    STATE.myName = name;
    STATE.myBio = bio;
    STATE.myAge = age;
    STATE.myEmail = STATE.pendingIdentifier || '';
    STATE.myColor = randomColor();
    localStorage.setItem('pm_username', STATE.myName);
    localStorage.setItem('pm_bio', STATE.myBio);
    localStorage.setItem('pm_age', STATE.myAge);
    localStorage.setItem('pm_email', STATE.myEmail);
    localStorage.setItem('pm_color', STATE.myColor);
    if (STATE.myAvatar) localStorage.setItem('pm_avatar', STATE.myAvatar);
    STATE.isLoggedIn = true;
    profileModal.classList.add('hidden');
    showToast(`خوش آمدید ${STATE.myName}`, '👋');
    initApp();
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

// ============================================
//  RENDER MESSAGES
// ============================================
function renderMessages() {
    let filtered = STATE.messages;
    if (STATE.privateChatWith) {
        filtered = STATE.messages.filter(m =>
            (m.sender_id === STATE.privateChatWith && m.recipient_id === STATE.myId) ||
            (m.sender_id === STATE.myId && m.recipient_id === STATE.privateChatWith) ||
            (m.is_private && m.sender_id === STATE.privateChatWith) ||
            (m.is_private && m.recipient_id === STATE.privateChatWith)
        );
        if (filtered.length === 0) {
            chatEl.innerHTML =
                `<div style="text-align:center;color:var(--text-muted);margin-top:80px;font-size:15px;"><div style="font-size:56px;margin-bottom:16px;">🔒</div><div style="font-weight:600;font-size:18px;">چت خصوصی</div><div style="font-size:13px;margin-top:6px;">هنوز پیامی ارسال نشده</div></div>`;
            return;
        }
    } else {
        filtered = STATE.messages.filter(m => !m.is_private || m.sender_id === STATE.myId);
    }
    if (filtered.length === 0) {
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
    chatEl.innerHTML = html;
    if (nearBottom || filtered.length === 0) scrollToBottom();
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
        if (msg.message) content += `<span class="bubble-text">${escapeHtml(msg.message)}</span>`;
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
    const levelBadge = msg.level ? `<span class="level-badge" style="background:${msg.level.color};color:#000;padding:0 8px;border-radius:10px;font-size:9px;font-weight:700;">${msg.level.name}</span>` : '';

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
                ${levelBadge}
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

    const msg = {
        message: text || '',
        reply_to: STATE.replyTarget ? STATE.replyTarget.id : null,
        is_private: !!STATE.privateChatWith,
        recipient_id: STATE.privateChatWith || null,
        media: null,
        sticker: null,
    };

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        fetch('/api/upload-file', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.url) {
                    msg.media = { type: data.type, url: data.url, name: data.name, size: data.size };
                    sendToSocket(msg);
                    fileInput.value = '';
                }
            });
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
    } else {
        showToast('ارسال نشد! اتصال برقرار نیست', '❌');
    }
}

fileInput.addEventListener('change', function() {
    if (this.files.length > 0) sendMessage();
});

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

// رفع باگ حذف برای همه
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
    if (STATE.ctxTarget) { showToast('به زودی اضافه می‌شود', '↗️');
        ctxMenu.classList.add('hidden'); }
};

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

window.startPrivateChat = function() {
    if (STATE._popupUserId) {
        STATE.privateChatWith = STATE._popupUserId;
        closeUserPopup();
        showToast(`💬 چت با ${STATE._popupUsername || 'کاربر'}`, '💬');
        headerTitle.textContent = `💬 ${STATE._popupUsername || 'کاربر'}`;
        renderMessages();
        if (!document.querySelector('.back-btn')) {
            const backBtn = document.createElement('button');
            backBtn.className = 'hdr-btn back-btn';
            backBtn.textContent = '←';
            backBtn.title = 'بازگشت به گروه';
            backBtn.style.fontSize = '20px';
            backBtn.onclick = function() {
                STATE.privateChatWith = null;
                headerTitle.textContent = 'Persia Messenger';
                this.remove();
                renderMessages();
            };
            document.querySelector('.header-actions').prepend(backBtn);
        }
    }
};

// ============================================
//  MY PROFILE - رفع باگ باز نشدن
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
            const av = $('my-profile-avatar');
            av.style.backgroundImage = `url('${data.url}')`;
            av.style.backgroundSize = 'cover';
            av.textContent = '';
            if (STATE.socket) {
                STATE.socket.emit('user_join', {
                    username: STATE.myName,
                    avatar_color: STATE.myColor,
                    avatar_url: data.url,
                    bio: STATE.myBio,
                    age: STATE.myAge,
                    email: STATE.myEmail
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
            const av = $('edit-profile-avatar');
            av.style.backgroundImage = `url('${data.url}')`;
            av.style.backgroundSize = 'cover';
            av.textContent = '';
            showToast('✅ عکس پروفایل به‌روز شد', '📸');
        }
    }
    this.value = '';
});

// رفع باگ ویرایش پروفایل
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
    if (STATE.socket) {
        STATE.socket.emit('user_join', {
            username: STATE.myName,
            avatar_color: STATE.myColor,
            avatar_url: STATE.myAvatar,
            bio: STATE.myBio,
            age: STATE.myAge,
            email: STATE.myEmail
        });
    }
    updateHeader();
    closeEditProfile();
    showToast('پروفایل به‌روز شد', '✅');
    renderMessages();
};

// ============================================
//  CHAT LIST
// ============================================
window.openChatList = function() {
    $('chat-list-modal').classList.remove('hidden');
    updateContacts();
};

window.closeChatList = function() { $('chat-list-modal').classList.add('hidden'); };

function updateContacts() {
    const container = $('contacts-list');
    const contactMap = new Map();
    STATE.messages.forEach(m => {
        if (m.sender_id !== STATE.myId && !m.is_private) {
            contactMap.set(m.sender_id, {
                id: m.sender_id,
                username: m.username,
                avatar_color: m.avatar_color,
                avatar_url: m.avatar_url,
                lastMessage: m.message,
                lastTime: m.created_at,
                bio: m.bio,
                age: m.age,
                level: m.level || { name: '🌱 جدید', color: '#90EE90' }
            });
        }
        if (m.is_private && m.sender_id !== STATE.myId) {
            contactMap.set(m.sender_id, {
                id: m.sender_id,
                username: m.username,
                avatar_color: m.avatar_color,
                avatar_url: m.avatar_url,
                lastMessage: m.message,
                lastTime: m.created_at,
                bio: m.bio,
                age: m.age,
                level: m.level || { name: '🌱 جدید', color: '#90EE90' }
            });
        }
    });
    if (contactMap.size === 0) {
        container.innerHTML =
            `<div style="text-align:center;color:var(--text-muted);padding:30px;"><div style="font-size:40px;margin-bottom:10px;">👥</div><div>هنوز با کسی چت نکرده‌اید</div><div style="font-size:12px;margin-top:4px;">برای شروع، روی آواتار کاربران کلیک کنید</div></div>`;
        return;
    }
    const sorted = Array.from(contactMap.values()).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    container.innerHTML = sorted.map(contact => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--radius);background:var(--bg-input);border:1px solid var(--border);margin-bottom:6px;cursor:pointer;transition:var(--transition);"
             onmouseover="this.style.background='var(--bg-tertiary)'" 
             onmouseout="this.style.background='var(--bg-input)'"
             onclick="startChatWith('${contact.id}')">
            <div style="position:relative;">
                <div style="width:44px;height:44px;border-radius:50%;background:${contact.avatar_color || '#c4956a'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;flex-shrink:0;${contact.avatar_url ? `background-image:url('${contact.avatar_url}');background-size:cover;` : ''}">
                    ${contact.avatar_url ? '' : avatarLetter(contact.username)}
                </div>
                <span style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#6B8F71;border-radius:50%;border:2px solid var(--bg-input);"></span>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-weight:600;font-size:14px;">${escapeHtml(contact.username)}</div>
                    <span style="font-size:10px;color:var(--text-muted);">${formatTime(contact.lastTime)}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;gap:6px;align-items:center;">
                    <span style="font-size:9px;background:${contact.level.color};color:#000;padding:0 8px;border-radius:10px;font-weight:700;">${contact.level.name}</span>
                    ${contact.lastMessage ? truncate(contact.lastMessage, 30) : '...'}
                </div>
            </div>
        </div>
    `).join('');
}

window.startChatWith = function(userId) {
    STATE.privateChatWith = userId;
    const user = STATE.messages.find(m => m.sender_id === userId);
    if (user) headerTitle.textContent = `💬 ${user.username || 'کاربر'}`;
    closeChatList();
    renderMessages();
    showToast(`💬 چت خصوصی شروع شد`, '💬');
};

window.filterContacts = function(query) {
    const items = document.querySelectorAll('#contacts-list > div');
    items.forEach(item => {
        const name = item.querySelector('[style*="font-weight:600"]')?.textContent || '';
        item.style.display = name.toLowerCase().includes(query.toLowerCase()) ? 'flex' : 'none';
    });
};

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
    a.download = `chat_export_${new Date().toISOString().slice(0,10)}.txt`;
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

$('verify-code').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') verifyCode();
});
$('login-identifier').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') requestCode();
});

// ============================================
//  SCROLL TO TOP
// ============================================
window.scrollToTop = function() { chatEl.scrollTop = 0; };

// ============================================
//  INIT
// ============================================
function initApp() {
    updateHeader();
    if (STATE.myName) {
        STATE.isLoggedIn = true;
        loginModal.classList.add('hidden');
        verifyModal.classList.add('hidden');
        profileModal.classList.add('hidden');
        updateHeader();
        showToast(`خوش آمدید ${STATE.myName}`, '👋', 2000);
        connectSocket();
    } else {
        loginModal.classList.remove('hidden');
    }
    headerStatus.innerHTML = `<span class="dot"></span><span>آنلاین</span>`;
    console.log('🚀 Persia Messenger v5.0 - نسخه نهایی');
    console.log('👤 کاربر:', STATE.myName || '未登录');
    console.log('🆔 شناسه:', STATE.myId);
    console.log('🎨 تم:', STATE.theme);
}

// ── Start ──
document.documentElement.style.setProperty('--font-family', "'Inter', -apple-system, sans-serif");
initApp();

console.log('✨ Persia Messenger - نسخه کامل با همه امکانات');
console.log('📱 برای تبدیل به APK: npm run build:pwa');
console.log('📱 برای تبدیل با Capacitor: npm run build:android');
