import { getDb } from "./database";

export type AlarmEventType = "OPENED" | "CLOSED";

export interface AlarmEvent {
    eventType: AlarmEventType;
    zoneId: string;
    level: string;
    flags: string[];
    score: number;
}

export async function logAlarmEvent(event: AlarmEvent): Promise<void> {
    const db = getDb();
    await db.query(
        `INSERT INTO alarm_events (event_type, zone_id, level, score, flags)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.eventType, event.zoneId, event.level, event.score, event.flags],
    );
    console.log(
        `[PG] alarm_event: ${event.eventType} zone=${event.zoneId} level=${event.level} score=${event.score}`,
    );
}
