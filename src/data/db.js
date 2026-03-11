const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

// Schema
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_code TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        note TEXT,
        total_amount INTEGER NOT NULL,
        telegram_user_id TEXT,
        telegram_username TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        item_name TEXT NOT NULL,
        size TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        toppings_text TEXT,
        toppings_total INTEGER NOT NULL DEFAULT 0,
        line_total INTEGER NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS banned_users (
        id SERIAL PRIMARY KEY,
        telegram_user_id TEXT NOT NULL UNIQUE,
        reason TEXT,
        banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Database đã sẵn sàng");
  } finally {
    client.release();
  }
}

// Order CRUD
async function createOrder({
  orderCode,
  customerInfo,
  cart,
  totalAmount,
  telegramUserId,
  telegramUsername,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `INSERT INTO orders (
        order_code, customer_name, phone, address, note,
        total_amount, telegram_user_id, telegram_username,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
      RETURNING id`,
      [
        orderCode,
        customerInfo.name,
        customerInfo.phone,
        customerInfo.address,
        customerInfo.note || "",
        totalAmount,
        String(telegramUserId || ""),
        telegramUsername || "",
      ],
    );

    const orderId = orderResult.rows[0].id;

    for (const item of cart) {
      const toppingsText = item.toppingsText || "";
      const toppingsTotal = item.toppingsTotal || 0;
      const lineTotal = (item.unitPrice + toppingsTotal) * item.quantity;

      await client.query(
        `INSERT INTO order_items (
          order_id, item_name, size, quantity, unit_price,
          toppings_text, toppings_total, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orderId,
          item.name,
          item.size,
          item.quantity,
          item.unitPrice,
          toppingsText,
          toppingsTotal,
          lineTotal,
        ],
      );
    }

    await client.query("COMMIT");
    return orderId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getAllOrders() {
  const result = await pool.query(
    `SELECT * FROM orders ORDER BY id DESC`,
  );
  return result.rows;
}

async function getOrderByCode(orderCode) {
  const result = await pool.query(
    `SELECT * FROM orders WHERE order_code = $1`,
    [orderCode],
  );
  return result.rows[0] || null;
}

async function getOrderItems(orderId) {
  const result = await pool.query(
    `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC`,
    [orderId],
  );
  return result.rows;
}

async function getOrderById(orderId) {
  const result = await pool.query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId],
  );
  return result.rows[0] || null;
}

async function getPendingOrdersByUser(telegramUserId) {
  const result = await pool.query(
    `SELECT * FROM orders WHERE telegram_user_id = $1 AND status = 'pending' ORDER BY id DESC`,
    [String(telegramUserId)],
  );
  return result.rows;
}

async function updateOrderStatus(orderCode, status) {
  await pool.query(
    `UPDATE orders SET status = $1 WHERE order_code = $2`,
    [status, orderCode],
  );
}

async function getPendingOrdersOlderThan(seconds) {
  const result = await pool.query(
    `SELECT * FROM orders WHERE status = 'pending' AND created_at <= NOW() - INTERVAL '1 second' * $1`,
    [seconds],
  );
  return result.rows;
}

// Cancel tracking
async function getCancelCountByUser(telegramUserId) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM orders 
     WHERE telegram_user_id = $1 
     AND status = 'cancelled' 
     AND created_at::date = CURRENT_DATE`,
    [String(telegramUserId)],
  );
  return Number.parseInt(result.rows[0].count, 10);
}

// Ban system
async function banUser(telegramUserId, reason) {
  await pool.query(
    `INSERT INTO banned_users (telegram_user_id, reason, banned_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (telegram_user_id) DO NOTHING`,
    [String(telegramUserId), reason],
  );
}

async function isUserBanned(telegramUserId) {
  const result = await pool.query(
    `SELECT id FROM banned_users WHERE telegram_user_id = $1`,
    [String(telegramUserId)],
  );
  return result.rows.length > 0;
}

module.exports = {
  initDB,
  createOrder,
  getAllOrders,
  getOrderByCode,
  getOrderById,
  getOrderItems,
  getPendingOrdersByUser,
  updateOrderStatus,
  getPendingOrdersOlderThan,
  getCancelCountByUser,
  banUser,
  isUserBanned,
};