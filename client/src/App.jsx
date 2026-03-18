import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const socket = io("https://energy-dashboard-1-anav.onrender.com/");
const GAUGE_CONFIG = {
  voltage: { min: 200, max: 260, unit: "V", label: "Voltage RMS" },
  current: { min: 0, max: 10, unit: "A", label: "Current RMS" },
  power: { min: 0, max: 2000, unit: "W", label: "Power" },
  energy: { min: 0, max: 500, unit: "kWh", label: "Energy" }
};

function Card({ title, value, unit, status, action }) {
  let borderColor = "#22c55e";

  if (status === "warning") borderColor = "#f59e0b";
  if (status === "critical") borderColor = "#ef4444";

  const formattedValue =
    typeof value === "number" ? value.toFixed(2) : value;

  return (
    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "12px",
        color: "white",
        boxSizing: "border-box",
        border: `3px solid ${borderColor}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px"
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "18px",
            color: "#94a3b8",
            letterSpacing: "0.5px"
          }}
        >
          {title}
        </p>

        {action && <div>{action}</div>}
      </div>

      <div
        style={{
          marginTop: "14px",
          display: "flex",
          alignItems: "baseline",
          gap: "8px"
        }}
      >
        <span
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            lineHeight: 1
          }}
        >
          {formattedValue}
        </span>

        <span
          style={{
            fontSize: "18px",
            color: "#cbd5e1"
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}
function GaugeCard({ title, value, unit, min, max, status }) {
  let accentColor = "#22c55e";

  if (status === "warning") accentColor = "#f59e0b";
  if (status === "critical") accentColor = "#ef4444";

  const formattedValue =
    typeof value === "number" ? value.toFixed(2) : value;

  const centerX = 140;
  const centerY = 150;
  const radius = 95;

  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad)
    };
  };

  const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M", start.x, start.y,
      "A", r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  const isOutOfRange = value < min || value > max;

  let needleAngle;
  let needleColor = accentColor;
  let needleOpacity = 1;

  if (isOutOfRange) {
    needleAngle = 90;
    needleColor = "#ef4444";
    needleOpacity = 0.65;
  } else {
    const ratio = (value - min) / (max - min);
    needleAngle = 180 + ratio * 180;
  }

  const needleTip = polarToCartesian(centerX, centerY, radius - 12, needleAngle);

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: "14px",
        padding: "18px",
        color: "white",
        border: `3px solid ${accentColor}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
      }}
    >
      <div
        style={{
          marginBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "18px",
            color: "#94a3b8",
            letterSpacing: "0.5px"
          }}
        >
          {title}
        </p>

        <span
          style={{
            fontSize: "16px",
            color: isOutOfRange ? "#fca5a5" : "#94a3b8",
            fontWeight: 600
          }}
        >
          {min}–{max} {unit}
        </span>
      </div>

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <svg width="280" height="170" viewBox="0 0 280 170">
          <path
            d={describeArc(centerX, centerY, radius, 180, 360)}
            fill="none"
            stroke="#334155"
            strokeWidth="16"
            strokeLinecap="round"
          />

          <path
            d={describeArc(centerX, centerY, radius, 180, 240)}
            fill="none"
            stroke="#22c55e"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d={describeArc(centerX, centerY, radius, 240, 315)}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d={describeArc(centerX, centerY, radius, 315, 360)}
            fill="none"
            stroke="#ef4444"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.9"
          />

          {[0, 0.25, 0.5, 0.75, 1].map((t, index) => {
            const angle = 180 + t * 180;
            const p1 = polarToCartesian(centerX, centerY, radius - 4, angle);
            const p2 = polarToCartesian(centerX, centerY, radius - 18, angle);

            return (
              <line
                key={index}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#cbd5e1"
                strokeWidth="2"
                opacity="0.8"
              />
            );
          })}

          <line
            x1={centerX}
            y1={centerY}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={needleColor}
            strokeWidth="4"
            strokeLinecap="round"
            opacity={needleOpacity}
          />

          <circle
            cx={centerX}
            cy={centerY}
            r="7"
            fill={needleColor}
            opacity={needleOpacity}
          />

          <text
            x="9"
            y="150"
            fill="#1bbda2"
            fontSize="16"
            fontWeight="600"
          >
            {min}
          </text>

          <text
            x="245"
            y="150"
            fill="#ff0000"
            fontSize="14"
            fontWeight="600"
          >
            {max}
          </text>
        </svg>
      </div>

      <div
        style={{
          marginTop: "-8px",
          textAlign: "center"
        }}
      >
        <div
          style={{
            fontSize: "34px",
            fontWeight: "bold",
            lineHeight: 1
          }}
        >
          {formattedValue}
          <span
            style={{
              marginLeft: "8px",
              fontSize: "18px",
              color: "#cbd5e1",
              fontWeight: "normal"
            }}
          >
            {unit}
          </span>
        </div>

        {isOutOfRange && (
          <div
            style={{
              marginTop: "8px",
              color: "#fca5a5",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            OUT OF RANGE
          </div>
        )}
      </div>
    </div>
  );
}
function SystemStatus({ anomalies }) {
  if (!anomalies) return null;

  const active = [];

  if (anomalies.voltage) active.push("Voltage anomaly detected");
  if (anomalies.current) active.push("Current anomaly detected");
  if (anomalies.powerSpike) active.push("Power spike detected");
  if (anomalies.powerInstability) active.push("Power instability detected");
  if (anomalies.sensorFault) active.push("Sensor fault detected");
  if (anomalies.energyAnomaly) active.push("Energy anomaly detected");

  let systemState = "NORMAL";
  let stateColor = "#22c55e";

  if (active.length > 0) {
    systemState = "WARNING";
    stateColor = "#f59e0b";
  }

  if (anomalies.sensorFault) {
    systemState = "CRITICAL";
    stateColor = "#ef4444";
  }

  return (
    <div
      style={{
        background: "#1e293b",
        marginTop: 0,
        padding: "20px",
        borderRadius: "10px",
        color: "white"
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "15px" }}>
        SYSTEM STATUS: <span style={{ color: stateColor }}>{systemState}</span>
      </h2>

      {active.length === 0 ? (
        <p style={{ color: "#22c55e", margin: 0 }}>• No active anomalies</p>
      ) : (
        active.map((message, index) => (
          <p key={index} style={{ margin: "8px 0", color: stateColor }}>
            • {message}
          </p>
        ))
      )}
    </div>
  );
}

