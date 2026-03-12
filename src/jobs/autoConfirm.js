const {
  getPendingOrdersOlderThan,
  updateOrderStatus,
  getOrderItems,
} = require("../data/db");
const { formatDateVN } = require("../utils/order");

const GRACE_PERIOD_SECONDS = 180;

function startAutoConfirmJob(bot, adminChatId) {
  setInterval(async () => {
    try {
      const expiredOrders = await getPendingOrdersOlderThan(GRACE_PERIOD_SECONDS);

      for (const order of expiredOrders) {
        await updateOrderStatus(order.order_code, "confirmed");

        if (adminChatId) {
          const items = await getOrderItems(order.id);
          const itemsText = items
            .map((item, i) => {
              let text = `${i + 1}. <b>${item.item_name}</b> (Size ${item.size}) - SL: ${item.quantity}\n`;
              if (item.toppings_text) {
                text += `   👉 Topping: ${item.toppings_text}\n`;
              }
              text += `   💵 ${Number(item.line_total).toLocaleString("vi-VN")}đ`;
              return text;
            })
            .join("\n");

          const formattedDate = formatDateVN(order.created_at);

          let orderMsg =
            `🔔 <b>CÓ ĐƠN HÀNG MỚI XÁC NHẬN!</b>\n` +
            `📦 Mã đơn: <code>${order.order_code}</code>\n` +
            `🕒 Đặt lúc: ${formattedDate}\n\n` +
            `👤 <b>Khách hàng:</b> ${order.customer_name}\n` +
            `📞 <b>SĐT:</b> ${order.phone}\n` +
            `📍 <b>Giao đến:</b> ${order.address}\n` +
            `📝 <b>Ghi chú:</b> ${order.note || "Không có"}\n`;

          if (order.telegram_username) {
            orderMsg += `💬 <b>Liên hệ:</b> @${order.telegram_username}\n`;
          }

          orderMsg +=
            `\n🍱 <b>CHI TIẾT MÓN:</b>\n${itemsText}\n\n` +
            `💰 <b>TỔNG TIỀN:</b> ${Number(order.total_amount).toLocaleString("vi-VN")}đ`;

          await bot.telegram.sendMessage(adminChatId, orderMsg, {
            parse_mode: "HTML",
          });
        }

        // Notify user
        if (order.telegram_user_id) {
          try {
            await bot.telegram.sendMessage(
              order.telegram_user_id,
              `✅ Đơn hàng <b>${order.order_code}</b> của bạn đã được xác nhận và gửi đến quán.\n` +
                "Quán sẽ bắt đầu làm đơn hàng ngay đây! 🎉",
              { parse_mode: "HTML" },
            );
          } catch {
            // User may have blocked bot
          }
        }
      }
    } catch (error) {
      console.error("Lỗi auto-confirm:", error);
    }
  }, 30000);
}

module.exports = { startAutoConfirmJob, GRACE_PERIOD_SECONDS };
