const {
  loadMenuFromCSV,
  groupMenuByCategory,
  formatMenuText,
} = require("../services/menu.service");
const { getUserSession } = require("../data/session");
const { formatCart } = require("../utils/cart");
const { getCartKeyboard } = require("../utils/keyboards");
const { getAllOrders, getOrderByCode, getOrderItems } = require("../data/db");
const { clearCurrentSelection, clearCheckout } = require("../data/session");

function getStartMessage(ctx) {
  const firstName = ctx.from.first_name || "bạn";
  const username = ctx.from.username ? ` (@${ctx.from.username})` : "";

  return (
    `Chào ${firstName}${username}! 👋\n` +
    `Chào mừng bạn đến với <b>Trà sữa Meme</b> - Đây là BOT đặt trà sữa nhanh chóng và tiện lợi. 🧋\n\n` +
    `✨ <b>Danh sách lệnh:</b>\n` +
    `🏠 /start - Về trang chính\n` +
    `📋 /menu - Xem thực đơn\n` +
    `📃 /order - Đặt món\n` +
    `🛍️ /orders - Lịch sử đơn hàng\n` +
    `🛒 /cart - Giỏ hàng\n` +
    `❌ /cancel - Hủy đơn`
  );
}

function registerCommandHandlers(bot) {
  bot.start((ctx) => {
    ctx.reply(getStartMessage(ctx), { parse_mode: "HTML" });
  });

  bot.action("back_to_home", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const startMsg = getStartMessage(ctx);
      clearCurrentSelection(userId);
      clearCheckout(userId);
      await ctx.answerCbQuery();

      if (ctx.callbackQuery?.message?.text) {
        await ctx.editMessageText(startMsg, { parse_mode: "HTML" });
      } else {
        await ctx.reply(startMsg, { parse_mode: "HTML" });
      }
    } catch (error) {
      console.error("Lỗi back_to_home:", error);
      const startMsg = getStartMessage(ctx);
      await ctx.reply(startMsg, { parse_mode: "HTML" });
    }
  });

  bot.command("menu", async (ctx) => {
    try {
      const menuItems = await loadMenuFromCSV();
      const groupedMenu = groupMenuByCategory(menuItems);
      const menuText = formatMenuText(groupedMenu);
      await ctx.reply(menuText);
    } catch (error) {
      console.error("Lỗi khi đọc menu:", error);
      await ctx.reply("Xin lỗi, hiện tại bot chưa đọc được menu.");
    }
  });

  bot.command("cart", (ctx) => {
    const userId = ctx.from.id;
    const session = getUserSession(userId);

    if (!session.cart || session.cart.length === 0) {
      ctx.reply(
        "🛒 Giỏ hàng hiện đang trống.\n\nGõ /order để bắt đầu đặt món!",
      );
      return;
    }

    ctx.reply(formatCart(session.cart), getCartKeyboard());
  });

  // /orders
  bot.command("orders", async (ctx) => {
    try {
      const orders = await getAllOrders();

      if (!orders.length) {
        await ctx.reply("📭 Chưa có đơn hàng nào.");
        return;
      }

      const statusEmoji = { pending: "⏳", confirmed: "✅", cancelled: "❌" };

      const text = orders
        .slice(0, 10)
        .map((order, index) => {
          const emoji = statusEmoji[order.status] || "❓";
          const amount = Number(order.total_amount).toLocaleString("vi-VN");

          const dt = new Date(order.created_at);
          const formattedDate = `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;

          return (
            `📦 ${emoji} <b>${order.order_code}</b> — ${order.status.toUpperCase()}\n` +
            `👤 ${order.customer_name} | 💰 ${amount}đ | 🕒 ${formattedDate}`
          );
        })
        .join("\n\n");

      await ctx.reply(
        `📋 <b>Danh sách đơn gần nhất:</b>\n\n${text}\n\n💡 <i>Dùng /order_items [mã đơn] để xem chi tiết.</i>`,
        { parse_mode: "HTML" },
      );
    } catch (error) {
      console.error("Lỗi khi xem orders:", error);
      await ctx.reply("Không thể đọc danh sách đơn hàng.");
    }
  });

  // /order_items
  bot.command("order_items", async (ctx) => {
    try {
      const parts = ctx.message.text.split(" ");
      const orderCode = parts[1];

      if (!orderCode) {
        await ctx.reply(
          "Dùng cú pháp: /order_items [mã đơn]\nVí dụ: /order_items OD1710183",
        );
        return;
      }

      const order = await getOrderByCode(orderCode);
      if (!order) {
        await ctx.reply(`❌ Không tìm thấy đơn hàng với mã: ${orderCode}`);
        return;
      }

      const items = await getOrderItems(order.id);
      if (!items.length) {
        await ctx.reply("Không tìm thấy món nào của đơn này.");
        return;
      }

      const statusEmoji = { pending: "⏳", confirmed: "✅", cancelled: "❌" };
      const emoji = statusEmoji[order.status] || "❓";

      const dt = new Date(order.created_at);
      const formattedDate = `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;

      let detailText =
        `🧾 <b>CHI TIẾT ĐƠN HÀNG</b>\n` +
        `📦 Mã đơn: <b>${order.order_code}</b> | ${emoji} ${order.status.toUpperCase()}\n` +
        `🕒 Đặt lúc: ${formattedDate}\n\n` +
        `👤 <b>Khách hàng:</b> ${order.customer_name}\n` +
        `📞 <b>SĐT:</b> ${order.phone}\n` +
        `📍 <b>Địa nhận:</b> ${order.address}\n` +
        `📝 <b>Ghi chú:</b> ${order.note || "Không có"}\n`;

      if (order.telegram_username) {
        detailText += `💬 <b>Username:</b> @${order.telegram_username}\n`;
      }

      detailText += `\n🍱 <b>DANH SÁCH MÓN:</b>\n`;

      const itemsText = items
        .map((item, index) => {
          return (
            `${index + 1}. <b>${item.item_name}</b>\n` +
            `   Size: ${item.size} | SL: ${item.quantity}\n` +
            `   Topping: ${item.toppings_text || "Không có"}\n` +
            `   Thành tiền: ${Number(item.line_total).toLocaleString("vi-VN")}đ`
          );
        })
        .join("\n");

      detailText += itemsText;
      detailText += `\n\n💰 <b>TỔNG CỘNG:</b> ${Number(order.total_amount).toLocaleString("vi-VN")}đ`;

      await ctx.reply(detailText, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Lỗi khi xem order items:", error);
      await ctx.reply("Không thể đọc chi tiết đơn.");
    }
  });
}

module.exports = { registerCommandHandlers };
