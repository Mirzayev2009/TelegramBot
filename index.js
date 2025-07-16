const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';

const ADMIN_ID = 5032534773;



const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);
const tempUsers = {};

// Start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegram_id = String(msg.from.id);

  const { data } = await supabase.from('users').select('id').eq('telegram_id', telegram_id).maybeSingle();
  if (data) return bot.sendMessage(chatId, '✅ Siz allaqachon ro‘yxatdan o‘tgansiz.');

  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ').trim();
  tempUsers[chatId] = { telegram_id, waiting: 'name' };

  bot.sendMessage(chatId, '👤 Ismingiz qanday?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: fullName, callback_data: `use_name_${encodeURIComponent(fullName)}` }],
        [{ text: '✍️ Ismimni yozaman', callback_data: 'name_manual' }]
      ]
    }
  });
});

// Callback (name selection)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  const data = query.data;

  if (data.startsWith('use_name_')) {
    state.name = decodeURIComponent(data.replace('use_name_', ''));
    state.waiting = 'phone';
    askPhone(chatId);
  } else if (data === 'name_manual') {
    state.waiting = 'manual_name';
    bot.sendMessage(chatId, '✍️ Iltimos, ismingizni yozing:');
  }
});

// Message handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = tempUsers[chatId];
  if (!state) return;

  // Manual name
  if (state.waiting === 'manual_name' && msg.text) {
    state.name = msg.text.trim();
    state.waiting = 'phone';
    return askPhone(chatId);
  }

  // Phone
  if (state.waiting === 'phone') {
    if (msg.contact) {
      state.phone = msg.contact.phone_number;
      return saveUser(chatId);
    } else if (msg.text) {
      state.phone = msg.text.trim();
      return saveUser(chatId);
    }
  }
});

// Ask for phone number
function askPhone(chatId) {
  bot.sendMessage(chatId, '📞 Telefon raqamingizni yuboring:\n\n📱 Tugmani bosing yoki quyidagi formatlardan birida yozing:\n+998901234567\n998901234567\n901234567', {
    reply_markup: {
      keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

// Save user
async function saveUser(chatId) {
  const state = tempUsers[chatId];
  if (!state || !state.name || !state.phone) return;

  let phone = state.phone.replace(/\s|[-()]/g, '');

  if (/^9\d{8}$/.test(phone)) phone = '+998' + phone;
  else if (/^998\d{9}$/.test(phone)) phone = '+' + phone;
  else if (!/^\+998\d{9}$/.test(phone)) {
    return bot.sendMessage(chatId, '❗ Noto‘g‘ri raqam formati.\n+998901234567 yoki 998901234567 yoki 901234567 yozing.');
  }

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', state.telegram_id)
    .maybeSingle();

  if (existing) {
    delete tempUsers[chatId];
    return bot.sendMessage(chatId, '⚠️ Siz allaqachon ro‘yxatdan o‘tgansiz.');
  }

  const { error } = await supabase.from('users').insert({
    id: state.telegram_id,
    telegram_id: state.telegram_id,
    name: state.name,
    phone,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error('❌ Supabase error:', error);
    return bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, yana urinib ko‘ring.');
  }

  bot.sendMessage(chatId, '✅ Ro‘yxatdan o‘tdingiz!');
  delete tempUsers[chatId];
}

// Admin broadcast
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const text = match[1];
  const { data: users } = await supabase.from('users').select('telegram_id');

  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, text);
    } catch (e) {
      console.warn('❌ Xabar yuborilmadi:', user.telegram_id);
    }
  }

  bot.sendMessage(msg.chat.id, '📤 Xabar yuborildi.');
});

// Admin pick winners
bot.onText(/\/pick_winners/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const { data: users } = await supabase.from('users').select('*');
  if (!users || users.length < 3) return bot.sendMessage(msg.chat.id, '❗ Kamida 3 foydalanuvchi kerak.');

  const winners = users.sort(() => 0.5 - Math.random()).slice(0, 3);

  for (const user of winners) {
    await supabase.from('winners').insert({
      user_id: user.telegram_id,
      selected_at: new Date().toISOString()
    });

    await bot.sendMessage(user.telegram_id, `🎉 Tabriklaymiz ${user.name}, siz g‘olib bo‘ldingiz!`);
  }

  bot.sendMessage(msg.chat.id, `🏆 G‘oliblar:\n${winners.map(w => '👤 ' + w.name).join('\n')}`);
});
