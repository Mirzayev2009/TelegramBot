const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// 🔐 Replace with your credentials
const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ';
const supabaseUrl = 'https://scinkyuoosbtpdowdzhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaW5reXVvb3NidHBkb3dkemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTQ4NTQsImV4cCI6MjA2NzgzMDg1NH0.eiku1mD-_bZXUoIJHmhJ6IfemmBPxcnjms1buENCcyw';
const channelUsername = '@umida_pardalarN1';
const ADMIN_ID = 5032534773; // Replace with your Telegram user ID

// Init
const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔄 Save user to Supabase
async function saveUser(user) {
  const { error } = await supabase
    .from('users')
    .upsert({
      telegram_id: String(user.id),
      name: user.first_name,
      joined_at: new Date().toISOString()
    }, { onConflict: ['telegram_id'] });

  if (error) console.error('❌ Supabase insert error:', error.message);
  else console.log(`✅ Saved user: ${user.first_name}`);
}

// 🤖 Start bot
bot.getMe().then(me => {
  console.log(`🤖 Bot launched as @${me.username}`);
});

// 🟢 /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const message = `
🤝 *Assalomu alaykum!*

Endi faqat oxirgi bosqichgina qoldi, masterklass mana shu Telegram kanalmizda bo'lib o'tadi! 👇
  `;

  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔗 Kanalga qo‘shilish', url: `https://t.me/${channelUsername.replace('@', '')}` }],
        [{ text: '✅ Tekshirish', callback_data: 'check_join' }]
      ]
    }
  });
});

// 🔍 Check subscription + save user
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (query.data === 'check_join') {
    try {
      const status = await bot.getChatMember(channelUsername, userId);
      const isMember = ['member', 'administrator', 'creator'].includes(status.status);

      if (isMember) {
        await bot.sendMessage(chatId, "✅ Siz kanalga muvaffaqiyatli a’zo bo‘ldingiz!");
        await saveUser(query.from);
      } else {
        await bot.sendMessage(chatId, "❗ Siz hali kanalga a’zo emassiz. Iltimos, avval kanalga qo‘shiling.");
      }
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "⚠️ Tekshirishda xatolik yuz berdi. Keyinroq urinib ko‘ring.");
    }
  }
});


// 📣 /notify command — send message to all users
bot.onText(/\/notify/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const { data, error } = await supabase.from('users').select('telegram_id, name');
  if (error) return console.error('Fetch error:', error);

  for (let user of data) {
    try {
      await bot.sendMessage(user.telegram_id, `📢 Eslatma: Masterklass tez orada boshlanadi. Qatnashishni unutmang!`);
    } catch (e) {
      console.error(`❌ Error sending to ${user.name}:`, e.message);
    }
  }

  bot.sendMessage(msg.chat.id, '✅ Xabar barcha foydalanuvchilarga yuborildi.');
});

// 🎁 /pick_winners command — choose 3 random users
bot.onText(/\/pick_winners/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const { data, error } = await supabase.from('users').select('*');
  if (error) return console.error('Fetch error:', error);

  const shuffled = data.sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, 3);

  for (let winner of winners) {
    await supabase.from('winners').insert({
      user_id: winner.telegram_id,
      selected_at: new Date().toISOString()
    });

    bot.sendMessage(winner.telegram_id, `🎉 Tabriklaymiz ${winner.name}! Siz g‘oliblardan birisiz!`);
  }

  bot.sendMessage(msg.chat.id, `🏆 G‘oliblar:\n${winners.map(w => '👤 ' + w.name).join('\n')}`);
});

const { createClient } = require('@supabase/supabase-js');


bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const messageText = match[1];

  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(chatId, "⛔ Sizda ruxsat yo‘q.");
  }

  // Fetch all telegram_id from Supabase
  const { data: users, error } = await supabase.from('users').select('telegram_id');

  if (error) {
    console.error("❌ Supabase error:", error.message);
    return bot.sendMessage(chatId, "❗ Foydalanuvchilarni olishda xatolik.");
  }

  let success = 0, failed = 0;

  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, messageText);
      success++;
    } catch (err) {
      failed++;
      console.error(`❌ User ${user.telegram_id}:`, err.message);
    }
  }

  bot.sendMessage(chatId, `✅ Yuborildi: ${success} ta\n❌ Xatolik: ${failed} ta`);
});
