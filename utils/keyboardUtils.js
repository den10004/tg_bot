// keyboardUtils.js
const { Keyboard } = require("grammy");
const { MAX_BUTTONS_PER_ROW, MAX_BUTTON_WIDTH, quizBtn } = require("../data/variables");

function createAdaptiveKeyboard(items, hasBackButton = false) {
  const keyboard = new Keyboard();

  let currentRowLength = 0;
  let currentRowButtons = 0;

  items.forEach(item => {
    const buttonLength = item.length;
    
    if (buttonLength > MAX_BUTTON_WIDTH || currentRowButtons >= MAX_BUTTONS_PER_ROW) {
      keyboard.row();
      currentRowLength = 0;
      currentRowButtons = 0;
    }
    
    keyboard.text(item);
    currentRowLength += buttonLength;
    currentRowButtons++;
  });

  if (!hasBackButton && quizBtn) {
    keyboard.row().text("🎲 Викторина 🎲");
  }

  if (hasBackButton) {
    keyboard.row().text("Назад");
  }

  return keyboard
    .resized()
    .oneTime(false);
}

module.exports = {
  createAdaptiveKeyboard
};