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
  console.log("createBatch data =", data);
  const result = await db.query(
    `
    INSERT INTO portal_batches
    (
      batch_no,
      customer_id,
      dealer_name,
      po_number,
      reference,
      shipment_date,
      arrival_date,
      invoice_amount,
      status,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
    `,
    [
      data.batch_no,
      data.customer_id || null,
      data.dealer_name || null,
      data.po_number || null,
      data.reference || null,
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
  let sql = `
    SELECT
      d.*,

      CASE
        WHEN d.related_type = 'batch' THEN b.batch_no
        WHEN d.related_type = 'shipment' THEN s.shipment_no
        WHEN d.related_type = 'payment' THEN p.reference_no
        ELSE NULL
      END AS related_label,

      CASE
        WHEN d.related_type = 'batch' THEN 'Batch'
        WHEN d.related_type = 'shipment' THEN 'Shipment'
        WHEN d.related_type = 'payment' THEN 'Payment'
        ELSE 'General'
      END AS related_type_label

    FROM portal_documents d
    LEFT JOIN portal_batches b
      ON d.related_type = 'batch'
      AND d.related_id = b.id
    LEFT JOIN portal_shipments s
      ON d.related_type = 'shipment'
      AND d.related_id = s.id
    LEFT JOIN portal_payments p
      ON d.related_type = 'payment'
      AND d.related_id = p.id
    WHERE 1=1
  `;

  const params = [];

  if (filters.related_type) {
    params.push(filters.related_type);
    sql += ` AND d.related_type = $${params.length}`;
  }

  if (filters.related_id) {
    params.push(filters.related_id);
    sql += ` AND d.related_id = $${params.length}`;
  }

  sql += `
    ORDER BY d.id DESC
  `;

  const result = await db.query(sql, params);
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
async function getShipments(batchId) {
  const result = await db.query(
    `
    SELECT
      s.*,
      COALESCE(SUM(sa.allocated_amount), 0) AS linked_amount,
      STRING_AGG(DISTINCT p.reference_no, ', ') AS linked_payment
    FROM portal_shipments s
    LEFT JOIN portal_shipment_allocations sa
      ON sa.shipment_id = s.id
    LEFT JOIN portal_payment_allocations pa
      ON pa.id = sa.allocation_id
    LEFT JOIN portal_payments p
      ON p.id = pa.payment_id
    WHERE s.batch_id = $1
    GROUP BY s.id
    ORDER BY s.id
    `,
    [batchId]
  );

  return result.rows;
}async function createShipment(data) {
  const { rows } = await db.query(
    `
    INSERT INTO portal_shipments
    (
      batch_id,
      shipment_no,
      carrier,
      tracking_no,
      bol_no,
      container_no,
      etd,
      eta,
      delivered_at,
      status,
      notes
    )
    VALUES
    (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    )
    RETURNING *
    `,
    [
      data.batch_id,
      data.shipment_no,
      data.carrier,
      data.tracking_no,
      data.bol_no,
      data.container_no,
      data.etd,
      data.eta,
      data.delivered_at,
      data.status,
      data.notes,
    ]
  );

  return rows[0];
}
async function getShipmentAllocations(shipmentId) {
  const result = await db.query(
    `
    SELECT
      sa.*,
      p.method,
      p.reference_no,
      p.payment_date,
      b.batch_no
    FROM portal_shipment_allocations sa
    JOIN portal_payment_allocations pa
      ON pa.id = sa.allocation_id
    LEFT JOIN portal_payments p
      ON p.id = pa.payment_id
    LEFT JOIN portal_batches b
      ON b.id = pa.batch_id
    WHERE sa.shipment_id = $1
    ORDER BY sa.id
    `,
    [shipmentId]
  );

  return result.rows;
}async function createShipmentAllocation(data) {
  const result = await db.query(
    `
    INSERT INTO portal_shipment_allocations
    (
      shipment_id,
      allocation_id,
      allocated_amount,
      notes
    )
    VALUES ($1,$2,$3,$4)
    RETURNING *
    `,
    [
      data.shipment_id,
      data.allocation_id,
      data.allocated_amount || 0,
      data.notes || null,
    ]
  );

  return result.rows[0];
}
async function getAvailableAllocations() {
  const result = await db.query(`
    SELECT
      pa.id,
      pa.allocated_amount,
      p.method,
      p.reference_no,
      p.payment_date,
      b.batch_no
    FROM portal_payment_allocations pa
    LEFT JOIN portal_payments p ON p.id = pa.payment_id
    LEFT JOIN portal_batches b ON b.id = pa.batch_id
    ORDER BY pa.id DESC
  `);

  return result.rows;
}
async function deleteShipmentAllocation(id) {
  const result = await db.query(
    `
    DELETE FROM portal_shipment_allocations
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}
async function getSalesReport({ start_date, end_date }) {
  const params = [start_date, end_date];

  const summaryResult = await db.query(
    `
    SELECT
      COALESCE(SUM(b.invoice_amount), 0) AS total_invoice,
      COALESCE(SUM(pa.received_amount), 0) AS total_received,
      COALESCE(SUM(b.invoice_amount - COALESCE(pa.received_amount, 0)), 0) AS total_outstanding,
      COUNT(DISTINCT b.id) AS batch_count,
      COUNT(DISTINCT b.customer_id) AS customer_count
    FROM portal_batches b
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(allocated_amount) AS received_amount
      FROM portal_payment_allocations
      GROUP BY batch_id
    ) pa ON pa.batch_id = b.id
    WHERE b.shipment_date BETWEEN $1 AND $2
    `,
    params
  );

  const salesBySkuResult = await db.query(
    `
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
    `,
    params
  );

  const salesByCustomerResult = await db.query(
    `
    SELECT
      c.name AS customer_name,
      c.company AS customer_company,
      COALESCE(SUM(b.invoice_amount), 0) AS invoice_amount,
      COALESCE(SUM(pa.received_amount), 0) AS received_amount,
      COALESCE(SUM(b.invoice_amount - COALESCE(pa.received_amount, 0)), 0) AS outstanding_amount
    FROM portal_batches b
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(allocated_amount) AS received_amount
      FROM portal_payment_allocations
      GROUP BY batch_id
    ) pa ON pa.batch_id = b.id
    WHERE b.shipment_date BETWEEN $1 AND $2
    GROUP BY c.name, c.company
    ORDER BY invoice_amount DESC
    `,
    params
  );

  const batchDetailsResult = await db.query(
    `
    SELECT
      b.batch_no,
      c.name AS customer_name,
      c.company AS customer_company,
      b.shipment_date,
      b.invoice_amount,
      COALESCE(pa.received_amount, 0) AS received_amount,
      b.invoice_amount - COALESCE(pa.received_amount, 0) AS balance,
      b.status
    FROM portal_batches b
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(allocated_amount) AS received_amount
      FROM portal_payment_allocations
      GROUP BY batch_id
    ) pa ON pa.batch_id = b.id
    WHERE b.shipment_date BETWEEN $1 AND $2
    ORDER BY b.shipment_date DESC, b.id DESC
    `,
    params
  );

  const shipmentDetailsResult = await db.query(
    `
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
    `,
    params
  );

  const paymentDetailsResult = await db.query(
    `
    SELECT
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount AS payment_amount,
      pa.allocated_amount,
      b.batch_no,
      c.name AS customer_name
    FROM portal_payment_allocations pa
    JOIN portal_payments p ON p.id = pa.payment_id
    JOIN portal_batches b ON b.id = pa.batch_id
    LEFT JOIN portal_customers c ON c.id = b.customer_id
    WHERE b.shipment_date BETWEEN $1 AND $2
    ORDER BY p.payment_date DESC, p.id DESC
    `,
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
async function getCustomerStatement({ customer_id, start_date, end_date }) {
  const params = [customer_id, start_date, end_date];

  const summaryResult = await db.query(
    `
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      c.company AS customer_company,
      COALESCE(SUM(b.invoice_amount), 0) AS invoice_amount,
      COALESCE(SUM(pa.allocated_amount), 0) AS received_amount,
      COALESCE(SUM(b.invoice_amount), 0) - COALESCE(SUM(pa.allocated_amount), 0) AS outstanding_amount,
      COUNT(DISTINCT b.id) AS batch_count,
      COUNT(DISTINCT pa.id) AS allocation_count
    FROM portal_customers c
    LEFT JOIN portal_batches b
      ON b.customer_id = c.id
      AND b.shipment_date BETWEEN $2 AND $3
    LEFT JOIN portal_payment_allocations pa
      ON pa.batch_id = b.id
    WHERE c.id = $1
    GROUP BY c.id, c.name, c.company
    `,
    params
  );

  const allocationDetailsResult = await db.query(
    `
    SELECT
      pa.id AS allocation_id,
      b.batch_no,
      b.shipment_date,
      b.invoice_amount,
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount AS payment_amount,
      pa.allocated_amount,
      b.invoice_amount - COALESCE(batch_alloc.total_allocated, 0) AS batch_balance,
      b.status AS batch_status
    FROM portal_payment_allocations pa
    JOIN portal_batches b ON b.id = pa.batch_id
    JOIN portal_payments p ON p.id = pa.payment_id
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(allocated_amount) AS total_allocated
      FROM portal_payment_allocations
      GROUP BY batch_id
    ) batch_alloc ON batch_alloc.batch_id = b.id
    WHERE b.customer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, b.id DESC, pa.id DESC
    `,
    params
  );

  const batchDetailsResult = await db.query(
    `
    SELECT
      b.id,
      b.batch_no,
      b.shipment_date,
      b.invoice_amount,
      COALESCE(batch_alloc.total_allocated, 0) AS received_amount,
      b.invoice_amount - COALESCE(batch_alloc.total_allocated, 0) AS balance,
      b.status
    FROM portal_batches b
    LEFT JOIN (
      SELECT
        batch_id,
        SUM(allocated_amount) AS total_allocated
      FROM portal_payment_allocations
      GROUP BY batch_id
    ) batch_alloc ON batch_alloc.batch_id = b.id
    WHERE b.customer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY b.shipment_date DESC, b.id DESC
    `,
    params
  );

  const shipmentDetailsResult = await db.query(
    `
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
    `,
    params
  );

  const paymentDetailsResult = await db.query(
    `
    SELECT DISTINCT
      p.id,
      p.payment_date,
      p.method,
      p.reference_no,
      p.amount,
      p.notes
    FROM portal_payments p
    JOIN portal_payment_allocations pa ON pa.payment_id = p.id
    JOIN portal_batches b ON b.id = pa.batch_id
    WHERE b.customer_id = $1
      AND b.shipment_date BETWEEN $2 AND $3
    ORDER BY p.payment_date DESC, p.id DESC
    `,
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
async function getShipmentItems(shipmentId) {
  const result = await db.query(
    `
    SELECT
      si.id,
      si.shipment_id,
      si.product_id,
      si.description_snapshot,
      si.qty,
      si.unit_price,
      si.discount,
      si.notes,
      si.created_at,
      si.updated_at,

      p.sku,
      p.product_name,
      p.category,
      p.chemistry,
      p.voltage,
      p.capacity,
      p.unit,
      p.dealer_price,

      (COALESCE(si.qty, 0) * COALESCE(si.unit_price, 0) - COALESCE(si.discount, 0)) AS amount
    FROM portal_shipment_items si
    LEFT JOIN portal_products p ON p.id = si.product_id
    WHERE si.shipment_id = $1
    ORDER BY si.id ASC
    `,
    [shipmentId]
  );

  return result.rows;
}
async function createShipmentItem(shipmentId, data) {
  const result = await db.query(
    `
    INSERT INTO portal_shipment_items
    (
      shipment_id,
      product_id,
      description_snapshot,
      qty,
      unit_price,
      discount,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      shipmentId,
      data.product_id || null,
      data.description_snapshot || null,
      data.qty || 0,
      data.unit_price || 0,
      data.discount || 0,
      data.notes || null,
    ]
  );

  return result.rows[0];
}

