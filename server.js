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

// ===== 路由文件 =====
const webhookRoutes = require("./routes/webhook.routes");
const customerRoutes = require("./routes/customer.routes");
const conversationRoutes = require("./routes/conversation.routes");
const messageRoutes = require("./routes/message.routes");
const mediaRoutes = require('./routes/media.routes');

// ===== 数据库 =====
const db = require("./config/db");

const app = express();
const server = http.createServer(app);

// ===== 环境变量 =====
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ===== CORS 白名单 =====
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  FRONTEND_URL,
].filter(Boolean);

// ===== Express CORS =====
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
  })
);

// ===== body parser =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== 请求日志 =====
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ===== Socket.IO 初始化 =====
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

// ===== 健康检查 =====
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    return res.status(200).json({
      ok: true,
      service: "voltgo-whatsapp-crm-api",
      db: "connected",
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check DB error:", error.message);

    return res.status(500).json({
      ok: false,
      service: "voltgo-whatsapp-crm-api",
      db: "disconnected",
      error: error.message,
      time: new Date().toISOString(),
    });
  }
});

// ===== 根路由 =====
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Voltgo WhatsApp CRM API is running",
  });
});

// ===== Webhook 路由 =====
app.use("/webhook", webhookRoutes);

// ===== API 路由 =====
app.use("/api/auth", authRoutes);
console.log("AUTH ROUTE LOADED");
app.use("/api/customers", authMiddleware, customerRoutes);
app.use("/api/conversations", authMiddleware, conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use('/api/media', mediaRoutes);

// ===== Debug 路由 =====
app.use("/debug", debugRoutes);

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ===== 全局错误处理中间件 =====
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ===== 启动服务 =====
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