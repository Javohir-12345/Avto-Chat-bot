// index.js
// Avto Chat Bot — har bir foydalanuvchi o'zining kalit so'z/javoblarini
// sozlaydigan, Telegram Business orqali avto-javob beruvchi bot.
//
// Tizim:
// - Har bir foydalanuvchi bepul 2 tagacha kalit so'z/javob qo'sha oladi
// - Ko'proq kerak bo'lsa, Premium sotib olish kerak (19,000 so'm / 30 kun)
// - To'lov: karta raqamiga o'tkazib, chek skrinshotini yuborish -> admin tasdiqlaydi
// - Admin panelida: Statistika, Xabar yuborish (broadcast), Premium berish

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const {
  loadData,
  saveData,
  ensureUser,
  refreshPremiumStatus,
  canAddMoreKeywords,
  FREE_KEYWORD_LIMIT,
} = require('./storage');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('XATOLIK: BOT_TOKEN topilmadi. .env fayliga yoki Railway Variables bo\'limiga BOT_TOKEN qo\'shing.');
  process.exit(1);
}

// Admin(lar) Telegram ID'lari, vergul bilan ajratilgan: masalan "111111,222222"
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// To'lov sozlamalari
const CARD_NUMBER = process.env.CARD_NUMBER || '6262570040359129';
const PREMIUM_PRICE = 19000; // so'm
const PREMIUM_DAYS = 30;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Javoh_1hacker';

const bot = new Telegraf(BOT_TOKEN);

// --- Yordamchi funksiyalar -------------------------------------------------

function isAdmin(ctx) {
  const id = String(ctx.from.id);
  return ADMIN_IDS.length === 0 ? true : ADMIN_IDS.includes(id);
}

function formatMoney(n) {
  return n.toLocaleString('uz-UZ').replace(/,/g, ' ');
}

function mainKeyboard(user) {
  const rows = [
    ['🔑 Kalit so\'z qo\'shish', '📝 Javob kiritish'],
    ['📋 Mening ro\'yxatim', '🗑 O\'chirish'],
    ['💎 Premium', '👤 Profil'],
  ];
  if (user && user.isAdminUser) {
    rows.push(['🛠 Admin panel']);
  }
  return Markup.keyboard(rows).resize();
}

function adminKeyboard() {
  return Markup.keyboard([
    ['📊 Statistika', '📢 Xabar yuborish'],
    ['💎 Premium berish'],
    ['🔙 Asosiy menyu'],
  ]).resize();
}

function findAutoReply(user, text) {
  const lower = text.toLowerCase();
  return user.autoReplies.find((item) => item.keywords.some((k) => lower.includes(k.toLowerCase())));
}

function premiumStatusText(user) {
  refreshPremiumStatus(user);
  if (user.isPremium) {
    const until = new Date(user.premiumUntil);
    return `💎 Premium faol (${until.toLocaleDateString('uz-UZ')} gacha)`;
  }
  return `🆓 Bepul reja (${user.autoReplies.length}/${FREE_KEYWORD_LIMIT} kalit so'z ishlatilgan)`;
}

// --- Umumiy javob mantig'i (oddiy va Business xabarlar uchun) -------------

function processIncomingText(data, ctx, ownerUser, text, businessConnectionId, chatId) {
  data.stats.totalMessages += 1;
  const match = findAutoReply(ownerUser, text);
  if (match) {
    data.stats.autoRepliedMessages += 1;
    saveData(data);

    const extra = {};
    if (businessConnectionId) extra.business_connection_id = businessConnectionId;
    if (match.buttons && match.buttons.length > 0) {
      extra.reply_markup = Markup.inlineKeyboard(
        match.buttons.map((b, idx) => [
          Markup.button.callback(b.label, `autobtn_${ownerUser.id}_${match.id}_${idx}`),
        ])
      ).reply_markup;
    }

    if (businessConnectionId) {
      return ctx.telegram.sendMessage(chatId, match.answer, extra);
    }
    return ctx.reply(match.answer, extra);
  }
  saveData(data);
}

// --- /start ----------------------------------------------------------------

