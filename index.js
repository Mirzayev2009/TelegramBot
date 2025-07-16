const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';

const ADMIN_ID = 5032534773;

// === 🚀 Setup ===
const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

// === /start command ===
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegram_id = String(msg.from.id);

  try {
    console.log('🔍 Checking Telegram ID:', telegram_id);

    const { data: existing, error: checkError } = await supabase
      .from('telegram_users')
      .select('id')
      .eq('telegram_id', telegram_id)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Supabase SELECT error:', checkError);
      throw checkError;
    }

    if (existing) {
      console.log('✅ Already registered:', telegram_id);
      return bot.sendMessage(chatId, "Ro'yxatdan o'tdingiz");
    }

    const { error: insertError } = await supabase
      .from('telegram_users')
      .insert({ telegram_id });

    if (insertError) {
      console.error('❌ Supabase INSERT error:', insertError);
      throw insertError;
    }

    console.log('✅ Telegram ID inserted:', telegram_id);
    return bot.sendMessage(chatId, "Ro'yxatdan o'tdingiz");

  } catch (err) {
    console.error('❌ Final error handler:', err);
    return bot.sendMessage(chatId, "❌ Tekshirishda xatolik.");
  }
});

// === /broadcast command ===
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const text = match[1];
  const { data: users, error } = await supabase.from('telegram_users').select('telegram_id');

  if (error) {
    console.error('❌ Broadcast select error:', error);
    return bot.sendMessage(msg.chat.id, "❌ Foydalanuvchilarni olishda xatolik.");
  }

  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, text);
    } catch (e) {
      console.warn('❌ Yuborilmadi:', user.telegram_id);
    }
  }

  bot.sendMessage(msg.chat.id, '📤 Xabar yuborildi.');
});

// === /pick_winners command ===
bot.onText(/\/pick_winners/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const { data: users, error } = await supabase.from('telegram_users').select('*');
  if (error) {
    console.error('❌ Winner select error:', error);
    return bot.sendMessage(msg.chat.id, "❌ Foydalanuvchilarni olishda xatolik.");
  }

  if (!users || users.length < 3) {
    return bot.sendMessage(msg.chat.id, '❗ Kamida 3 foydalanuvchi kerak.');
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
});
