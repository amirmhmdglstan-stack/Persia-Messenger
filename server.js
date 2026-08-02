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
const ai = require('./ai');

// ============================================
//  Supabase (auth + contacts + profiles)
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mnoqsdglcvpameknmbnh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ub3FzZGdsY3ZwYW1la25tYm5oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTYwNDkxNiwiZXhwIjoyMTAxMTgwOTE2fQ.bHx15IzZVU3O5oTqQWrl4VL0XOlHulGF-9ven085mjM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
});

// ============================================
//  Special contacts (AI همیار + Saved Messages)
// ============================================
const HAMYAR_ID = '00000000-0000-0000-0000-0000000000a1'; // همیار (AI)
const SAVED_ID  = '00000000-0000-0000-0000-0000000000a2'; // پیام‌های ذخیره‌شده
const VID_ID    = '00000000-0000-0000-0000-0000000000a3'; // دانلودر ویدیو (yt-dlp)
const FILES_ID  = '00000000-0000-0000-0000-0000000000a4'; // فایل‌های ذخیره‌شده (local)
const HAMYAR_ALIASES = ['همیار', 'کا.جی', 'کا جی', 'کجی', 'kg', 'k.g', 'hamyar'];

// ---- Groups (in-memory + Supabase metadata fallback) ----
let groups = {};          // groupId -> {id, title, avatar_color, avatar_url, info, created_by, members:[]}
let groupMsgStore = {};   // groupId -> [messages] (ephemeral, reset on restart)

function newGroupId(){ return 'grp_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

async function persistGroup(g){
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/groups`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer '+SUPABASE_SERVICE_ROLE_KEY,
                       'Content-Type':'application/json','Prefer':'return=minimal' },
            body: JSON.stringify({ id:g.id, title:g.title, avatar_color:g.avatar_color||'#7a8ac4',
                                   avatar_url:g.avatar_url||null, info:g.info||'', created_by:g.created_by })
        }).catch(()=>{});
        for(const uid of g.members){
            await fetch(`${SUPABASE_URL}/rest/v1/group_members`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer '+SUPABASE_SERVICE_ROLE_KEY,
                           'Content-Type':'application/json','Prefer':'resolution=merge-duplicates' },
                body: JSON.stringify({ group_id:g.id, user_id:uid })
            }).catch(()=>{});
        }
    } catch(e){}
}

async function loadGroupsFor(uid){
    // Return group summaries the user is a member of.
    const mine = Object.values(groups).filter(g => g.members.includes(uid));
    // try to load from DB too (fallback)
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/group_members?select=group_id&user_id=eq.${uid}`, {
            headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer '+SUPABASE_SERVICE_ROLE_KEY }
        });
        const rows = await r.json().catch(()=>[]);
        if(Array.isArray(rows)){
            for(const row of rows){
                if(!groups[row.group_id]){
                    const gr = await fetch(`${SUPABASE_URL}/rest/v1/groups?select=*&id=eq.${row.group_id}`, {
                        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer '+SUPABASE_SERVICE_ROLE_KEY }
                    }).then(r=>r.json()).catch(()=>[]);
                    if(Array.isArray(gr) && gr[0]){
                        const g = gr[0];
                        groups[g.id] = { id:g.id, title:g.title, avatar_color:g.avatar_color, avatar_url:g.avatar_url,
                                         info:g.info, created_by:g.created_by, members:[uid] };
                    }
                }
            }
        }
    } catch(e){}
    return Object.values(groups).filter(g => g.members.includes(uid));
}

// ---- Video downloader (yt-dlp optional + direct links) ----
// yt-dlp path: default to ./yt-dlp (installed in project root, which is
// writable on Render). Override via env var YTDLP_PATH if needed.
const YTDLP_PATH = process.env.YTDLP_PATH || './yt-dlp';
let vidState = {}; // uid -> {awaitingQuality, url, formats}

function isDirectMediaLink(url){
    return /\.(mp4|m4v|mov|mkv|webm|avi|mp3|m4a|aac|wav|flac|ogg|jpg|jpeg|png|gif|webp|pdf)$/i.test(url);
}

