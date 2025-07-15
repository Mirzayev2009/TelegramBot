const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';

const ADMIN_ID = 5032534773;

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

const tempUsers = {};

// 👋 /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  tempUsers[chatId] = { telegram_id: String(msg.from.id) };

  await bot.sendMessage(chatId, "👤 Ismingizni tanlang yoki yozing:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Mirzayev Alisher", callback_data: 'name_Mirzayev Alisher' }],
        [{ text: "Yozib yuboraman", callback_data: 'name_manual' }]
      ]
    }
  });
});

// 👉 Handle name choice
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (!tempUsers[chatId]) return;

  if (query.data.startsWith('name_')) {
    const chosen = query.data.split('_')[1];

    if (chosen === 'manual') {
      bot.sendMessage(chatId, "✍️ Ismingizni yozing:");
    } else {
      tempUsers[chatId].name = chosen;
      askForPhone(chatId);
    }
  }
});

// 📝 Handle name input
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = tempUsers[chatId];

  if (!state) return;

  if (!state.name && msg.text && !msg.contact) {
    state.name = msg.text;
    return askForPhone(chatId);
  }

  if (msg.contact) {
    const phone = msg.contact.phone_number;
    const name = state.name;
    const telegram_id = state.telegram_id;

    const { error } = await supabase.from('users').upsert({
      id: telegram_id,
      telegram_id,
      name,
      phone,
      created_at: new Date().toISOString()
    });

    if (error) {
      await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Qayta urinib ko‘ring.");
    } else {
      await bot.sendMessage(chatId, "✅ Ro‘yxatdan o‘tdingiz!");
    }

    delete tempUsers[chatId];
  } else if (!msg.contact && state.name && !state.phone && msg.text) {
    const phone = msg.text;
    const { error } = await supabase.from('users').upsert({
      id: state.telegram_id,
      telegram_id: state.telegram_id,
      name: state.name,
      phone,
      created_at: new Date().toISOString()
    });

    if (error) {
      await bot.sendMessage(chatId, "❌ Xatolik. Raqamni to‘g‘ri kiriting.");
    } else {
      await bot.sendMessage(chatId, "✅ Ro‘yxatdan o‘tdingiz!");
    }

    delete tempUsers[chatId];
  }
});

// 📲 Ask phone helper
function askForPhone(chatId) {
  bot.sendMessage(chatId, "📞 Telefon raqamingizni yuboring:", {
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

// 📣 /broadcast <msg>
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const text = match[1];
  const { data: users, error } = await supabase.from('users').select('telegram_id, name');

  if (error) return bot.sendMessage(msg.chat.id, "❌ Supabase error");

  let sent = 0;
  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, text);
      sent++;
    } catch (e) {}
  }

  bot.sendMessage(msg.chat.id, `📤 Yuborildi: ${sent} ta`);
});

// 🎁 /pick_winners
bot.onText(/\/pick_winners/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const { data: users, error } = await supabase.from('users').select('*');
  if (error || users.length < 3) {
    return bot.sendMessage(msg.chat.id, "❗ Kamida 3 foydalanuvchi kerak.");
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



