const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = '7661394640:AAHns_1buMgks9n_40xWtgzx2Lei5CXXMi8';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';

const ADMIN_ID = 5032534773;


// === INIT ===
const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Helper: check if user exists ---
async function isUserRegistered(telegram_id) {
  const { data, error } = await supabase
    .from('bot_user_data')
    .select('id')
    .eq('telegram_id', telegram_id)
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase SELECT error:', error);
    return false; // Assume not registered on error to be safe
  }
  return !!data;
}

// --- /start handler ---
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegram_id = String(msg.from.id);

  try {
    if (await isUserRegistered(telegram_id)) {
      return bot.sendMessage(chatId, "✅ Siz allaqachon ro'yxatdan o'tgansiz.");
    }

    const { error: insertError } = await supabase
      .from('bot_user_data')
      .insert({ telegram_id });

    if (insertError) {
      console.error('❌ Supabase INSERT error:', insertError);
      return bot.sendMessage(chatId, `❌ Ro'yxatdan o'tishda xatolik:\n${insertError.message}`);
    }

    return bot.sendMessage(chatId, "✅ Ro'yxatdan muvaffaqiyatli o'tdingiz!");
  } catch (err) {
    console.error('❌ GENERAL ERROR:', err);
    return bot.sendMessage(chatId, "❌ Noma'lum xatolik yuz berdi.");
  }
});

// --- Inline button handler ---
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "start_command") {
    // Simulate /start command triggered by button
    bot.emit('text', {
      chat: { id: chatId },
      text: '/start',
      from: query.from
    });
    bot.answerCallbackQuery(query.id);
  } else {
    bot.answerCallbackQuery(query.id);
  }
});

// --- Catch-all message handler for unregistered users ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const telegram_id = String(msg.from.id);
  const text = msg.text;

  if (!text) return; // ignore non-text messages
  if (text.startsWith('/start')) return; // /start already handled

  try {
    if (!(await isUserRegistered(telegram_id))) {
      // Send inline "Start" button prompt
      await bot.sendMessage(chatId, "Salom! Boshlash uchun pastdagi tugmani bosing:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Boshlash", callback_data: "start_command" }]
          ]
        }
      });
    }
  } catch (err) {
    console.error('❌ GENERAL ERROR in message handler:', err);
  }
});

// --- /broadcast command for admin ---
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const text = match[1];

  try {
    const { data: users, error } = await supabase
      .from('bot_user_data')
      .select('telegram_id');

    if (error) {
      console.error('❌ Supabase SELECT error (broadcast):', error);
      return bot.sendMessage(msg.chat.id, `❌ Xatolik:\n${error.message}`);
    }

    for (const user of users) {
      try {
        await bot.sendMessage(user.telegram_id, text);
      } catch (e) {
        console.warn(`⚠️ Xabar yuborib bo'lmadi: ${user.telegram_id}`);
      }
    }

    bot.sendMessage(msg.chat.id, '📤 Xabar muvaffaqiyatli yuborildi.');
  } catch (err) {
    console.error('❌ GENERAL ERROR (broadcast):', err);
  }
});

// --- /pick_winners command for admin ---
bot.onText(/\/pick_winners/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  try {
    const { data: users, error } = await supabase
      .from('bot_user_data')
      .select('telegram_id');

    if (error) {
      console.error('❌ Supabase SELECT error (winners):', error);
      return bot.sendMessage(msg.chat.id, `❌ Xatolik:\n${error.message}`);
    }

    if (!users || users.length < 3) {
      return bot.sendMessage(msg.chat.id, '❗ Kamida 3 ta foydalanuvchi bo‘lishi kerak.');
    }

    const winners = users.sort(() => 0.5 - Math.random()).slice(0, 3);

    for (const user of winners) {
      await supabase.from('winners').insert({
        user_id: user.telegram_id,
        selected_at: new Date().toISOString()
      });

      await bot.sendMessage(user.telegram_id, `🎉 Tabriklaymiz! Siz g‘olib bo‘ldingiz!`);
    }

    bot.sendMessage(msg.chat.id, `🏆 G‘oliblar:\n${winners.map(w => '👤 ' + w.telegram_id).join('\n')}`);
  } catch (err) {
    console.error('❌ GENERAL ERROR (pick_winners):', err);
  }
});
