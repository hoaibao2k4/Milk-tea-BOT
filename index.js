require("dotenv").config();
const { Telegraf } = require("telegraf");

// Middleware
const { banMiddleware } = require("./src/middleware/ban");

// Handlers
const { registerCommandHandlers } = require("./src/handlers/commands");
const { registerOrderHandlers } = require("./src/handlers/order");
const { registerCartHandlers } = require("./src/handlers/cart");
const { registerCheckoutHandlers } = require("./src/handlers/checkout");
const { registerCancelHandlers } = require("./src/handlers/cancel");
const { registerTextInputHandler } = require("./src/handlers/textInput");

// Background jobs
const { startAutoConfirmJob } = require("./src/jobs/autoConfirm");

// Database
const { initDB } = require("./src/data/db");

// Config
const botToken = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHATID;

if (!botToken) {
  throw new Error("Chưa tìm thấy BOT_TOKEN trong file .env");
}

const bot = new Telegraf(botToken);

// Middleware
bot.use(banMiddleware());

// Register handlers
registerCommandHandlers(bot);
registerOrderHandlers(bot);
registerCartHandlers(bot);
registerCheckoutHandlers(bot);
registerCancelHandlers(bot, adminChatId);
registerTextInputHandler(bot); // Must be last (catches all text)

// Launch
async function main() {
  try {
    await initDB();
    startAutoConfirmJob(bot, adminChatId);
    await bot.launch();
    console.log("Bot đang khởi động...");
  } catch (error) {
    console.error("Lỗi khi khởi động bot:", error);
    process.exit(1);
  }
}

main(); 

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
