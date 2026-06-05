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
import { inferRiskFlags, inferDownwindThreats } from "./inferenceService";
import { calculateScore } from "./riskCalculator";

const PYRO = "http://pyrosense.io/ontology#";

let mqttConnected = false;
export function isMqttConnected(): boolean {
    return mqttConnected;
}

export function startMqttConsumer() {
    const client = mqtt.connect(MQTT_URL);

    client.on("connect", () => {
        mqttConnected = true;
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

            // 2. Fiziksel sınır kontrolü (sanity check)
            // Sensör arızası senaryosunda üretilen imkânsız değerler
            // (smoke=9999, temp=999, humidity=-1, wind=-5) SPARQL motoruna
            // gönderilirse yanlış alarm üretir. Bu değerler gerçek doğada
            // hiçbir zaman oluşamaz → çıkarımı atla, skor=0 kaydet.
            const r = message.readings;
            const isFaulty =
                r.smoke_ppm > 2000       ||  // max gerçek yangın ~1000 ppm
                r.temperature > 150      ||  // orman yangınında sensör erişimi yok
                r.temperature < -60      ||  // Türkiye'de imkânsız
                r.humidity < 0           ||  // fiziksel alt sınır
                r.wind_speed_ms < 0;        // negatif hız imkânsız

            if (isFaulty) {
                const faultyRisk = { score: 0, level: "LOW" as const, flags: [], reasoningLog: [] };
                const alarm = evaluateAlarm(message.zone_id, 0);
                await saveRiskScore(message.zone_id, faultyRisk, "", message.timestamp, message.scenario);
                broadcast({
                    type: "RISK_UPDATE",
                    zoneId: message.zone_id,
                    score: 0,
                    level: "LOW",
                    flags: [],
                    reasoningLog: [],
                    forestType: message.forest_type,
                    topology: message.topology,
                    temperature: r.temperature,
                    humidity: r.humidity,
                    smokePpm: r.smoke_ppm,
                    windSpeedMs: r.wind_speed_ms,
                    timeStamp: message.timestamp,
                    scenario: message.scenario,
                    alarm: {
                        active: alarm.shouldAlert,
                        justOpened: alarm.justOpened,
                        justClosed: alarm.justClosed,
                    },
                });
                console.log(`[SANITY] ${message.zone_id} fizik dışı değer — çıkarım atlandı (smoke=${r.smoke_ppm} temp=${r.temperature} hum=${r.humidity} wind=${r.wind_speed_ms})`);
                return;
            }

            // 3. Drough Class i al - Turtle a yazmak icin once cekelim.
            const droughtClass = await getZoneDrought(message.zone_id);

            // 4. RDF'e cevirelim
            const turtle = toRdfTurtle(message, droughtClass);
            await uploadTurtle(turtle);

            // 5. Ontoloji tabanli cikartim yapalim.
            const readingUri = `${PYRO}reading_${message.device_id}_${message.timestamp}`;
            const [inferredFlags, downwindFlag] = await Promise.all([
                inferRiskFlags(readingUri),
                inferDownwindThreats(message.zone_id, message.readings.smoke_ppm),
            ]);

            // 5b. Bölgeler arası rüzgar yayılım flag'i varsa ekle
            const allFlags = downwindFlag
                ? [...inferredFlags, downwindFlag]
                : inferredFlags;

            // 6. Skor ve seviye hesapla
            const risk = calculateScore(allFlags);

            // 7. Alarm karari ver
            const alarm = evaluateAlarm(message.zone_id, risk.score);

            // 8. PostgreSQL risk skoru kayit et.
            await saveRiskScore(
                message.zone_id,
                risk,
                readingUri,
                message.timestamp,
                message.scenario,
            );

            // 8. Websocket broadcast, sensor degerleri direkt mesajdan oku
            broadcast({
                type: "RISK_UPDATE",
                zoneId: message.zone_id,
                score: risk.score,
                level: risk.level,
                flags: risk.flags,
                scenario: message.scenario,
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

            // 9. Alarm olaylarını PostgreSQL'e kaydet (alarm_events audit log)
            if (alarm.justOpened) {
                await saveAlarm(message.zone_id, risk.level, risk.flags);
                await logAlarmEvent({
                    eventType: "OPENED",
                    zoneId: message.zone_id,
                    level: risk.level,
                    score: risk.score,
                    flags: risk.flags,
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
                    score: risk.score,
                    flags: [],
                });
                console.log(`ALARM KAPANDI zone=${message.zone_id}`);
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

    client.on("close", () => {
        mqttConnected = false;
    });
    client.on("disconnect", () => {
        mqttConnected = false;
    });
}
