const TelegramBot = require('node-telegram-bot-api');
const token = '7228927101:AAFn6d5Z371GXPT8F5nf4aUGSd0O_F7_tAQ'; // replace with your new token
const channelUsername = '@umida_pardalar1';

const bot = new TelegramBot(token, { polling: true });

bot.getMe().then(me => {
  console.log(`🤖 Bot launched as @${me.username}`);
});

// Start command
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

// Subscription check
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (query.data === 'check_join') {
    try {
      const status = await bot.getChatMember(channelUsername, userId);
      const isMember = ['member', 'administrator', 'creator'].includes(status.status);

      if (isMember) {
        await bot.sendMessage(chatId, "✅ Siz kanalga muvaffaqiyatli a’zo bo‘ldingiz!");
      } else {
        await bot.sendMessage(chatId, "❗ Siz hali kanalga a’zo emassiz. Iltimos, avval kanalga qo‘shiling.");
      }
    } catch (err) {
      await bot.sendMessage(chatId, "⚠️ Tekshirishda xatolik yuz berdi. Keyinroq urinib ko‘ring.");
    }
  }
});
