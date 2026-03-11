const { Markup } = require("telegraf");
const {
  loadMenuFromCSV,
  getDrinkCategories,
  getItemsByCategory,
  findItemById,
  getToppingItems,
} = require("../services/menu.service");
const { getUserSession } = require("../data/session");
const { getPriceBySize } = require("./price");
const { calculateCartTotal } = require("./cart");
const { getNextActionKeyboard } = require("./keyboards");

// Category menu
async function showCategoryMenu(ctx) {
  const menuItems = await loadMenuFromCSV();
  const categories = getDrinkCategories(menuItems);

  const buttons = categories.map((category) => [
    Markup.button.callback(category, `select_category:${category}`),
  ]);

  buttons.push([
    Markup.button.callback("🏠 Quay về trang chủ", "back_to_home"),
  ]);

  await ctx.reply("🧱 *CHỌN NHÓM ĐỒ UỐNG*:", {
    ...Markup.inlineKeyboard(buttons),
    parse_mode: "Markdown",
  });
}

// Items in category
async function showItemsBySelectedCategory(ctx, category) {
  const menuItems = await loadMenuFromCSV();
  const items = getItemsByCategory(menuItems, category);

  if (!items.length) {
    await ctx.reply("Hiện chưa có món nào trong nhóm này.");
    return;
  }

  const buttons = items.map((item) => [
    Markup.button.callback(item.name, `select_item:${item.itemId}`),
  ]);

  buttons.push([
    Markup.button.callback("⬅️ Quay lại chọn nhóm", "back_to_categories"),
  ]);

  await ctx.reply(`📂 *NHÓM:* ${category}\n\n👇 Chọn món bên dưới:`, {
    ...Markup.inlineKeyboard(buttons),
    parse_mode: "Markdown",
  });
}

// Toppings menu
async function showToppingsMenu(ctx) {
  const menuItems = await loadMenuFromCSV();
  const toppings = getToppingItems(menuItems);
  const userId = ctx.from.id;
  const session = getUserSession(userId);

  const selectedItem = findItemById(menuItems, session.selectedItemId);
  const itemName = selectedItem ? selectedItem.name : "Món đã chọn";

  const buttons = toppings.map((t) => {
    const isSelected = session.selectedToppings.includes(t.itemId);
    const label = `${isSelected ? "✅ " : ""}${t.name} (+${t.priceM.toLocaleString("vi-VN")}đ)`;
    return [Markup.button.callback(label, `toggle_topping:${t.itemId}`)];
  });

  buttons.push(
    [Markup.button.callback("➡️ Tiếp tục", "done_toppings")],
    [Markup.button.callback("⬅️ Quay lại chọn size", "back_to_size")],
  );

  const selectedToppingsText =
    session.selectedToppings.length > 0
      ? `\n✅ Đã chọn: ${session.selectedToppings.length} topping`
      : "";

  const text =
    `🧋 *${itemName}* | Size: ${session.size}\n\n` +
    `✨ *Chọn thêm Topping:*${selectedToppingsText}`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      ...Markup.inlineKeyboard(buttons),
      parse_mode: "Markdown",
    });
  } else {
    await ctx.reply(text, {
      ...Markup.inlineKeyboard(buttons),
      parse_mode: "Markdown",
    });
  }
}

// Process add to cart / buy now
async function processAddToCart(ctx, isBuyNow = false) {
  const userId = ctx.from.id;
  const session = getUserSession(userId);
  const { clearCurrentSelection } = require("../data/session");

  if (!session.selectedItemId || !session.size || !session.quantity) {
    await ctx.answerCbQuery("Phần chọn món chưa hợp lệ.");
    return;
  }

  const menuItems = await loadMenuFromCSV();
  const selectedItem = findItemById(menuItems, session.selectedItemId);

  if (!selectedItem) {
    await ctx.answerCbQuery("Không tìm thấy món.");
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

  const quantity = session.quantity;
  const lineTotal = (unitPrice + toppingsTotal) * quantity;

  session.cart.push({
    itemId: selectedItem.itemId,
    name: selectedItem.name,
    size: selectedSize,
    quantity,
    unitPrice,
    toppingsTotal,
    toppingsText,
  });

  clearCurrentSelection(userId);

  if (isBuyNow) {
    session.checkoutStep = "name";
    await ctx.editMessageText(
      "📦 Bắt đầu nhập thông tin đặt hàng.\n\n" +
        "Vui lòng nhập *tên người nhận*:",
      { parse_mode: "Markdown" },
    );
  } else {
    const cartTotal = calculateCartTotal(session.cart);
    await ctx.editMessageText(
      "✅ Đã thêm món vào giỏ hàng\n\n" +
        `Món: ${selectedItem.name}\n` +
        `Size: ${selectedSize}\n` +
        `${toppingsText ? `Topping: ${toppingsText}\n` : ""}` +
        `Số lượng: ${quantity}\n` +
        `Thành tiền: ${lineTotal.toLocaleString("vi-VN")}đ\n\n` +
        `🛒 Tạm tính giỏ hàng: ${cartTotal.toLocaleString("vi-VN")}đ\n\n` +
        "Bạn muốn làm gì tiếp theo?",
      getNextActionKeyboard(),
    );
  }
}

module.exports = {
  showCategoryMenu,
  showItemsBySelectedCategory,
  showToppingsMenu,
  processAddToCart,
};
