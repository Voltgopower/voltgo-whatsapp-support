const db = require("../config/db");

async function initPortalTables() {
  try {
    console.log("Initializing portal tables...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS portal_customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        customer_type VARCHAR(50) DEFAULT 'dealer',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS portal_batches (
        id SERIAL PRIMARY KEY,
        batch_no VARCHAR(100) UNIQUE NOT NULL,
        customer_id INTEGER REFERENCES portal_customers(id) ON DELETE SET NULL,
        shipment_date DATE,
        arrival_date DATE,
        invoice_amount NUMERIC(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS portal_batch_items (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER REFERENCES portal_batches(id) ON DELETE CASCADE,
        sku VARCHAR(100),
        description TEXT,
        qty INTEGER DEFAULT 0,
        unit_price NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS portal_payments (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES portal_customers(id) ON DELETE SET NULL,
        payment_date DATE,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        method VARCHAR(50),
        reference_no VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS portal_payment_allocations (
        id SERIAL PRIMARY KEY,
        payment_id INTEGER REFERENCES portal_payments(id) ON DELETE CASCADE,
        batch_id INTEGER REFERENCES portal_batches(id) ON DELETE CASCADE,
        allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Portal tables initialized successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to initialize portal tables:", err);
    process.exit(1);
  }
}

initPortalTables();
