const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://localhost:1883");

const TOPIC = "cce3/device01/telemetry";

client.on("connect", () => {
  console.log("Simulator connected to MQTT! Sending data...");
  
  let cumulativeEnergy = 12.4;

  setInterval(() => {
    const vrms = 220 + (Math.random() * 5);  // 220-225V
    const irms = 5 + (Math.random() * 2);    // 5-7A
    const power_factor = 0.95 + (Math.random() * 0.04); // 0.95-0.99

    // 2. Real Calculation: P = V * I * PF
    const calculatedPower = vrms * irms * power_factor;
    
    // 3. Increment energy slightly each second
    cumulativeEnergy += (calculatedPower / 3600000); 

    const mockData = {
      vrms: parseFloat(vrms.toFixed(2)),
      irms: parseFloat(irms.toFixed(2)),
      power: parseFloat(calculatedPower.toFixed(2)),
      energy: parseFloat(cumulativeEnergy.toFixed(4)),
      
      // Engineering values for Level 2
      power_factor: parseFloat(power_factor.toFixed(2)),
      frequency: parseFloat((49.98 + Math.random() * 0.05).toFixed(2)),
      thd: parseFloat((1.1 + Math.random() * 0.3).toFixed(1)),
      
      anomalies: {
        powerSpike: calculatedPower > 1500, // Trigger if power is high
        voltageTrip: vrms > 224.5
      }
    };

    // Send the JSON string to the dashboard
    client.publish(TOPIC, JSON.stringify(mockData));
    
    // Simple console log for debugging
    console.log(`[Sent] P: ${mockData.power}W | V: ${mockData.vrms}V | PF: ${mockData.power_factor}`);
    
  }, 1000); // 1Hz Refresh Rate
});