function AnomalyPanel({ anomalies }) {
  if (!anomalies) return null;

  const anomalyItems = [
    { label: "Voltage Anomaly", active: anomalies.voltage },
    { label: "Current Anomaly", active: anomalies.current },
    { label: "Power Spike", active: anomalies.powerSpike },
    { label: "Power Instability", active: anomalies.powerInstability },
    { label: "Sensor Fault", active: anomalies.sensorFault },
    { label: "Energy Anomaly", active: anomalies.energyAnomaly }
  ];

  return (
    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "10px",
        color: "white"
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "16px" }}>Anomaly Indicators</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "12px"
        }}
      >
        {anomalyItems.map((item, index) => {
          const isActive = item.active;
          const badgeBg = isActive ? "#7f1d1d" : "#14532d";
          const badgeColor = isActive ? "#fecaca" : "#bbf7d0";
          const dotColor = isActive ? "#ef4444" : "#22c55e";

          return (
            <div
              key={index}
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "999px",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: 0
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: dotColor,
                    flexShrink: 0
                  }}
                />

                <span
                  style={{
                    color: "#e2e8f0",
                    fontSize: "16px",
                    fontWeight: "500"
                  }}
                >
                  {item.label}
                </span>
              </div>

              <span
                style={{
                  background: badgeBg,
                  color: badgeColor,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "14px",
                  fontWeight: "600",
                  whiteSpace: "nowrap"
                }}
              >
                {isActive ? "ACTIVE" : "NORMAL"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildEvents(history) {
  const events = [];

  [...history].reverse().forEach((item) => {
    const time = item.timestamp ? item.timestamp.slice(11, 16) : "Now";
    const anomalies = item.anomalies || {};

    if (anomalies.sensorFault) {
      events.push({ time, message: "Sensor fault detected" });
    }
    if (anomalies.voltage) {
      events.push({ time, message: "Voltage anomaly detected" });
    }
    if (anomalies.current) {
      events.push({ time, message: "Current anomaly detected" });
    }
    if (anomalies.powerSpike) {
      events.push({ time, message: "Power spike detected" });
    }
    if (anomalies.powerInstability) {
      events.push({ time, message: "Power instability detected" });
    }
    if (anomalies.energyAnomaly) {
      events.push({ time, message: "Energy anomaly detected" });
    }
  });

  return events.slice(0, 10);
}

function computeCumulativeDeltaP(history) {
  if (history.length < 2) return 0;

  let totalVariation = 0;

  for (let i = 1; i < history.length; i++) {
    const current = history[i]?.power ?? 0;
    const previous = history[i - 1]?.power ?? 0;
    totalVariation += Math.abs(current - previous);
  }

  return totalVariation;
}

function computeSigmaP(history) {
  if (history.length === 0) return 0;

  const values = history.map((item) => item.power ?? 0);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  return Math.sqrt(variance);
}

function computeAveragePower(history) {
  if (history.length === 0) return 0;

  const values = history.map((item) => item.power ?? 0);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("No data yet");
  const [selectedChart, setSelectedChart] = useState("power");

  function handleResetHistory() {
    setHistory(data ? [data] : []);
  }

  useEffect(() => {
    fetch("https://energy-dashboard-1-anav.onrender.com/api/latest")
      .then((res) => res.json())
      .then((result) => {
        if (!result.message) {
          setData(result);
          setLastUpdate(result.timestamp ? result.timestamp.slice(11, 16) : "Now");
        }
      });

    fetch("https://energy-dashboard-1-anav.onrender.com/api/history")
      .then((res) => res.json())
      .then((result) => {
        setHistory(result);
      });

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("data:update", (newData) => {
      setData(newData);
      setLastUpdate(newData.timestamp ? newData.timestamp.slice(11, 16) : "Now");

      setHistory((prev) => {
        const updated = [...prev, newData];
        if (updated.length > 20) updated.shift();
        return updated;
      });
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("data:update");
    };
  }, []);

  const chartData = history.map((item, index) => ({
    time: item.timestamp ? item.timestamp.slice(11, 16) : `P${index + 1}`,
    power: item.power,
    voltage: item.vrms,
    current: item.irms
  }));

  const events = buildEvents(history);
  const cumulativeDeltaP = computeCumulativeDeltaP(history);
  const sigmaP = computeSigmaP(history);
  const averagePower = computeAveragePower(history);

  const sigmaWarningThreshold = 0.05 * averagePower;
  const sigmaCriticalThreshold = 0.1 * averagePower;

  let sigmaStatus = "normal";

  if (sigmaP > sigmaCriticalThreshold) {
    sigmaStatus = "critical";
  } else if (sigmaP > sigmaWarningThreshold) {
    sigmaStatus = "warning";
  }

  let chartColor = "#f59e0b";
  if (selectedChart === "voltage") chartColor = "#3b82f6";
  if (selectedChart === "current") chartColor = "#ef4444";

  let chartUnit = "W";
  if (selectedChart === "voltage") chartUnit = "V";
  if (selectedChart === "current") chartUnit = "A";

  let chartTitle = "Power Trend";
  let currentChartValue = data?.power ?? 0;

  if (selectedChart === "voltage") {
    chartTitle = "Voltage Trend";
    currentChartValue = data?.vrms ?? 0;
  }

  if (selectedChart === "current") {
    chartTitle = "Current Trend";
    currentChartValue = data?.irms ?? 0;
  }

  const formattedChartValue =
    typeof currentChartValue === "number"
      ? currentChartValue.toFixed(2)
      : currentChartValue;

  return (
    <div
      style={{
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        background: "#0f172a",
        minHeight: "100vh",
        color: "white",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1800px",
          margin: "0 auto"
        }}
      >
        <div
          style={{
            background: "#1e293b",
            padding: "20px 24px",
            borderRadius: "12px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Energy Monitoring Dashboard</h1>
            <p style={{ margin: "8px 0 0 0", color: "#94a3b8" }}>
              Real-time monitoring of electrical parameters
            </p>
          </div>

          <div
            style={{
              padding: "18px 18px",
              borderRadius: "999px",
              background: "#0f172a",
              fontWeight: "bold",
              minWidth: "220px"
            }}
          >
            <div
              style={{
                color: data
                  ? isConnected
                    ? "#22c55e"
                    : "#ef4444"
                  : "#f59e0b"
              }}
            >
              ● {data ? (isConnected ? "ONLINE" : "DISCONNECTED") : "WAITING FOR DATA"}
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "18px",
                color: "#94a3b8",
                fontWeight: "normal"
              }}
            >
              Last update: {lastUpdate}
            </div>
          </div>
        </div>

        {data ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
                marginBottom: "20px"
              }}
            >
              <GaugeCard
                title={GAUGE_CONFIG.voltage.label}
                value={data.vrms}
                unit={GAUGE_CONFIG.voltage.unit}
                min={GAUGE_CONFIG.voltage.min}
                max={GAUGE_CONFIG.voltage.max}
                status={data.anomalies?.voltage ? "warning" : "normal"}
              />

              <GaugeCard
                title={GAUGE_CONFIG.current.label}
                value={data.irms}
                unit={GAUGE_CONFIG.current.unit}
                min={GAUGE_CONFIG.current.min}
                max={GAUGE_CONFIG.current.max}
                status={data.anomalies?.current ? "critical" : "normal"}
              />

              <GaugeCard
                title={GAUGE_CONFIG.power.label}
                value={data.power}
                unit={GAUGE_CONFIG.power.unit}
                min={GAUGE_CONFIG.power.min}
                max={GAUGE_CONFIG.power.max}
                status={data.anomalies?.powerSpike ? "warning" : "normal"}
              />

              <GaugeCard
                title={GAUGE_CONFIG.energy.label}
                value={data.energy}
                unit={GAUGE_CONFIG.energy.unit}
                min={GAUGE_CONFIG.energy.min}
                max={GAUGE_CONFIG.energy.max}
                status={data.anomalies?.energyAnomaly ? "warning" : "normal"}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
                marginBottom: "24px"
              }}
            >
              <Card
                title="Cumulative Power Variation"
                value={cumulativeDeltaP}
                unit="W"
                status={cumulativeDeltaP > 800 ? "warning" : "normal"}
                action={
                  <button
                    onClick={handleResetHistory}
                    style={{
                      background: "#7f1d1d",
                      color: "#fecaca",
                      border: "1px solid #b91c1c",
                      borderRadius: "8px",
                      padding: "4px 10px",
                      fontSize: "18px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "0.2s ease"
                    }}
                  >
                    Reset
                  </button>
                }
              />

              <Card
                title="Power Stability (σP)"
                value={sigmaP}
                unit="W"
                status={sigmaStatus}
              />
            </div>

            <div
              style={{
                background: "#1e293b",
                padding: "20px",
                borderRadius: "12px",
                marginBottom: "24px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                  flexWrap: "wrap",
                  gap: "10px"
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>{chartTitle}</h2>
                  <p style={{ margin: "6px 0 0 0", color: "#94a3b8", fontSize: "18px" }}>
                    Current Value: {formattedChartValue} {chartUnit}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => setSelectedChart("power")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      background: selectedChart === "power" ? "#f59e0b" : "#334155",
                      color: "white"
                    }}
                  >
                    Power
                  </button>

                  <button
                    onClick={() => setSelectedChart("voltage")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      background: selectedChart === "voltage" ? "#f59e0b" : "#334155",
                      color: "white"
                    }}
                  >
                    Voltage
                  </button>

                  <button
                    onClick={() => setSelectedChart("current")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      background: selectedChart === "current" ? "#f59e0b" : "#334155",
                      color: "white"
                    }}
                  >
                    Current
                  </button>
                </div>
              </div>

              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" stroke="white" />
                    <YAxis
                      stroke="white"
                      tickFormatter={(value) => `${value} ${chartUnit}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                        color: "white"
                      }}
                      labelFormatter={(label) => `Time: ${label}`}
                      formatter={(value) => {
                        const name =
                          selectedChart === "power"
                            ? "Power"
                            : selectedChart === "voltage"
                              ? "Voltage"
                              : "Current";

                        return [`${value} ${chartUnit}`, name];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={selectedChart}
                      stroke={chartColor}
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "24px"
              }}
            >
              <SystemStatus anomalies={data.anomalies} />
              <AnomalyPanel anomalies={data.anomalies} />

              <div
                style={{
                  background: "#1e293b",
                  marginTop: 0,
                  padding: "20px",
                  borderRadius: "10px",
                  color: "white"
                }}
              >
                <h2 style={{ marginTop: 0 }}>Event Log</h2>

                {events.length === 0 ? (
                  <p style={{ color: "#94a3b8" }}>No events recorded</p>
                ) : (
                  events.map((event, index) => (
                    <p key={index} style={{ margin: "8px 0", color: "#f59e0b", fontSize: "18px" }}>
                      {event.time} - {event.message}
                    </p>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <p>Loading data...</p>
        )}
      </div>
    </div>
  );
}

export default App;