bot.start((ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  saveData(data);

  const admin = isAdmin(ctx);
  ctx.reply(
    `Assalomu alaykum, ${ctx.from.first_name || ''}! 👋\n\n` +
      `Bu bot orqali siz o'z kalit so'z va javoblaringizni sozlab, ` +
      `Telegram Business orqali mijozlaringizga avtomatik javob berishingiz mumkin.\n\n` +
      `🔑 Kalit so'z qo'shish — yangi kalit so'z(lar) qo'shish\n` +
      `📝 Javob kiritish — qo'shilgan kalit so'zlarga umumiy javob yozish\n` +
      `📋 Mening ro'yxatim — barcha kalit so'z/javoblaringiz\n` +
      `🗑 O'chirish — kalit so'zni o'chirish\n` +
      `💎 Premium — cheksiz kalit so'z uchun premium sotib olish\n` +
      `👤 Profil — hisobingiz holati\n\n` +
      `${premiumStatusText(user)}`,
    mainKeyboard({ isAdminUser: admin })
  );
});

// --- Kalit so'z qo'shish -----------------------------------------------

bot.hears('🔑 Kalit so\'z qo\'shish', (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);

  if (!canAddMoreKeywords(user)) {
    saveData(data);
    return ctx.reply(
      `⚠️ Bepul rejada faqat ${FREE_KEYWORD_LIMIT} ta kalit so'z qo'sha olasiz, limitga yetdingiz.\n\n` +
        `Ko'proq kalit so'z qo'shish uchun "💎 Premium" bo'limidan obuna bo'ling.`
    );
  }

  const existing = user.pending && user.pending.stage === 'awaiting_keyword' ? user.pending.keywords : [];
  user.pending = { stage: 'awaiting_keyword', keywords: existing };
  saveData(data);

  if (existing.length > 0) {
    ctx.reply(
      `Hozirgacha qo'shilgan kalit so'zlar:\n${existing.map((k) => `• ${k}`).join('\n')}\n\n` +
        `Yana bitta kalit so'z yuboring, yoki "📝 Javob kiritish" tugmasini bosib javobni kiriting.`
    );
  } else {
    ctx.reply(
      'Yangi kalit so\'zni yuboring!\n(Masalan: "narxi", "salom", "ish vaqti")\n\n' +
        'Bir nechta kalit so\'zni bitta javobga bog\'lash uchun har birini alohida-alohida yuboring.'
    );
  }
});

// --- Javob kiritish ------------------------------------------------------

bot.hears('📝 Javob kiritish', (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  const pending = user.pending;

  if (!pending || !pending.keywords || pending.keywords.length === 0) {
    saveData(data);
    return ctx.reply('⚠️ Avval "🔑 Kalit so\'z qo\'shish" orqali kamida bitta kalit so\'z kiriting.');
  }

  user.pending = { stage: 'awaiting_answer', keywords: pending.keywords };
  saveData(data);
  ctx.reply(
    `Quyidagi kalit so'zlarning barchasiga bitta umumiy javob yozing:\n` +
      `${pending.keywords.map((k) => `🔑 ${k}`).join('\n')}\n\n` +
      `Javob matnini yuboring:`
  );
});

// --- Ro'yxat ---------------------------------------------------------------

bot.hears('📋 Mening ro\'yxatim', (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  saveData(data);

  if (user.autoReplies.length === 0) {
    return ctx.reply('Hozircha kalit so\'zlaringiz mavjud emas.');
  }
  const list = user.autoReplies
    .map((item, i) => {
      const buttonsText =
        item.buttons && item.buttons.length > 0
          ? `\n   🔘 Tugmalar: ${item.buttons.map((b) => b.label).join(', ')}`
          : '';
      return `${i + 1}. 🔑 ${item.keywords.join(', ')}\n   📝 ${item.answer}${buttonsText}`;
    })
    .join('\n\n');
  ctx.reply(`Sizning kalit so'z/javoblaringiz:\n\n${list}\n\n${premiumStatusText(user)}`);
});

// --- O'chirish ---------------------------------------------------------

bot.hears('🗑 O\'chirish', (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  saveData(data);

  if (user.autoReplies.length === 0) {
    return ctx.reply('O\'chirish uchun kalit so\'zlaringiz mavjud emas.');
  }
  const buttons = user.autoReplies.map((item) => [
    Markup.button.callback(`❌ ${item.keywords.join(', ')}`, `delete_${item.id}`),
  ]);
  ctx.reply('O\'chirmoqchi bo\'lgan kalit so\'zni tanlang:', Markup.inlineKeyboard(buttons));
});

