const express = require('express');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

app.use('/webhook', webhookRoutes);

module.exports = app;