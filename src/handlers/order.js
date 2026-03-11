const { Markup } = require("telegraf");
const { loadMenuFromCSV, findItemById } = require("../services/menu.service");
const {
  getUserSession,
  clearCurrentSelection,
  clearCheckout,
} = require("../data/session");
const {
  showCategoryMenu,
  showItemsBySelectedCategory,
  showToppingsMenu,
  processAddToCart,
} = require("../utils/menus");

function registerOrderHandlers(bot) {
  // /order command
  bot.command("order", async (ctx) => {
    try {
      const userId = ctx.from.id;
      clearCurrentSelection(userId);
      clearCheckout(userId);
      await showCategoryMenu(ctx);
    } catch (error) {
      console.error("Lỗi khi bắt đầu order:", error);
      await ctx.reply("Không thể bắt đầu đặt món lúc này.");
    }
  });

  // Back to categories
  bot.action("back_to_categories", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);
      session.currentCategory = null;
      session.selectedItemId = null;
      session.size = null;
      await ctx.answerCbQuery();
      await showCategoryMenu(ctx);
    } catch (error) {
      console.error("Lỗi back_to_categories:", error);
    }
  });

  // Select category
  bot.action(/select_category:(.+)/, async (ctx) => {
    try {
      const category = ctx.match[1];
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      session.currentCategory = category;
      session.selectedItemId = null;
      session.size = null;
      session.awaitingQuantityInput = false;

      await ctx.editMessageText(`📂 Bạn đã chọn nhóm: ${category}`);
      await showItemsBySelectedCategory(ctx, category);
    } catch (error) {
      console.error("Lỗi khi chọn category:", error);
      await ctx.reply("Có lỗi khi chọn nhóm món.");
    }
  });

  // Select item
  bot.action(/select_item:(.+)/, async (ctx) => {
    try {
      const itemId = ctx.match[1];
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      const menuItems = await loadMenuFromCSV();
      const selectedItem = findItemById(menuItems, itemId);

      if (!selectedItem) {
        await ctx.answerCbQuery("Không tìm thấy món này.");
        return;
      }

      session.selectedItemId = selectedItem.itemId;
      session.size = null;
      session.awaitingQuantityInput = false;

      await ctx.editMessageText(
        `🧋 *${selectedItem.name}*\n${selectedItem.description}\n\n` +
          `💰 Size M: ${selectedItem.priceM.toLocaleString("vi-VN")}đ\n` +
          `💰 Size L: ${selectedItem.priceL.toLocaleString("vi-VN")}đ\n\n` +
          "Chọn size:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(`Size M`, "select_size:M"),
              Markup.button.callback(`Size L`, "select_size:L"),
            ],
            [
              Markup.button.callback(
                "⬅️ Quay lại",
                `back_to_items:${session.currentCategory}`,
              ),
            ],
          ]),
        },
      );
    } catch (error) {
      console.error("Lỗi khi chọn món:", error);
      await ctx.reply("Có lỗi xảy ra khi chọn món.");
    }
  });

  // Back to items in category
  bot.action(/back_to_items:(.+)/, async (ctx) => {
    try {
      const category = ctx.match[1];
      await ctx.answerCbQuery();
      await showItemsBySelectedCategory(ctx, category);
    } catch (error) {
      console.error("Lỗi back_to_items:", error);
    }
  });

  // Back to size selection
  bot.action("back_to_size", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      if (!session.selectedItemId) {
        await ctx.answerCbQuery("Chưa chọn món.");
        return;
      }

      const menuItems = await loadMenuFromCSV();
      const selectedItem = findItemById(menuItems, session.selectedItemId);

      if (!selectedItem) {
        await ctx.answerCbQuery("Không tìm thấy món.");
        return;
      }

      session.size = null;
      session.selectedToppings = [];

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🧋 *${selectedItem.name}*\n${selectedItem.description}\n\n` +
          `💰 Size M\n` +
          `💰 Size L\n\n` +
          "Chọn size:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(`Size M`, "select_size:M"),
              Markup.button.callback(`Size L`, "select_size:L"),
            ],
            [
              Markup.button.callback(
                "⬅️ Quay lại",
                `back_to_items:${session.currentCategory}`,
              ),
            ],
          ]),
        },
      );
    } catch (error) {
      console.error("Lỗi back_to_size:", error);
    }
  });

  // Select size
  bot.action(/select_size:(.+)/, async (ctx) => {
    try {
      const size = ctx.match[1];
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      if (!session.selectedItemId) {
        await ctx.answerCbQuery("Bạn chưa chọn món.");
        return;
      }

      session.size = size;
      await ctx.answerCbQuery();
      await showToppingsMenu(ctx);
    } catch (error) {
      console.error("Lỗi khi chọn size:", error);
      await ctx.reply("Có lỗi xảy ra khi chọn size.");
    }
  });

  // Toggle topping
  bot.action(/toggle_topping:(.+)/, async (ctx) => {
    try {
      const toppingId = ctx.match[1];
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      const index = session.selectedToppings.indexOf(toppingId);
      if (index > -1) {
        session.selectedToppings.splice(index, 1);
      } else {
        session.selectedToppings.push(toppingId);
      }

      await ctx.answerCbQuery();
      await showToppingsMenu(ctx);
    } catch (error) {
      console.error("Lỗi khi toggle topping:", error);
    }
  });

  // Done toppings → ask quantity
  bot.action("done_toppings", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      session.awaitingQuantityInput = true;

      const menuItems = await loadMenuFromCSV();
      const selectedItem = findItemById(menuItems, session.selectedItemId);
      const itemName = selectedItem ? selectedItem.name : "Món đã chọn";

      let toppingsInfo = "";
      if (session.selectedToppings.length > 0) {
        const toppingDetails = session.selectedToppings.map((tid) =>
          findItemById(menuItems, tid),
        );
        toppingsInfo =
          "\nTopping: " + toppingDetails.map((t) => t.name).join(", ");
      }

      await ctx.editMessageText(
        `🧋 *${itemName}* — Size ${session.size}${toppingsInfo}\n\n` +
          "📝 Bạn muốn đặt bao nhiêu ly?\nHãy nhập số lượng bằng bàn phím.",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "⬅️ Quay lại chọn topping",
                "back_to_toppings_from_qty",
              ),
            ],
          ]),
        },
      );
    } catch (error) {
      console.error("Lỗi khi xong topping:", error);
    }
  });

  // Back to toppings from quantity
  bot.action("back_to_toppings_from_qty", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);
      session.quantity = null;
      session.awaitingQuantityInput = false;
      await ctx.answerCbQuery();
      await showToppingsMenu(ctx);
    } catch (error) {
      console.error("Lỗi khi quay lại toppings:", error);
    }
  });

  bot.action("back_to_toppings", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);
      session.quantity = null;
      await ctx.answerCbQuery();
      await showToppingsMenu(ctx);
    } catch (error) {
      console.error("Lỗi khi quay lại toppings:", error);
    }
  });

  // Add to cart / Buy now
  bot.action("add_to_cart_action", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await processAddToCart(ctx, false);
    } catch (error) {
      console.error("Lỗi add_to_cart:", error);
    }
  });

  bot.action("buy_now_action", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);
      session.cart = [];
      await ctx.answerCbQuery();
      await processAddToCart(ctx, true);
    } catch (error) {
      console.error("Lỗi buy_now:", error);
    }
  });
}

module.exports = { registerOrderHandlers };
