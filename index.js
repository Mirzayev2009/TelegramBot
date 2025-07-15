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
    .select('id')
    .eq('telegram_id', telegram_id)
    .single();

  if (data) {
    return bot.sendMessage(chatId, "✅ Siz allaqachon ro‘yxatdan o‘tgansiz.");
  }

  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
  tempUsers[chatId] = { telegram_id };

  await bot.sendMessage(chatId, "👤 Ismingizni tasdiqlang:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: fullName, callback_data: `name_${fullName}` }]
      ]
    }
  });
});

// Handle name confirmation
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  const name = query.data.replace('name_', '');
  state.name = name;

  bot.sendMessage(chatId, "📞 Telefon raqamingizni yuboring:", {
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

// Handle phone via contact or manual entry
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = tempUsers[chatId];
  if (!state || state.phone) return;

  // via contact button
  if (msg.contact && msg.contact.phone_number) {
    state.phone = msg.contact.phone_number;
    return saveUser(chatId);
  }

  // manual input
  if (msg.text && !msg.contact && state.name && !state.phone) {
    state.phone = msg.text;
    return saveUser(chatId);
  }
});

// Save user to Supabase
async function saveUser(chatId) {
  const state = tempUsers[chatId];

  const { error } = await supabase.from('users').insert({
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
