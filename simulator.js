const { io } = require("socket.io-client");

// Connect directly to your Render Engine
const socket = io("https://energy-dashboard-1-anav.onrender.com");

console.log("Simulator starting... Connecting to Render...");

socket.on("connect", () => {
    console.log("Connected to Render! Sending real-time packets...");
    
    let cumulativeEnergy = 12.4;

    setInterval(() => {
        // Random base values
        const vrms = 220 + (Math.random() * 5);
        const irms = 5 + (Math.random() * 2);
        const power_factor = 0.85 + (Math.random() * 0.1);
        
        // Basic Electrical Equations
        const active_power = vrms * irms * power_factor;
        const apparent_power = vrms * irms;
        const reactive_power = Math.sqrt(Math.pow(apparent_power, 2) - Math.pow(active_power, 2));
        
        cumulativeEnergy += (active_power / 3600000);

        // Occasional Anomalies logic
        const isAnomaly = Math.random() > 0.65; // 5% chance of anomaly
        const ai_distance = isAnomaly ? (5.0 + Math.random() * 2) : (0.1 + Math.random() * 0.5);

        const mockData = {
            vrms: parseFloat(vrms.toFixed(2)),
            irms: parseFloat(irms.toFixed(2)),
            power: parseFloat(active_power.toFixed(2)), // Active Power
            energy: parseFloat(cumulativeEnergy.toFixed(4)),
            power_factor: parseFloat(power_factor.toFixed(2)),
            
            // New requested variables
            apparent_power: parseFloat(apparent_power.toFixed(2)),
            reactive_power: parseFloat(reactive_power.toFixed(2)),
            sigmap: parseFloat((Math.random() * 0.5).toFixed(3)), // Standard deviation simulation
            delta_p: parseFloat((Math.random() * 10 - 5).toFixed(2)), // Change in power
            ai_distance: parseFloat(ai_distance.toFixed(3)),
            
            anomalies: {
                powerSpike: active_power > 1500 || isAnomaly,
                voltageTrip: vrms > 224.5
            }
        };

        // Emit the data in the original flat structure
        socket.emit("data:send", mockData); 
        
        console.log(`Packet Sent: ${active_power.toFixed(1)}W | Dist: ${ai_distance.toFixed(2)} | Anomaly: ${isAnomaly}`);
    }, 2000);
});

socket.on("connect_error", (err) => {
    console.log("Connection failed: " + err.message);
});