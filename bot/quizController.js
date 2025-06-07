const fs = require("fs").promises;
const { InputFile } = require("grammy");

const {
  QUIZ_START_TIME,
  QUIZ_END_TIME,
  TIME_LIMIT,
  csvFilePath,
  randomizeQuestions,
  randomizeAnswers,
} = require("../data/variables");

const { loadConfig } = require("../config/loadConfig");
const { parseDate, formatDate, formatDuration, formatDateTime } = require("../utils/dateUtils");
const { normalizeText } = require("../utils/textUtils");
const { createAdaptiveKeyboard } = require("../utils/keyboardUtils");
const { sendStartCommand } = require("../utils/commandUtils");
const { loadQuizData, hasUserTakenQuiz, saveUserResult } = require("../utils/fileUtils");
const { updateQuizKeyboard } = require("../utils/updateQuizKeyboard");

const {
  getState,
  setState,
  updateState,
  deleteState,
} = require("./quizState");

const {
  prepareQuestions,
  prepareAnswers,
  isAnswerCorrect,
  calculatePercentage,
} = require("./quizLogic");

const {
  createQuizKeyboard
} = require("./quizKeyboard");

const ADMIN_IDS = process.env.ADMIN_IDS;

// ---------------------------- Start Quiz ----------------------------

async function startQuiz(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const now = new Date();

  const quizStart = parseDate(QUIZ_START_TIME);
  const quizEnd = parseDate(QUIZ_END_TIME, true);

  if (now < quizStart) return { success: false, message: `Викторина ещё не началась. Начало: ${QUIZ_START_TIME}.` };
  if (now > quizEnd) return { success: false, message: `Викторина уже закончилась. Конец: ${QUIZ_END_TIME}.` };
  if (await hasUserTakenQuiz(username)) return { success: false, message: "Вы уже прошли викторину." };

  const quizData = await loadQuizData();
  if (quizData.length === 0) return { success: false, message: "Ошибка: вопросы не загружены." };

  // Устанавливаем состояние для запроса наличия ника
  setState(userId, {
    awaitingNicknamePrompt: true, // Ждём ответа на вопрос "Да/Нет"
    username,
    questions: null,
    currentQuestion: 0,
    score: 0,
    totalQuestions: 0,
    startTime: null,
    timeoutId: null,
    answers: [],
    selectedAnswers: null,
    currentMessageId: null,
    forumNickname: null
  });

  const keyboard = {
    inline_keyboard: [
      [
        { text: "Да", callback_data: `quiz_nickname_yes_${userId}` },
        { text: "Нет", callback_data: `quiz_nickname_no_${userId}` }
      ]
    ]
  };

  await ctx.reply("Есть ли у вас ник на форуме?", {
    reply_markup: keyboard
  });

  return { success: true };
}

// ---------------------------- Send Question ----------------------------

async function sendQuestion(ctx, userId) {
  const state = getState(userId);
  if (!state || state.currentQuestion >= state.totalQuestions) return endQuiz(ctx, false, false);

  const question = state.questions[state.currentQuestion];
  const { answers, correct } = prepareAnswers(question, randomizeAnswers);

  if (question.answerType === 'multiple' && state.selectedAnswers === null) {
    state.selectedAnswers = [];
  } else if (question.answerType === 'single') {
    state.selectedAnswers = null;
  }

  state.currentQuestionData = { answers, correct };
  setState(userId, state);

  const keyboard = createQuizKeyboard(answers, question.answerType, userId, state.selectedAnswers);
  const instructions = getInstructions(question.answerType);
  const questionText = `Вопрос ${state.currentQuestion + 1}/${state.totalQuestions}:\n${question.question}${instructions}`;

  if (question.image) {
    try {
      await fs.access(`data/images/${question.image}`);
      await ctx.replyWithPhoto(new InputFile(`data/images/${question.image}`));
    } catch {
      await ctx.reply("⚠️ Изображение для вопроса недоступно");
    }
  }

  const message = await ctx.reply(questionText, {
    reply_markup: keyboard,
    disable_web_page_preview: true,
    parse_mode: "HTML"
  });

  state.currentMessageId = message.message_id;
  setState(userId, state);
}