bot.action(/delete_(.+)/, (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  const id = ctx.match[1];
  const before = user.autoReplies.length;
  user.autoReplies = user.autoReplies.filter((item) => item.id !== id);
  saveData(data);
  ctx.answerCbQuery(before !== user.autoReplies.length ? 'O\'chirildi ✅' : 'Topilmadi');
  ctx.editMessageText('Amal bajarildi. Ro\'yxatni qayta ko\'rish uchun "📋 Mening ro\'yxatim" tugmasini bosing.');
});

// Avto-javobga qo'shilgan tugma bosilganda — bosgan kishiga belgilangan matnni yuboradi.
// callback_data formati: autobtn_{ownerId}_{autoReplyId}_{buttonIndex}
bot.action(/autobtn_(.+?)_(.+?)_(\d+)$/, async (ctx) => {
  const [, ownerId, autoReplyId, buttonIndexStr] = ctx.match;
  const buttonIndex = parseInt(buttonIndexStr, 10);
  const data = loadData();
  const ownerUser = data.users[ownerId];

  if (!ownerUser) {
    return ctx.answerCbQuery('Xatolik: ma\'lumot topilmadi.');
  }
  const autoReply = ownerUser.autoReplies.find((item) => item.id === autoReplyId);
  if (!autoReply || !autoReply.buttons || !autoReply.buttons[buttonIndex]) {
    return ctx.answerCbQuery('Bu tugma endi mavjud emas.');
  }

  const button = autoReply.buttons[buttonIndex];
  await ctx.answerCbQuery();

  // Business chatda bosilgan bo'lsa ham, callback_query orqali business_connection_id keladi.
  const businessConnectionId = ctx.callbackQuery && ctx.callbackQuery.business_connection_id;
  if (businessConnectionId) {
    await ctx.telegram.sendMessage(ctx.chat.id, button.reply, {
      business_connection_id: businessConnectionId,
    });
  } else {
    await ctx.reply(button.reply);
  }
});

// --- Profil ---------------------------------------------------------------

bot.hears('👤 Profil', (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  saveData(data);
  ctx.reply(
    `👤 Profil\n\n` +
      `ID: ${user.id}\n` +
      `Ism: ${user.firstName || '-'}\n` +
      `Username: @${user.username || '-'}\n` +
      `Kalit so'zlar: ${user.autoReplies.length}\n` +
      `${premiumStatusText(user)}`
  );
});

// --- Premium sotib olish (chek/depozit oqimi) -----------------------------

bot.hears('💎 Premium', (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  saveData(data);

  if (user.isPremium) {
    refreshPremiumStatus(user);
  }
  if (user.isPremium) {
    return ctx.reply(`Sizda allaqachon ${premiumStatusText(user)} mavjud. ✅`);
  }

  user.pending = { stage: 'awaiting_payment_screenshot', amount: PREMIUM_PRICE };
  saveData(data);

  ctx.reply(
    `💎 Premium — ${formatMoney(PREMIUM_PRICE)} so'm / ${PREMIUM_DAYS} kun\n\n` +
      `✅ Premium bilan cheksiz kalit so'z qo'sha olasiz.\n\n` +
      `💳 To'lov qilish uchun:\n\n` +
      `Karta raqami: ${CARD_NUMBER}\n\n` +
      `💰 Summa: ${formatMoney(PREMIUM_PRICE)} so'm\n\n` +
      `🆔 Sizning Telegram ID: ${user.id}\n\n` +
      `✅ To'lovni amalga oshirgach, chek rasmini (screenshot) shu yerga yuboring.\n` +
      `👨‍💼 Chekingiz admin tomonidan tekshiriladi (odatda tez orada, ba'zan 24 soatgacha).`
  );
});

