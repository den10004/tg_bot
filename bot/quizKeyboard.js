// bot/quizKeyboard.js
const { InlineKeyboard } = require("grammy");
const { MAX_BUTTON_WIDTH, MAX_BUTTONS_PER_ROW } = require("../data/variables");

/**
 * Форматирует подпись кнопки, добавляя "✅" если выбрано
 */
function formatAnswerLabel(answer, isSelected) {
  let label = isSelected ? `✅ ${answer}` : answer;
  return label.length > MAX_BUTTON_WIDTH
    ? label.slice(0, MAX_BUTTON_WIDTH - 3) + "..."
    : label;
}

/**
 * Добавляет кнопки с ответами в клавиатуру
 */
function buildAnswerButtons(keyboard, answers, answerType, userId, selected) {
  let currentRowButtons = 0;

  answers.forEach((answer, index) => {
    const isSelected =
      (answerType === "multiple" && selected.includes(index)) ||
      (answerType === "single" && selected === index);

    const label = formatAnswerLabel(answer, isSelected);
    const shouldStartNewRow =
      label.length > MAX_BUTTON_WIDTH || currentRowButtons >= MAX_BUTTONS_PER_ROW;

    if (shouldStartNewRow) {
      keyboard.row();
      currentRowButtons = 0;
    }

    keyboard.text(label, `quiz_${answerType}_${userId}_${index}`);
    currentRowButtons++;
  });
}

/**
 * Создает inline-клавиатуру викторины для текущего вопроса
 */
function createQuizKeyboard(answers, answerType, userId, selected) {
  const keyboard = new InlineKeyboard();

  if (answerType === "single" || answerType === "multiple") {
    buildAnswerButtons(keyboard, answers, answerType, userId, selected);
    keyboard.row().text("Подтвердить выбор", `quiz_submit_${userId}`);
  }

  keyboard.row().text("Выйти из викторины", `quiz_exit_${userId}`);
  return keyboard;
}

module.exports = {
  createQuizKeyboard,
  buildAnswerButtons,
  formatAnswerLabel
};
