const { io } = require("socket.io-client");

// Connect directly to your Render Engine
const socket = io("https://energy-dashboard-1-anav.onrender.com");

console.log("🚀 Simulator starting... Connecting to Render...");

socket.on("connect", () => {
    console.log("✅ Connected to Render! Sending real-time packets...");
    
    let cumulativeEnergy = 12.4;

    setInterval(() => {
        const vrms = 220 + (Math.random() * 5);
        const irms = 5 + (Math.random() * 2);
        const power_factor = 0.95 + (Math.random() * 0.04);
        const power = vrms * irms * power_factor;
        cumulativeEnergy += (power / 3600000);

        const mockData = {
            vrms: parseFloat(vrms.toFixed(2)),
            irms: parseFloat(irms.toFixed(2)),
            power: parseFloat(power.toFixed(2)),
            energy: parseFloat(cumulativeEnergy.toFixed(4)),
            power_factor: parseFloat(power_factor.toFixed(2)),
            frequency: 50.01,
            thd: 1.2,
            anomalies: {
                powerSpike: power > 1500,
                voltageTrip: vrms > 224.5
            }
        };

        // Emit the data just like the backend expects
        socket.emit("data:send", mockData); 
        console.log(`📡 Packet Sent: ${power.toFixed(1)}W | ${vrms.toFixed(1)}V`);
    }, 2000);
});

socket.on("connect_error", (err) => {
    console.log("❌ Connection failed: " + err.message);
});