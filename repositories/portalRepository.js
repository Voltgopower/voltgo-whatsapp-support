const db = require("../config/db");

async function getCustomers() {
  const result = await db.query(`
    SELECT *
    FROM portal_customers
    ORDER BY id DESC
  `);

  return result.rows;
}

async function createCustomer(data) {
  const result = await db.query(
    `
    INSERT INTO portal_customers
    (
      name,
      company,
      email,
      phone,
      customer_type
    )
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *
    `,
    [
      data.name,
      data.company,
      data.email,
      data.phone,
      data.customer_type || "dealer",
    ]
  );

  return result.rows[0];
}
async function getBatches() {
  const result = await db.query(`
    SELECT
      b.*,
      c.name AS customer_name,
      c.company AS customer_company,
      COALESCE(SUM(pa.allocated_amount), 0) AS received_amount,
      (b.invoice_amount - COALESCE(SUM(pa.allocated_amount), 0)) AS balance
    FROM portal_batches b
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN portal_payment_allocations pa ON pa.batch_id = b.id
    GROUP BY b.id, c.name, c.company
    ORDER BY b.id DESC
  `);

  return result.rows;
}

async function createBatch(data) {
  const result = await db.query(
    `
    INSERT INTO portal_batches
    (
      batch_no,
      customer_id,
      shipment_date,
      arrival_date,
      invoice_amount,
      status,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      data.batch_no,
      data.customer_id,
      data.shipment_date || null,
      data.arrival_date || null,
      data.invoice_amount || 0,
      data.status || "draft",
      data.notes || null,
    ]
  );

  return result.rows[0];
}
module.exports = {
  getCustomers,
  createCustomer,
  getBatches,
  createBatch,
};