import mqtt from "mqtt";
import { SensorMessage } from "../types/sensor";
import { saveSensorReading } from "./sensorRepository";
import { toRdfTurtle } from "./rdfConverter";
import { uploadTurtle } from "./fusekiClient";
import { MQTT_URL } from "../constants";
import { queryReading } from "./sparqlService";
import { calculateRisk } from "./riskCalculator";
import { evaluateAlarm } from "./alarmManager";
import { closeAlarm, saveAlarm, saveRiskScore } from "./riskRepository";
import { logAlarmEvent } from "./alarmLogRepository";
import { broadcast } from "./wsGateway";

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

            // 1. Postgresql e kayit edelim
            await saveSensorReading(message);

            // 2. RDF e cevirelim ve fuseki ye yukleyelim.
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

            // 4. Risk hesaplamasi yapalim.
            const risk = calculateRisk(sparqlReading);

            // 5. Alarm karari ver
            const alarm = evaluateAlarm(message.zone_id, risk.score);

            // 6. PostgreSQL risk skoru kayit et.
            await saveRiskScore(message.zone_id, risk, readingUri, message.timestamp);

            broadcast({
                type: "RISK_UPDATE",
                zoneId: message.zone_id,
                score: risk.score,
                level: risk.level,
                flags: risk.flags,
                forestType: message.forest_type,
                topology: message.topology,
                temperature: sparqlReading.temperature,
                humidity: sparqlReading.humidity,
                smokePpm: sparqlReading.smokePpm,
                windSpeedMs: sparqlReading.windSpeedMs,
                timeStamp: message.timestamp,
                alarm: {
                    active: alarm.shouldAlert,
                    justOpened: alarm.justOpened,
                    justClosed: alarm.justClosed,
                },
            });

            // 7. Alarm eventleri - Postgresql state + mongodb audit log
            if (alarm.justOpened) {
                await saveAlarm(message.zone_id, risk.level, risk.flags);
                await logAlarmEvent({
                    eventType: "OPENED",
                    zoneId: message.zone_id,
                    flags: risk.flags,
                    level: risk.level,
                    score: risk.score,
                    timestamp: new Date(),
                });
                console.log(
                    `ALARM ACILDI zone=${message.zone_id} level=${risk.level} score=${risk.score}`,
                );
            }

            if (alarm.justClosed) {
                await closeAlarm(message.zone_id);
                await logAlarmEvent({
                    eventType: "CLOSED",
                    zoneId: message.zone_id,
                    level: risk.level,
                    flags: [],
                    score: risk.score,
                    timestamp: new Date(),
                });
                console.log(`AlARM KAPANDI zone=${message.zone_id}`);
            }

            // 8. Log
            const flagStr = risk.flags.length > 0 ? risk.flags.join(", ") : "—";
            console.log(
                `[${message.zone_id}] ${risk.level} (${risk.score}) | ` +
                    `${message.forest_type}/${message.topology} | ` +
                    `${message.readings.temperature}°C ${message.readings.humidity}% ` +
                    `${message.readings.smoke_ppm}ppm ${message.readings.wind_speed_ms}m/s | ` +
                    `flags: ${flagStr}`,
            );

        } catch (error) {
            console.log(`Pipeline Error ${error}`);
        }
    });

    client.on("error", (err) => {
        console.log("MQTT Error: ", err);
    });
}
