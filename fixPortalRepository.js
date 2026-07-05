const fs = require("fs");

const file = "repositories/portalRepository.js";
let s = fs.readFileSync(file, "utf8");

function replaceBetween(startName, nextName, body) {
  const start = `async function ${startName}`;
  const end = `async function ${nextName}`;

  const i = s.indexOf(start);
  if (i < 0) throw new Error(`Cannot find ${startName}`);

  const j = s.indexOf(end, i);
  if (j < 0) throw new Error(`Cannot find next function ${nextName}`);

  s = s.slice(0, i) + body.trim() + "\n" + s.slice(j);
}

replaceBetween("getBatches", "createBatch", `
async function getBatches({ isDealer = false, dealerId = null } = {}) {
  const params = [];
  let whereSql = "";

  if (isDealer) {
    params.push(dealerId);
    whereSql = \`WHERE b.dealer_id = $\${params.length}\`;
  }

  const result = await db.query(
    \`
    SELECT
      b.*,

      d.id AS dealer_id,
      d.dealer_code,
      d.company AS dealer_company,
      d.contact_name AS dealer_contact_name,
      d.email AS dealer_email,

      c.name AS customer_name,
      c.company AS customer_company,

      COALESCE(pay.received_amount, 0) AS received_amount,
      (COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0)) AS balance

    FROM portal_batches b
    LEFT JOIN portal_dealers d ON d.id = b.dealer_id
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    \${whereSql}
    ORDER BY b.id DESC
    \`,
    params
  );

  return result.rows;
}
`);

replaceBetween("getBatchById", "getDocuments", `
async function getBatchById(batchId) {
  const batchResult = await db.query(
    \`
    SELECT
      b.*,
      c.name AS customer_name,
      c.company AS customer_company,
      c.email AS customer_email,
      c.phone AS customer_phone,
      COALESCE(pay.received_amount, 0) AS received_amount,
      (COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0)) AS balance
    FROM portal_batches b
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.id = $1
    \`,
    [batchId]
  );

  const batch = batchResult.rows[0];

  if (!batch) {
    return null;
  }

  const itemsResult = await db.query(
    \`
    SELECT *
    FROM portal_batch_items
    WHERE batch_id = $1
    ORDER BY id ASC
    \`,
    [batchId]
  );

  const paymentsResult = await db.query(
    \`
    SELECT
      p.*,
      COALESCE(SUM(pa.allocated_amount), 0) AS allocated_amount,
      (
        COALESCE(p.amount, 0) - COALESCE(SUM(pa.allocated_amount), 0)
      ) AS balance
    FROM portal_payments p
    LEFT JOIN portal_payment_allocations pa
      ON pa.payment_id = p.id
    WHERE p.batch_id = $1
    GROUP BY p.id
    ORDER BY p.payment_date DESC, p.id DESC
    \`,
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
    payments: paymentsResult.rows,
  };
}
`);

