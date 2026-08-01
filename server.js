require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');

// ============================================
//  Supabase (auth + contacts + profiles)
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mnoqsdglcvpameknmbnh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ub3FzZGdsY3ZwYW1la25tYm5oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTYwNDkxNiwiZXhwIjoyMTAxMTgwOTE2fQ.bHx15IzZVU3O5oTqQWrl4VL0XOlHulGF-9ven085mjM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
//  آپلود فایل
// ============================================
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        cb(null, unique + '_' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/', 'video/', 'audio/', 'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument',
            'application/zip', 'application/x-zip-compressed'];
        const ok = allowed.some(type => file.mimetype.startsWith(type) || file.mimetype.includes(type));
        cb(null, ok);
    }
});

// ============================================
//  حافظه
// ============================================
let messages = [];
let users = {};        // socketId -> user (id = supabase uid)
let uidSocket = {};    // uid -> socketId (for private routing)
let spamLog = {};
const MAX_MESSAGES = 1000;
const SPAM_LIMIT = 5;
const SPAM_WINDOW = 10000;

// ============================================
//  توابع کمکی
// ============================================
function getLevel(count) {
    if (count >= 1000) return { name: '👑 افسانه', color: '#FFD700' };
    if (count >= 500) return { name: '⭐ پرحرف', color: '#C0C0C0' };
    if (count >= 200) return { name: '💬 فعال', color: '#CD7F32' };
    if (count >= 50) return { name: '📝 تازه کار', color: '#87CEEB' };
    return { name: '🌱 جدید', color: '#90EE90' };
}

function isSpam(socketId, msg) {
    const now = Date.now();
    if (!spamLog[socketId]) spamLog[socketId] = [];
    spamLog[socketId] = spamLog[socketId].filter(t => now - t < SPAM_WINDOW);
    const lastMsg = messages.filter(m => m.sender_id === users[socketId]?.id).pop();
    if (lastMsg && lastMsg.message === msg && !msg.sticker && !msg.media) return true;
    if (spamLog[socketId].length >= SPAM_LIMIT) return true;
    spamLog[socketId].push(now);
    return false;
}

async function getProfile(uid) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&id=eq.${uid}`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
    });
    if (!res.ok) return null;
    const arr = await res.json().catch(() => []);
    return arr && arr[0] ? arr[0] : null;
}

async function upsertContact(ownerId, contact) {
    const body = {
        owner_id: ownerId,
        contact_id: contact.contact_id,
        username: contact.username,
        avatar_color: contact.avatar_color,
        avatar_url: contact.avatar_url || null,
        last_message: contact.last_message,
        last_time: new Date().toISOString()
    };
    // Direct REST call with service_role so RLS is reliably bypassed.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?on_conflict=owner_id,contact_id`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('⚠️ upsertContact error owner=' + ownerId + ' contact=' + contact.contact_id, res.status, txt);
    }
}

