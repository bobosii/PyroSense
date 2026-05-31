import express from "express";
import axios from "axios";
import { getDb } from "./database";
import { isMqttConnected } from "./mqttConsumer";
import {
    FUSEKI_URL,
    FUSEKI_DATASET,
    FUSEKI_USER,
    FUSEKI_PASSWORD,
    ONTOLOGY_GRAPH,
} from "../constants";

const PORT = 3001;

export function startHttpServer(): void {
    const app = express();

    app.use((_req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        next();
    });

    // GET /weather -> weather cache tablosunun son kayitlari
    app.get("/weather", async (_req, res) => {
        try {
            const db = getDb();

            const result = await db.query(`
                SELECT DISTINCT ON (zone_id)
                     zone_id, temperature, humidity, wind_speed, wind_direction,
                     precipitation_30d, drought_class, fetched_at
                FROM weather_cache
                ORDER BY zone_id, fetched_at DESC
            `);
            res.json(result.rows);
        } catch (err: any) {
            res.status(500).json({ error: String(err) });
        }
    });

    // GET /alarms -> PostgreSQL alarm geçmişi (son 20)
    app.get("/alarms", async (_req, res) => {
        try {
            const db = getDb();
            const result = await db.query(
                `SELECT id, zone_id, level, message, status, created_at, closed_at
                 FROM alarms
                 ORDER BY created_at DESC
                 LIMIT 20`,
            );
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    app.get("/active-alarms", async (_req, res) => {
        try {
            const db = getDb();

            const result = await db.query(
                `SELECT DISTINCT ON (zone_id) zone_id, level, message, created_at
                 FROM alarms WHERE status = 'OPEN'
                 ORDER BY zone_id, created_at DESC`,
            );
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    app.get("/validation-metrics", async (_req, res) => {
        try {
            const db = getDb();

            const result = await db.query(`
            SELECT
                -- Aktif Yangın Tespiti (activefire → HIGH veya EXTREME beklenir)
                COUNT(*) FILTER (
                    WHERE scenario = 'activefire' AND level IN ('HIGH', 'EXTREME')
                ) AS fire_tp,
                COUNT(*) FILTER (
                    WHERE scenario = 'activefire' AND level IN ('LOW', 'MODERATE')
                ) AS fire_fn,

                -- Yangın Öncesi Tehlike Tespiti (prefire → MODERATE+ beklenir)
                COUNT(*) FILTER (
                    WHERE scenario = 'prefire' AND level IN ('MODERATE', 'HIGH', 'EXTREME')
                ) AS danger_tp,
                COUNT(*) FILTER (
                    WHERE scenario = 'prefire' AND level = 'LOW'
                ) AS danger_fn,

                -- Yanlış Alarm: activefire olmayan senaryoda HIGH/EXTREME tetiklenmesi
                COUNT(*) FILTER (
                    WHERE scenario != 'activefire' AND level IN ('HIGH', 'EXTREME')
                ) AS false_positive,
                COUNT(*) FILTER (
                    WHERE scenario = 'normal' AND level = 'LOW'
                ) AS true_negative,

                -- Sensör Arızası Testi (sensorFault → HIGH/EXTREME olmamalı)
                COUNT(*) FILTER (
                    WHERE scenario = 'sensorFault' AND level IN ('HIGH', 'EXTREME')
                ) AS fault_false_alarm,
                COUNT(*) FILTER (
                    WHERE scenario = 'sensorFault' AND level IN ('LOW', 'MODERATE')
                ) AS fault_correct,

                -- Toplam kayıt
                COUNT(*) AS total_readings
            FROM risk_scores
                `);
            const r = result.rows[0];

            const fireTp = parseInt(r.fire_tp);
            const fireFn = parseInt(r.fire_fn);
            const dangerTp = parseInt(r.danger_tp);
            const dangerFn = parseInt(r.danger_fn);
            const fp = parseInt(r.false_positive);
            const tn = parseInt(r.true_negative);

            res.json({
                activeFireDetection: {
                    truePositive: fireTp,
                    falseNegative: fireFn,
                    precision:
                        fireTp + fp > 0 ? +(fireTp / (fireTp + fp)).toFixed(3) : null,
                    recall:
                        fireTp + fireFn > 0
                            ? +(fireTp / (fireTp + fireFn)).toFixed(3)
                            : null,
                },
                dangerDetection: {
                    truePositive: dangerTp,
                    falseNegative: dangerFn,
                    recall:
                        dangerTp + dangerFn > 0
                            ? +(dangerTp / (dangerTp + dangerFn)).toFixed(3)
                            : null,
                },
                normalConditions: {
                    falsePositive: fp,
                    trueNegative: tn,
                    specificity: tn + fp > 0 ? +(tn / (tn + fp)).toFixed(3) : null,
                },
                sensorFault: {
                    falseAlarms: parseInt(r.fault_false_alarm),
                    correctlySuppressed: parseInt(r.fault_correct),
                },
                totalReadings: parseInt(r.total_readings),
            });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    app.get("/health", async (_req, res) => {
        const results: Record<string, { ok: boolean; detail?: string }> = {};

        // PostgreSQL
        try {
            const db = getDb();
            await db.query("SELECT 1");
            results.postgres = { ok: true };
        } catch (e: any) {
            results.postgres = { ok: false, detail: String(e.message) };
        }

        // Fuseki — ping + triple count (timeout 8 sn)
        try {
            await axios.get(`${FUSEKI_URL}/$/ping`, {
                auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
                timeout: 8000,
            });
            const countQ = `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${ONTOLOGY_GRAPH}> { ?s ?p ?o } }`;
            const cv = await axios.get(`${FUSEKI_URL}/${FUSEKI_DATASET}/sparql`, {
                params: { query: countQ },
                headers: { Accept: "application/sparql-results+json" },
                auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
                timeout: 8000,
            });
            const tripleCount = parseInt(
                cv.data?.results?.bindings?.[0]?.n?.value ?? "0",
                10,
            );
            results.fuseki = { ok: true, detail: `${tripleCount} triple` };
        } catch (e: any) {
            results.fuseki = { ok: false, detail: String(e.message) };
        }

        // MQTT
        results.mqtt = { ok: isMqttConnected() };

        const allOk = Object.values(results).every((r) => r.ok);
        res.status(allOk ? 200 : 207).json(results);
    });

    app.get("/history/:zoneId", async (req, res) => {
        try {
            const { zoneId } = req.params;
            const { from, to, limit = "200", format } = req.query;

            const fromDate = from
                ? new Date(from as string)
                : new Date(Date.now() - 24 * 60 * 60 * 1000);
            const toDate = to ? new Date(to as string) : new Date();
            const rowLimit = Math.min(parseInt(limit as string) || 200, 1000);

            const db = getDb();

            const result = await db.query(
                `SELECT time, temperature, humidity, smoke_ppm,
                        wind_speed_ms, wind_dir_deg, flame_detected, co2_ppm, scenario
                 FROM sensor_readings
                 WHERE zone_id = $1 AND time BETWEEN $2 AND $3
                 ORDER BY time ASC
                 LIMIT $4`,
                [zoneId, fromDate, toDate, rowLimit],
            );

            if (format === "csv") {
                const headers =
                    "time,temperature,humidity,smoke_ppm,wind_speed_ms,wind_dir_deg,flame_detected,co2_ppm,scenario";
                const rows = result.rows.map((r: any) =>
                    [
                        r.time,
                        r.temperature,
                        r.humidity,
                        r.smoke_ppm,
                        r.wind_speed_ms,
                        r.wind_dir_deg,
                        r.flame_detected,
                        r.co2_ppm ?? "",
                        r.scenario,
                    ].join(","),
                );
                res.setHeader("Content-Type", "text/csv; charset=utf-8");
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="${zoneId}_history.csv"`,
                );
                res.send([headers, ...rows].join("\n"));
            } else {
                res.json(result.rows);
            }
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    app.listen(PORT, () => {
        console.log(`HTTP API: http://localhost:${PORT}`);
    });
}
