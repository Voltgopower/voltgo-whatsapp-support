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
async function getPayments() {
  const result = await db.query(`
    SELECT
      p.*,
      c.name AS customer_name,
      c.company AS customer_company,
      COALESCE(SUM(pa.allocated_amount), 0) AS allocated_amount,
      (p.amount - COALESCE(SUM(pa.allocated_amount), 0)) AS unapplied_amount
    FROM portal_payments p
    LEFT JOIN portal_customers c ON c.id = p.customer_id
    LEFT JOIN portal_payment_allocations pa ON pa.payment_id = p.id
    GROUP BY p.id, c.name, c.company
    ORDER BY p.id DESC
  `);

  return result.rows;
}

async function createPayment(data) {
  const result = await db.query(
    `
    INSERT INTO portal_payments
    (
      customer_id,
      payment_date,
      amount,
      method,
      reference_no,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
    `,
    [
      data.customer_id,
      data.payment_date || null,
      data.amount || 0,
      data.method || null,
      data.reference_no || null,
      data.notes || null,
    ]
  );

  return result.rows[0];
}

async function getAllocations() {
  const result = await db.query(`
    SELECT
      pa.*,
      p.amount AS payment_amount,
      p.method AS payment_method,
      p.reference_no,
      b.batch_no,
      c.name AS customer_name
    FROM portal_payment_allocations pa
    LEFT JOIN portal_payments p ON p.id = pa.payment_id
    LEFT JOIN portal_batches b ON b.id = pa.batch_id
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    ORDER BY pa.id DESC
  `);

  return result.rows;
}

async function createAllocation(data) {
  const result = await db.query(
    `
    INSERT INTO portal_payment_allocations
    (
      payment_id,
      batch_id,
      allocated_amount
    )
    VALUES ($1,$2,$3)
    RETURNING *
    `,
    [
      data.payment_id,
      data.batch_id,
      data.allocated_amount || 0,
    ]
  );

  return result.rows[0];
}
async function getBatchItems(batchId) {
  const result = await db.query(
    `
    SELECT *
    FROM portal_batch_items
    WHERE batch_id = $1
    ORDER BY id ASC
    `,
    [batchId]
  );

  return result.rows;
}

async function createBatchItem(data) {
  const result = await db.query(
    `
    INSERT INTO portal_batch_items
    (
      batch_id,
      sku,
      description,
      qty,
      unit_price
    )
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *
    `,
    [
      data.batch_id,
      data.sku,
      data.description || null,
      data.qty || 0,
      data.unit_price || 0,
    ]
  );

  return result.rows[0];
}
async function getBatchById(batchId) {
  const batchResult = await db.query(
    `
    SELECT
      b.*,
      c.name AS customer_name,
      c.company AS customer_company,
      c.email AS customer_email,
      c.phone AS customer_phone,
      COALESCE(SUM(pa.allocated_amount), 0) AS received_amount,
      (b.invoice_amount - COALESCE(SUM(pa.allocated_amount), 0)) AS balance
    FROM portal_batches b
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN portal_payment_allocations pa ON pa.batch_id = b.id
    WHERE b.id = $1
    GROUP BY b.id, c.name, c.company, c.email, c.phone
    `,
    [batchId]
  );

  const batch = batchResult.rows[0];

  if (!batch) {
    return null;
  }

  const itemsResult = await db.query(
    `
    SELECT *
    FROM portal_batch_items
    WHERE batch_id = $1
    ORDER BY id ASC
    `,
    [batchId]
  );

  const allocationsResult = await db.query(
    `
    SELECT
      pa.*,
      p.payment_date,
      p.amount AS payment_amount,
      p.method,
      p.reference_no,
      p.notes AS payment_notes
    FROM portal_payment_allocations pa
    LEFT JOIN portal_payments p ON p.id = pa.payment_id
    WHERE pa.batch_id = $1
    ORDER BY pa.id ASC
    `,
    [batchId]
  );

  return {
    ...batch,
    customer: {
      id: batch.customer_id,
      name: batch.customer_name,
      company: batch.customer_company,
      email: batch.customer_email,
      phone: batch.customer_phone,
    },
    items: itemsResult.rows,
    payments: allocationsResult.rows,
  };
}
async function getDocuments(filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.related_type) {
    values.push(filters.related_type);
    conditions.push(`related_type = $${values.length}`);
  }

  if (filters.related_id) {
    values.push(Number(filters.related_id));
    conditions.push(`related_id = $${values.length}`);
  }

  if (filters.category) {
    values.push(filters.category);
    conditions.push(`category = $${values.length}`);
  }

  const whereSql = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await db.query(
    `
    SELECT *
    FROM portal_documents
    ${whereSql}
    ORDER BY id DESC
    `,
    values
  );

  return result.rows;
}

async function createDocument(data) {
  const result = await db.query(
    `
    INSERT INTO portal_documents
    (
      title,
      category,
      related_type,
      related_id,
      file_name,
      file_url,
      file_size,
      mime_type,
      uploaded_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      data.title,
      data.category || "other",
      data.related_type || null,
      data.related_id ? Number(data.related_id) : null,
      data.file_name,
      data.file_url,
      data.file_size || null,
      data.mime_type || null,
      data.uploaded_by ? Number(data.uploaded_by) : null,
    ]
  );

  return result.rows[0];
}

async function getDocumentById(id) {
  const result = await db.query(
    `
    SELECT *
    FROM portal_documents
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
}
module.exports = {
  getCustomers,
  createCustomer,
  getBatches,
  createBatch,
  getPayments,
  createPayment,
  getAllocations,
  createAllocation,
  getBatchItems,
  createBatchItem,
  getBatchById,

  getDocuments,
  createDocument,
  getDocumentById,
};