// Chek skrinshotini qabul qilish
bot.on('photo', async (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);

  if (!user.pending || user.pending.stage !== 'awaiting_payment_screenshot') {
    saveData(data);
    return; // kutilmagan rasm, e'tiborsiz qoldiramiz
  }

  const amount = user.pending.amount || PREMIUM_PRICE;
  const photos = ctx.message.photo;
  const fileId = photos[photos.length - 1].file_id; // eng katta o'lchamdagi rasm

  const depositId = Date.now().toString();
  data.deposits[depositId] = {
    id: depositId,
    userId: user.id,
    amount,
    status: 'pending', // pending | approved | rejected
    screenshotFileId: fileId,
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  user.pending = null;
  saveData(data);

  await ctx.reply(
    `⏳ Chek qabul qilindi va tekshirilmoqda...\n\n` +
      `👨‍💼 Admin tomonidan tasdiqlangach, sizga xabar beriladi.\n` +
      `🔑 Chek ID: ${depositId}\n\n` +
      `Tezroq tasdiqlash kerak bo'lsa, admin bilan bog'laning: @${ADMIN_USERNAME}`
  );

  // Adminlarga xabar yuborish
  const caption =
    `💳 YANGI CHEK\n\n` +
    `👤 Foydalanuvchi: ${user.firstName || '-'}\n` +
    `🔗 Username: @${user.username || '-'}\n` +
    `🆔 ID: ${user.id}\n` +
    `💰 Kutilgan summa: ${formatMoney(amount)} so'm\n` +
    `🔑 Chek ID: ${depositId}`;

  const approveButtons = Markup.inlineKeyboard([
    Markup.button.callback('✅ Tasdiqlash', `approve_${depositId}`),
    Markup.button.callback('❌ Rad etish', `reject_${depositId}`),
  ]);

  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendPhoto(adminId, fileId, { caption, ...approveButtons });
    } catch (err) {
      console.error(`Admin ${adminId} ga chek yuborishda xatolik:`, err.message);
    }
  }
});

// Admin chekni tasdiqlaydi
bot.action(/approve_(.+)/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Sizga ruxsat yo\'q.');
  const depositId = ctx.match[1];
  const data = loadData();
  const deposit = data.deposits[depositId];

  if (!deposit) {
    return ctx.answerCbQuery('Chek topilmadi.');
  }
  if (deposit.status !== 'pending') {
    return ctx.answerCbQuery('Bu chek allaqachon ko\'rib chiqilgan.');
  }

  deposit.status = 'approved';
  deposit.decidedAt = new Date().toISOString();

  const targetUser = data.users[deposit.userId];
  if (targetUser) {
    const now = new Date();
    const currentUntil =
      targetUser.isPremium && targetUser.premiumUntil && new Date(targetUser.premiumUntil) > now
        ? new Date(targetUser.premiumUntil)
        : now;
    const newUntil = new Date(currentUntil.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);
    targetUser.isPremium = true;
    targetUser.premiumUntil = newUntil.toISOString();
  }

  saveData(data);
  await ctx.answerCbQuery('Tasdiqlandi ✅');
  await ctx.editMessageCaption(`✅ TASDIQLANDI\n\nChek ID: ${depositId}\nSumma: ${formatMoney(deposit.amount)} so'm`);

  if (targetUser) {
    try {
      await ctx.telegram.sendMessage(
        targetUser.id,
        `✅ To'lovingiz tasdiqlandi!\n\n💎 Sizga ${PREMIUM_DAYS} kunlik Premium faollashtirildi.\nEndi cheksiz kalit so'z qo'sha olasiz.`
      );
    } catch (err) {
      console.error('Foydalanuvchiga xabar yuborishda xatolik:', err.message);
    }
  }
});

// Admin chekni rad etadi
bot.action(/reject_(.+)/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Sizga ruxsat yo\'q.');
  const depositId = ctx.match[1];
  const data = loadData();
  const deposit = data.deposits[depositId];

  if (!deposit) {
    return ctx.answerCbQuery('Chek topilmadi.');
  }
  if (deposit.status !== 'pending') {
    return ctx.answerCbQuery('Bu chek allaqachon ko\'rib chiqilgan.');
  }

  deposit.status = 'rejected';
  deposit.decidedAt = new Date().toISOString();
  saveData(data);

  await ctx.answerCbQuery('Rad etildi ❌');
  await ctx.editMessageCaption(`❌ RAD ETILDI\n\nChek ID: ${depositId}\nSumma: ${formatMoney(deposit.amount)} so'm`);

  const targetUser = data.users[deposit.userId];
  if (targetUser) {
    try {
      await ctx.telegram.sendMessage(
        targetUser.id,
        `❌ Kechirasiz, to'lovingiz rad etildi.\n\nAgar bu xato deb hisoblasangiz, admin bilan bog'laning: @${ADMIN_USERNAME}`
      );
    } catch (err) {
      console.error('Foydalanuvchiga xabar yuborishda xatolik:', err.message);
    }
  }
});

