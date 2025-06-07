const { shuffleArray } = require("../utils/arrayUtils");

function prepareQuestions(quizData, randomize) {
  return randomize ? shuffleArray(quizData) : quizData;
}

function prepareAnswers(question, randomize) {
  const originalAnswers = [...question.answers];
  const answers = randomize ? shuffleArray([...originalAnswers]) : originalAnswers;

  let correct;
  if (randomize) {
    if (question.answerType === 'single') {
      correct = answers.indexOf(originalAnswers[question.correct]);
    } else if (question.answerType === 'multiple') {
      correct = question.correct.map(idx => answers.indexOf(originalAnswers[idx]));
    }
  } else {
    correct = question.correct;
  }

  return { answers, correct };
}

function isAnswerCorrect(question, selected, correct) {
  if (question.allAnswersCorrect) return true;

  if (question.answerType === 'single') {
    return selected === correct;
  }

  if (question.answerType === 'multiple') {
    return (
      Array.isArray(selected) &&
      selected.length === correct.length &&
      selected.every((idx) => correct.includes(idx))
    );
  }

  return false;
}

function calculatePercentage(score, total) {
  return total > 0 ? ((score / total) * 100).toFixed(2) : "0";
}

module.exports = {
  prepareQuestions,
  prepareAnswers,
  isAnswerCorrect,
  calculatePercentage
};
