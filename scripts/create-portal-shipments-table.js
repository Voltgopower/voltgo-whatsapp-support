const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const db = require("../config/db");

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS portal_shipments (
      id SERIAL PRIMARY KEY,

      batch_id INTEGER NOT NULL REFERENCES portal_batches(id) ON DELETE CASCADE,

      shipment_no VARCHAR(100) NOT NULL,
      carrier VARCHAR(120),
      tracking_no VARCHAR(180),
      bol_no VARCHAR(180),
      container_no VARCHAR(180),

      etd DATE,
      eta DATE,
      delivered_at DATE,

      status VARCHAR(80) DEFAULT 'draft',
      notes TEXT,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("portal_shipments table created");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});