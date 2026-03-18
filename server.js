const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mqtt = require("mqtt");
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// MQTT connection
const client = mqtt.connect("mqtt://localhost:1883"); // replace with Hassan's broker IP later
const MQTT_TOPIC = "energy/data"; // replace with the real topic later

app.use(cors());
app.use(express.json());

// In-memory storage
let latestData = null;
let history = [];
const MAX_HISTORY = 50;

// Normalize incoming packet without changing anomaly decisions
function normalizePacket(data) {
  return {
    timestamp: data.timestamp || new Date().toISOString(),
    vrms: Number(data.vrms ?? 0),
    irms: Number(data.irms ?? 0),
    power: Number(data.power ?? 0),
    energy: Number(data.energy ?? 0),

    // Keep features if other modules send them
    features: {
      deltaP: data.features?.deltaP ?? null,
      sigmaP: data.features?.sigmaP ?? null,
      avgPower: data.features?.avgPower ?? null
    },

    // Keep anomaly flags exactly as received
    anomalies: {
      voltage: !!data.anomalies?.voltage,
      current: !!data.anomalies?.current,
      powerSpike: !!data.anomalies?.powerSpike,
      powerInstability: !!data.anomalies?.powerInstability,
      sensorFault: !!data.anomalies?.sensorFault,
      energyAnomaly: !!data.anomalies?.energyAnomaly
    }
  };
}

// Shared packet handler for both HTTP and MQTT
function processIncomingPacket(rawData, source = "unknown") {
  const packet = normalizePacket(rawData);

  latestData = packet;
  history.push(packet);

  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  io.emit("data:update", packet);

  console.log(`[${source}] Received data:`, packet);

  return packet;
}

// MQTT events
/*client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error("Failed to subscribe to topic:", MQTT_TOPIC, err.message);
    } else {
      console.log("Subscribed to MQTT topic:", MQTT_TOPIC);
    }
  });
});

client.on("message", (topic, message) => {
  try {
    const rawData = JSON.parse(message.toString());
    processIncomingPacket(rawData, "MQTT");
  } catch (error) {
    console.error("Invalid MQTT message received:", error.message);
    console.error("Raw message:", message.toString());
  }
});

client.on("error", (error) => {
  console.error("MQTT connection error:", error.message);
});
*/

// Home route
app.get("/", (req, res) => {
  res.send("Energy Dashboard Backend Running");
});

// Get latest data
app.get("/api/latest", (req, res) => {
  res.json(latestData || { message: "No data received yet" });
});

// Get recent history
app.get("/api/history", (req, res) => {
  res.json(history);
});

// Optional: clear history manually
app.post("/api/reset-history", (req, res) => {
  latestData = null;
  history = [];

  io.emit("history:reset");

  console.log("History reset");

  res.json({
    success: true,
    message: "History reset successfully"
  });
});

// Receive new data packet through HTTP
app.post("/api/data", (req, res) => {
  const packet = processIncomingPacket(req.body, "HTTP");

  res.json({
    success: true,
    message: "Data received successfully",
    packet
  });
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});