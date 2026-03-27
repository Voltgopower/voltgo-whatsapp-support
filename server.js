require("dotenv").config();

console.log("=== BUILD MARK A ===");
console.log("__filename =", __filename);
console.log("cwd =", process.cwd());

const express = require("express");
const http = require("http");
const cors = require("cors");
const { initIO } = require("./socket");
const debugRoutes = require("./routes/debug.routes");
const authRoutes = require("./routes/auth.routes");
const authMiddleware = require("./middleware/auth.middleware");

const webhookRoutes = require("./routes/webhook.routes");
const customerRoutes = require("./routes/customer.routes");
const conversationRoutes = require("./routes/conversation.routes");
const messageRoutes = require("./routes/message.routes");
const mediaRoutes = require("./routes/media.routes");
const healthRoutes = require("./routes/health.routes");
const noteRoutes = require("./routes/note.routes");
const templateRoutes = require("./routes/template.routes");

const db = require("./config/db");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

const io = initIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Voltgo WhatsApp CRM API is running",
  });
});

app.use("/webhook", webhookRoutes);

app.use("/api/auth", authRoutes);
console.log("AUTH ROUTE LOADED");

app.use("/api/health", healthRoutes);
app.use("/api/customers", authMiddleware, customerRoutes);
app.use("/api/customers", authMiddleware, noteRoutes);
app.use("/api/conversations", authMiddleware, conversationRoutes);
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/media", authMiddleware, mediaRoutes);
app.use("/api/templates", templateRoutes);

app.use("/debug", debugRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);

  try {
    await db.query("SELECT 1");
    console.log("PostgreSQL connected");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
  }
});
app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large (max 150MB)",
    });
  }

  console.error("Unhandled error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});