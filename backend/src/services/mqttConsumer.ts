import mqtt from "mqtt";
import { SensorMessage } from "../types/sensor";
import { saveSensorReading } from "./sensorRepository";
import { toRdfTurtle } from "./rdfConverter";
import { uploadTurtle } from "./fusekiClient";
import { MQTT_URL } from "../constants";
import { queryReading } from "./sparqlService";
import { calculateRisk } from "./riskCalculator";
import { evaluateAlarm } from "./alarmManager";

const PYRO = "http://pyrosense.io/ontology#";

export function startMqttConsumer() {
    const client = mqtt.connect(MQTT_URL);

    client.on("connect", () => {
        console.log(`MQTT connected: ${MQTT_URL}`);
        client.subscribe("pyrosense/#", (err) => {
            if (err) console.log(`Subscribe error: ${err}`);
            else console.log("pyrosense/# listening...");
        });
    });

    client.on("message", async (topic, payload) => {
        try {
            const message: SensorMessage = JSON.parse(payload.toString());

            // Postgresql e kayit edelim
            await saveSensorReading(message);

            // RDF e cevirelim ve fuseki ye yukleyelim.
            const turtle = toRdfTurtle(message);
            await uploadTurtle(turtle);

            // 3. Fuseki'den semantik okuma yap
            const readingUri = `${PYRO}reading_${message.device_id}_${message.timestamp}`;
            const sparqlReading = await queryReading(readingUri);

            if (!sparqlReading) {
                console.warn(
                    `[${message.zone_id}] SPARQL: okuma bulunamadi — ${readingUri}`,
                );
                return;
            }

            // Risk hesaplamasi yapalim.
            const risk = calculateRisk(sparqlReading);

            // Alarm karari ver
            const alarm = evaluateAlarm(message.zone_id, risk.score);

            // 6. Log
            const flagStr = risk.flags.length > 0 ? risk.flags.join(", ") : "—";
            console.log(
                `[${message.zone_id}] ${risk.level} (${risk.score}) | ` +
                    `${message.forest_type}/${message.topology} | ` +
                    `${message.readings.temperature}°C ${message.readings.humidity}% ` +
                    `${message.readings.smoke_ppm}ppm ${message.readings.wind_speed_ms}m/s | ` +
                    `flags: ${flagStr}`,
            );

            if (alarm.justOpened) {
                console.warn(
                    `ALARM ACILDI  zone=${message.zone_id} level=${risk.level} score=${risk.score}`,
                );
            }
            if (alarm.justClosed) {
                console.log(`ALARM KAPANDI zone=${message.zone_id}`);
            }
        } catch (error) {
            console.log(`Pipeline Error ${error}`);
        }
    });

    client.on("error", (err) => {
        console.log("MQTT Error: ", err);
    });
}
