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

const socket = io("http://localhost:3000");

function Card({ title, value, unit }) {
  return (
    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "10px",
        width: "200px",
        textAlign: "center",
        color: "white"
      }}
    >
      <h3>{title}</h3>
      <h1>{value}</h1>
      <p>{unit}</p>
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // First load latest data
    fetch("http://localhost:3000/api/latest")
      .then((res) => res.json())
      .then((result) => {
        if (!result.message) {
          setData(result);
        }
      });

    // First load history
    fetch("http://localhost:3000/api/history")
      .then((res) => res.json())
      .then((result) => {
        const formatted = result.map((item, index) => ({
          time: item.timestamp ? item.timestamp.slice(11, 16) : `P${index + 1}`,
          power: item.power
        }));
        setHistory(formatted);
      });

    // Listen for live updates
    socket.on("data:update", (newData) => {
      setData(newData);

      const newPoint = {
        time: newData.timestamp ? newData.timestamp.slice(11, 16) : "Now",
        power: newData.power
      };

      setHistory((prev) => {
        const updated = [...prev, newPoint];
        if (updated.length > 20) {
          updated.shift();
        }
        return updated;
      });
    });

    return () => {
      socket.off("data:update");
    };
  }, []);

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "Arial",
        background: "#0f172a",
        minHeight: "100vh",
        color: "white"
      }}
    >
      <h1>Energy Monitoring Dashboard</h1>

      {data ? (
        <>
          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: "30px",
              flexWrap: "wrap"
            }}
          >
            <Card title="Voltage RMS" value={data.vrms} unit="V" />
            <Card title="Current RMS" value={data.irms} unit="A" />
            <Card title="Power" value={data.power} unit="W" />
            <Card title="Energy" value={data.energy} unit="kWh" />
          </div>

          <div
            style={{
              background: "#1e293b",
              marginTop: "30px",
              padding: "20px",
              borderRadius: "10px"
            }}
          >
            <h2>Power Trend</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="white" />
                  <YAxis stroke="white" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="power"
                    stroke="#f59e0b"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <p>Loading data...</p>
      )}
    </div>
  );
}

export default App;