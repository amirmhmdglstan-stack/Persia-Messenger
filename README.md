# Persia Messenger

Persia Messenger — یک گپ گروهی لوکس و بلادرنگ (Real-time) با قابلیت تبدیل به APK.
نسخهٔ بازسازیشده با نام جدید از یک پروژهٔ متنباز چت گروهی.

## ✨ امکانات

- 🔐 ورود با کد تأیید (کد در کنسول F12 نمایش داده میشود)
- 👤 پروفایل کاربری (نام، بیوگرافی، سن، آواتار)
- 💬 چت گروهی بلادرنگ (Socket.IO)
- 🔒 چت خصوصی (با کلیک روی آواتار)
- 🤖 ربات راهنمای فارسی
- 😊 ایموجی، 🎨 استیکر، 📎 ارسال فایل/تصویر/ویدیو/صدا
- ❤️ واکنش به پیامها
- ✏️ ویرایش پیام (دوبار کلیک) و 🗑️ حذف برای من/همه
- 🔍 جستجو در پیامها
- 🎨 ۶ تم رنگی
- 📤 خروجی چت TXT
- 📱 PWA و تبدیل به APK

## 🚀 اجرا

```bash
npm install
npm start
```

سپس در مرورگر:

```
http://localhost:3000
```

حالت توسعه با nodemon:

```bash
npm run dev
```

## 📱 تبدیل به APK

```bash
npm run build:pwa          # با pwa2apk
npm run build:android      # با Capacitor
```

> برای کارکرد نسخهٔ نصبشده (PWA)، آدرس سرور واقعی را در `public/index.html`
> و `public/app.js` بهجای `YOUR_SERVER_IP` قرار دهید.

## 🛠 تکنولوژیها

- Node.js + Express
- Socket.IO
- Multer (آپلود فایل)
- HTML / CSS / Vanilla JS
- PWA / Capacitor
