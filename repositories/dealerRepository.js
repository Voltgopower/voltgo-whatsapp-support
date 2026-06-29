const db = require("../config/db");

async function getDealers() {
  const result = await db.query(
    `
    SELECT
      id,
      dealer_code,
      company,
      contact_name,
      email,
      phone,
      country,
      timezone,
      currency,
      language,
      portal_enabled,
      status,
      created_at,
      updated_at
    FROM portal_dealers
    ORDER BY id DESC
    `
  );

  return result.rows;
}

async function getDealerById(id) {
  const result = await db.query(
    `
    SELECT
      id,
      dealer_code,
      company,
      contact_name,
      email,
      phone,
      country,
      timezone,
      currency,
      language,
      portal_enabled,
      status,
      created_at,
      updated_at
    FROM portal_dealers
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getDealerDashboard(dealerId) {
  const summaryResult = await db.query(
    `
    SELECT
      d.id AS dealer_id,
      d.dealer_code,
      d.company AS dealer_company,
      d.contact_name,
      d.email,

      COUNT(DISTINCT c.id) AS customer_count,
      COUNT(DISTINCT b.id) AS batch_count,
      COUNT(DISTINCT s.id) AS shipment_count,

      COALESCE(SUM(DISTINCT b.invoice_amount), 0) AS invoice_amount,
      COALESCE(SUM(pa.allocated_amount), 0) AS received_amount,
      COALESCE(SUM(DISTINCT b.invoice_amount), 0) - COALESCE(SUM(pa.allocated_amount), 0) AS outstanding_amount

    FROM portal_dealers d
    LEFT JOIN portal_customers c
      ON c.dealer_id = d.id
    LEFT JOIN portal_batches b
      ON b.customer_id = c.id
    LEFT JOIN portal_shipments s
      ON s.batch_id = b.id
    LEFT JOIN portal_payment_allocations pa
      ON pa.batch_id = b.id
    WHERE d.id = $1
    GROUP BY
      d.id,
      d.dealer_code,
      d.company,
      d.contact_name,
      d.email
    `,
    [dealerId]
  );

  const recentBatchesResult = await db.query(
    `
    SELECT
      b.id,
      b.batch_no,
      b.status,
      b.shipment_date,
      b.invoice_amount,
      c.name AS customer_name,
      c.company AS customer_company
    FROM portal_batches b
    JOIN portal_customers c
      ON c.id = b.customer_id
    WHERE c.dealer_id = $1
    ORDER BY b.id DESC
    LIMIT 10
    `,
    [dealerId]
  );

  const recentShipmentsResult = await db.query(
    `
    SELECT
      s.id,
      s.shipment_no,
      s.carrier,
      s.tracking_no,
      s.status,
      s.etd,
      s.eta,
      s.delivered_at,
      b.batch_no,
      c.company AS customer_company
    FROM portal_shipments s
    JOIN portal_batches b
      ON b.id = s.batch_id
    JOIN portal_customers c
      ON c.id = b.customer_id
    WHERE c.dealer_id = $1
    ORDER BY s.id DESC
    LIMIT 10
    `,
    [dealerId]
  );

  const recentPaymentsResult = await db.query(
    `
    SELECT DISTINCT
      p.id,
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount,
      c.company AS customer_company
    FROM portal_payments p
    JOIN portal_payment_allocations pa
      ON pa.payment_id = p.id
    JOIN portal_batches b
      ON b.id = pa.batch_id
    JOIN portal_customers c
      ON c.id = b.customer_id
    WHERE c.dealer_id = $1
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT 10
    `,
    [dealerId]
  );

  return {
    summary: summaryResult.rows[0] || null,
    recent_batches: recentBatchesResult.rows,
    recent_shipments: recentShipmentsResult.rows,
    recent_payments: recentPaymentsResult.rows,
  };
}

module.exports = {
  getDealers,
  getDealerById,
  getDealerDashboard,
};