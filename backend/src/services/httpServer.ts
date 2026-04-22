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

    app.listen(PORT, () => {
        console.log(`HTTP API: http://localhost:${PORT}`);
    });
}