async function getContacts(ownerId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?select=*&owner_id=eq.${ownerId}&order=last_time.desc`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
    });
    if (!res.ok) return [];
    const arr = await res.json().catch(() => []);
    return arr || [];
}

async function notifyContacts(socket, ownerId) {
    const list = await getContacts(ownerId);
    socket.emit('contacts_update', list);
}

// ============================================
//  ChatBot
// ============================================
function getBotResponse(msg, username) {
    const lower = msg.toLowerCase();

    if (lower.includes('سلام') || lower.includes('hi') || lower.includes('hello')) {
        return `👋 سلام ${username}! خوش آمدید. من راهنمای شما هستم.`;
    }
    if (lower.includes('چطوری') || lower.includes('حالت')) {
        return `😊 ممنون ${username}! من رباتم و همیشه آماده کمک هستم.`;
    }
    if (lower.includes('خداحافظ') || lower.includes('bye')) {
        return `👋 خداحافظ ${username}! روز خوبی داشته باشید.`;
    }
    if (lower.includes('راهنما') || lower.includes('help') || lower.includes('کمک')) {
        return `📖 **راهنمای کامل**:
✅ ارسال متن، ایموجی، استیکر، عکس، فیلم، فایل
✅ چت خصوصی با کلیک روی آواتار
✅ ویرایش پیام با دوبار کلیک
✅ حذف برای من/همه
✅ واکنش دلخواه
✅ جستجو در پیام‌ها
✅ ۶ تم رنگی
✅ خروجی چت TXT
✅ پاک کردن تاریخچه`;
    }
    if (lower.includes('چت خصوصی')) {
        return `🔒 **چت خصوصی**:
1️⃣ روی آواتار کاربر کلیک کنید
2️⃣ روی "چت خصوصی" کلیک کنید
3️⃣ برای بازگشت روی ← کلیک کنید`;
    }
    if (lower.includes('تنظیمات') || lower.includes('تم')) {
        return `🎨 **تنظیمات**:
6 تم: 🌙 تیره | ☀️ روشن | 🍫 شکلاتی | ☕ قهوه‌ای | 🌿 سبز | 💜 یاسی`;
    }
    if (lower.includes('لطیفه') || lower.includes('جوک')) {
        const jokes = [
            "😂 چرا برنامه‌نویس‌ها خسته‌اند؟ چون باگ می‌گیرند!",
            "😄 تفاوت برنامه‌نویس و پزشک؟ پزشک می‌گوید: بیمار رو بیارید، برنامه‌نویس می‌گوید: باگ رو بیارید",
            "🤣 چرا برنامه‌نویس‌ها از طبیعت بدشان می‌آید؟ چون درخت‌ها exception پرتاب می‌کنند!"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }
    return null;
}

// ============================================
//  Auth Routes
// ============================================
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, username, bio, age } = req.body;
        if (!email || !password || password.length < 6) {
            return res.status(400).json({ error: 'ایمیل و رمز (حداقل ۶ کاراکتر) لازم است' });
        }
        // create user (auto-confirmed so it works without email confirmation)
        const { data: u, error: ue } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true
        });
        if (ue) {
            if (ue.message && ue.message.toLowerCase().includes('already')) {
                return res.status(409).json({ error: 'این حساب قبلاً ساخته شده است. لطفاً ورود کنید.' });
            }
            return res.status(400).json({ error: ue.message || 'خطا در ساخت حساب' });
        }
        const uid = u.user.id;
        await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
                'Content-Type': 'application/json', 'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                id: uid, username: username || 'کاربر', bio: bio || '',
                age: age || '', avatar_color: '#c4956a', email
            })
        });
        // sign them in to get a token
        const { data: s, error: se } = await supabase.auth.signInWithPassword({ email, password });
        if (se || !s.session) return res.status(400).json({ error: 'خطا در ورود خودکار' });
        return res.json({ uid, token: s.session.access_token, email });
    } catch (e) {
        return res.status(500).json({ error: 'خطای سرور' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'ایمیل و رمز لازم است' });
        const { data: s, error: se } = await supabase.auth.signInWithPassword({ email, password });
        if (se || !s.session) {
            return res.status(401).json({ error: 'ایمیل یا رمز نادرست است' });
        }
        const uid = s.user.id;
        const profile = await getProfile(uid);
        return res.json({
            uid, token: s.session.access_token, email,
            profile: profile || {}
        });
    } catch (e) {
        return res.status(500).json({ error: 'خطای سرور' });
    }
});

// update profile (name/bio/age/avatar)
app.post('/api/profile', async (req, res) => {
    try {
        const token = req.body.token || (req.headers.authorization || '').replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'بدون توکن' });
        const { data: u, error: ue } = await supabase.auth.getUser(token);
        if (ue || !u.user) return res.status(401).json({ error: 'توکن نامعتبر' });
        const uid = u.user.id;
        const patch = {};
        if (req.body.username !== undefined) patch.username = req.body.username;
        if (req.body.bio !== undefined) patch.bio = req.body.bio;
        if (req.body.age !== undefined) patch.age = req.body.age;
        if (req.body.avatar_color !== undefined) patch.avatar_color = req.body.avatar_color;
        if (req.body.avatar_url !== undefined) patch.avatar_url = req.body.avatar_url;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
                'Content-Type': 'application/json', 'Prefer': 'return=minimal'
            },
            body: JSON.stringify(patch)
        });
        if (!r.ok) return res.status(500).json({ error: 'خطا در به‌روزرسانی پروفایل' });
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: 'خطای سرور' });
    }
});

// ============================================
//  Socket.io
// ============================================
io.on('connection', (socket) => {
    console.log('🟢 متصل:', socket.id);

    socket.on('user_join', async (userData) => {
        // Validate token -> uid (stable identity)
        const token = userData.token;
        if (!token) { socket.emit('auth_error', 'بدون توکن'); return; }
        const { data: u, error: ue } = await supabase.auth.getUser(token);
        if (ue || !u.user) { socket.emit('auth_error', 'توکن نامعتبر'); return; }
        const uid = u.user.id;

        users[socket.id] = {
            id: uid,
            username: userData.username || 'کاربر',
            avatar_color: userData.avatar_color || '#c4956a',
            avatar_url: userData.avatar_url || null,
            bio: userData.bio || '',
            age: userData.age || '',
            email: userData.email || '',
            joinTime: Date.now(),
            messageCount: 0
        };
        uidSocket[uid] = socket.id;

        io.emit('user_joined', { id: uid, username: users[socket.id].username });
        io.emit('online_count', Object.keys(users).length);
        io.emit('users_list', Object.values(users).map(u => ({
            id: u.id, username: u.username, avatar_color: u.avatar_color,
            avatar_url: u.avatar_url, bio: u.bio, age: u.age,
            level: getLevel(u.messageCount || 0)
        })));

        // Load this user's contacts from DB (persistent)
        notifyContacts(socket, uid);

        // Also: catch up from current in-memory chat so freshly-online users
        // get contacts for people currently talking (persist + add).
        const seen = {};
        for (const m of messages) {
            const snd = m.sender_id;
            if (!snd || snd === uid) continue;
            const relevant = !m.is_private || (m.recipient_id === uid);
            if (!relevant) continue;
            if (seen[snd]) continue;
            seen[snd] = true;
            await upsertContact(uid, {
                contact_id: snd,
                username: m.username || 'کاربر',
                avatar_color: m.avatar_color || '#c4956a',
                avatar_url: m.avatar_url || null,
                last_message: m.message || (m.sticker || '📎 فایل')
            });
        }
        if (Object.keys(seen).length) notifyContacts(socket, uid);

        console.log(`👤 ${users[socket.id].username} وارد شد`);
    });

    socket.on('send_message', async (msg) => {
        const uid = users[socket.id]?.id;
        if (!uid) return;
        if (isSpam(socket.id, msg.message)) {
            socket.emit('spam_warning', '⚠️ لطفاً سرعت ارسال را کاهش دهید');
            return;
        }
        if (users[socket.id]) users[socket.id].messageCount = (users[socket.id].messageCount || 0) + 1;

        const newMsg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            sender_id: uid,
            username: users[socket.id]?.username || 'کاربر',
            avatar_color: users[socket.id]?.avatar_color || '#c4956a',
            avatar_url: users[socket.id]?.avatar_url || null,
            message: msg.message || '',
            sticker: msg.sticker || null,
            media: msg.media || null,
            reply_to: msg.reply_to || null,
            is_private: msg.is_private || false,
            recipient_id: msg.recipient_id || null,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            edited: false,
            deleted: false,
            reactions: [],
            level: getLevel(users[socket.id]?.messageCount || 0)
        };

        messages.push(newMsg);
        if (messages.length > MAX_MESSAGES) messages.shift();

        if (newMsg.is_private && newMsg.recipient_id) {
            // deliver to recipient (by uid) if online
            const rcptSocket = uidSocket[newMsg.recipient_id];
            if (rcptSocket) io.to(rcptSocket).emit('new_message', newMsg);
            socket.emit('new_message', newMsg);

            // contacts: both sides add each other
            // recipient's contact = sender (owner: recipient)
            await upsertContact(newMsg.recipient_id, {
                contact_id: uid,
                username: newMsg.username,
                avatar_color: newMsg.avatar_color,
                avatar_url: newMsg.avatar_url,
                last_message: newMsg.message || (newMsg.sticker || '📎 فایل')
            });
            if (rcptSocket) io.to(rcptSocket).emit('contact_added', {
                contact_id: uid, username: newMsg.username, avatar_color: newMsg.avatar_color,
                avatar_url: newMsg.avatar_url, last_message: newMsg.message || (newMsg.sticker || '📎 فایل')
            });
            // sender's contact = recipient (owner: sender)
            const rcpt = await getProfile(newMsg.recipient_id);
            const rcptContact = {
                contact_id: newMsg.recipient_id,
                username: rcpt?.username || 'کاربر',
                avatar_color: rcpt?.avatar_color || '#c4956a',
                avatar_url: rcpt?.avatar_url || null,
                last_message: newMsg.message || (newMsg.sticker || '📎 فایل')
            };
            await upsertContact(uid, rcptContact);
            socket.emit('contact_added', rcptContact);
        } else {
            io.emit('new_message', newMsg);

            // add sender to every online user's contacts (persist)
            for (const sk in users) {
                if (users[sk].id === uid) continue;
                const ownerId = users[sk].id;
                await upsertContact(ownerId, {
                    contact_id: uid,
                    username: newMsg.username,
                    avatar_color: newMsg.avatar_color,
                    avatar_url: newMsg.avatar_url,
                    last_message: newMsg.message || (newMsg.sticker || '📎 فایل')
                });
                io.to(sk).emit('contact_added', {
                    contact_id: uid, username: newMsg.username, avatar_color: newMsg.avatar_color,
                    avatar_url: newMsg.avatar_url, last_message: newMsg.message || (newMsg.sticker || '📎 فایل')
                });
            }

            const botReply = getBotResponse(msg.message, users[socket.id]?.username || 'کاربر');
            if (botReply) {
                setTimeout(() => {
                    io.emit('new_message', {
                        id: 'bot_' + Date.now(),
                        sender_id: 'bot',
                        username: '🤖 راهنما',
                        avatar_color: '#7aa88a',
                        message: botReply,
                        timestamp: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        edited: false,
                        deleted: false,
                        reactions: [],
                        is_private: false,
                        level: { name: '⭐ ویژه', color: '#FFD700' }
                    });
                }, 800 + Math.random() * 1200);
            }
        }
    });

    socket.on('get_contacts', async () => {
        const uid = users[socket.id]?.id;
        if (uid) notifyContacts(socket, uid);
    });

    // ویرایش پیام
    socket.on('edit_message', ({ msgId, text }) => {
        const uid = users[socket.id]?.id;
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.sender_id === uid && !msg.deleted) {
            msg.message = text;
            msg.edited = true;
            io.emit('message_updated', msg);
        }
    });

    // واکنش
    socket.on('add_reaction', ({ msgId, emoji }) => {
        const msg = messages.find(m => m.id === msgId);
        if (msg && !msg.deleted) {
            if (!msg.reactions) msg.reactions = [];
            const idx = msg.reactions.indexOf(emoji);
            if (idx > -1) msg.reactions.splice(idx, 1);
            else msg.reactions.push(emoji);
            io.emit('message_updated', msg);
        }
    });

    // حذف برای همه
    socket.on('delete_for_all', (msgId) => {
        const uid = users[socket.id]?.id;
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.sender_id === uid) {
            msg.deleted = true;
            io.emit('message_updated', msg);
            socket.emit('delete_confirmed', msgId);
        }
    });

    // پاک کردن تاریخچه خود
    socket.on('clear_my_messages', () => {
        const uid = users[socket.id]?.id;
        messages.forEach(m => { if (m.sender_id === uid) m.deleted = true; });
        io.emit('messages_cleared', uid);
        socket.emit('clear_confirmed');
    });

    // تایپینگ
    socket.on('typing', (data) => {
        socket.broadcast.emit('user_typing', {
            userId: users[socket.id]?.id,
            username: users[socket.id]?.username || 'کاربر',
            isTyping: data.isTyping
        });
    });

    socket.on('disconnect', () => {
        console.log('🔴 قطع:', socket.id);
        const uid = users[socket.id]?.id;
        delete users[socket.id];
        if (uid && uidSocket[uid] === socket.id) delete uidSocket[uid];
        delete spamLog[socket.id];
        io.emit('online_count', Object.keys(users).length);
        if (uid) io.emit('user_left', uid);
    });
});

// ============================================
//  API Routes
// ============================================
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'فایلی انتخاب نشده' });
    res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'فایلی انتخاب نشده' });
    let type = 'file';
    if (req.file.mimetype.startsWith('image/')) type = 'image';
    else if (req.file.mimetype.startsWith('video/')) type = 'video';
    else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
    res.json({
        url: `/uploads/${req.file.filename}`,
        type,
        name: req.file.originalname,
        size: (req.file.size / 1024).toFixed(1) + ' KB'
    });
});

app.get('/api/users', (req, res) => {
    res.json(Object.values(users).map(u => ({
        id: u.id, username: u.username, avatar_color: u.avatar_color,
        avatar_url: u.avatar_url, bio: u.bio, age: u.age,
        level: getLevel(u.messageCount || 0)
    })));
});

// ============================================
//  PWA
// ============================================
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📱 برای تبدیل به APK: npm run build:pwa`);
});
