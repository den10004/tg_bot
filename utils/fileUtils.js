const fs = require("fs").promises;
const path = require("path");
const { csvFilePath } = require("../data/variables");

// Загрузка вопросов викторины из JSON файла
async function loadQuizData() {
  try {
    const data = await fs.readFile("data/quizData.json", "utf8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      throw new Error("Данные викторины должны быть массивом объектов");
    }
    parsed.forEach((question, index) => {
      if (!question.question || !question.correct || !question.answerType) {
        throw new Error(`Некорректная структура вопроса ${index + 1}`);
      }
      if (!['single', 'multiple', 'text'].includes(question.answerType)) {
        throw new Error(`Недопустимый тип ответа в вопросе ${index + 1}`);
      }
      if (question.answerType !== 'text' && (!question.answers || !Array.isArray(question.answers))) {
        throw new Error(`Для вопроса ${index + 1} требуется массив answers для типов single/multiple`);
      }
      if (question.answerType === 'multiple' && !Array.isArray(question.correct)) {
        throw new Error(`Для multiple типа в вопросе ${index + 1} correct должен быть массивом`);
      }
      if (question.answerType === 'single' && typeof question.correct !== 'number') {
        throw new Error(`Для single типа в вопросе ${index + 1} correct должен быть числом`);
      }
      if (question.answerType === 'text' && typeof question.correct !== 'string') {
        throw new Error(`Для text типа в вопросе ${index + 1} correct должен быть строкой`);
      }
    });
    return parsed;
  } catch (error) {
    console.error("Ошибка загрузки данных викторины:", error.message);
    return [];
  }
}

// Загрузка результатов пользователей
async function loadUserResults() {
  try {
    const data = await fs.readFile("data/userResults.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    console.error("Ошибка загрузки результатов пользователей:", error.message);
    return {};
  }
}

// Проверка, проходил ли пользователь викторину
async function hasUserTakenQuiz(username) {
  if (!username) {
    return false;
  }
  const results = await loadUserResults();
  return Object.values(results).some(userResults =>
    userResults.some(result => result.username === `@${username}`)
  );
}

// Сохранение результатов пользователей
async function saveUserResult(userId, result, username) {
  const results = await loadUserResults();
  if (!results[userId]) {
    results[userId] = [];
  }
  results[userId].push({
    ...result,
    username: username ? `@${username}` : "No username",
    forumNickname: result.forumNickname || "" // Сохраняем ник или пустую строку
  });

  try {
    await fs.writeFile("data/userResults.json", JSON.stringify(results, null, 2));
    await saveUserResultToCSV(userId, result, username);
  } catch (error) {
    console.error("Ошибка сохранения результатов:", error.message);
  }
}

// Получение результатов пользователя
async function getUserResults(userId) {
  const results = await loadUserResults();
  return results[userId] || [];
}

// Сохранение результатов пользователей в CSV
async function saveUserResultToCSV(userId, result, username) {
  const headers = 'ID Пользователя,Имя Пользователя,Ник на форуме,Дата,Правильные ответы,Всего вопросов,Время прохождения,Время начала,Время окончания,Ответы\r\n';

  const formattedAnswers = result.answers
    .map((answer, idx) => {
      return [
        `Вопрос ${idx + 1}`,
        `Вопрос: ${answer.question.replace(/"/g, '""')}`,
        `Ответ: ${answer.selectedAnswer.toString().replace(/"/g, '""')}`,
        `Правильно: ${answer.isCorrect ? "✅" : "❌"} (${answer.correctAnswer})`,
        "────────────────────────"
      ].join('\r\n');
    })
    .join('\r\n');

  const answersEscaped = `"${formattedAnswers}"`;

 // const forumNicknameEscaped = result.forumNickname ? `"${result.forumNickname.replace(/"/g, '""')}"` : '""';
  const forumNicknameEscaped = result.forumNickname ? `"${result.forumNickname.replace(/"/g, '""')}"` : '"регистрации на форуме нет"';

  const csvRow = [
    userId,
    username ? `@${username}` : 'No username',
    forumNicknameEscaped,
    result.date,
    result.score,
    result.totalQuestions,
    result.timeSpent,
    result.startTime,
    result.endTime,
    answersEscaped
  ].join(',');

  try {
    const dir = path.dirname(csvFilePath);
    await fs.mkdir(dir, { recursive: true }).catch((err) => {
      if (err.code !== 'EEXIST') throw err;
    });

    const fileExists = await fs.access(csvFilePath).then(() => true).catch(() => false);
    if (!fileExists) {
      await fs.writeFile(csvFilePath, '\ufeff' + headers);
    }
    await fs.appendFile(csvFilePath, csvRow + '\r\n');
  } catch (error) {
    console.error(`Error writing CSV for user ${userId}: ${error.message}`);
  }
}

module.exports = {
  loadQuizData,
  loadUserResults,
  hasUserTakenQuiz,
  saveUserResult,
  getUserResults,
  saveUserResultToCSV
};