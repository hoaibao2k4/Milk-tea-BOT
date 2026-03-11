const {
  getUserSession,
  clearCurrentSelection,
  clearCheckout,
  clearUserSession,
} = require("../data/session");
const { calculateCartTotal } = require("../utils/cart");
const { createOrder } = require("../data/db");

function registerCheckoutHandlers(bot) {
  // Start checkout
  bot.action("cart_checkout", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      await ctx.answerCbQuery();

      if (!session.cart || session.cart.length === 0) {
        await ctx.reply("Giỏ hàng đang trống, chưa thể đặt hàng.");
        return;
      }

      clearCurrentSelection(userId);
      clearCheckout(userId);

      session.checkoutStep = "name";

      await ctx.reply(
        "📦 Bắt đầu nhập thông tin đặt hàng.\n\n" +
          "Vui lòng nhập *tên người nhận*:",
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      console.error("Lỗi khi chọn đặt hàng:", error);
      await ctx.reply("Không thể chuyển sang bước đặt hàng.");
    }
  });

  // Confirm order
  bot.action("confirm_order", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);

      await ctx.answerCbQuery();

      if (!session.cart.length) {
        await ctx.reply("Giỏ hàng đang trống.");
        return;
      }

      if (
        !session.customerInfo.name ||
        !session.customerInfo.phone ||
        !session.customerInfo.address
      ) {
        await ctx.reply("Thông tin khách hàng chưa đầy đủ.");
        return;
      }

      const orderCode = `OD${Date.now()}`;
      const total = calculateCartTotal(session.cart);

      await createOrder({
        orderCode,
        customerInfo: session.customerInfo,
        cart: session.cart,
        totalAmount: total,
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || "",
      });

      await ctx.editMessageText(
        "✅ Đặt hàng thành công!\n\n" +
          `Mã đơn: *${orderCode}*\n` +
          `Tổng tiền: ${total.toLocaleString("vi-VN")}đ\n\n` +
          "⏳ Đơn hàng sẽ được gửi đến quán sau 3 phút.\n" +
          "Trong thời gian này bạn có thể hủy bằng lệnh /cancel",
        { parse_mode: "Markdown" },
      );

      clearUserSession(userId);
    } catch (error) {
      console.error("Lỗi khi xác nhận đơn:", error);
      await ctx.reply("Có lỗi khi xác nhận đơn hàng.");
    }
  });
}

module.exports = { registerCheckoutHandlers };
