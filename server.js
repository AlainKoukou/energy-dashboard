const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mqtt = require("mqtt");
const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "https://energy-dashboard-lt18hfcot-alainkoukous-projects.vercel.app", // Allow your Vite frontend
    methods: ["GET", "POST"]
  }
});

// MQTT connection
// NEW Safe MQTT Connection

const client = mqtt.connect(process.env.MQTT_BROKER_URL || "mqtt://localhost:1883", {
  connectTimeout: 5000, // Stop trying after 5 seconds
  reconnectPeriod: 10000 // Only try again every 10 seconds
});

client.on("connect", () => {
  console.log("✅ Connected to MQTT Broker successfully");
});

client.on("error", (err) => {
  console.log("⚠️ MQTT not available yet, waiting for Hassan's IP...");
  // This prevents the "Connection Error" loop from crashing the server
});
app.use(cors());
app.use(express.json());

// In-memory storage
let latestData = null;
let history = [];
const MAX_HISTORY = 50;
let lastPower = 0;
let powerBuffer = [];

let minMaxStore = {
  vrms: { min: 200, max: 260 },
  irms: { min: 0, max: 10 },
  power: { min: 0, max: 2000 }
};

// Normalize incoming packet without changing anomaly decisions
function normalizePacket(data) {
  // 1. Core measurements
  const currentPower = Number(data.power ?? 0);
  const vrms = Number(data.vrms ?? 0);
  const irms = Number(data.irms ?? 0);
  const energyWh = Number(data.energy ?? 0) * 1000;
  if (vrms > 0) {
    minMaxStore.vrms.min = Math.min(minMaxStore.vrms.min, vrms);
    minMaxStore.vrms.max = Math.max(minMaxStore.vrms.max, vrms);
    minMaxStore.irms.min = Math.min(minMaxStore.irms.min, irms);
    minMaxStore.irms.max = Math.max(minMaxStore.irms.max, irms);
    minMaxStore.power.max = Math.max(minMaxStore.power.max, currentPower);
  }
  // 2. Delta P Calculation
  const deltaP = currentPower - lastPower;
  lastPower = currentPower;

  // 3. Sigma P Calculation (Standard Deviation)
  powerBuffer.push(currentPower);
  if (powerBuffer.length > 10) powerBuffer.shift();
  const avg = powerBuffer.reduce((a, b) => a + b, 0) / powerBuffer.length;
  const sigmaP = Math.sqrt(powerBuffer.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / powerBuffer.length);

  // 4. Advanced Electrical Math (S and Q)
  const s_apparent = vrms * irms;
  // Q = sqrt(S^2 - P^2)
  const q_reactive = Math.sqrt(Math.max(0, Math.pow(s_apparent, 2) - Math.pow(currentPower, 2)));

  // 5. Edge-AI Three-State Logic (Normal / Unknown / Anomaly)
  // We use a simulated AI Distance score (0.0 to 1.0)
  const aiDist = Number(data.ai_distance ?? (0.2 + Math.random() * 0.5)); 
  
  let systemStatus = "Normal";
  let faultType = "";
if (data.anomalies?.voltage) {
  systemStatus = "Anomaly";
  faultType = "VOLTAGE TRIP";
} else if (data.anomalies?.powerSpike) {
  systemStatus = "Anomaly";
  faultType = "POWER SURGE";
} else if (sigmaP > 150) { // Using the relaxed threshold we discussed
  systemStatus = "Anomaly";
  faultType = "UNSTABLE POWER LOAD";
} else if (aiDist > 0.8) {
  systemStatus = "Anomaly";
  faultType = "AI CRITICAL DISTANCE";
} else if (aiDist > 0.55) {
  systemStatus = "Unknown";
  faultType = "UNKNOWN PATTERN";
}
  return {
    system_status: systemStatus,
    fault_type: faultType,
    timestamp: data.timestamp || new Date().toISOString(),
    vrms: vrms,
    irms: irms,
    power: currentPower,
    energy: energyWh,
    peaks: {
      v_min: minMaxStore.vrms.min,
      v_max: minMaxStore.vrms.max,
      i_min: minMaxStore.irms.min,
      i_max: minMaxStore.irms.max,
      p_max: minMaxStore.power.max
    },
    power_factor: Number(data.power_factor ?? 0),
    frequency: Number(data.frequency ?? 0),
    thd: Number(data.thd ?? 0),
    system_status: systemStatus, // <--- New field for Dashboard UI

    features: {
      deltaP: parseFloat(deltaP.toFixed(2)),
      sigmaP: parseFloat(sigmaP.toFixed(2)),
      s_apparent: parseFloat(s_apparent.toFixed(2)),
      q_reactive: parseFloat(q_reactive.toFixed(2)),
      ai_distance: parseFloat(aiDist.toFixed(3)) 
    },

    anomalies: {
      voltage: !!data.anomalies?.voltage,
      current: !!data.anomalies?.current,
      powerSpike: !!data.anomalies?.powerSpike,
      powerInstability: sigmaP > 150,
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
client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error("Failed to subscribe to topic:", MQTT_TOPIC, err.message);
    } else {
      console.log(`Subscribed to: ${MQTT_TOPIC}`);
    }
  });
});

client.on("message", (topic, message) => {
  try {
    const rawData = JSON.parse(message.toString());
    const dataToProcess = rawData.electrical_metrics ? {
      timestamp: rawData.timestamp_utc,
      vrms: rawData.electrical_metrics.vrms_volts,
      irms: rawData.electrical_metrics.irms_amps,
      power: rawData.electrical_metrics.active_power_watts,
      energy: rawData.electrical_metrics.energy_wh,
      anomalies: rawData.anomalies // This comes from your AI agent
    } : rawData;
    
    processIncomingPacket(rawData, "MQTT");
  } catch (error) {
    console.error("Invalid MQTT message received:", error.message);  }
});

client.on("error", (error) => {
  console.error("MQTT connection error:", error.message);
});


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
  console.log("A client connected to the Engine");

  // LISTEN for data coming from simulator
  socket.on("data:send", (incomingData) => {
    // 1. Process/Normalize the data
    const processedData = normalizePacket(incomingData);
    
    // 2. BROADCAST the processed data to the Vercel Dashboard
    io.emit("data:update", processedData); 
    
    console.log(`Forwarding data: ${processedData.power}W to Dashboard`);
  });
});
// server.listen(3000, () => {
//   console.log("Server running on port 3000");
// });

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});