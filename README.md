# Avto Chat Bot

Kalit so'z asosida avtomatik javob beruvchi Telegram bot. Admin ko'plab
kalit so'z va ularga mos javoblarni kiritib qo'yadi; foydalanuvchi botga
yozganda, xabari kiritilgan kalit so'zlardan birini o'z ichiga olsa, bot
avtomatik javob qaytaradi.

## Fayllar

- `index.js` — botning asosiy logikasi
- `storage.js` — ma'lumotlarni `data.json` fayliga saqlash/o'qish
- `package.json` — bog'liqliklar va start skripti
- `Procfile` / `railway.json` — Railway uchun ishga tushirish sozlamalari
- `.env.example` — kerakli maxfiy o'zgaruvchilar namunasi

## 1-qadam: Bot tokenini olish

1. Telegram'da [@BotFather](https://t.me/BotFather) ga o'ting
2. `/newbot` buyrug'ini yuboring, nom va username bering
3. Sizga token beriladi, masalan: `123456789:AAExampleToken...`

## 2-qadam: O'z Telegram ID'ingizni bilish

1. [@userinfobot](https://t.me/userinfobot) ga `/start` yuboring
2. U sizga ID raqamingizni yuboradi (masalan `123456789`)
3. Shu ID admin sifatida ishlaydi — faqat shu odam boshqaruv panelidan foydalana oladi

## 3-qadam: Railway'ga joylashtirish

### A) GitHub orqali (tavsiya etiladi)

1. Shu papkani GitHub'ga reponame bilan yuklang (`data.json`, `node_modules`, `.env` ni yuklamang — `.gitignore` allaqachon buni hisobga oladi)
2. [railway.app](https://railway.app) ga kiring → **New Project** → **Deploy from GitHub repo**
3. Reponi tanlang
4. **Variables** bo'limiga o'ting va quyidagilarni qo'shing:
   - `BOT_TOKEN` = @BotFather'dan olingan token
   - `ADMIN_IDS` = sizning Telegram ID'ingiz (bir nechta bo'lsa, vergul bilan: `111,222`)
5. Railway avtomatik `npm install` va keyin `node index.js` ni ishga tushiradi (bu `railway.json`/`Procfile`da yozilgan)
6. **Deployments** bo'limida loglarni kuzatib turing — `✅ Avto Chat Bot ishga tushdi!` chiqishi kerak

### B) Railway CLI orqali

```bash
npm install -g @railway/cli
railway login
cd avto-chat-bot
railway init
railway up
railway variables set BOT_TOKEN=123456789:AAExampleToken...
railway variables set ADMIN_IDS=123456789
```

> **Muhim:** Railway'da bepul/Hobby rejada fayl tizimi har deploy'da (yoki
> konteyner qayta ishga tushganda) tozalanishi mumkin, ya'ni `data.json`
> o'chib ketishi ehtimoli bor. Agar ma'lumotlar doimiy saqlanishi kerak
> bo'lsa, Railway'da **Volume** qo'shing (Project → Settings → Volumes)
> va uni `/app` yoki `data.json` joylashgan papkaga bog'lang. Shunda
> qayta deploy qilinganda ham ma'lumotlar saqlanib qoladi.

## 4-qadam: Botni sinab ko'rish

1. Telegram'da botingizni toping va `/start` bosing
2. Admin sifatida quyidagi menyuni ko'rasiz:
   - 🔑 Kalit so'z — yangi kalit so'z qo'shish
   - 📝 Javob kiritish — kalit so'zga javob yozish
   - 📋 Ro'yxat — barcha kalit so'z/javoblarni ko'rish
   - 🗑 O'chirish — kalit so'zni o'chirish
   - 🏠 Kabinet — sozlamalar
   - 📊 Statistika — foydalanuvchilar va xabarlar statistikasi
3. "🔑 Kalit so'z" tugmasini bosing → masalan `narxi` deb yozing
4. "📝 Javob kiritish" tugmasini bosing → masalan `Narxlar 5 mln so'mdan boshlanadi` deb yozing
5. Endi boshqa odam (yoki boshqa Telegram akkaunt bilan) botga "Narxi qancha bo'ladi?" deb yozsa, bot avtomatik javob beradi

## Lokal ishga tushirish (ixtiyoriy, sinov uchun)

```bash
npm install
cp .env.example .env
# .env faylini ochib BOT_TOKEN va ADMIN_IDS ni to'ldiring
npm start
```

## Botni kengaytirish g'oyalari

- Bir nechta admin qo'shish (`ADMIN_IDS` ga vergul bilan qo'shing)
- Kalit so'zni tahrirlash tugmasi qo'shish
- SQLite'ga o'tish (ko'p foydalanuvchi/kalit so'z bo'lganda tezroq ishlaydi)
- Guruh chatlarda ham ishlashini sozlash
