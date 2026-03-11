const { Markup } = require("telegraf");
const { getUserSession, clearCurrentSelection } = require("../data/session");
const { formatCart } = require("../utils/cart");
const { showCategoryMenu } = require("../utils/menus");
const { getCartKeyboard } = require("../utils/keyboards");
const { clearCheckout } = require("../data/session");

function registerCartHandlers(bot) {
  // Add more items
  bot.action("cart_add_more", async (ctx) => {
    try {
      const userId = ctx.from.id;
      clearCurrentSelection(userId);
      await ctx.answerCbQuery();
      await showCategoryMenu(ctx);
    } catch (error) {
      console.error("Lỗi khi thêm món khác:", error);
      await ctx.reply("Không thể tiếp tục thêm món.");
    }
  });

  // View cart
  bot.action("cart_view", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      await ctx.answerCbQuery();

      if (!session.cart || session.cart.length === 0) {
        await ctx.reply("🛒 Giỏ hàng đang trống.\n\nGõ /order để đặt món!");
        return;
      }

      await ctx.reply(formatCart(session.cart), getCartKeyboard());
    } catch (error) {
      console.error("Lỗi khi xem giỏ hàng:", error);
      await ctx.reply("Không thể hiển thị giỏ hàng.");
    }
  });

  // Show cart with options (used as back button target)
  bot.action("show_cart_with_options", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      await ctx.answerCbQuery();

      if (!session.cart || session.cart.length === 0) {
        await ctx.editMessageText(
          "🛒 Giỏ hàng đang trống.\n\nGõ /order để đặt món!",
        );
        return;
      }

      await ctx.editMessageText(formatCart(session.cart), getCartKeyboard());
    } catch (error) {
      console.error("Lỗi show_cart_with_options:", error);
    }
  });

  // Select specific items to checkout
  bot.action("cart_select_items", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      await ctx.answerCbQuery();

      if (!session.cart || session.cart.length === 0) {
        await ctx.reply("Giỏ hàng đang trống.");
        return;
      }

      const buttons = session.cart.map((item, index) => {
        const toppingsTotal = item.toppingsTotal || 0;
        const lineTotal = (item.unitPrice + toppingsTotal) * item.quantity;
        return [
          Markup.button.callback(
            `${item.name} (${item.size}) x${item.quantity} — ${lineTotal.toLocaleString("vi-VN")}đ`,
            `checkout_item:${index}`,
          ),
        ];
      });

      buttons.push([
        Markup.button.callback(
          "⬅️ Quay lại giỏ hàng",
          "show_cart_with_options",
        ),
      ]);

      await ctx.reply(
        "📋 Chọn món bạn muốn đặt riêng:",
        Markup.inlineKeyboard(buttons),
      );
    } catch (error) {
      console.error("Lỗi cart_select_items:", error);
    }
  });

  bot.action(/checkout_item:(\d+)/, async (ctx) => {
    try {
      const index = Number(ctx.match[1]);
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      if (index < 0 || index >= session.cart.length) {
        await ctx.answerCbQuery("Món không hợp lệ.");
        return;
      }

      const selectedItem = session.cart[index];
      session.cart = [selectedItem];
      clearCheckout(userId);
      session.checkoutStep = "name";

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `📦 Đặt riêng: *${selectedItem.name}* (${selectedItem.size}) x${selectedItem.quantity}\n\n` +
          "Vui lòng nhập *tên người nhận*:",
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      console.error("Lỗi checkout_item:", error);
    }
  });

  // Edit quantity
  bot.action("cart_edit_qty", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      await ctx.answerCbQuery();

      if (!session.cart || session.cart.length === 0) {
        await ctx.reply("Giỏ hàng đang trống.");
        return;
      }

      const buttons = session.cart.map((item, index) => [
        Markup.button.callback(
          `${item.name} (${item.size}) — SL: ${item.quantity}`,
          `edit_qty:${index}`,
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "⬅️ Quay lại giỏ hàng",
          "show_cart_with_options",
        ),
      ]);

      await ctx.reply(
        "✏️ Chọn món cần sửa số lượng:",
        Markup.inlineKeyboard(buttons),
      );
    } catch (error) {
      console.error("Lỗi cart_edit_qty:", error);
    }
  });

  bot.action(/edit_qty:(\d+)/, async (ctx) => {
    try {
      const index = Number(ctx.match[1]);
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      if (index < 0 || index >= session.cart.length) {
        await ctx.answerCbQuery("Món không hợp lệ.");
        return;
      }

      session.editingCartIndex = index;
      session.awaitingEditQtyInput = true;

      const item = session.cart[index];

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `✏️ Đang sửa: *${item.name}* (${item.size})\nSố lượng hiện tại: ${item.quantity}\n\n` +
          "Nhập số lượng mới:",
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      console.error("Lỗi edit_qty:", error);
    }
  });

  // Delete item
  bot.action("cart_delete_item", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      await ctx.answerCbQuery();

      if (!session.cart || session.cart.length === 0) {
        await ctx.reply("Giỏ hàng đang trống.");
        return;
      }

      const buttons = session.cart.map((item, index) => [
        Markup.button.callback(
          `🗑️ ${item.name} (${item.size}) x${item.quantity}`,
          `confirm_delete_item:${index}`,
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "⬅️ Quay lại giỏ hàng",
          "show_cart_with_options",
        ),
      ]);

      await ctx.reply(
        "🗑️ Chọn món cần xóa khỏi giỏ hàng:",
        Markup.inlineKeyboard(buttons),
      );
    } catch (error) {
      console.error("Lỗi cart_delete_item:", error);
    }
  });

  bot.action(/confirm_delete_item:(\d+)/, async (ctx) => {
    try {
      const index = Number(ctx.match[1]);
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      if (index < 0 || index >= session.cart.length) {
        await ctx.answerCbQuery("Món không hợp lệ.");
        return;
      }

      const item = session.cart[index];

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `⚠️ Bạn có chắc muốn xóa *${item.name}* (${item.size}) x${item.quantity} khỏi giỏ hàng?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ Xóa", `do_delete_item:${index}`)],
            [Markup.button.callback("↩️ Không xóa", "show_cart_with_options")],
          ]),
        },
      );
    } catch (error) {
      console.error("Lỗi confirm_delete_item:", error);
    }
  });

  bot.action(/do_delete_item:(\d+)/, async (ctx) => {
    try {
      const index = Number(ctx.match[1]);
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      if (index < 0 || index >= session.cart.length) {
        await ctx.answerCbQuery("Món không hợp lệ.");
        return;
      }

      const removed = session.cart.splice(index, 1)[0];
      await ctx.answerCbQuery();
      await ctx.editMessageText(`✅ Đã xóa *${removed.name}* khỏi giỏ hàng.`, {
        parse_mode: "Markdown",
      });

      if (session.cart.length > 0) {
        await ctx.reply(formatCart(session.cart), getCartKeyboard());
      } else {
        await ctx.reply("🛒 Giỏ hàng đã trống.\n\nGõ /order để đặt món!");
      }
    } catch (error) {
      console.error("Lỗi do_delete_item:", error);
    }
  });
}

module.exports = { registerCartHandlers };
