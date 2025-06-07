async function sendStartCommand(ctx, userId, chatId, maxRetries = 3, retryDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ctx.api.sendMessage(chatId, '/start');
      return true;
    } catch (error) {
      console.error(`Failed to send /start command for user ${userId} (chat_id: ${chatId}, attempt: ${attempt}/${maxRetries}): ${error.message}`, {
        errorCode: error.code,
        errorDescription: error.description
      });
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  console.error(`All attempts to send /start command failed for user ${userId} (chat_id: ${chatId})`);
  return false;
}

module.exports = {
  sendStartCommand
};