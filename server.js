const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

// Temporary in-memory storage
let latestData = null;
let history = [];

// Home route
app.get("/", (req, res) => {
  res.send("Energy Dashboard Backend Running v2");
});

// Get latest received data
app.get("/api/latest", (req, res) => {
  res.json(latestData || { message: "No data received yet" });
});

// Get recent history
app.get("/api/history", (req, res) => {
  res.json(history);
});

// Receive new data
app.post("/api/data", (req, res) => {
  const data = req.body;

  latestData = data;
  history.push(data);

  // Keep only last 50 points for now
  if (history.length > 50) {
    history.shift();
  }

  // Send live update to connected frontend later
  io.emit("data:update", data);

  console.log("Received data:", data);

  res.json({
    success: true,
    message: "Data received successfully"
  });
});

// Socket connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});