async function handleVideoRequest(uid, socket, newMsg){
    const text = (newMsg.message || '').trim();
    const st = vidState[uid];
    const urls = extractUrls(text);

    // quality selection stage
    if (st && st.awaitingQuality && !urls.length && /^\d|^\d+\.|^\d+\)|کیفیت|quality/i.test(text)) {
        const choice = parseInt(text.match(/\d+/));
        const fmt = st.formats && st.formats[choice-1];
        delete vidState[uid];
        if (!fmt) {
            reply(socket, uid, '❌ انتخاب نامعتبر بود. لینک را دوباره بفرستید.');
            return;
        }
        const dest = path.join(uploadDir, 'dl_' + Date.now() + '_' + (fmt.ext||'mp4'));
        const ok = await downloadYtdlp(st.url, fmt.format_id, dest);
        if (ok) {
            reply(socket, uid, '🎬 در حال ارسال: ' + (fmt.format_note || fmt.format_id || 'ویدیو'), true);
            sendMedia(socket, uid, dest, 'video', fmt.ext||'mp4');
        } else {
            reply(socket, uid, '❌ دانلود ناموفق بود (ممکن است سرور yt-dlp نداشته باشد یا سرویس لینک را مسدود کند).');
        }
        return;
    }

    // a URL was provided
    if (urls.length) {
        const url = urls[0];
        // Direct media link -> fetch & serve (works without yt-dlp)
        if (isDirectMediaLink(url)) {
            try {
                const res = await fetch(url);
                if (!res.ok) { reply(socket, uid, '❌ دانلود مستقیم ناموفق بود (کد ' + res.status + ')'); return; }
                const blob = await res.arrayBuffer();
                const ext = (url.match(/\.([a-z0-9]+)(\?.*)?$/i) || [,'bin'])[1];
                const name = 'dl_' + Date.now() + '.' + ext;
                const dest = path.join(uploadDir, name);
                fs.writeFileSync(dest, Buffer.from(blob));
                const mime = res.headers.get('content-type') || '';
                sendMedia(socket, uid, dest, mime.startsWith('video')?'video':(mime.startsWith('image')?'image':(mime.startsWith('audio')?'audio':'file')), ext);
            } catch(e){ reply(socket, uid, '❌ دانلود مستقیم ناموفق بود.'); }
            return;
        }
        // yt-dlp path
        const j = await runYtdlpJson(url);
        if (!j) {
            reply(socket, uid, '🎬 این لینک نیاز به yt-dlp دارد. اگر سرور آن را نصب دارد لینک را دوباره بفرستید؛ در غیر این صورت لینک مستقیم فایل (.mp4 و...) بفرستید.');
            return;
        }
        const formats = (j.formats || []).filter(f => f.format_id && (f.height || f.format_note || f.ext)).slice(0, 8);
        if (!formats.length) {
            reply(socket, uid, '🎬 کیفیتی یافت نشد.');
            return;
        }
        vidState[uid] = { awaitingQuality: true, url, formats };
        const lines = formats.map((f,i) => (i+1) + ') ' + (f.format_note || f.format_id) + (f.height ? ' - ' + f.height + 'p' : '') + (f.ext?'.'+f.ext:'')).join('\n');
        reply(socket, uid, '🎬 لینک دریافت شد. کیفیت مورد نظر را انتخاب کنید:\n' + lines + '\n\nعدد را بنویسید.');
        return;
    }
    reply(socket, uid, '🎬 لینک ویدیو (یوتیوب و...) یا لینک مستقیم فایل را بفرستید.');
}

function reply(socket, uid, text, isProgress){
    const m = {
        id: 'vid_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        sender_id: VID_ID,
        username: 'دانلودر ویدیو',
        avatar_color: '#6B8F71',
        message: text,
        media: null,
        is_private: true,
        recipient_id: uid,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        edited:false, deleted:false, reactions:[],
        level: { name:'⭐ ویژه', color:'#FFD700' }
    };
    socket.emit('new_message', m);
}

function sendMedia(socket, uid, filePath, type, ext){
    const url = '/uploads/' + path.basename(filePath);
    const m = {
        id: 'vidm_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        sender_id: VID_ID,
        username: 'دانلودر ویدیو',
        avatar_color: '#6B8F71',
        message: '',
        media: { type, url, name: path.basename(filePath), size: (fs.statSync(filePath).size/1024).toFixed(1)+' KB' },
        is_private: true,
        recipient_id: uid,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        edited:false, deleted:false, reactions:[],
        level: { name:'⭐ ویژه', color:'#FFD700' }
    };
    socket.emit('new_message', m);
}

