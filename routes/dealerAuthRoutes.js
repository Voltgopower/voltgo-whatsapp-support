const express = require("express");
const router = express.Router();

const { dealerLogin } = require("../controllers/dealerAuthController");

router.post("/login", dealerLogin);

module.exports = router;