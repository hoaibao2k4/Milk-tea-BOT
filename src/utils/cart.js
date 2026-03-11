function formatCartItems(cart) {
  if (!cart || cart.length === 0) return "";

  let message = "";
  let total = 0;

  cart.forEach((item, index) => {
    const toppingsTotal = item.toppingsTotal || 0;
    const lineTotal = (item.unitPrice + toppingsTotal) * item.quantity;
    total += lineTotal;

    message += `${index + 1}. ${item.name}\n`;
    message += `   Size: ${item.size}\n`;
    if (item.toppingsText) {
      message += `   Topping: ${item.toppingsText}\n`;
    }
    message += `   SL: ${item.quantity}\n`;
    message += `   Đơn giá: ${item.unitPrice.toLocaleString("vi-VN")}đ`;
    if (toppingsTotal > 0) {
      message += ` + ${toppingsTotal.toLocaleString("vi-VN")}đ (topping)`;
    }
    message += `\n   Thành tiền: ${lineTotal.toLocaleString("vi-VN")}đ\n\n`;
  });

  message += `💰 *Tổng cộng:* ${total.toLocaleString("vi-VN")}đ`;

  return message;
}

function formatCart(cart) {
  if (!cart || cart.length === 0) {
    return "🛒 Giỏ hàng hiện đang trống.";
  }
  return `🛒 *GIỎ HÀNG CỦA BẠN*\n\n${formatCartItems(cart)}`;
}

function calculateCartTotal(cart) {
  if (!cart || cart.length === 0) return 0;

  return cart.reduce((sum, item) => {
    const toppingsTotal = item.toppingsTotal || 0;
    return sum + (item.unitPrice + toppingsTotal) * item.quantity;
  }, 0);
}

module.exports = {
  formatCart,
  formatCartItems,
  calculateCartTotal,
};
