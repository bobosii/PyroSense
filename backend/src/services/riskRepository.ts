import { getDb } from "./database";
import { RiskResult } from "./riskCalculator";

// -----------------------------------------------------------
// Risk Skoru Kaydet — her tick'te çağrılır
// -----------------------------------------------------------
export async function saveRiskScore(
    zoneId: string,
    risk: RiskResult,
    sparqlUri: string,
    timeStamp: string,
): Promise<void> {
    const db = getDb();

    const sql = `INSERT INTO risk_scores (time, zone_id, score, level, source, sparql_uri)
        VALUES ($1, $2, $3, $4, $5, $6)`;
    await db.query(sql, [
        timeStamp,
        zoneId,
        risk.score,
        risk.level,
        "ontology",
        sparqlUri,
    ]);
    console.log(`[RISK] ${zoneId} -> ${risk.level} (${risk.score})`);
}

// -----------------------------------------------------------
// Alarm ac - justOpened tetiklendiginde cagirilir
// -----------------------------------------------------------
export async function saveAlarm(
    zoneId: string,
    level: string,
    flags: string[],
): Promise<void> {
    const db = getDb();
    const message = flags.join(", ");

    const sql = `INSERT INTO alarms (zone_id, level, message, status)
                 VALUES ($1, $2, $3, 'OPEN')`;

    await db.query(sql, [zoneId, level, message]);
    console.log(`[ALARM] acildi: zone=${zoneId} level=${level}`);
}

export async function closeAlarm(zoneId: string): Promise<void> {
    const db = getDb();
    const sql = `UPDATE alarms SET status = 'CLOSED', closed_at = NOW()
                WHERE zone_id = $1 AND status = 'OPEN'
                AND id = (SELECT id FROM alarms WHERE zone_id = $1 AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1)`;
    await db.query(sql, [zoneId]);
    console.log(`[ALARM] kapandi: zone=${zoneId}`);
}
