const db = require("../config/db");
const bcrypt = require("bcrypt");

async function getDealers() {
  const result = await db.query(`
    SELECT
      d.id,
      d.dealer_code,
      d.company,
      d.contact_name,
      d.email,
      d.phone,
      d.country,
      d.timezone,
      d.currency,
      d.language,
      d.portal_enabled,
      d.status,
      d.created_at,
      d.updated_at,
      u.id AS user_id,
      u.email AS login_email,
      u.active AS user_active
    FROM portal_dealers d
    LEFT JOIN portal_dealer_users u
      ON u.dealer_id = d.id
    ORDER BY d.id DESC
  `);

  return result.rows;
}

async function createDealer(data) {
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const dealerResult = await client.query(
      `
      INSERT INTO portal_dealers
      (
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
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'active')
      RETURNING *
      `,
      [
        data.dealer_code,
        data.company,
        data.contact_name,
        data.email,
        data.phone || "",
        data.country || "USA",
        data.timezone || "America/Los_Angeles",
        data.currency || "USD",
        data.language || "en",
      ]
    );

    const dealer = dealerResult.rows[0];

    const passwordHash = await bcrypt.hash(data.password || "Voltgo123!", 10);

    await client.query(
      `
      INSERT INTO portal_dealer_users
      (
        dealer_id,
        name,
        email,
        password_hash,
        role,
        active
      )
      VALUES ($1,$2,$3,$4,'admin',true)
      `,
      [
        dealer.id,
        data.contact_name || data.company,
        data.email,
        passwordHash,
      ]
    );

    await client.query("COMMIT");

    return dealer;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateDealer(id, data) {
  const result = await db.query(
    `
    UPDATE portal_dealers
    SET
      company = $1,
      contact_name = $2,
      phone = $3,
      country = $4,
      timezone = $5,
      currency = $6,
      language = $7,
      updated_at = NOW()
    WHERE id = $8
    RETURNING *
    `,
    [
      data.company,
      data.contact_name,
      data.phone || "",
      data.country || "USA",
      data.timezone || "America/Los_Angeles",
      data.currency || "USD",
      data.language || "en",
      id,
    ]
  );

  return result.rows[0];
}

async function updateDealerStatus(id, portalEnabled) {
  const result = await db.query(
    `
    UPDATE portal_dealers
    SET
      portal_enabled = $1,
      status = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING *
    `,
    [
      portalEnabled,
      portalEnabled ? "active" : "disabled",
      id,
    ]
  );

  await db.query(
    `
    UPDATE portal_dealer_users
    SET active = $1
    WHERE dealer_id = $2
    `,
    [portalEnabled, id]
  );

  return result.rows[0];
}

async function resetDealerPassword(id, password) {
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.query(
    `
    UPDATE portal_dealer_users
    SET password_hash = $1
    WHERE dealer_id = $2
    RETURNING dealer_id, email, active
    `,
    [passwordHash, id]
  );

  return result.rows[0];
}

module.exports = {
  getDealers,
  createDealer,
  updateDealer,
  updateDealerStatus,
  resetDealerPassword,
};