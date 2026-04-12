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

    const sql = `INSERT INTO alarms (zoneId, level, message)
    VALUES ($1, $2, $3)`;

    await db.query(sql, [zoneId, level, message]);
    console.log(`[ALARM] kayit: zone=${zoneId} level=${level}`);
}