async function deleteShipmentItem(id) {
  const result = await db.query(
    `
    DELETE FROM portal_shipment_items
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}
async function getProducts() {
  const result = await db.query(`
    SELECT *
    FROM portal_products
    ORDER BY active DESC, sku ASC
  `);

  return result.rows;
}

async function createProduct(data) {
  const result = await db.query(
    `
    INSERT INTO portal_products
    (
      sku,
      product_name,
      description,
      category,
      chemistry,
      voltage,
      capacity,
      unit,
      weight,
      volume,
      msrp,
      dealer_price,
      cost,
      active
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *
    `,
    [
      data.sku,
      data.product_name,
      data.description || null,
      data.category || null,
      data.chemistry || null,
      data.voltage || null,
      data.capacity || null,
      data.unit || "pcs",
      data.weight || null,
      data.volume || null,
      data.msrp || 0,
      data.dealer_price || 0,
      data.cost || 0,
      data.active !== false,
    ]
  );

  return result.rows[0];
}

async function updateProduct(id, data) {
  const result = await db.query(
    `
    UPDATE portal_products
    SET
      sku = $1,
      product_name = $2,
      description = $3,
      category = $4,
      chemistry = $5,
      voltage = $6,
      capacity = $7,
      unit = $8,
      weight = $9,
      volume = $10,
      msrp = $11,
      dealer_price = $12,
      cost = $13,
      active = $14,
      updated_at = NOW()
    WHERE id = $15
    RETURNING *
    `,
    [
      data.sku,
      data.product_name,
      data.description || null,
      data.category || null,
      data.chemistry || null,
      data.voltage || null,
      data.capacity || null,
      data.unit || "pcs",
      data.weight || null,
      data.volume || null,
      data.msrp || 0,
      data.dealer_price || 0,
      data.cost || 0,
      data.active !== false,
      id,
    ]
  );

  return result.rows[0];
}

async function deleteProduct(id) {
  const result = await db.query(
    `
    DELETE FROM portal_products
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}
async function getBatchProductSummary(batchId) {
  const result = await db.query(
    `
    SELECT
      p.id AS product_id,
      p.sku,
      p.product_name,
      p.category,
      p.chemistry,
      p.voltage,
      p.capacity,
      p.unit,
      SUM(si.qty) AS total_qty,
      COUNT(DISTINCT s.id) AS shipment_count,
      SUM(si.qty * si.unit_price) AS amount,
      MAX(s.shipment_no) AS latest_shipment_no
    FROM portal_shipment_items si
    JOIN portal_shipments s ON s.id = si.shipment_id
    LEFT JOIN portal_products p ON p.id = si.product_id
    WHERE s.batch_id = $1
    GROUP BY
      p.id,
      p.sku,
      p.product_name,
      p.category,
      p.chemistry,
      p.voltage,
      p.capacity,
      p.unit
    ORDER BY p.sku ASC
    `,
    [batchId]
  );

  return result.rows;
}
async function updateBatch(id, data) {
  const result = await db.query(
    `
    UPDATE portal_batches
    SET
      batch_no = $1,
      dealer_name = $2,
      invoice_amount = $3,
      status = $4,
      shipment_date = $5
    WHERE id = $6
    RETURNING *
    `,
    [
      data.batch_no,
      data.customer_name || data.dealer_name || null,
      data.invoice_amount || 0,
      data.status || "draft",
      data.shipment_date || null,
      id,
    ]
  );

  return result.rows[0];
}
async function updateShipment(id, data) {
  const result = await db.query(
    `
    UPDATE portal_shipments
    SET
      shipment_no = $1,
      carrier = $2,
      tracking_no = $3,
      bol_no = $4,
      container_no = $5,
      status = $6,
      notes = $7
    WHERE id = $8
    RETURNING *
    `,
    [
      data.shipment_no,
      data.carrier || null,
      data.tracking_no || null,
      data.bol_no || null,
      data.container_no || null,
      data.status || "draft",
      data.notes || null,
      id,
    ]
  );

  return result.rows[0];
}
async function updatePayment(id, data) {
  const result = await db.query(
    `
    UPDATE portal_payments
    SET
      customer_id = $1,
      payment_date = $2,
      amount = $3,
      method = $4,
      reference_no = $5,
      notes = $6
    WHERE id = $7
    RETURNING *
    `,
    [
      data.customer_id || null,
      data.payment_date || null,
      data.amount || 0,
      data.method || null,
      data.reference_no || null,
      data.notes || null,
      id,
    ]
  );

  return result.rows[0];
}

async function deletePayment(id) {
  const allocationCheck = await db.query(
    `
    SELECT COUNT(*)::int AS count
    FROM portal_payment_allocations
    WHERE payment_id = $1
    `,
    [id]
  );

  if (allocationCheck.rows[0].count > 0) {
    const err = new Error("Payment has allocations and cannot be deleted");
    err.statusCode = 400;
    throw err;
  }

  const result = await db.query(
    `
    DELETE FROM portal_payments
    WHERE id = $1
    RETURNING *
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
  getShipments,
  createShipment,
  getShipmentAllocations,
  createShipmentAllocation,
  getAvailableAllocations,
  deleteShipmentAllocation,
  getSalesReport,
  getCustomerStatement,
  getShipmentItems,
  createShipmentItem,
  deleteShipmentItem,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getBatchProductSummary,
  updateBatch,
  updateShipment,
  updatePayment,
  deletePayment,
};