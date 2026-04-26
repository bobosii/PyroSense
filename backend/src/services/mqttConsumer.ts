import mqtt from "mqtt";
import { SensorMessage } from "../types/sensor";
import { saveSensorReading } from "./sensorRepository";
import { toRdfTurtle } from "./rdfConverter";
import { uploadTurtle } from "./fusekiClient";
import { MQTT_URL } from "../constants";
import { evaluateAlarm } from "./alarmManager";
import { closeAlarm, saveAlarm, saveRiskScore } from "./riskRepository";
import { logAlarmEvent } from "./alarmLogRepository";
import { broadcast } from "./wsGateway";
import { getZoneDrought } from "./weatherRepository";
import { inferRiskFlags } from "./inferenceService";
import { calculateScore } from "./riskCalculator";

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

            // 2. Drough Class i al - Turtle a yazmak icin once cekelim.
            const droughtClass = await getZoneDrought(message.zone_id);

            // 3. RDF'e cevirelim
            const turtle = toRdfTurtle(message, droughtClass);
            await uploadTurtle(turtle);

            // 4. Ontoloji tabanli cikartim yapalim.
            const readingUri = `${PYRO}reading_${message.device_id}_${message.timestamp}`;
            const inferredFlags = await inferRiskFlags(readingUri);

            // 5. Skor ve seviye hesapla
            const risk = calculateScore(inferredFlags);

            // 6. Alarm karari ver
            const alarm = evaluateAlarm(message.zone_id, risk.score);

            // 7. PostgreSQL risk skoru kayit et.
            await saveRiskScore(message.zone_id, risk, readingUri, message.timestamp);

            // 8. Websocket broadcast, sensor degerleri direkt mesajdan oku
            broadcast({
                type: "RISK_UPDATE",
                zoneId: message.zone_id,
                score: risk.score,
                level: risk.level,
                flags: risk.flags,
                reasoningLog: risk.reasoningLog,
                forestType: message.forest_type,
                topology: message.topology,
                temperature: message.readings.temperature,
                humidity: message.readings.humidity,
                smokePpm: message.readings.smoke_ppm,
                windSpeedMs: message.readings.wind_speed_ms,
                timeStamp: message.timestamp,
                alarm: {
                    active: alarm.shouldAlert,
                    justOpened: alarm.justOpened,
                    justClosed: alarm.justClosed,
                },
            });

            // 9. Alarm eventleri - Postgresql state + mongodb audit log
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

            // 10. Log
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
