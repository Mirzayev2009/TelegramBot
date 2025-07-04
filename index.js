

  
  
  
  const TelegramBot = require('node-telegram-bot-api');
  const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
  const channelUsername = '@umida_pardalar1';

  const bot = new TelegramBot(token, { polling: true });

  let botUsername = 'bot';
  bot.getMe().then(me => {
    botUsername = me.username;
    console.log(`🤖 Bot launched as @${botUsername}`);
  });

  const users = {};

  // 🔹 Log all users to console
  function logUsers() {
    console.log("\n📊 [LIVE USER LIST]");
    const entries = Object.entries(users);
    console.log(`👥 Total users: ${entries.length}`);
    entries.forEach(([id, user], i) => {
      console.log(`${i + 1}. 🧑‍💼 ${user.name || 'No name'} | 📞 ${user.phone || 'No phone'} | ID: ${id}`);
    });
    console.log("────────────────────────────\n");
  }

  // 1. /start → Welcome + ask to confirm name
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Ismingiz';

    const intro = `
  🤝 *Assalomu alaykum!*

  Siz ushbu bot orqali:

  🔹 Parda sohasida 13 yillik tajribaga ega bo‘lgan ekspert  
  🔹 400 dan ortiq shogirdlar ustozi  
  🔹 *Umida Pardalar* brendi asoschisi  

  tomonidan tayyorlangan *BEPUL masterklass* darsini olishingiz mumkin!

  👇 Boshlash uchun ismingizni tasdiqlang:
    `;

    bot.sendPhoto(chatId, './welcome.jpg', {
      caption: intro,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: name, callback_data: 'confirm_name' }]]
      }
    });
  });

  // 2. Confirm name → Ask phone number OR check subscription
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    if (query.data === 'confirm_name') {
      const name = query.from.first_name || 'Foydalanuvchi';
      if (!users[userId]) users[userId] = {};
      users[userId].name = name;

      logUsers(); // ✅ Log after saving name

      await bot.sendMessage(chatId, `😊 Rahmat, ${name}!\nIltimos, telefon raqamingizni yuboring:`, {
        reply_markup: {
          keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }

    if (query.data === 'check_join') {
      try {
        const status = await bot.getChatMember(channelUsername, userId);
        const isMember = ['member', 'administrator', 'creator'].includes(status.status);

        if (isMember) {
          await bot.sendMessage(chatId, "✅ Siz kanalga muvaffaqiyatli a’zo bo‘ldingiz!");

          try {
            await bot.sendVideo(chatId, 'BAACAgIAAxkBAAMzaGKDQvRfQIEyDdDxBRavmOzVTywAAjd2AAIGvBBLjth6h9U1_Aw2BA', {
              caption: "🎬 Bu masterklass haqida qisqacha video. Tomosha qiling!"
            });
          } catch (videoErr) {
            console.error("Video yuborishda xatolik:", videoErr.message);
            await bot.sendMessage(chatId, "⚠️ Video yuborishda muammo yuz berdi.");
          }

          return;
        } else {
          await bot.sendMessage(chatId, "❗ Siz hali kanalga a’zo emassiz. Iltimos, avval kanalga qo‘shiling.");
        }
      } catch (err) {
        await bot.sendMessage(chatId, "⚠️ Kanalga ulanishda xatolik yuz berdi.");
      }
    }
  });

  // 3. After phone number → Send channel invite
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!users[userId]) users[userId] = {};
    users[userId].phone = msg.contact.phone_number;

    logUsers(); // ✅ Log after saving phone

    const channelInfo = `
  📢 *Endi kanalga qo‘shiling!*

  Bu kanalda siz:

  📅 18-Iyundagi bepul masterklass haqida ma’lumotlar  
  🎥 Masterklass darslari  
  🧵 Eksklyuziv tikuvchilik sirlari  
  🎁 Sovg’alar va maslahatlar topasiz
    `;

    await bot.sendMessage(chatId, channelInfo, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Kanalga qo‘shilish", url: `https://t.me/${channelUsername.replace('@', '')}` }],
          [{ text: "✅ Tekshirish", callback_data: "check_join" }]
        ]
      }
    });
  });

  // Optional: debug video uploads
  bot.on('message', (msg) => {
    if (msg.video) {
      console.log("📁 file_id:", msg.video.file_id);
    }
  });

  // 🔐 Hidden admin command to list users in Telegram chat
  bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const entries = Object.entries(users);
    const list = entries.map(([id, user], i) =>
      `${i + 1}. ${user.name || 'Noma\'lum'} | ${user.phone || 'No phone'} | ID: ${id}`
    ).join('\n');

    bot.sendMessage(chatId, `👥 Foydalanuvchilar soni: ${entries.length}\n\n${list}`);
  });
