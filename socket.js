const { Server } = require("socket.io");

let io = null;

function initIO(server, options = {}) {
  io = new Server(server, options);
  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

module.exports = {
  initIO,
  getIO,
};