replaceBetween("getSalesReport", "getCustomerStatement", `
async function getSalesReport({ start_date, end_date }) {
  const params = [start_date, end_date];

  const summaryResult = await db.query(
    \`
    SELECT
      COALESCE(SUM(b.invoice_amount), 0) AS total_invoice,
      COALESCE(SUM(pay.received_amount), 0) AS total_received,
      COALESCE(SUM(COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0)), 0) AS total_outstanding,
      COUNT(DISTINCT b.id) AS batch_count,
      COUNT(DISTINCT b.customer_id) AS customer_count
    FROM portal_batches b
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.shipment_date BETWEEN $1 AND $2
    \`,
    params
  );

  const salesBySkuResult = await db.query(
    \`
    SELECT
      bi.sku,
      bi.description,
      COALESCE(SUM(bi.qty), 0) AS total_qty,
      COALESCE(SUM(bi.qty * bi.unit_price), 0) AS sales_amount
    FROM portal_batch_items bi
    JOIN portal_batches b ON b.id = bi.batch_id
    WHERE b.shipment_date BETWEEN $1 AND $2
    GROUP BY bi.sku, bi.description
    ORDER BY sales_amount DESC
    \`,
    params
  );

  const salesByCustomerResult = await db.query(
    \`
    SELECT
      c.name AS customer_name,
      c.company AS customer_company,
      COALESCE(SUM(b.invoice_amount), 0) AS invoice_amount,
      COALESCE(SUM(pay.received_amount), 0) AS received_amount,
      COALESCE(SUM(COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0)), 0) AS outstanding_amount
    FROM portal_batches b
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.shipment_date BETWEEN $1 AND $2
    GROUP BY c.name, c.company
    ORDER BY invoice_amount DESC
    \`,
    params
  );

  const batchDetailsResult = await db.query(
    \`
    SELECT
      b.batch_no,
      c.name AS customer_name,
      c.company AS customer_company,
      b.shipment_date,
      b.invoice_amount,
      COALESCE(pay.received_amount, 0) AS received_amount,
      COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0) AS balance,
      b.status
    FROM portal_batches b
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.shipment_date BETWEEN $1 AND $2
    ORDER BY b.shipment_date DESC, b.id DESC
    \`,
    params
  );

  const shipmentDetailsResult = await db.query(
    \`
    SELECT
      s.shipment_no,
      b.batch_no,
      c.name AS customer_name,
      s.carrier,
      s.tracking_no,
      s.status,
      s.etd,
      s.eta,
      s.delivered_at
    FROM portal_shipments s
    JOIN portal_batches b ON b.id = s.batch_id
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    WHERE b.shipment_date BETWEEN $1 AND $2
    ORDER BY b.shipment_date DESC, s.id DESC
    \`,
    params
  );

  const paymentDetailsResult = await db.query(
    \`
    SELECT
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount AS payment_amount,
      p.amount AS allocated_amount,
      b.batch_no,
      c.name AS customer_name
    FROM portal_payments p
    JOIN portal_batches b ON b.id = p.batch_id
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    WHERE b.shipment_date BETWEEN $1 AND $2
    ORDER BY p.payment_date DESC, p.id DESC
    \`,
    params
  );

  return {
    summary: summaryResult.rows[0],
    sales_by_sku: salesBySkuResult.rows,
    sales_by_customer: salesByCustomerResult.rows,
    batch_details: batchDetailsResult.rows,
    shipment_details: shipmentDetailsResult.rows,
    payment_details: paymentDetailsResult.rows,
  };
}
`);

replaceBetween("getCustomerStatement", "getDealerStatement", `
async function getCustomerStatement({ customer_id, start_date, end_date }) {
  const params = [customer_id, start_date, end_date];

  const summaryResult = await db.query(
    \`
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      c.company AS customer_company,
      COALESCE(SUM(b.invoice_amount), 0) AS invoice_amount,
      COALESCE(SUM(pay.received_amount), 0) AS received_amount,
      COALESCE(SUM(COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0)), 0) AS outstanding_amount,
      COUNT(DISTINCT b.id) AS batch_count,
      COUNT(DISTINCT p.id) AS allocation_count
    FROM portal_customers c
    LEFT JOIN portal_batches b
      ON b.customer_id = c.id
      AND b.shipment_date BETWEEN $2 AND $3
    LEFT JOIN portal_payments p
      ON p.batch_id = b.id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE c.id = $1
    GROUP BY c.id, c.name, c.company
    \`,
    params
  );

  const allocationDetailsResult = await db.query(
    \`
    SELECT
      p.id AS allocation_id,
      b.batch_no,
      b.shipment_date,
      b.invoice_amount,
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount AS payment_amount,
      p.amount AS allocated_amount,
      COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0) AS batch_balance,
      b.status AS batch_status
    FROM portal_payments p
    JOIN portal_batches b ON b.id = p.batch_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.customer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, b.id DESC, p.id DESC
    \`,
    params
  );

  const batchDetailsResult = await db.query(
    \`
    SELECT
      b.id,
      b.batch_no,
      b.shipment_date,
      b.invoice_amount,
      COALESCE(pay.received_amount, 0) AS received_amount,
      COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0) AS balance,
      b.status
    FROM portal_batches b
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.customer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, b.id DESC
    \`,
    params
  );

  const shipmentDetailsResult = await db.query(
    \`
    SELECT
      s.shipment_no,
      b.batch_no,
      s.carrier,
      s.tracking_no,
      s.status,
      s.etd,
      s.eta,
      s.delivered_at
    FROM portal_shipments s
    JOIN portal_batches b ON b.id = s.batch_id
    WHERE b.customer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, s.id DESC
    \`,
    params
  );

  const paymentDetailsResult = await db.query(
    \`
    SELECT DISTINCT
      p.id,
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount,
      p.notes
    FROM portal_payments p
    JOIN portal_batches b ON b.id = p.batch_id
    WHERE b.customer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY p.payment_date DESC, p.id DESC
    \`,
    params
  );

  return {
    summary: summaryResult.rows[0],
    allocation_details: allocationDetailsResult.rows,
    batch_details: batchDetailsResult.rows,
    shipment_details: shipmentDetailsResult.rows,
    payment_details: paymentDetailsResult.rows,
  };
}
`);

