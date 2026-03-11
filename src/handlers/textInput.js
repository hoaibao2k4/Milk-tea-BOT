const { Markup } = require("telegraf");
const { getUserSession } = require("../data/session");
const { loadMenuFromCSV, findItemById } = require("../services/menu.service");
const { getPriceBySize } = require("../utils/price");
const { formatCart } = require("../utils/cart");
const { isValidPhone, formatOrderSummary } = require("../utils/order");
const {
  getCartKeyboard,
  getConfirmOrderKeyboard,
} = require("../utils/keyboards");

function registerTextInputHandler(bot) {
  bot.on("text", async (ctx) => {
    try {
      const userId = ctx.from.id;
      const session = getUserSession(userId);
      const text = ctx.message.text.trim();

      // Skip commands
      if (text.startsWith("/")) {
        return;
      }

      // Edit cart quantity
      if (
        session.awaitingEditQtyInput &&
        session.editingCartIndex !== undefined
      ) {
        const qty = Number(text);

        if (!Number.isInteger(qty) || qty <= 0) {
          await ctx.reply(
            "Số lượng không hợp lệ. Vui lòng nhập số nguyên dương.",
          );
          return;
        }

        const item = session.cart[session.editingCartIndex];
        if (!item) {
          await ctx.reply("Không tìm thấy món trong giỏ. Gõ /cart để xem lại.");
          session.awaitingEditQtyInput = false;
          session.editingCartIndex = undefined;
          return;
        }

        const oldQty = item.quantity;
        item.quantity = qty;

        session.awaitingEditQtyInput = false;
        session.editingCartIndex = undefined;

        await ctx.reply(
          `✅ Đã sửa *${item.name}* (${item.size}): ${oldQty} → ${qty}\n\n` +
            formatCart(session.cart),
          { parse_mode: "Markdown", ...getCartKeyboard() },
        );
        return;
      }

      // Quantity input for new item
      if (session.awaitingQuantityInput) {
        const quantity = Number(text);

        if (!Number.isInteger(quantity) || quantity <= 0) {
          await ctx.reply(
            "Số lượng không hợp lệ. Vui lòng nhập một số nguyên dương, ví dụ: 2",
          );
          return;
        }

        if (!session.selectedItemId || !session.size) {
          await ctx.reply(
            "Phiên chọn món chưa hợp lệ. Hãy gõ /order để bắt đầu lại.",
          );
          return;
        }

        const menuItems = await loadMenuFromCSV();
        const selectedItem = findItemById(menuItems, session.selectedItemId);

        if (!selectedItem) {
          await ctx.reply(
            "Không tìm thấy món đã chọn. Hãy gõ /order để bắt đầu lại.",
          );
          return;
        }

        const selectedSize = session.size;
        const unitPrice = getPriceBySize(selectedItem, selectedSize);

        let toppingsTotal = 0;
        let toppingsText = "";
        if (session.selectedToppings.length > 0) {
          const toppingDetails = session.selectedToppings.map((tid) =>
            findItemById(menuItems, tid),
          );
          toppingsTotal = toppingDetails.reduce((sum, t) => sum + t.priceM, 0);
          toppingsText = toppingDetails.map((t) => t.name).join(", ");
        }

        const lineTotal = (unitPrice + toppingsTotal) * quantity;

        session.quantity = quantity;
        session.awaitingQuantityInput = false;

        await ctx.reply(
          "📝 Món bạn đang chọn:\n\n" +
            `🧋 *${selectedItem.name}*\n` +
            `📏 Size: ${selectedSize}\n` +
            `${toppingsText ? `✨ Topping: ${toppingsText}\n` : ""}` +
            `🔢 Số lượng: ${quantity}\n` +
            `💰 Thành tiền: ${lineTotal.toLocaleString("vi-VN")}đ\n\n` +
            "Bạn muốn làm gì tiếp?",
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "📦 Đặt hàng luôn món này",
                  "buy_now_action",
                ),
              ],
              [
                Markup.button.callback(
                  "🛒 Thêm vào giỏ hàng",
                  "add_to_cart_action",
                ),
              ],
              [Markup.button.callback("⬅️ Quay lại", "back_to_toppings")],
            ]),
          },
        );

        return;
      }

      // Checkout flow: customer info
      if (session.checkoutStep === "name") {
        session.customerInfo.name = text;
        session.checkoutStep = "phone";
        await ctx.reply("📞 Vui lòng nhập số điện thoại người nhận:");
        return;
      }

      if (session.checkoutStep === "phone") {
        if (!isValidPhone(text)) {
          await ctx.reply(
            "Số điện thoại chưa hợp lệ. Vui lòng nhập lại, ví dụ: 0912345678",
          );
          return;
        }

        session.customerInfo.phone = text;
        session.checkoutStep = "address";
        await ctx.reply("📍 Vui lòng nhập địa chỉ hoặc nơi nhận hàng:");
        return;
      }

      if (session.checkoutStep === "address") {
        session.customerInfo.address = text;
        session.checkoutStep = "note";
        await ctx.reply(
          '📝 Bạn có ghi chú gì không?\nVí dụ: "ít đá", "giao trước 10h", hoặc nhập "không"',
        );
        return;
      }

      if (session.checkoutStep === "note") {
        session.customerInfo.note = text.toLowerCase() === "không" ? "" : text;
        session.checkoutStep = "confirm";

        const username = ctx.from.username || "";

        await ctx.reply(
          "📋 Xác nhận đơn hàng:\n\n" +
            formatOrderSummary(session, username) +
            "\n\nBạn vui lòng xác nhận:",
          getConfirmOrderKeyboard(),
        );
        return;
      }

      // Default
      await ctx.reply(
        "Hiện tại bạn có thể dùng:\n" +
          "/menu - Xem menu\n" +
          "/order - Đặt món\n" +
          "/cart - Xem giỏ hàng\n" +
          "/cancel - Hủy đơn đã đặt",
      );
    } catch (error) {
      console.error("Lỗi khi xử lý tin nhắn text:", error);
      await ctx.reply("Có lỗi xảy ra khi xử lý tin nhắn.");
    }
  });
}

module.exports = { registerTextInputHandler };