function extractUrls(text){
    const re = /https?:\/\/[^\s<>"']+/g;
    return (text||'').match(re) || [];
}

function hasYtdlp(){
    return false; // determined lazily per call via execFileSync check
}

function runYtdlpJson(url){
    return new Promise((resolve)=>{
        try {
            const { execFile } = require('child_process');
            execFile(YTDLP_PATH, ['--dump-json','--no-playlist', url], { timeout: 30000 }, (err, stdout, stderr) => {
                if(err || !stdout){ resolve(null); return; }
                try { const j = JSON.parse(stdout.split('\n')[0]); resolve(j); } catch(e){ resolve(null); }
            });
        } catch(e){ resolve(null); }
    });
}

function downloadYtdlp(url, format, dest){
    return new Promise((resolve)=>{
        try {
            const { execFile } = require('child_process');
            execFile(YTDLP_PATH, ['-f', format, '-o', dest, '--no-playlist', '--no-warnings', url], { timeout: 120000 }, (err)=>{
                resolve(!err);
            });
        } catch(e){ resolve(false); }
    });
}

function isHamyarMessage(text) {
    if (!text) return false;
    const t = text.toLowerCase().trim();
    if (t === 'همیار' || t === '@همیار') return true;
    return HAMYAR_ALIASES.some(a => t.includes(a));
}

// ---- Saved messages helpers (Supabase, with in-memory fallback) ----
async function saveSavedMessage(ownerId, msg) {
    const body = {
        owner_id: ownerId,
        sender_name: msg.sender_name || 'کاربر',
        text: msg.text || '',
        media_url: msg.media_url || null,
        media_type: msg.media_type || null,
        sticker: msg.sticker || null,
        created_at: new Date().toISOString()
    };
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/saved_messages`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
                'Content-Type': 'application/json', 'Prefer': 'return=minimal'
            },
            body: JSON.stringify(body)
        });
        if (!r.ok) return { ok: false, status: r.status };
        // keep only last 10
        try {
            const list = await fetch(`${SUPABASE_URL}/rest/v1/saved_messages?select=id&owner_id=eq.${ownerId}&order=created_at.desc&limit=1000`, {
                headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
            }).then(r => r.json()).catch(() => []);
            if (Array.isArray(list) && list.length > 10) {
                const extra = list.slice(10).map(x => x.id);
                await fetch(`${SUPABASE_URL}/rest/v1/saved_messages?id=in.(${extra.join(',')})`, {
                    method: 'DELETE',
                    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
                }).catch(() => {});
            }
        } catch (e) {}
        return { ok: true };
    } catch (e) { return { ok: false }; }
}

async function getSavedMessages(ownerId) {
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/saved_messages?select=*&owner_id=eq.${ownerId}&order=created_at.desc&limit=10`, {
            headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
        });
        if (!r.ok) return { ok: false, status: r.status, data: [] };
        const arr = await r.json().catch(() => []);
        return { ok: true, data: (arr || []).slice(0, 10) };
    } catch (e) { return { ok: false, data: [] }; }
}

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

// ---- Saved Messages (پیام‌های ذخیره‌شده) ----
app.get('/api/saved-messages', async (req, res) => {
    try {
        const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : req.query.token;
        if (!token) return res.status(401).json({ error: 'بدون توکن' });
        const { data: u, error: ue } = await supabase.auth.getUser(token);
        if (ue || !u.user) return res.status(401).json({ error: 'توکن نامعتبر' });
        const r = await getSavedMessages(u.user.id);
        if (!r.ok) return res.json({ ok: false, local: true, data: [] }); // table missing -> client uses localStorage
        return res.json({ ok: true, data: r.data });
    } catch (e) { return res.status(500).json({ error: 'خطای سرور' }); }
});

app.post('/api/saved-messages', async (req, res) => {
    try {
        const token = req.body.token || (req.headers.authorization || '').replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'بدون توکن' });
        const { data: u, error: ue } = await supabase.auth.getUser(token);
        if (ue || !u.user) return res.status(401).json({ error: 'توکن نامعتبر' });
        const m = req.body.message || {};
        const r = await saveSavedMessage(u.user.id, {
            sender_name: m.sender_name || 'کاربر',
            text: m.text || '',
            media_url: m.media_url || null,
            media_type: m.media_type || null,
            sticker: m.sticker || null
        });
        if (!r.ok) return res.json({ ok: false, local: true }); // table missing -> client saves locally
        return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'خطای سرور' }); }
});