function getInstructions(type) {
  switch (type) {
    case "single": return "\nВыберите <b>ОДИН</b> вариант и нажмите \"Подтвердить выбор\".";
    case "multiple": return "\nВыберите <b>ОДИН или НЕСКОЛЬКО</b> вариантов и нажмите \"Подтвердить выбор\".";
    case "text": return "\nВведите ответ текстом.";
    default: return "";
  }
}

// ---------------------------- Handle Answer ----------------------------

async function handleQuizAnswer(ctx, input) {
  const userId = ctx.from.id;
  const state = getState(userId);
  if (!state) return input.startsWith("quiz_") || input === "Выйти из викторины";

  // Обработка ответа на вопрос "Есть ли ник?"
  if (state.awaitingNicknamePrompt) {
    if (input === `quiz_nickname_yes_${userId}`) {
      setState(userId, { ...state, awaitingNicknamePrompt: false, awaitingNickname: true });
      await ctx.reply("Пожалуйста, введите ваш ник на форуме:");
      return true;
    } else if (input === `quiz_nickname_no_${userId}`) {
      return await startQuizLogic(ctx, userId, state, null);
    }
    return false;
  }

  // Обработка ввода ника
  if (state.awaitingNickname) {
    const forumNickname = input && input.trim() !== "" ? input.trim() : null;
    return await startQuizLogic(ctx, userId, state, forumNickname);
  }

  // Существующая логика обработки ответов на вопросы викторины
  const elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
  if (elapsedTime >= TIME_LIMIT) {
    await endQuiz(ctx, true, false);
    return true;
  }

  const question = state.questions[state.currentQuestion];
  const { answers, correct } = state.currentQuestionData;

  if (input === `quiz_exit_${userId}` || input === "Выйти из викторины") {
    await endQuiz(ctx, true, true);
    return true;
  }

  if (question.answerType === "single" && input.startsWith(`quiz_single_${userId}_`)) {
    const index = parseInt(input.split("_").pop());
    if (index >= 0 && index < answers.length) {
      state.selectedAnswers = state.selectedAnswers === index ? null : index;
      const keyboard = createQuizKeyboard(answers, "single", userId, state.selectedAnswers);
      await updateQuizKeyboard(ctx, state, userId, `Вопрос ${state.currentQuestion + 1}/${state.totalQuestions}:\n${question.question}${getInstructions("single")}`, keyboard);
      setState(userId, state);
      return true;
    }
    return false;
  }

  if (question.answerType === "multiple" && input.startsWith(`quiz_multiple_${userId}_`)) {
    const index = parseInt(input.split("_").pop());
    if (index >= 0 && index < answers.length) {
      const selected = new Set(state.selectedAnswers);
      selected.has(index) ? selected.delete(index) : selected.add(index);
      state.selectedAnswers = Array.from(selected);
      const keyboard = createQuizKeyboard(answers, "multiple", userId, state.selectedAnswers);
      await updateQuizKeyboard(ctx, state, userId, `Вопрос ${state.currentQuestion + 1}/${state.totalQuestions}:\n${question.question}${getInstructions("multiple")}`, keyboard);
      setState(userId, state);
      return true;
    }
    return false;
  }

  let selectedAnswer = null;
  let correctAnswer = null;
  let isCorrect = false;

  if (input === `quiz_submit_${userId}`) {
    if (question.answerType === "single") {
      if (state.selectedAnswers === null) {
        await ctx.reply("Выберите один вариант перед подтверждением.");
        return true;
      }
      selectedAnswer = answers[state.selectedAnswers];
      correctAnswer = answers[correct];
      isCorrect = isAnswerCorrect(question, state.selectedAnswers, correct);
      state.selectedAnswers = null;
    } else if (question.answerType === "multiple") {
      if (!state.selectedAnswers?.length) {
        await ctx.reply("Выберите хотя бы один вариант перед подтверждением.");
        return true;
      }
      selectedAnswer = state.selectedAnswers.map(i => answers[i]).join(", ");
      correctAnswer = correct.map(i => answers[i]).join(", ");
      isCorrect = isAnswerCorrect(question, state.selectedAnswers, correct);
      state.selectedAnswers = [];
    }
  } else if (question.answerType === "text") {
    selectedAnswer = input;
    correctAnswer = question.correct;
    isCorrect = normalizeText(input) === normalizeText(question.correct);
  }

  state.answers.push({
    questionIndex: state.currentQuestion,
    question: question.question,
    selectedAnswer,
    correctAnswer,
    isCorrect,
    timestamp: formatDateTime(new Date()),
  });

  if (isCorrect) {
    state.score++;
    await ctx.reply("Правильно! 👋");
  } else {
    await ctx.reply(`Неправильно ❌. Правильный ответ: ${correctAnswer}`);
  }

  state.currentQuestion++;
  setState(userId, state);

  if (state.currentQuestion < state.totalQuestions) {
    await sendQuestion(ctx, userId);
  } else {
    await endQuiz(ctx, false, false);
  }

  return true;
}

