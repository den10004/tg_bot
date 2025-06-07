async function updateQuizKeyboard(ctx, state, userId, questionText, keyboard) {
  try {
    if (state.currentMessageId) {
      await ctx.api.editMessageReplyMarkup(ctx.chat.id, state.currentMessageId, {
        reply_markup: keyboard,
      });
    } else {
      const message = await ctx.reply(questionText, { reply_markup: keyboard });
      state.currentMessageId = message.message_id;
    }
  } catch (error) {
    console.error(`Ошибка при обновлении клавиатуры для пользователя ${userId}: ${error.message}`);
    const message = await ctx.reply(questionText, { reply_markup: keyboard });
    state.currentMessageId = message.message_id;
  }
}

module.exports = {
  updateQuizKeyboard
};