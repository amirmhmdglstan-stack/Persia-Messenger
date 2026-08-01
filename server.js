const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

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
let users = {};
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
    const lastMsg = messages.filter(m => m.sender_id === socketId).pop();
    if (lastMsg && lastMsg.message === msg && !msg.sticker && !msg.media) return true;
    if (spamLog[socketId].length >= SPAM_LIMIT) return true;
    spamLog[socketId].push(now);
    return false;
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
//  Socket.io
// ============================================
io.on('connection', (socket) => {
    console.log('🟢 متصل:', socket.id);
    socket.emit('load_messages', messages);

    socket.on('user_join', (userData) => {
        users[socket.id] = { id: socket.id, ...userData, joinTime: Date.now(), messageCount: 0 };
        io.emit('user_joined', { id: socket.id, ...userData });
        io.emit('online_count', Object.keys(users).length);
        io.emit('users_list', Object.values(users).map(u => ({
            id: u.id, username: u.username, avatar_color: u.avatar_color,
            avatar_url: u.avatar_url, bio: u.bio, age: u.age,
            level: getLevel(u.messageCount || 0)
        })));
        console.log(`👤 ${userData.username} وارد شد`);
    });

    socket.on('send_message', (msg) => {
        if (isSpam(socket.id, msg.message)) {
            socket.emit('spam_warning', '⚠️ لطفاً سرعت ارسال را کاهش دهید');
            return;
        }
        if (users[socket.id]) users[socket.id].messageCount = (users[socket.id].messageCount || 0) + 1;

        const newMsg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            sender_id: socket.id,
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
            io.to(newMsg.recipient_id).emit('new_message', newMsg);
            socket.emit('new_message', newMsg);
        } else {
            io.emit('new_message', newMsg);
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

    // ویرایش پیام
    socket.on('edit_message', ({ msgId, text }) => {
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.sender_id === socket.id && !msg.deleted) {
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

    // حذف برای همه - رفع باگ
    socket.on('delete_for_all', (msgId) => {
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.sender_id === socket.id) {
            msg.deleted = true;
            io.emit('message_updated', msg);
            socket.emit('delete_confirmed', msgId);
        }
    });

    // پاک کردن تاریخچه خود
    socket.on('clear_my_messages', () => {
        messages.forEach(m => { if (m.sender_id === socket.id) m.deleted = true; });
        io.emit('messages_cleared', socket.id);
        socket.emit('clear_confirmed');
    });

    // تایپینگ
    socket.on('typing', (data) => {
        socket.broadcast.emit('user_typing', {
            userId: socket.id,
            username: users[socket.id]?.username || 'کاربر',
            isTyping: data.isTyping
        });
    });

    socket.on('disconnect', () => {
        console.log('🔴 قطع:', socket.id);
        delete users[socket.id];
        delete spamLog[socket.id];
        io.emit('online_count', Object.keys(users).length);
        io.emit('user_left', socket.id);
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
//  PWA و تبدیل به APK
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
