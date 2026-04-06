import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const socket = io("https://energy-dashboard-1-anav.onrender.com");

function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [activeMetric, setActiveMetric] = useState("power");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    socket.on("data:update", (newData) => {
      // Data normalization for local state
      const timestamp = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
      const dataWithTime = { ...newData, time: timestamp };

      setData(dataWithTime);
      setHistory((prev) => {
        const updated = [...prev, dataWithTime];
        return updated.length > 25 ? updated.slice(1) : updated;
      });

      // Unified Anomaly/Event Logger
      if (newData.system_status !== "Normal" ) {
        setAnomalies(prev => {
          
            if (prev.length > 0 && prev[0].type === newData.fault_type && prev[0].time === timestamp) {
            return prev;
          }
          return[ 
            {
              time: timestamp,
              type: newData.fault_type,
              value: newData.power,
              status: newData.system_status
            },
            ...prev.slice(0, 5)
          ];
        });
      }
    });
    return () => socket.off("data:update");
  }, []);

  if (!data) return (
    <div style={{ background: "#020617", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "24px" }}>
      Establishing High-Speed Link...
    </div>
  );

  // Status and Color Mapping
  const status = data.system_status || "Normal";
  const statusColors = {
    Normal: "#22c55e",
    Unknown: "#f59e0b",
    Anomaly: "#ef4444"
  };

  return (
    <div style={{ 
      background: "#020617", 
      minHeight: "100vh", 
      color: "#f8fafc", 
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      padding: "40px", 
      fontSize: "18px" 
    }}>
      
      {/* --- HEADER (Updated with 3-State Logic) --- */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "42px", fontWeight: "800", letterSpacing: "-1px" }}>
            Energy Command <span style={{color: "#3b82f6"}}>PRO</span>
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "20px", marginTop: "8px" }}>
            Unit Status: <span style={{color: statusColors[status]}}>{status.toUpperCase()}</span>
          </p>
        </div>
        
        <div style={{
          background: statusColors[status],
          padding: "20px 40px",
          borderRadius: "16px",
          boxShadow: status === "Anomaly" ? "0 0 40px #ef4444" : "none",
          animation: status === "Anomaly" ? "pulse 1s infinite" : "none",
          transition: "all 0.5s ease"
        }}>
          <span style={{ fontWeight: "900", fontSize: "22px", color: "#fff" }}>
            {status === "Normal" ? "SYSTEM STABLE" : status === "Unknown" ? "PATTERN UNKNOWN" : "ALARM ACTIVE"}
          </span>
        </div>
      </header>

      {/* --- LEVEL 1: LARGE GAUGES --- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "30px", marginBottom: "40px" }}>
        <GaugeCard title="Voltage" value={data.vrms} unit="V" min={210} max={250} color="#3b82f6" peakMin={data.peaks?.v_min} peakMax={data.peaks?.v_max}/>
        <GaugeCard title="Current (Irms)" value={data.irms} unit="A" min={0} max={10} color="#10b981" peakMin={data.peaks?.i_min} peakMax={data.peaks?.i_max} />
        <GaugeCard title="Active Power" value={data.power} unit="W" min={0} max={3000} color="#f59e0b" peakMax={data.peaks?.p_max} />
        <GaugeCard title="Total Energy" value={data.energy} unit="Wh" min={0} max={30000} color="#8b5cf6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "30px", marginBottom: "40px" }}>
        {/* --- CHART SECTION --- */}
        <div style={{ background: "#0f172a", padding: "30px", borderRadius: "24px", border: "1px solid #1e293b" }}>
          <div style={{display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center"}}>
             <h2 style={{margin: 0, fontSize: "24px"}}>Telemetry History</h2>
             <div style={{ display: "flex", gap: "10px" }}>
                {['power', 'vrms', 'irms'].map(m => (
                  <button 
                    key={m} 
                    onClick={() => setActiveMetric(m)} 
                    style={{
                      background: activeMetric === m ? "#3b82f6" : "#1e293b", 
                      border: "none", color: "white", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold"
                    }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
             </div>
          </div>
          <div style={{ height: "350px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={14} tickMargin={15} />
                <YAxis stroke="#94a3b8" fontSize={14} tickMargin={10} />
                <Tooltip contentStyle={{background: "#0f172a", border: "1px solid #334155", borderRadius: "12px"}} />
                <Area type="monotone" dataKey={activeMetric} stroke="#3b82f6" fill="url(#colorMain)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- EVENT MEMORY --- */}
        <div style={{ background: "#0f172a", padding: "30px", borderRadius: "24px", border: "1px solid #1e293b" }}>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "24px", color: "#ef4444" }}>Event Memory</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {anomalies.length === 0 ? (
              <p style={{color: "#475569"}}>No events detected in current session.</p>
            ) : (
              anomalies.map((ann, i) => (
                <div key={i} style={{ 
                  padding: "15px", 
                  background: "#1e293b", 
                  borderRadius: "12px", 
                  borderLeft: `5px solid ${statusColors[ann.status] || "#ef4444"}` 
                }}>
                  <div style={{fontSize: "14px", color: "#94a3b8"}}>{ann.time}</div>
                  <div style={{fontWeight: "bold", fontSize: "18px"}}>{ann.type}</div>
                  <div style={{fontSize: "16px"}}>Value Recorded: {ann.value}W</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- LEVEL 2: ENGINEERING DETAILS --- */}
      <div style={{ background: "#1e293b", borderRadius: "20px", overflow: "hidden" }}>
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ width: "100%", padding: "25px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", textAlign: "left", fontSize: "18px", fontWeight: "bold" }}>
           {showAdvanced ? "▼ HIDE ENGINEERING DIAGNOSTICS" : "▶ SHOW ENGINEERING DIAGNOSTICS (LEVEL 2)"}
        </button>
        {showAdvanced && (
          <div style={{ padding: "40px", background: "#020617", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "25px", borderTop: "2px solid #334155" }}>
             <TechStat label="Power Factor (PF)" value={data.power_factor} unit="" />
             <TechStat label="Apparent Power (S)" value={data.features?.s_apparent} unit="VA" />
             <TechStat label="Reactive Power (Q)" value={data.features?.q_reactive} unit="VAR" />
             <TechStat label="System Frequency" value={data.frequency} unit="Hz" />

             <TechStat label="ΔP (Variation)" value={data.features?.deltaP} unit="W" />
             <TechStat label="σP (Std Dev)" value={data.features?.sigmaP} unit="W" />
             <TechStat label="AI Distance" value={data.features?.ai_distance} unit="dist" />
             <TechStat label="THD" value={data.thd} unit="%" />
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 50% { opacity: 0.7; transform: scale(1.02); } }
      `}</style>
    </div>
  );
}

function TechStat({ label, value, unit }) {
  return (
    <div>
      <p style={{ color: "#64748b", margin: 0, fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: "28px", fontWeight: "bold", margin: "5px 0 0 0" }}>
        {value !== undefined && value !== null ? (typeof value === 'number' ? value.toFixed(2) : value) : "0.00"}
        <span style={{ fontSize: "14px", color: "#475569", marginLeft: "4px" }}>{unit}</span>
      </p>
    </div>
  );
}

function GaugeCard({ title, value, unit, min, max, color, peakMin, peakMax }) {
  const safeValue = value ?? 0;
  const percent = Math.min(Math.max((safeValue - min) / (max - min), 0), 1);
  const angle = 180 + (percent * 180);

  return (
    <div style={{ background: "#0f172a", padding: "30px", borderRadius: "30px", border: "1px solid #1e293b", textAlign: "center" }}>
      <p style={{ margin: "0 0 20px 0", color: "#94a3b8", fontSize: "16px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>{title}</p>
      {/* Min/Max Labels */}
      {(peakMin !== undefined || peakMax !== undefined) && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
          <span>MIN: {peakMin?.toFixed(1) || "0"}</span>
          <span>MAX: {peakMax?.toFixed(1) || "0"}</span>
        </div>
      )} 

      <svg width="240" height="150" viewBox="0 0 200 120">
        <path d="M 25 100 A 75 75 0 0 1 175 100" fill="none" stroke="#1e293b" strokeWidth="18" strokeLinecap="round" />
        <path d="M 25 100 A 75 75 0 0 1 175 100" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray="235" strokeDashoffset={235 - (235 * percent)} style={{transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)"}} />
        <line x1="100" y1="100" x2={100 + 65 * Math.cos(angle * Math.PI / 180)} y2={100 + 65 * Math.sin(angle * Math.PI / 180)} stroke="white" strokeWidth="5" strokeLinecap="round" style={{transition: "all 0.6s ease"}} />
        <circle cx="100" cy="100" r="8" fill="white" />
      </svg>
      <div style={{ marginTop: "-35px" }}>
        <span style={{ fontSize: "48px", fontWeight: "900" }}>{safeValue.toFixed(1)}</span>
        <span style={{ fontSize: "18px", color: "#64748b", marginLeft: "8px" }}>{unit}</span>
      </div>
    </div>
  );
}

export default App;