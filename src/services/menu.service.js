const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const menuFilePath = path.join(__dirname, "../../data/Menu.csv");

function loadMenuFromCSV() {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(menuFilePath)
      .pipe(csv())
      .on("data", (data) => {
        results.push({
          category: data.category?.trim(),
          itemId: data.item_id?.trim(),
          name: data.name?.trim(),
          description: data.description?.trim() || "",
          priceM: Number(data.price_m) || 0,
          priceL: Number(data.price_l) || 0,
          available: String(data.available).trim().toLowerCase() === "true",
        });
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

function groupMenuByCategory(menuItems) {
  return menuItems.reduce((acc, item) => {
    if (!item.available) return acc;

    if (!acc[item.category]) {
      acc[item.category] = [];
    }

    acc[item.category].push(item);
    return acc;
  }, {});
}

function formatMenuText(groupedMenu) {
  let message = "📋 MENU QUÁN TRÀ SỮA\n\n";

  for (const category in groupedMenu) {
    message += `🍹 ${category}\n`;

    groupedMenu[category].forEach((item) => {
      message += `- ${item.name} | M: ${item.priceM.toLocaleString("vi-VN")}đ | L: ${item.priceL.toLocaleString("vi-VN")}đ\n`;
    });

    message += "\n";
  }

  return message;
}

function getDrinkItems(menuItems) {
  return menuItems.filter(
    (item) => item.available && item.category.toLowerCase() !== "topping",
  );
}

function getDrinkCategories(menuItems) {
  const drinkItems = getDrinkItems(menuItems);
  return [...new Set(drinkItems.map((item) => item.category))];
}

function getItemsByCategory(menuItems, category) {
  return menuItems.filter(
    (item) =>
      item.available &&
      item.category.toLowerCase() !== "topping" &&
      item.category === category,
  );
}

function findItemById(menuItems, itemId) {
  return menuItems.find((item) => item.itemId === itemId);
}

function getToppingItems(menuItems) {
  return menuItems.filter(
    (item) => item.available && item.category.toLowerCase() === "topping",
  );
}

module.exports = {
  loadMenuFromCSV,
  groupMenuByCategory,
  formatMenuText,
  getDrinkItems,
  getDrinkCategories,
  getItemsByCategory,
  findItemById,
  getToppingItems,
};
