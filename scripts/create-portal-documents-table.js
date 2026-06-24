const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const db = require("../config/db");

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS portal_documents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'other',

      related_type VARCHAR(80),
      related_id INTEGER,

      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER,
      mime_type VARCHAR(120),

      uploaded_by INTEGER,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("portal_documents table created");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});