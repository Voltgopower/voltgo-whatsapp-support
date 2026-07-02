const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "voltgo_jwt_secret";

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,

      dealer_id: user.dealer_id,
      dealer_user_id: user.dealer_user_id,
      email: user.email,
      user_type: user.user_type,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken,
};