// ---- Groups API ----
function authUid(req, res){
    const token = (req.body && req.body.token) || (req.headers.authorization || '').replace('Bearer ', '');
    return token;
}
app.post('/api/groups/create', async (req, res) => {
    try {
        const token = authUid(req, res);
        if (!token) return res.status(401).json({ error: 'بدون توکن' });
        const { data: u, error: ue } = await supabase.auth.getUser(token);
        if (ue || !u.user) return res.status(401).json({ error: 'توکن نامعتبر' });
        const uid = u.user.id;
        const { title, memberIds, info } = req.body || {};
        if (!title || !Array.isArray(memberIds)) return res.status(400).json({ error: 'عنوان و اعضا لازم است' });
        const id = newGroupId();
        const members = [...new Set([uid, ...memberIds])];
        const g = { id, title: String(title).slice(0,50), avatar_color:'#7a8ac4', avatar_url:null, info: info||'', created_by:uid, members };
        groups[id] = g;
        persistGroup(g);
        return res.json({ ok:true, group: { id:g.id, title:g.title, avatar_color:g.avatar_color, info:g.info } });
    } catch (e) { return res.status(500).json({ error: 'خطای سرور' }); }
});

app.get('/api/groups', async (req, res) => {
    try {
        const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ','') : req.query.token;
        if (!token) return res.status(401).json({ error: 'بدون توکن' });
        const { data: u, error: ue } = await supabase.auth.getUser(token);
        if (ue || !u.user) return res.status(401).json({ error: 'توکن نامعتبر' });
        const uid = u.user.id;
        const list = await loadGroupsFor(uid);
        return res.json({ ok:true, groups: list.map(g=>({ id:g.id, title:g.title, avatar_color:g.avatar_color, avatar_url:g.avatar_url, info:g.info, memberCount:g.members.length })) });
    } catch (e) { return res.status(500).json({ error: 'خطای سرور' }); }
});

