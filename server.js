const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mqtt = require("mqtt");

const app = express();
const server = http.createServer(app);
const MQTT_TOPIC = "cce3/device01/telemetry";

// 1. SOCKET.IO SETUP
const io = new Server(server, {
  cors: {
    origin: "*", // Set to your specific Vercel URL in production
    methods: ["GET", "POST"]
  }
});

// 2. MQTT CONNECTION
// Uses environment variable for security, defaults to public HiveMQ broker
const client = mqtt.connect(process.env.MQTT_BROKER_URL || "mqtt://broker.hivemq.com:1883", {
  connectTimeout: 5000,
  reconnectPeriod: 3000 // Faster reconnect for live demos
});

// 3. STATE MANAGEMENT
let latestData = null;
let history = [];
const MAX_HISTORY = 50;
let lastPower = 0; 

let minMaxStore = {
  vrms: { min: 0, max: 460 },
  irms: { min: 0, max: 10 },
  power: { min: 0, max: 2600 }
};

// 4. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 5. CORE LOGIC: NORMALIZE PACKET
// This takes the raw AI data and prepares it for the Dashboard
function normalizePacket(data) {
  const vrms = Number(data.vrms ?? 0);
  const irms = Number(data.irms ?? 0);
  const currentPower = Number(data.power ?? 0);
  const energyWh = Number(data.energy ?? 0); 

  // Update Peaks
  if (vrms > 0) {
    minMaxStore.vrms.min = Math.min(minMaxStore.vrms.min, vrms);
    minMaxStore.vrms.max = Math.max(minMaxStore.vrms.max, vrms);
    minMaxStore.irms.min = Math.min(minMaxStore.irms.min, irms);
    minMaxStore.irms.max = Math.max(minMaxStore.irms.max, irms);
    minMaxStore.power.max = Math.max(minMaxStore.power.max, currentPower);
  }

  // AI-Driven Status Logic
  let systemStatus = "Normal";
  let faultType = "";
  if (data.anomalies?.voltage) {
    systemStatus = "Anomaly";
    faultType = "VOLTAGE TRIP";
  } else if (data.anomalies?.powerSpike) {
    systemStatus = "Anomaly";
    faultType = "POWER SURGE";
  }

  return {
    timestamp: data.timestamp || new Date().toISOString(),
    vrms: vrms,
    irms: irms,
    power: currentPower,
    energy: Number(energyWh.toFixed(2)),
    system_status: systemStatus,
    fault_type: faultType,
    power_factor: Number(data.power_factor ?? 0),
    frequency: Number(data.frequency ?? 0),
    thd: Number(data.thd ?? 0),
    peaks: {
      v_min: minMaxStore.vrms.min,
      v_max: minMaxStore.vrms.max,
      i_min: minMaxStore.irms.min,
      i_max: minMaxStore.irms.max,
      p_max: minMaxStore.power.max
    },
    features: {
      deltaP: Number(data.features?.deltaP ?? 0),
      sigmaP: Number(data.features?.sigmaP ?? 0),
      s_apparent: Number(data.features?.S_apparent ?? 0),
      q_reactive: Number(data.features?.q_reactive ?? 0),
      ai_distance: Number(data.features?.ai_distance ?? 0)

    },
    anomalies: {
      voltage: !!data.anomalies?.voltage,
      current: !!data.anomalies?.current,
      powerSpike: !!data.anomalies?.powerSpike,
      powerInstability: !!data.anomalies?.powerInstability,
      sensorFault: !!data.anomalies?.sensorFault,
      energyAnomaly: !!data.anomalies?.energyAnomaly,
      ai_state: data.anomalies?.ai_state || "unknown",
    }
  };
}

// 6. SHARED PACKET HANDLER
function processIncomingPacket(rawData, source = "unknown") {
  const packet = normalizePacket(rawData);
  latestData = packet;
  history.push(packet);

  if (history.length > MAX_HISTORY) history.shift();

  // The "Shout" to the frontend
  io.emit("data:update", packet);

  // LOGGING (Requested by teammate)
  console.log(`[${source}] Received data:`, packet);
  
  return packet;
}

// 7. MQTT EVENTS
client.on("connect", () => {
  console.log("Connected to MQTT broker successfully");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error("Failed to subscribe:", MQTT_TOPIC, err.message);
    } else {
      console.log(`Subscribed to: ${MQTT_TOPIC}`);
    }
  });
});

client.on("message", (topic, message) => {
  try {
    const rawData = JSON.parse(message.toString());
    
    // Map the nested Professional JSON from the Arduino-- take sample from hasan 
    const dataToProcess = {
      timestamp: rawData.timestamp_utc,
      vrms: rawData.electrical_metrics?.vrms_volts || 0,
      irms: rawData.electrical_metrics?.irms_amps || 0,
      power: rawData.electrical_metrics?.active_power_watts || 0,
      energy: rawData.electrical_metrics?.energy_kwh || 0,
      power_factor: rawData.electrical_metrics?.power_factor || 0,
      features: {
        sigmaP: rawData.features?.std_current || 0, 
        S_apparent: rawData.electrical_metrics?.apparent_power_va || 0,
        q_reactive: rawData.electrical_metrics?.reactive_power_var || 0,
        ai_distance: rawData.anomaly?.distance || 0,
        crest_factor: rawData.features?.crest_factor_current || 0,
        deltaP: rawData.features?.delta_p_watts || 0
      },
      anomalies: {
        voltage: rawData.anomaly?.severity === "high", 
        powerSpike: rawData.anomaly?.flag || false,
        ai_state: rawData.anomaly?.state || "unknown",
      }
    };
    console.log("------------------------------------");
    console.log("Raw anomaly.distance from Arduino:", rawData.anomaly?.distance);
    console.log("Mapped ai_distance for Dashboard:", dataToProcess.features.ai_distance);
    console.log("------------------------------------");
    processIncomingPacket(dataToProcess, "MQTT");
  } catch (error) {
    console.error("Invalid MQTT message received:", error.message, "Raw data length:", message.length);
  }
});

// 8. API ENDPOINTS
app.get("/", (req, res) => res.send("Energy Dashboard Backend Running"));
app.get("/api/latest", (req, res) => res.json(latestData || { message: "No data" }));
app.get("/api/history", (req, res) => res.json(history));

app.post("/api/data", (req, res) => {
  const packet = processIncomingPacket(req.body, "HTTP");
  res.json({ success: true, packet });
});

// 9. SOCKET.IO EVENTS
io.on("connection", (socket) => {
  console.log("A client connected to the Engine");

  socket.on("data:send", (incomingData) => {
    const processedData = processIncomingPacket(incomingData, "Simulator");
    console.log(`Forwarding data: ${processedData.power}W to Dashboard`);
  });
});

// 10. SERVER START
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});