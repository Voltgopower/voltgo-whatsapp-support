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

    // 1. 获取当前用户
    const result = await db.query(
      "SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2. 校验旧密码
    const match = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // 3. 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. 更新
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
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
}

module.exports = {
  login,
  changePassword,
};