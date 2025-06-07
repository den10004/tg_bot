// Парсинг даты из формата DD.MM.YYYY
function parseDate(dateStr, isEndOfDay = false) {
  const [day, month, year] = dateStr.split('.').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (isEndOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date;
}

// Форматирование даты в DD/MM/YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Форматирование даты и времени в DD/MM/YYYY HH:MM:SS
function formatDateTime(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Форматирование времени в часы, минуты и секунды
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}ч ${minutes}мин ${remainingSeconds}сек`;
}

module.exports = {
  parseDate,
  formatDate,
  formatDateTime,
  formatDuration
};