// ---------------------------- Helper: Start Quiz Logic ----------------------------

async function startQuizLogic(ctx, userId, state, forumNickname) {
  const quizData = await loadQuizData();
  const questions = prepareQuestions(quizData, randomizeQuestions);
  const timeoutId = setTimeout(() => endQuiz(ctx, true, false), TIME_LIMIT * 1000);
  const startTime = new Date();

  setState(userId, {
    ...state,
    awaitingNicknamePrompt: false,
    awaitingNickname: false,
    forumNickname,
    questions,
    currentQuestion: 0,
    score: 0,
    totalQuestions: questions.length,
    startTime,
    timeoutId,
    answers: [],
    selectedAnswers: null,
    currentMessageId: null
  });

  await ctx.reply(`Викторина началась! У вас есть ${formatDuration(TIME_LIMIT)} на прохождение.`, {
    reply_markup: { remove_keyboard: true }
  });

  await sendQuestion(ctx, userId);
  return true;
}

// ---------------------------- End Quiz ----------------------------

async function endQuiz(ctx, isTimeout = false, isManualExit = false) {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const state = getState(userId);
  if (!state) return;

  clearTimeout(state.timeoutId);

  if (state.currentMessageId && state.questions[state.currentQuestion]?.answerType !== "text") {
    try {
      await ctx.api.editMessageReplyMarkup(ctx.chat.id, state.currentMessageId, { reply_markup: undefined });
    } catch {}
  }

  const endTime = new Date();
  const timeSpent = Math.floor((endTime - state.startTime) / 1000);
  const percentageCorrect = calculatePercentage(state.score, state.totalQuestions);

  let msg;
  if (isManualExit) {
    msg = `Вы вышли из викторины.`;
  } else if (isTimeout) {
    msg = `Время вышло.\nВаш результат: ${state.score} из ${state.totalQuestions} (${percentageCorrect}%)`;
  } else {
    msg = `Викторина завершена! 🎉\nВаш результат: ${state.score} из ${state.totalQuestions} (${percentageCorrect}%)`;
  }

  if (!isTimeout && !isManualExit && state.currentQuestion >= state.totalQuestions) {
    await saveUserResult(userId, {
      date: formatDate(new Date()),
      score: state.score,
      totalQuestions: state.totalQuestions,
      percentageCorrect,
      timeSpent: formatDuration(timeSpent),
      startTime: formatDateTime(state.startTime),
      endTime: formatDateTime(endTime),
      answers: state.answers,
      forumNickname: state.forumNickname
    }, username);
  }

  deleteState(userId);
  await ctx.reply(`${msg}\nДля возврата в меню выполните команду /start`);

  try {
    await sendStartCommand(ctx, userId, ctx.chat.id);
  } catch {
    const config = await loadConfig();
    const keyboard = createAdaptiveKeyboard(config.map(item => Object.keys(item)[0]));
    await ctx.reply("Не удалось отобразить меню. Отправьте /start вручную.", {
      reply_markup: keyboard
    });
  }
}

// ---------------------------- Admin CSV Export ----------------------------

async function downloadResultsCSV(ctx) {
  const userId = ctx.from.id.toString();
  if (!ADMIN_IDS.includes(userId)) {
    await ctx.reply("⛔ У вас нет прав для скачивания результатов.");
    return;
  }

  try {
    await fs.access(csvFilePath);
    await ctx.replyWithDocument(new InputFile(csvFilePath, `Quiz_Results_${formatDate(new Date())}.csv`), {
      caption: "📊 Результаты викторины. Для возврата — команда /start"
    });
  } catch (error) {
    const msg = error.code === 'ENOENT'
      ? "⚠️ Файл результатов не найден."
      : "❌ Ошибка при отправке файла.";
    await ctx.reply(msg);
  }
}

module.exports = {
  startQuiz,
  sendQuestion,
  handleQuizAnswer,
  endQuiz,
  downloadResultsCSV
};