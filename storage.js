// storage.js
// Barcha ma'lumotlarni (foydalanuvchilar, ularning kalit so'z/javoblari,
// depozit/chek so'rovlari, statistika) data.json faylida saqlaydi.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// Boshlang'ich (bo'sh) tuzilma
const DEFAULT_DATA = {
  // Har bir foydalanuvchi o'z profiliga ega:
  // users[userId] = {
  //   id, username, firstName, firstSeen, lastSeen, messageCount,
  //   isPremium, premiumUntil (ISO sana yoki null),
  //   autoReplies: [{ id, keywords: [...], answer, createdAt }],
  //   pending: { stage, keywords } | null   // kalit so'z/javob kiritish jarayoni holati
  // }
  users: {},

  // Chek/depozit so'rovlari: depositId -> { id, userId, amount, status, screenshotFileId, createdAt, decidedAt }
  deposits: {},

  stats: {
    totalMessages: 0,
    autoRepliedMessages: 0,
    startedAt: new Date().toISOString(),
  },
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    saveData(DEFAULT_DATA);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // Eski fayllarda yangi maydonlar bo'lmasligi mumkin — birlashtiramiz
    return { ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...parsed };
  } catch (err) {
    console.error('data.json o\'qishda xatolik, yangi fayl yaratilmoqda:', err.message);
    saveData(DEFAULT_DATA);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Foydalanuvchi profilini topadi, bo'lmasa yaratadi.
function ensureUser(data, ctx) {
  const id = String(ctx.from.id);
  const now = new Date().toISOString();
  if (!data.users[id]) {
    data.users[id] = {
      id,
      username: ctx.from.username || '',
      firstName: ctx.from.first_name || '',
      firstSeen: now,
      lastSeen: now,
      messageCount: 0,
      isPremium: false,
      premiumUntil: null,
      autoReplies: [],
      pending: null,
    };
  } else {
    // Username/ism o'zgargan bo'lishi mumkin — yangilab qo'yamiz
    data.users[id].username = ctx.from.username || data.users[id].username;
    data.users[id].firstName = ctx.from.first_name || data.users[id].firstName;
  }
  data.users[id].lastSeen = now;
  return data.users[id];
}

// Premium muddati tugaganini tekshiradi va kerak bo'lsa avtomatik o'chiradi.
function refreshPremiumStatus(user) {
  if (user.isPremium && user.premiumUntil) {
    const until = new Date(user.premiumUntil).getTime();
    if (Date.now() > until) {
      user.isPremium = false;
      user.premiumUntil = null;
    }
  }
  return user;
}

const FREE_KEYWORD_LIMIT = 2;

function canAddMoreKeywords(user) {
  refreshPremiumStatus(user);
  if (user.isPremium) return true;
  return user.autoReplies.length < FREE_KEYWORD_LIMIT;
}

module.exports = {
  loadData,
  saveData,
  ensureUser,
  refreshPremiumStatus,
  canAddMoreKeywords,
  FREE_KEYWORD_LIMIT,
  DATA_FILE,
};
