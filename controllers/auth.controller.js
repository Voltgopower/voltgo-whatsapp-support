const db = require("../config/db");
const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/jwt");

// ================= LOGIN =================
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username and password are required",
      });
    }

    const result = await db.query(
      "SELECT * FROM users WHERE username = $1 AND is_active = TRUE LIMIT 1",
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("auth login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// ================= CHANGE PASSWORD =================
async function changePassword(req, res) {
  try {
    const userId = req.user?.id;
    const isDealer =
      req.user?.role === "dealer" ||
      req.user?.user_type === "dealer";

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const tableName = isDealer ? "portal_dealer_users" : "users";

    const result = await db.query(
      `SELECT id, password_hash FROM ${tableName} WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE ${tableName} SET password_hash = $1 WHERE id = $2`,
      [hashedPassword, userId]
    );

    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}// ================= DEALER LOGIN =================
async function dealerLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required",
      });
    }

    const result = await db.query(
      `
      SELECT *
      FROM portal_dealer_users
      WHERE email = $1
        AND active = TRUE
      LIMIT 1
      `,
      [email]
    );

    const dealerUser = result.rows[0];

    if (!dealerUser) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!dealerUser.password_hash) {
      return res.status(400).json({
        success: false,
        message: "Dealer user password is not set",
      });
    }

    const match = await bcrypt.compare(password, dealerUser.password_hash);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const tokenPayload = {
      id: dealerUser.id,
      dealer_user_id: dealerUser.id,
      dealer_id: dealerUser.dealer_id,
      name: dealerUser.name,
      email: dealerUser.email,
      role: "dealer",
      user_type: "dealer",
    };

    const token = generateToken(tokenPayload);

    await db.query(
      "UPDATE portal_dealer_users SET last_login = NOW() WHERE id = $1",
      [dealerUser.id]
    );

    return res.json({
      success: true,
      token,
      user: {
        id: dealerUser.id,
        dealerUserId: dealerUser.id,
        dealerId: dealerUser.dealer_id,
        name: dealerUser.name,
        email: dealerUser.email,
        role: "dealer",
        userType: "dealer",
      },
    });
  } catch (error) {
    console.error("dealer login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
module.exports = {
  login,
  dealerLogin,
  changePassword,
}; 