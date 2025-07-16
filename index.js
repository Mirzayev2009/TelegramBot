const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';

const ADMIN_ID = 5032534773;

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);
const tempUsers = {};

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegram_id = String(msg.from.id);

  const { data } = await supabase
    .from('users')
    .select('id', { head: true })
    .eq('telegram_id', telegram_id)
    .maybeSingle();

  if (data) return bot.sendMessage(chatId, "✅ Siz allaqachon ro‘yxatdan o‘tgansiz.");

  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
  tempUsers[chatId] = { telegram_id };

  bot.sendMessage(chatId, "👤 Ismingizni tanlang:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: fullName, callback_data: `name_${encodeURIComponent(fullName)}` }],
        [{ text: "✍️ Yozib kiritaman", callback_data: "name_manual" }]
      ]
    }
  });
});

// Handle name via callback
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  const data = query.data;

  if (data.startsWith("name_")) {
    state.name = decodeURIComponent(data.replace("name_", ""));
    askPhone(chatId);
  }

  if (data === "name_manual") {
    bot.sendMessage(chatId, "✍️ Iltimos, ismingizni yozing:");
  }
});

// Handle messages (name / phone)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  // Manual name input
  if (!state.name && msg.text && !msg.contact) {
    state.name = msg.text;
    return askPhone(chatId);
  }

  // Phone sent via contact
  if (msg.contact && !state.phone) {
    state.phone = msg.contact.phone_number;
    return checkAndSave(chatId);
  }

  // Phone typed manually
  if (state.name && !state.phone && msg.text && !msg.contact) {
    state.phone = msg.text;
    return checkAndSave(chatId);
  }
});

// Ask for phone number
function askPhone(chatId) {
  bot.sendMessage(chatId, "📞 Telefon raqamingizni yuboring.\n\n📱 Tugmani bosing (agar Telegram profilingizda raqam ulangan bo‘lsa)\n\nAgar ishlamasa, ✍️ quyidagi shaklda yozing:\n\n`+998901234567` yoki `901234567`", {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

// Save user only when name + phone are valid
async function checkAndSave(chatId) {
  const state = tempUsers[chatId];
  if (!state.name || !state.phone) return;

  const phone = state.phone.replace(/\s/g, '');
  const isValid = /^(\+998)?\d{9}$/.test(phone);

  if (!isValid) {
    return bot.sendMessage(chatId, "❗ Telefon raqam noto‘g‘ri. Iltimos, quyidagicha yozing:\n\n`+998901234567` yoki `901234567`", {
      parse_mode: "Markdown"
    });
  }

  // ⚡ Instant feedback while Supabase saves
  await bot.sendMessage(chatId, "⏳ Ma'lumotlaringiz saqlanmoqda. Iltimos, kuting...");

  const { data: existing } = await supabase
    .from('users')
    .select('id', { head: true })
    .eq('telegram_id', state.telegram_id)
    .maybeSingle();

  if (existing) {
    await bot.sendMessage(chatId, "⚠️ Siz allaqachon ro‘yxatdan o‘tgansiz.");
  } else {
    const { error } = await supabase.from('users').insert({
      id: state.telegram_id,
      telegram_id: state.telegram_id,
      name: state.name,
      phone: phone,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return bot.sendMessage(chatId, "❌ Xatolik yuz berdi.");
    }

    await bot.sendMessage(chatId, "✅ Ro‘yxatdan o‘tdingiz!");
  }

  delete tempUsers[chatId];
}

// /broadcast command
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const text = match[1];

  const { data: users } = await supabase.from('users').select('telegram_id');

  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, text);
    } catch (e) {
      console.warn(`❌ Yuborilmadi ${user.telegram_id}:`, e.message);
    }
  }

  bot.sendMessage(msg.chat.id, "📤 Xabar yuborildi.");
});

// /pick_winners command
bot.onText(/\/pick_winners/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const { data: users } = await supabase.from('users').select('*');
  if (!users || users.length < 3) {
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