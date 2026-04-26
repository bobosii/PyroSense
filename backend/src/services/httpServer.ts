import express from "express";
import { getDb } from "./database";
import { getMongo } from "./mongoClient";

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

    app.get("/alarms", async (_req, res) => {
        try {
            const db = await getMongo();
            const docs = await db
                .collection("alarm_events")
                .find({})
                .sort({ timestamp: -1 })
                .limit(20)
                .toArray();
            res.json(docs);
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
                 ORDER BY created_at DESC`,
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

                -- Yanlış Alarm (normal → LOW beklenir)
                COUNT(*) FILTER (
                    WHERE scenario = 'normal' AND level IN ('MODERATE', 'HIGH', 'EXTREME')
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

    app.listen(PORT, () => {
        console.log(`HTTP API: http://localhost:${PORT}`);
    });
}
