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

  // Check if already registered
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegram_id)
    .single();

  if (data) {
    return bot.sendMessage(chatId, "✅ Siz allaqachon ro‘yxatdan o‘tibsiz.");
  }

  // Save telegram_id temporarily
  tempUsers[chatId] = { telegram_id };

  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

  await bot.sendMessage(chatId, "👤 Ismingizni tasdiqlang:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: fullName, callback_data: `name_${fullName}` }],
        [{ text: "✍️ Yozib kiritaman", callback_data: 'name_manual' }]
      ]
    }
  });
});

// Handle callback buttons
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  const data = query.data;

  if (data.startsWith('name_')) {
    state.name = data.replace('name_', '');
    askForPhone(chatId);
  }

  if (data === 'name_manual') {
    bot.sendMessage(chatId, "✍️ Iltimos, ismingizni yozing:");
  }

  if (data === 'confirm_phone') {
    await saveUser(chatId);
  }

  if (data === 'retry_phone') {
    delete state.phone;
    askForPhone(chatId);
  }
});

// Handle text messages or phone
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  // Manual name entry
  if (!state.name && msg.text && !msg.contact) {
    state.name = msg.text;
    return askForPhone(chatId);
  }

  // Phone contact shared
  if (msg.contact && !state.phone) {
    state.phone = msg.contact.phone_number;
    return confirmPhone(chatId, state.phone);
  }

  // Manual phone input
  if (state.name && !state.phone && msg.text) {
    state.phone = msg.text;
    return confirmPhone(chatId, state.phone);
  }
});

// Ask for phone number
function askForPhone(chatId) {
  bot.sendMessage(chatId, "📞 Telefon raqamingizni yuboring:", {
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

// Confirm phone number
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
    console.error(error);
    return bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.");
  }

  await bot.sendMessage(chatId, "✅ Ro‘yxatdan muvaffaqiyatli o‘tdingiz!");
  delete tempUsers[chatId];
}