replaceBetween("getDealerStatement", "getShipmentItems", `
async function getDealerStatement({ dealer_id, start_date, end_date }) {
  const params = [dealer_id, start_date, end_date];

  const summaryResult = await db.query(
    \`
    SELECT
      d.id AS dealer_id,
      d.dealer_code,
      d.company,
      d.contact_name,
      d.email,
      COALESCE(SUM(b.invoice_amount), 0) AS invoice_amount,
      COALESCE(SUM(pay.received_amount), 0) AS received_amount,
      COALESCE(SUM(COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0)), 0) AS outstanding_amount,
      COUNT(DISTINCT b.id) AS batch_count,
      COUNT(DISTINCT p.id) AS allocation_count
    FROM portal_dealers d
    LEFT JOIN portal_batches b
      ON b.dealer_id = d.id
      AND b.shipment_date BETWEEN $2 AND $3
    LEFT JOIN portal_payments p
      ON p.batch_id = b.id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE d.id = $1
    GROUP BY d.id, d.dealer_code, d.company, d.contact_name, d.email
    \`,
    params
  );

  const batchDetailsResult = await db.query(
    \`
    SELECT
      b.id,
      b.batch_no,
      b.shipment_date,
      b.invoice_amount,
      COALESCE(pay.received_amount, 0) AS received_amount,
      COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0) AS balance,
      b.status
    FROM portal_batches b
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.dealer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, b.id DESC
    \`,
    params
  );

  const allocationDetailsResult = await db.query(
    \`
    SELECT
      p.id AS allocation_id,
      b.batch_no,
      b.shipment_date,
      b.invoice_amount,
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount AS payment_amount,
      p.amount AS allocated_amount,
      COALESCE(b.invoice_amount, 0) - COALESCE(pay.received_amount, 0) AS batch_balance,
      b.status AS batch_status
    FROM portal_payments p
    JOIN portal_batches b ON b.id = p.batch_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(amount) AS received_amount
      FROM portal_payments
      GROUP BY batch_id
    ) pay ON pay.batch_id = b.id
    WHERE b.dealer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, b.id DESC, p.id DESC
    \`,
    params
  );

  const shipmentDetailsResult = await db.query(
    \`
    SELECT
      s.shipment_no,
      b.batch_no,
      s.carrier,
      s.tracking_no,
      s.status,
      s.etd,
      s.eta,
      s.delivered_at
    FROM portal_shipments s
    JOIN portal_batches b ON b.id = s.batch_id
    WHERE b.dealer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, s.id DESC
    \`,
    params
  );

  const paymentDetailsResult = await db.query(
    \`
    SELECT DISTINCT
      p.id,
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount,
      p.notes
    FROM portal_payments p
    JOIN portal_batches b ON b.id = p.batch_id
    WHERE b.dealer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY p.payment_date DESC, p.id DESC
    \`,
    params
  );

  return {
    summary: summaryResult.rows[0],
    allocation_details: allocationDetailsResult.rows,
    batch_details: batchDetailsResult.rows,
    shipment_details: shipmentDetailsResult.rows,
    payment_details: paymentDetailsResult.rows,
  };
}
`);

replaceBetween("updatePayment", "deletePayment", `
async function updatePayment(id, data) {
  await db.query("BEGIN");

  try {
    const result = await db.query(
      \`
      UPDATE portal_payments
      SET
        customer_id = $1,
        dealer_id = COALESCE($2, dealer_id),
        payment_date = $3,
        amount = $4,
        method = $5,
        reference_no = $6,
        notes = $7
      WHERE id = $8
      RETURNING *
      \`,
      [
        data.customer_id || null,
        data.dealer_id || null,
        data.payment_date || null,
        data.amount || 0,
        data.method || null,
        data.reference_no || null,
        data.notes || null,
        id,
      ]
    );

    await db.query(
      \`
      UPDATE portal_payment_allocations
      SET allocated_amount = $2
      WHERE payment_id = $1
      \`,
      [id, data.amount || 0]
    );

    await db.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
`);

fs.writeFileSync(file, s);
console.log("portalRepository.js patched successfully");