// --- Admin panel -----------------------------------------------------------

bot.hears('🛠 Admin panel', (ctx) => {
  if (!isAdmin(ctx)) return;
  ctx.reply('👑 Admin boshqaruv paneli:', adminKeyboard());
});

bot.hears('🔙 Asosiy menyu', (ctx) => {
  const data = loadData();
  const user = ensureUser(data, ctx);
  saveData(data);
  ctx.reply('Asosiy menyu 👇', mainKeyboard({ isAdminUser: isAdmin(ctx) }));
});

bot.hears('📊 Statistika', (ctx) => {
  if (!isAdmin(ctx)) return;
  const data = loadData();
  const userIds = Object.keys(data.users);
  const premiumCount = userIds.filter((id) => {
    const u = data.users[id];
    refreshPremiumStatus(u);
    return u.isPremium;
  }).length;
  const totalKeywords = userIds.reduce((sum, id) => sum + data.users[id].autoReplies.length, 0);
  saveData(data);

  ctx.reply(
    `📊 Umumiy statistika\n\n` +
      `👥 Jami foydalanuvchilar: ${userIds.length}\n` +
      `💎 Premium foydalanuvchilar: ${premiumCount}\n` +
      `🔑 Jami kalit so'zlar: ${totalKeywords}\n` +
      `💬 Jami xabarlar: ${data.stats.totalMessages}\n` +
      `🤖 Avto javob berilgan: ${data.stats.autoRepliedMessages}`
  );
});

bot.hears('📢 Xabar yuborish', (ctx) => {
  if (!isAdmin(ctx)) return;
  const data = loadData();
  const user = ensureUser(data, ctx);
  user.pending = { stage: 'awaiting_broadcast' };
  saveData(data);
  ctx.reply('📝 Barcha foydalanuvchilarga yuboriladigan xabar matnini kiriting:');
});

bot.hears('💎 Premium berish', (ctx) => {
  if (!isAdmin(ctx)) return;
  const data = loadData();
  const user = ensureUser(data, ctx);
  user.pending = { stage: 'awaiting_premium_target' };
  saveData(data);
  ctx.reply(
    `Premium bermoqchi bo'lgan foydalanuvchining Telegram ID raqamini yuboring.\n` +
      `(ID ni foydalanuvchi "👤 Profil" bo'limidan ko'rishi mumkin)`
  );
});

// --- Business xabarlari (shaxsiy raqamga kelgan mijoz xabarlari) -----------
// MUHIM: business_message ichida ctx.chat to'g'ri to'lmasligi mumkin —
// shuning uchun chat ID'ni bevosita bm.chat.id dan olamiz.

bot.on('business_message', async (ctx) => {
  const bm = ctx.update.business_message;
  if (!bm || !bm.text) return;

  const data = loadData();
  // Bu Business ulanish qaysi bot egasiga tegishli ekanini aniqlaymiz:
  // business_connection_id orqali botning egasi (owner) ni topamiz.
  const businessConnectionId = bm.business_connection_id;

  // ctx.from bu yerda ODDIY MIJOZ (xabar yozgan kishi), owner emas!
  // Owner'ni topish uchun business_connection orqali kelgan user_chat_id kerak,
  // buni oldindan saqlab qo'yamiz (pastdagi business_connection handlerida).
  const ownerId = data.businessOwners && data.businessOwners[businessConnectionId];
  if (!ownerId || !data.users[ownerId]) {
    console.log('⚠️ Business ulanish egasi topilmadi:', businessConnectionId);
    return;
  }

  const ownerUser = data.users[ownerId];
  console.log('📩 Business xabar keldi:', bm.text, '| owner:', ownerId, '| chat:', bm.chat?.id);
  processIncomingText(data, ctx, ownerUser, bm.text.trim(), businessConnectionId, bm.chat.id);
});

