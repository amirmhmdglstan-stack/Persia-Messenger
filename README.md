# Persia Messenger

Persia Messenger — یک گپ گروهی لوکس و بلادرنگ (Real-time) با حساب کاربری، رمز عبور و مخاطبین ماندگار.
نسخهٔ بازسازیشده با نام جدید از یک پروژهٔ متنباز چت گروهی.

## ✨ امکانات

- 🤖 **دستیار هوشمند «همیار»** — همان موتور/کلیدها/مدل‌های K.G GPT، به‌صورت یک مخاطب:
  - چت خصوصی با همیار
  - در Global chat با نامش صدا بزنید (`همیار`، `کا.جی`، `KG`،...) یا به پیامش ریپلای کنید
  - ساخت **تصویر** (مدل‌های pollinations) و پاسخ‌های واقعی
  - نشانگر «در حال تایپ» و رندر مارک‌داون
- 📌 **پیام‌های ذخیره‌شده** — هر کاربر یک مخاطب مخصوص دارد که ۱۰ پیام آخر (با Forward) را دائمی ذخیره می‌کند (Supabase + فالبک محلی)
- ↗️ **Forward** — با راست‌کلیک روی هر پیام، آن را به پیام‌های ذخیره‌شده یا یک مخاطب بفرستید
- 🔐 حساب کاربری با **ایمیل و رمز عبور** (ساخت حساب + ورود مجدد)
- 👥 **مخاطبین ماندگار** — حتی اگر سرور ری‌استارت شود، مخاطبینی که با آنها چت کرده‌اید می‌مانند
- 🚫 بدون حساب تکراری در مخاطبین (هر شخص یک بار)
- 🏠 دکمهٔ خانه → بازگشت به چت اصلی (Global chat)
- 🌐 زیر عنوان: «Global chat • تعداد آنلاین»
- 🔔 اعلان کارتی برای پیام خصوصی هنگام حضور در Global chat
- 💬 چت گروهی بلادرنگ (Socket.IO)
- 🔒 چت خصوصی
- 📎 ارسال فایل/تصویر با **پیش‌نمایش و نشانگر لودینگ**
- ✏️ ویرایش پیام (دوبار کلیک) و 🗑️ حذف برای من/همه
- 😊 ایموجی، 🎨 استیکر، ❤️ واکنش
- 🔍 جستجو در پیام‌ها
- 🎨 ۶ تم رنگی و اندازه فونت
- 📱 PWA (manifest + service worker + آیکن) و تبدیل به APK

## 🧱 پیش‌نیاز: Supabase

این نسخه برای **ورود با رمز** و **ذخیرهٔ مخاطبین** از **Supabase** استفاده می‌کند (رایگان).

1. در https://supabase.com یک پروژهٔ جدید بسازید.
2. در **SQL Editor** این اسکریپت را اجرا کنید (جداول `profiles` و `contacts` + RLS):

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  bio text default '',
  age text default '',
  avatar_color text default '#c4956a',
  avatar_url text,
  email text,
  created_at timestamptz default now()
);
create table if not exists contacts (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null,
  username text,
  avatar_color text,
  avatar_url text,
  last_message text,
  last_time timestamptz default now(),
  created_at timestamptz default now(),
  unique (owner_id, contact_id)
);
alter table profiles enable row level security;
alter table contacts enable row level security;
create policy "profiles are viewable by everyone" on profiles for select using (true);
create policy "users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "users can update their own profile" on profiles for update using (auth.uid() = id);
create policy "contacts select own" on contacts for select using (auth.uid() = owner_id);
create policy "contacts insert own" on contacts for insert with check (auth.uid() = owner_id);
create policy "contacts update own" on contacts for update using (auth.uid() = owner_id);

-- جدول پیام‌های ذخیره‌شده (برای قابلیت Forward)
create table if not exists saved_messages (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sender_name text default 'کاربر',
  text text default '',
  media_url text,
  media_type text,
  sticker text,
  created_at timestamptz default now()
);
alter table saved_messages enable row level security;
create policy "saved_messages select own" on saved_messages for select using (auth.uid() = owner_id);
create policy "saved_messages insert own" on saved_messages for insert with check (auth.uid() = owner_id);
create policy "saved_messages delete own" on saved_messages for delete using (auth.uid() = owner_id);
```

> نسخهٔ کامل SQL در فایل `saved_messages_sql.sql` هم هست.

3. از **Project Settings → API** سه مقدار را بردارید و در `.env` بگذارید:

```bash
cp .env.example .env
```

سپس `.env` را با مقادیر خودتان پر کنید (`SUPABASE_URL`، `SUPABASE_ANON_KEY`، `SUPABASE_SERVICE_ROLE_KEY`).

> ⚠️ **کلید `service_role` محرمانه است** — فقط در سمت سرور استفاده می‌شود و به‌هیچ‌وجه آن را به GitHub ندهید (فایل `.env` در `.gitignore` است). اگر آن را در `server.js` به‌صورت پیش‌فرض گذاشته‌اید، بهتر است با متغیر محیطی جایگزین کنید.

## 🚀 اجرا

```bash
npm install
npm start
```

سپس در مرورگر:

```
http://localhost:3000
```

حالت توسعه:

```bash
npm run dev
```

## 🗒 دربارهٔ پیام‌ها

پیام‌های لحظه‌ای در حافظهٔ سرور نگهداری می‌شوند و با ری‌استارت سرور پاک می‌شوند (رفتار فعلی). فقط **مخاطبین** و **پروفایل کاربران** در Supabase ذخیره می‌شوند و ماندگارند.

## 📱 تبدیل به APK

```bash
npm run build:pwa          # با pwa2apk
npm run build:android      # با Capacitor
```

> برای نسخهٔ نصب‌شده (PWA) آدرس سرور واقعی را در `public/index.html` و `public/app.js` به‌جای `YOUR_SERVER_IP` بگذارید.

## 🛠 تکنولوژی‌ها

- Node.js + Express
- Socket.IO
- Multer (آپلود فایل)
- Supabase (Auth + Postgres برای مخاطبین و پروفایل)
- HTML / CSS / Vanilla JS
- PWA / Capacitor
