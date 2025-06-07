
const fs = require("fs").promises;

async function loadConfig() {
  try {
    const data = await fs.readFile("data/navigation.json", "utf8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      throw new Error("Конфигурация должна быть массивом объектов");
    }
    return parsed;
  } catch (error) {
    console.error("Ошибка загрузки конфигурации:", error.message);
    return [];
  }
}

module.exports = {
  loadConfig
};