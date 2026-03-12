// Removed require telegraf
const { formatCartItems, calculateCartTotal } = require("./cart");

function isValidPhone(phone) {
  return /^(0|\+84)\d{9,10}$/.test(phone);
}

function formatCustomerInfo(customerInfo, username) {
  let info =
    `👤 *Khách hàng:* ${customerInfo.name}\n` +
    `📞 *SĐT:* ${customerInfo.phone}\n` +
    `📍 *Địa nhận:* ${customerInfo.address}\n` +
    `📝 *Ghi chú:* ${customerInfo.note || "Không có"}`;
  if (username) {
    info += `\n💬 Username: @${username}`;
  }
  return info;
}

function formatOrderSummary(session, username) {
  const cartText = formatCartItems(session.cart);
  const total = calculateCartTotal(session.cart);

  return (
    "📋 *THÔNG TIN ĐƠN HÀNG*\n\n" +
    `${cartText}\n\n` +
    "--- QUẢN LÝ KHÁCH HÀNG ---\n" +
    `${formatCustomerInfo(session.customerInfo, username)}\n\n` +
    `💵 *TỔNG THANH TOÁN:* ${total.toLocaleString("vi-VN")}đ`
  );
}

// Removed getConfirmOrderKeyboard

function formatDateVN(dateInput) {
  return new Date(dateInput).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}

module.exports = {
  isValidPhone,
  formatCustomerInfo,
  formatOrderSummary,
  formatDateVN,
};
