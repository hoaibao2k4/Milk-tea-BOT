const sessions = {};

function createDefaultSession() {
  return {
    cart: [],
    currentCategory: null,
    selectedItemId: null,
    size: null,
    selectedToppings: [],
    quantity: null,
    awaitingQuantityInput: false,

    // Cart editing
    editingCartIndex: undefined,
    awaitingEditQtyInput: false,

    // Checkout
    checkoutStep: null,
    customerInfo: {
      name: "",
      phone: "",
      address: "",
      note: "",
    },
  };
}

function getUserSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = createDefaultSession();
  }
  return sessions[userId];
}

function clearCurrentSelection(userId) {
  const session = getUserSession(userId);
  session.currentCategory = null;
  session.selectedItemId = null;
  session.size = null;
  session.selectedToppings = [];
  session.quantity = null;
  session.awaitingQuantityInput = false;
  session.editingCartIndex = undefined;
  session.awaitingEditQtyInput = false;
}

function clearCheckout(userId) {
  const session = getUserSession(userId);
  session.checkoutStep = null;
  session.customerInfo = {
    name: "",
    phone: "",
    address: "",
    note: "",
  };
}

function clearUserSession(userId) {
  sessions[userId] = createDefaultSession();
}

module.exports = {
  getUserSession,
  clearCurrentSelection,
  clearCheckout,
  clearUserSession,
};