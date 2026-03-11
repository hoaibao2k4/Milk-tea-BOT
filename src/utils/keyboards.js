const { Markup } = require("telegraf");

function getNextActionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Thêm món khác", "cart_add_more")],
    [Markup.button.callback("💳 Đặt hàng ngay", "cart_checkout")],
    [Markup.button.callback("🛒 Xem giỏ hàng", "cart_view")],
    [Markup.button.callback("🏠 Quay về trang chủ", "back_to_home")],
  ]);
}

function getCartKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💳 Đặt toàn bộ", "cart_checkout")],
    [Markup.button.callback("📋 Chọn món để đặt", "cart_select_items")],
    [Markup.button.callback("➕ Thêm món", "cart_add_more")],
    [Markup.button.callback("✏️ Sửa số lượng", "cart_edit_qty")],
    [Markup.button.callback("🗑️ Xóa món", "cart_delete_item")],
    [Markup.button.callback("🏠 Quay về trang chủ", "back_to_home")],
  ]);
}

function getConfirmOrderKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Xác nhận đặt hàng", "confirm_order")],
    [Markup.button.callback("❌ Hủy lệnh đặt", "confirm_cancel_order_flow")],
    [Markup.button.callback("🏠 Quay về trang chủ", "back_to_home")],
  ]);
}

module.exports = {
  getNextActionKeyboard,
  getCartKeyboard,
  getConfirmOrderKeyboard,
};
