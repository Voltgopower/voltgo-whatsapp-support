const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const db = require("../config/db");

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS portal_shipment_allocations (
      id SERIAL PRIMARY KEY,

      shipment_id INTEGER NOT NULL REFERENCES portal_shipments(id) ON DELETE CASCADE,
      allocation_id INTEGER NOT NULL REFERENCES portal_payment_allocations(id) ON DELETE CASCADE,

      allocated_amount NUMERIC(12,2) DEFAULT 0,

      notes TEXT,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("portal_shipment_allocations table created");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});