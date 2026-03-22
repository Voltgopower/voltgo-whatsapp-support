const express = require('express');
const cors = require('cors');

const webhookRoutes = require('./routes/webhook.routes');
const conversationRoutes = require('./routes/conversation.routes');
const customerRoutes = require('./routes/customer.routes');
const messageRoutes = require('./routes/message.routes');   // 新增

const app = express();

// Allow frontend http://localhost:5173 to access API
app.use(cors({ origin: "http://localhost:5173" }));

app.use(express.json());

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/messages', messageRoutes);   // 新增

app.get('/', (req, res) => {
  res.send('WhatsApp API running');
});

module.exports = app;