// Business ulanish o'rnatilganda/yangilanganda, kim ulaganini saqlab qolamiz
bot.on('business_connection', (ctx) => {
  const conn = ctx.update.business_connection;
  if (!conn) return;
  const data = loadData();
  if (!data.businessOwners) data.businessOwners = {};
  data.businessOwners[conn.id] = String(conn.user_chat_id || conn.user?.id || '');
  saveData(data);
  console.log('🔗 Business ulanish saqlandi:', conn.id, '->', data.businessOwners[conn.id]);
});

bot.on('deleted_business_messages', () => {
  console.log('🗑 Business xabar(lar) o\'chirildi.');
});

// --- Oddiy matnli xabarlarni qayta ishlash (shaxsiy/guruh chat) -----------

bot.on('text', async (ctx) => {
  if (ctx.update.business_message) return; // yuqorida alohida ushlangan

  const data = loadData();
  const user = ensureUser(data, ctx);
  const text = ctx.message.text.trim();
  const admin = isAdmin(ctx);

  const menuLabels = [
    '🔑 Kalit so\'z qo\'shish', '📝 Javob kiritish', '📋 Mening ro\'yxatim', '🗑 O\'chirish',
    '💎 Premium', '👤 Profil', '🛠 Admin panel', '🔙 Asosiy menyu',
    '📊 Statistika', '📢 Xabar yuborish', '💎 Premium berish',
  ];

  const pending = user.pending;

  // --- Admin: broadcast matnini kutmoqda ---
  if (admin && pending && pending.stage === 'awaiting_broadcast' && !menuLabels.includes(text)) {
    user.pending = null;
    const userIds = Object.keys(data.users);
    saveData(data);
    await ctx.reply(`📤 ${userIds.length} ta foydalanuvchiga yuborilmoqda...`);
    let sent = 0;
    for (const uid of userIds) {
      try {
        await ctx.telegram.sendMessage(uid, text);
        sent += 1;
      } catch (err) {
        // Foydalanuvchi botni bloklagan bo'lishi mumkin, o'tkazib yuboramiz
      }
    }
    return ctx.reply(`✅ ${sent} ta foydalanuvchiga yetkazildi!`);
  }

  // --- Admin: premium beriladigan foydalanuvchi ID sini kutmoqda ---
  if (admin && pending && pending.stage === 'awaiting_premium_target' && !menuLabels.includes(text)) {
    const targetId = text.trim();
    const targetUser = data.users[targetId];
    user.pending = null;

    if (!targetUser) {
      saveData(data);
      return ctx.reply('❌ Bu ID bilan foydalanuvchi topilmadi. ID to\'g\'riligini tekshiring.');
    }

    const now = new Date();
    const currentUntil =
      targetUser.isPremium && targetUser.premiumUntil && new Date(targetUser.premiumUntil) > now
        ? new Date(targetUser.premiumUntil)
        : now;
    const newUntil = new Date(currentUntil.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);
    targetUser.isPremium = true;
    targetUser.premiumUntil = newUntil.toISOString();
    saveData(data);

    await ctx.reply(`✅ ${targetUser.firstName || targetId} ga ${PREMIUM_DAYS} kunlik Premium berildi!`);
    try {
      await ctx.telegram.sendMessage(
        targetId,
        `🎉 Sizga admin tomonidan ${PREMIUM_DAYS} kunlik Premium berildi!\nEndi cheksiz kalit so'z qo'sha olasiz.`
      );
    } catch (err) {
      // foydalanuvchi botni bloklagan bo'lishi mumkin
    }
    return;
  }

  // --- Kalit so'z / javob kiritish jarayoni ---
  if (pending && pending.stage === 'awaiting_keyword' && !menuLabels.includes(text)) {
    const keywords = [...pending.keywords, text];
    user.pending = { stage: 'awaiting_keyword', keywords };
    saveData(data);
    return ctx.reply(
      `✅ Kalit so'z qo'shildi: "${text}"\n\n` +
        `Hozirgacha qo'shilganlar:\n${keywords.map((k) => `• ${k}`).join('\n')}\n\n` +
        `Yana kalit so'z qo'shish uchun yozavering, yoki umumiy javob uchun "📝 Javob kiritish" ni bosing.`
    );
  }

  if (pending && pending.stage === 'awaiting_answer' && !menuLabels.includes(text)) {
    // Javob matni saqlab qolinadi, endi tugma qo'shish-qo'shmaslik so'raladi
    user.pending = {
      stage: 'awaiting_add_button_choice',
      keywords: pending.keywords,
      answer: text,
      buttons: [],
    };
    saveData(data);
    return ctx.reply(
      `✅ Javob matni saqlandi.\n\n` +
        `Endi xabar tagida tugma(lar) qo'shmoqchimisiz?\n` +
        `Tugma bosilganda, foydalanuvchiga siz belgilagan matn avtomatik yuboriladi.\n\n` +
        `Javob bering: "Ha" yoki "Yo'q"`
    );
  }

  // --- Tugma qo'shish jarayoni: Ha/Yo'q tanlovi ---
  if (pending && pending.stage === 'awaiting_add_button_choice' && !menuLabels.includes(text)) {
    const lower = text.trim().toLowerCase();
    if (lower === 'ha') {
      user.pending = { ...pending, stage: 'awaiting_button_label' };
      saveData(data);
      return ctx.reply('Tugma nomini yozing (masalan: "Ha", "Yo\'q", "Batafsil"):');
    }
    if (lower === 'yo\'q' || lower === 'yoq' || lower === 'yo`q') {
      const newItem = {
        id: Date.now().toString(),
        keywords: pending.keywords,
        answer: pending.answer,
        buttons: pending.buttons || [],
        createdAt: new Date().toISOString(),
      };
      user.autoReplies.push(newItem);
      user.pending = null;
      saveData(data);
      return ctx.reply(
        `✅ Avto javob muvaffaqiyatli qo'shildi!\n\n${newItem.keywords.map((k) => `🔑 ${k}`).join('\n')}\n📝 ${newItem.answer}`
      );
    }
    saveData(data);
    return ctx.reply('Iltimos, faqat "Ha" yoki "Yo\'q" deb javob bering.');
  }

  // --- Tugma nomini kiritish ---
  if (pending && pending.stage === 'awaiting_button_label' && !menuLabels.includes(text)) {
    user.pending = { ...pending, stage: 'awaiting_button_reply', currentLabel: text };
    saveData(data);
    return ctx.reply(`Tugma nomi: "${text}"\n\nEndi shu tugma bosilganda yuboriladigan javob matnini yozing:`);
  }

  // --- Tugma bosilganda yuboriladigan javobni kiritish ---
  if (pending && pending.stage === 'awaiting_button_reply' && !menuLabels.includes(text)) {
    const newButton = { label: pending.currentLabel, reply: text };
    const buttons = [...(pending.buttons || []), newButton];
    user.pending = {
      stage: 'awaiting_add_button_choice',
      keywords: pending.keywords,
      answer: pending.answer,
      buttons,
    };
    saveData(data);
    return ctx.reply(
      `✅ Tugma qo'shildi: "${newButton.label}"\n\n` +
        `Hozirgacha qo'shilgan tugmalar:\n${buttons.map((b) => `• ${b.label}`).join('\n')}\n\n` +
        `Yana tugma qo'shmoqchimisiz? "Ha" yoki "Yo'q"`
    );
  }

  if (menuLabels.includes(text)) {
    saveData(data);
    return; // menyu tugmalari alohida bot.hears() orqali ushlanadi
  }

  // --- Oddiy xabar: bu foydalanuvchining o'z kalit so'zlariga mos kelsa javob beramiz ---
  // (Masalan, kimdir shu foydalanuvchiga to'g'ridan-to'g'ri botga yozsa emas, balki
  //  bu bo'lim ko'proq sinov/demo maqsadida — asosiy oqim Business orqali ishlaydi.)
  processIncomingText(data, ctx, user, text, null, ctx.chat.id);
});

// --- Xatoliklarni ushlash ------------------------------------------------

bot.catch((err, ctx) => {
  console.error(`Xatolik yuz berdi (${ctx.updateType}):`, err);
});

// --- Botni ishga tushirish -----------------------------------------------

bot.launch({
  allowedUpdates: [
    'message',
    'edited_message',
    'callback_query',
    'business_connection',
    'business_message',
    'edited_business_message',
    'deleted_business_messages',
  ],
}).then(() => {
  console.log('✅ Avto Chat Bot ishga tushdi! (Foydalanuvchi tizimi + Premium + Business qo\'llab-quvvatlanadi)');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
