const { Markup } = require("telegraf");
const { clearUserSession } = require("../data/session");
const {
  getPendingOrdersByUser,
  updateOrderStatus,
  getOrderByCode,
  getCancelCountByUser,
  banUser,
} = require("../data/db");
const { GRACE_PERIOD_SECONDS } = require("../jobs/autoConfirm");

const CANCEL_LIMIT = 3;

function registerCancelHandlers(bot, adminChatId) {
  // /cancel - show pending orders
  bot.command("cancel", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const pendingOrders = await getPendingOrdersByUser(userId);

      if (!pendingOrders.length) {
        await ctx.reply("📭 Bạn không có đơn hàng nào đang chờ xử lý.");
        return;
      }

      const buttons = pendingOrders.map((order) => {
        const createdAt = new Date(order.created_at);
        const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 1000);
        const remaining = Math.max(0, GRACE_PERIOD_SECONDS - elapsed);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStr = remaining > 0 ? `⏳ ${mins}p${secs}s` : "⏰ Hết hạn";

        return [
          Markup.button.callback(
            `${order.order_code} — ${Number(order.total_amount).toLocaleString("vi-VN")}đ ${timeStr}`,
            `cancel_order:${order.order_code}`,
          ),
        ];
      });

      await ctx.reply(
        "📋 Đơn hàng đang chờ xử lý:\n" +
          "Bạn có thể hủy đơn trong vòng 3 phút sau khi đặt.\n\n" +
          "Chọn đơn cần hủy:",
        Markup.inlineKeyboard(buttons),
      );
    } catch (error) {
      console.error("Lỗi khi xem cancel:", error);
      await ctx.reply("Không thể đọc danh sách đơn.");
    }
  });

  // Show confirm dialog
  bot.action(/cancel_order:(.+)/, async (ctx) => {
    try {
      const orderCode = ctx.match[1];

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `⚠️ Bạn có chắc muốn hủy đơn *${orderCode}*?\n\n` +
          `Lưu ý: Nếu hủy quá ${CANCEL_LIMIT} đơn trong ngày, tài khoản sẽ bị khóa.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✅ Xác nhận hủy",
                `confirm_cancel:${orderCode}`,
              ),
            ],
            [Markup.button.callback("↩️ Không, giữ đơn", "keep_order")],
          ]),
        },
      );
    } catch (error) {
      console.error("Lỗi cancel_order:", error);
    }
  });

  bot.action("keep_order", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      "✅ Đã giữ đơn hàng. Đơn sẽ được gửi đến quán như bình thường.",
    );
  });

  // Actually cancel the order
  bot.action(/confirm_cancel:(.+)/, async (ctx) => {
    try {
      const orderCode = ctx.match[1];
      const userId = ctx.from.id;

      await ctx.answerCbQuery();

      const order = await getOrderByCode(orderCode);

      if (!order) {
        await ctx.editMessageText("Không tìm thấy đơn hàng này.");
        return;
      }

      if (order.status !== "pending") {
        await ctx.editMessageText(
          `❌ Đơn *${orderCode}* đã được gửi đến quán, không thể hủy nữa.`,
          { parse_mode: "Markdown" },
        );
        return;
      }

      const createdAt = new Date(order.created_at);
      const elapsed = (Date.now() - createdAt.getTime()) / 1000;

      if (elapsed > GRACE_PERIOD_SECONDS) {
        await ctx.editMessageText(
          `❌ Đã quá thời hạn hủy (3 phút). Đơn *${orderCode}* đã được gửi đến quán.`,
          { parse_mode: "Markdown" },
        );
        await updateOrderStatus(orderCode, "confirmed");
        return;
      }

      // Cancel the order
      await updateOrderStatus(orderCode, "cancelled");
      const cancelCount = await getCancelCountByUser(userId);

      if (cancelCount >= CANCEL_LIMIT) {
        await banUser(userId, `Hủy quá ${CANCEL_LIMIT} đơn`);
        await ctx.editMessageText(
          `🚫 Đơn *${orderCode}* đã bị hủy.\n\n` +
            `⛔ Bạn đã hủy ${cancelCount} đơn trong ngày hôm nay - tài khoản đã bị khóa.\n` +
            "Vui lòng liên hệ quản trị viên.",
          { parse_mode: "Markdown" },
        );

        if (adminChatId) {
          await bot.telegram.sendMessage(
            adminChatId,
            `⚠️ User ${userId} (${ctx.from.username ? "@" + ctx.from.username : "N/A"}) đã bị BAN — hủy ${cancelCount} đơn.`,
          );
        }
      } else {
        const remaining = CANCEL_LIMIT - cancelCount;
        await ctx.editMessageText(
          `✅ Đã hủy đơn *${orderCode}* thành công.\n\n` +
            `⚠️ Bạn đã hủy ${cancelCount}/${CANCEL_LIMIT} đơn trong ngày hôm nay. Còn ${remaining} lần nữa sẽ bị khóa.`,
          { parse_mode: "Markdown" },
        );
      }
    } catch (error) {
      console.error("Lỗi confirm_cancel:", error);
      await ctx.reply("Có lỗi khi hủy đơn.");
    }
  });

  // Cancel order flow (during ordering) — with confirmation
  bot.action("confirm_cancel_order_flow", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        "⚠️ Bạn có chắc muốn hủy lệnh đặt món?\n\n" +
          "Giỏ hàng hiện tại sẽ bị xóa.",
        Markup.inlineKeyboard([
          [Markup.button.callback("✅ Xác nhận hủy", "do_cancel_order_flow")],
          [Markup.button.callback("↩️ Tiếp tục đặt", "resume_ordering")],
        ]),
      );
    } catch (error) {
      console.error("Lỗi confirm_cancel_order_flow:", error);
    }
  });

  bot.action("do_cancel_order_flow", async (ctx) => {
    try {
      const userId = ctx.from.id;
      clearUserSession(userId);

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        "✅ Đã hủy lệnh đặt món và xóa giỏ hàng.\n\nGõ /order để đặt lại!",
      );
    } catch (error) {
      console.error("Lỗi do_cancel_order_flow:", error);
    }
  });

  bot.action("resume_ordering", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        "👍 Tiếp tục đặt món! Gõ /order hoặc chọn từ giỏ hàng.",
      );
    } catch (error) {
      console.error("Lỗi resume_ordering:", error);
    }
  });

  // Legacy: cancel current selection
  bot.action("cancel_current_selection", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const { clearCurrentSelection } = require("../data/session");
      clearCurrentSelection(userId);

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        "✅ Đã bỏ món đang chọn.\nGiỏ hàng hiện tại vẫn được giữ nguyên.",
      );
    } catch (error) {
      console.error("Lỗi khi bỏ món đang chọn:", error);
      await ctx.reply("Không thể bỏ món đang chọn.");
    }
  });
}

module.exports = { registerCancelHandlers, CANCEL_LIMIT };
