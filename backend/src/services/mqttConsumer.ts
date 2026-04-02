import mqtt from "mqtt";
import { SensorMessage } from "../types/sensor";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";

export function startMqttConsumer() {
    const client = mqtt.connect(MQTT_URL);

    client.on("connect", () => {
        console.log(`MQTT connected: ${MQTT_URL}`);
        client.subscribe("pyrosense/#", (err) => {
            if (err) console.log(`There is an error: ${err}`);
            else console.log("pyrosense/# listening...");
        });
    });

    client.on("message", (topic, payload) => {
        try {
            const message: SensorMessage = JSON.parse(payload.toString());
            console.log(
                `[${message.zone_id}] sıcaklık: ${message.readings.temperature}°C | ` +
                    `duman: ${message.readings.smoke_ppm} PPM | ` +
                    `senaryo: ${message.scenario}`,
            );
        } catch (err) {
            console.log("Parse error: ", err);
        }
    });

    client.on("error", (err) => {
        console.log("MQTT Error: ", err);
    });
}
