const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// 🔐 Replace with your actual credentials
const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';
const ADMIN_ID = 5032534773;

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

const tempUsers = {};

// 👉 /start command: Ask for name
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  tempUsers[chatId] = { telegram_id: String(msg.from.id) };

  await bot.sendMessage(chatId, "👤 Ismingizni kiriting:");
});

// 📥 Handle name and then phone
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userState = tempUsers[chatId];

  // Only react if user is in registration flow
  if (!userState) return;

  // Name step
  if (!userState.name && msg.text && !msg.contact) {
    userState.name = msg.text;
    await bot.sendMessage(chatId, "📞 Endi telefon raqamingizni yuboring:", {
      reply_markup: {
        keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  // Contact step
  if (msg.contact && msg.contact.phone_number) {
    const phone = msg.contact.phone_number;
    const name = userState.name;
    const telegram_id = userState.telegram_id;

    const { error } = await supabase.from('users').upsert({
      id: telegram_id,
      telegram_id,
      name,
      phone,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('❌ Supabase error:', error.message);
      await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Qayta urinib ko‘ring.");
    } else {
      await bot.sendMessage(chatId, "✅ Ro‘yxatdan o‘tdingiz!");
    }

    delete tempUsers[chatId];
  }
});

// 📣 /broadcast Your message
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const text = match[1];

  const { data: users, error } = await supabase.from('users').select('telegram_id, name');
  if (error) {
    console.error(error.message);
    return bot.sendMessage(msg.chat.id, "❌ Foydalanuvchilarni olishda xatolik.");
  }

  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, text);
      sent++;
    } catch (err) {
      failed++;
      console.error(`❌ ${user.telegram_id}:`, err.message);
    }
  }

  bot.sendMessage(msg.chat.id, `📤 Yuborildi: ${sent} ta\n❌ Xatolik: ${failed} ta`);
});

// 🎉 /pick_winners
bot.onText(/\/pick_winners/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const { data: users, error } = await supabase.from('users').select('*');
  if (error || users.length < 3) {
    return bot.sendMessage(msg.chat.id, "❗ Yetarli foydalanuvchi topilmadi yoki xatolik yuz berdi.");
  }

  const winners = users.sort(() => 0.5 - Math.random()).slice(0, 3);

  for (const user of winners) {
    await supabase.from('winners').insert({
      user_id: user.telegram_id,
      selected_at: new Date().toISOString()
    });

    await bot.sendMessage(user.telegram_id, `🎉 Tabriklaymiz ${user.name}! Siz g‘olib bo‘ldingiz!`);
  }

  bot.sendMessage(msg.chat.id, `🏆 G‘oliblar:\n${winners.map(w => '👤 ' + w.name).join('\n')}`);
});
