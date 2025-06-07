const quizStates = new Map();

function getState(userId) {
  return quizStates.get(userId);
}

function setState(userId, state) {
  quizStates.set(userId, state);
}

function updateState(userId, updates) {
  const currentState = quizStates.get(userId) || {};
  quizStates.set(userId, { ...currentState, ...updates });
}

function deleteState(userId) {
  quizStates.delete(userId);
}

function hasState(userId) {
  return quizStates.has(userId);
}

module.exports = {
  getState,
  setState,
  updateState,
  deleteState,
  hasState
};
