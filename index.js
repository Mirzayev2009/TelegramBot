const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';

const ADMIN_ID = 5032534773;


const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

const tempUsers = {};

// /start — Start registration if not already registered
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegram_id = String(msg.from.id);

  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegram_id)
    .single();

  if (data) {
    return bot.sendMessage(chatId, "✅ Siz allaqachon ro‘yxatdan o‘tgansiz.");
  }

  tempUsers[chatId] = { telegram_id };
  bot.sendMessage(chatId, "👤 Iltimos, ismingizni yozing:");
});

// Handle name and phone flow
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  // Save name
  if (!state.name && msg.text && !msg.contact) {
    state.name = msg.text;
    return bot.sendMessage(chatId, `Ismingiz: *${state.name}*\nTasdiqlaysizmi?`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Ha", callback_data: "confirm_name" }],
          [{ text: "❌ Yoq, qayta kiritaman", callback_data: "retry_name" }]
        ]
      }
    });
  }

  // Save phone by Telegram contact
  if (msg.contact && state.name && !state.phone) {
    state.phone = msg.contact.phone_number;
    return confirmPhone(chatId, state.phone);
  }

  // Manual phone entry
  if (state.name && !state.phone && msg.text) {
    state.phone = msg.text;
    return confirmPhone(chatId, state.phone);
  }
});

// Handle inline confirmations
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  const data = query.data;

  if (data === "confirm_name") {
    askForPhone(chatId);
  } else if (data === "retry_name") {
    delete tempUsers[chatId].name;
    bot.sendMessage(chatId, "❌ Iltimos, ismingizni qaytadan yozing:");
  } else if (data === "confirm_phone") {
    await saveUser(chatId);
  } else if (data === "retry_phone") {
    delete tempUsers[chatId].phone;
    askForPhone(chatId);
  }
});

// Ask for phone
function askForPhone(chatId) {
  bot.sendMessage(chatId, "📞 Telefon raqamingizni yuboring:", {
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

// Confirm phone
function confirmPhone(chatId, phone) {
  bot.sendMessage(chatId, `Raqamingiz: *${phone}*\nTasdiqlaysizmi?`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Ha", callback_data: "confirm_phone" }],
        [{ text: "❌ Yoq, qayta kiritaman", callback_data: "retry_phone" }]
      ]
    }
  });
}

// Save user to Supabase
async function saveUser(chatId) {
  const state = tempUsers[chatId];

  const { error } = await supabase.from('users').upsert({
    id: state.telegram_id,
    telegram_id: state.telegram_id,
    name: state.name,
    phone: state.phone,
    created_at: new Date().toISOString()
  });

  if (error) {
    if (error.message.includes('duplicate')) {
      await bot.sendMessage(chatId, "⚠️ Siz allaqachon ro‘yxatdan o‘tgansiz.");
    } else {
      console.error(error);
      await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Qayta urinib ko‘ring.");
    }
  } else {
    await bot.sendMessage(chatId, "✅ Ro‘yxatdan muvaffaqiyatli o‘tdingiz!");
  }

  delete tempUsers[chatId];
}

// 📣 /broadcast <message>
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const text = match[1];

  const { data: users, error } = await supabase.from('users').select('telegram_id');
  if (error) return bot.sendMessage(msg.chat.id, "❌ Supabase xatosi.");

  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, text);
    } catch (err) {}
  }

  bot.sendMessage(msg.chat.id, `📤 Xabar barcha foydalanuvchilarga yuborildi.`);
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

  bot.sendMessage(msg.chat.id, `🏆 G‘oliblar:\n${winners.map(w => `👤 ${w.name}`).join('\n')}`);
});
