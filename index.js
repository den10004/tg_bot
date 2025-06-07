require('dotenv').config();
const { Bot, Keyboard } = require("grammy");
const { quizBtn } = require("./data/variables");
const { createAdaptiveKeyboard } = require("./utils/keyboardUtils");
const { startQuiz, handleQuizAnswer, endQuiz, getUserResults, downloadResultsCSV } = require("./bot/quiz");
const { loadConfig} = require("./config/loadConfig");


const bot = new Bot(process.env.BOT_API_KEY);


bot.command('download', async (ctx) => {
  await downloadResultsCSV(ctx);
});

bot.command("start", async (ctx) => {
  const config = await loadConfig();
  
  if (config.length === 0) {
    return ctx.reply("Ошибка: конфигурация пуста или некорректна.");
  }

  const firstLevelItems = config.map(item => Object.keys(item)[0]);
  const keyboard = createAdaptiveKeyboard(firstLevelItems);
  const userName = ctx.from.first_name || ctx.from.username || "Пользователь";
  await ctx.reply(`Добро пожаловать, ${userName}! Используйте кнопки меню для навигации. Выберите опцию для продолжения.`, {
    reply_markup: keyboard,
  });
});


bot.on("message:text", async (ctx) => {
  const config = await loadConfig();
  const messageText = ctx.message.text;

  if (config.length === 0) {
    return ctx.reply("Ошибка: конфигурация пуста или некорректна.");
  }

  if (messageText === "🎲 Викторина 🎲" && quizBtn) {
    const result = await startQuiz(ctx);
    if (!result.success) {
      const firstLevelItems = config.map(item => Object.keys(item)[0]);
      const keyboard = createAdaptiveKeyboard(firstLevelItems);
      return ctx.reply(result.message, {
        reply_markup: keyboard,
      });
    }
    return;
  }
  
  if (messageText === "📊 Мои результаты") {
    const results = await getUserResults(ctx.from.id);
    const firstLevelItems = config.map(item => Object.keys(item)[0]);
    const keyboard = createAdaptiveKeyboard(firstLevelItems);
    
    if (results.length === 0) {
      return ctx.reply("У вас пока нет результатов викторины. Пройдите викторину, чтобы увидеть свои результаты!", {
        reply_markup: keyboard,
      });
    }

    let resultMessage = "Ваши результаты викторины:\n\n";
    results.forEach((result, index) => {
      resultMessage += `Попытка ${index + 1} (${result.date}):\n`;
      resultMessage += `Пользователь: ${result.username}\n`;
      resultMessage += `Счёт: ${result.score} из ${result.totalQuestions}\n\n`;
    });

    return ctx.reply(resultMessage, {
      reply_markup: keyboard,
    });
  }


if (messageText === "Выйти из викторины") {
  await endQuiz(ctx, false, true); 
  return; 
}

  const quizHandled = await handleQuizAnswer(ctx, messageText);
  if (quizHandled) {
    return;
  }


  const firstLevelIndex = config.findIndex(item => Object.keys(item)[0] === messageText);
  
  if (firstLevelIndex !== -1) {
    const subItems = Object.keys(config[firstLevelIndex][messageText]);
    const keyboard = createAdaptiveKeyboard(subItems, true);

    await ctx.reply("Выберите подопцию:", {
      reply_markup: keyboard,
    });
  } else if (messageText === "Назад") {
    const firstLevelItems = config.map(item => Object.keys(item)[0]);
    const keyboard = createAdaptiveKeyboard(firstLevelItems);

    await ctx.reply("Выберите опцию:", {
      reply_markup: keyboard,
    });
  } else {

    for (const item of config) {
      const mainKey = Object.keys(item)[0];
      const subItems = item[mainKey];
      
      if (subItems[messageText]) {
        return ctx.reply(subItems[messageText], {
          reply_markup: new Keyboard()
            .text("Назад").row()
            .resized()
            .oneTime(false)
        });
      }
    }
    await ctx.reply("Для начала работы с ботом, используйте команду /start");
  }
});


bot.on("callback_query:data", async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;


  try {
    const quizHandled = await handleQuizAnswer(ctx, data);
    if (quizHandled) {
      await ctx.answerCallbackQuery();
    } else {
      if (!quizStates.has(userId)) {
        await ctx.answerCallbackQuery();
      } else {
        await ctx.answerCallbackQuery({ text: "Ошибка обработки ответа. Попробуйте снова." });
      }
    }
  } catch (error) {
    console.error(`Error handling callback for user ${userId}: ${error.message}`);
    await ctx.answerCallbackQuery({ text:  "Произошла ошибка. Пожалуйста, попробуйте снова." });
  }
});

bot.start().catch((err) => console.error("Ошибка запуска бота:", err));



module.exports = { createAdaptiveKeyboard };