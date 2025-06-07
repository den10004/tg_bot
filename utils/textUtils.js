// Нормализация текста для текстовых ответов (игнорируем регистр и пробелы)
function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, '');
}

module.exports = {
  normalizeText
};