app.get('/api/group/:id', async (req, res) => {
    try {
        const g = groups[req.params.id];
        if (!g) return res.status(404).json({ error: 'گروه یافت نشد' });
        return res.json({ ok:true, group: { id:g.id, title:g.title, avatar_color:g.avatar_color, avatar_url:g.avatar_url, info:g.info, memberCount:g.members.length, members:g.members } });
    } catch (e) { return res.status(500).json({ error: 'خطای سرور' }); }
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

        // Always ensure special contacts exist for every user
        await upsertContact(uid, { contact_id: HAMYAR_ID, username: 'همیار', avatar_color: '#7a8ac4', avatar_url: null, last_message: '🤖 دستیار هوشمند' });
        await upsertContact(uid, { contact_id: SAVED_ID, username: 'پیام‌های ذخیره‌شده', avatar_color: '#c47a7a', avatar_url: null, last_message: '📌 ۱۰ پیام اخیر' });
        await upsertContact(uid, { contact_id: VID_ID, username: 'دانلودر ویدیو', avatar_color: '#6B8F71', avatar_url: null, last_message: '🎬 لینک ویدیو بفرستید' });
        await upsertContact(uid, { contact_id: FILES_ID, username: 'فایل‌های ذخیره‌شده', avatar_color: '#a890b8', avatar_url: null, last_message: '📁 فایل‌های ذخیره‌شده شما' });

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
            is_group: msg.is_group || false,
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

        // ============================================
        //  Detect AI «همیار» interaction
        // ============================================
        const privateToAI = newMsg.is_private && newMsg.recipient_id === HAMYAR_ID;
        let replyToAI = false;
        if (!privateToAI && !newMsg.is_private) {
            if (isHamyarMessage(newMsg.message)) replyToAI = true;
            else if (newMsg.reply_to) {
                const ref = messages.find(m => m.id === newMsg.reply_to);
                if (ref && ref.sender_id === HAMYAR_ID) replyToAI = true;
            }
        }
        const aiShouldReply = privateToAI || replyToAI;

        // ============================================
        //  Deliver the user's message (private or global)
        // ============================================
        // ---- Group message ----
        if (newMsg.is_group && newMsg.recipient_id && newMsg.recipient_id.startsWith('grp_')) {
            const gid = newMsg.recipient_id;
            if (!groupMsgStore[gid]) groupMsgStore[gid] = [];
            groupMsgStore[gid].push(newMsg);
            if (groupMsgStore[gid].length > 500) groupMsgStore[gid].shift();
            const g = groups[gid];
            if (g) {
                for (const member of g.members) {
                    const ms = uidSocket[member];
                    if (ms) io.to(ms).emit('new_message', newMsg);
                }
            }
            // mark AI-typing false not needed; no further handling
        }

        // ---- Video downloader ----
        else if (newMsg.is_private && newMsg.recipient_id === VID_ID) {
            socket.emit('new_message', newMsg);
            handleVideoRequest(uid, socket, newMsg);
        }

        // ---- Other private ----
        else if (newMsg.is_private && newMsg.recipient_id) {
            const rcptSocket = uidSocket[newMsg.recipient_id];
            if (rcptSocket) io.to(rcptSocket).emit('new_message', newMsg);
            socket.emit('new_message', newMsg);

            // contact bookkeeping (skip for special AI/Saved recipients)
            if (newMsg.recipient_id !== HAMYAR_ID && newMsg.recipient_id !== SAVED_ID && newMsg.recipient_id !== VID_ID && newMsg.recipient_id !== FILES_ID) {
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
            }
        } else {
            io.emit('new_message', newMsg);

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
        }

        // ============================================
        //  AI «همیار» replies (non-blocking so the user's message
        //  is delivered instantly; the reply arrives when ready)
        // ============================================
        if (aiShouldReply) {
            const isPrivate = privateToAI;
            (async () => {
                try {
                    const history = [];
                    if (isPrivate) {
                        for (const m of messages) {
                            const inConvo =
                                (m.sender_id === uid && m.recipient_id === HAMYAR_ID) ||
                                (m.sender_id === HAMYAR_ID && m.recipient_id === uid);
                            if (inConvo) history.push({ role: m.sender_id === uid ? 'user' : 'assistant', content: m.message || '' });
                        }
                    } else {
                        for (const m of messages) {
                            if (!m.is_private && m.sender_id !== 'bot') history.push({ role: m.sender_id === uid ? 'user' : 'assistant', content: m.message || '' });
                        }
                    }
                    const res = await ai.askAI(history.slice(-14));
                    const aiMsg = {
                        id: 'hamyar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                        sender_id: HAMYAR_ID,
                        username: 'همیار',
                        avatar_color: '#7a8ac4',
                        avatar_url: null,
                        message: res.type === 'image' ? '' : res.text,
                        media: res.type === 'image' ? { type: 'image', url: res.url, name: 'Generated Image' } : null,
                        sticker: null,
                        reply_to: null,
                        is_private: isPrivate,
                        recipient_id: isPrivate ? uid : null,
                        timestamp: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        edited: false,
                        deleted: false,
                        reactions: [],
                        level: { name: '⭐ ویژه', color: '#FFD700' }
                    };
                    messages.push(aiMsg);
                    if (messages.length > MAX_MESSAGES) messages.shift();
                    if (isPrivate) {
                        // the AI is the one replying to this same socket — emit once
                        socket.emit('new_message', aiMsg);
                    } else {
                        io.emit('new_message', aiMsg);
                    }
                } catch (e) { console.error('AI reply error:', e && e.message); }
            })();
        }
    });

    socket.on('get_contacts', async () => {
        const uid = users[socket.id]?.id;
        if (uid) notifyContacts(socket, uid);
    });

    socket.on('get_groups', async () => {
        const uid = users[socket.id]?.id;
        if (uid) {
            const list = await loadGroupsFor(uid);
            socket.emit('groups_update', list.map(g=>({ id:g.id, title:g.title, avatar_color:g.avatar_color, avatar_url:g.avatar_url, info:g.info, memberCount:g.members.length })));
        }
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

    // Clear the FULL history between me and a specific contact
    // (used for the همیار bot contact — removes both sides' messages)
    socket.on('clear_contact_history', (contactId) => {
        const uid = users[socket.id]?.id;
        if (!uid || !contactId) return;
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            const between =
                (m.sender_id === uid && m.recipient_id === contactId) ||
                (m.sender_id === contactId && m.recipient_id === uid);
            if (between) messages.splice(i, 1);
        }
        // tell this user to drop those messages locally too
        socket.emit('history_cleared', contactId);
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
        if (uid) delete vidState[uid];
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
