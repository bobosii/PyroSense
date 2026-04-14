import { getMongo } from "./mongoClient";

export type AlarmEventType = "OPENED" | "CLOSED";

export interface AlarmEvent {
    eventType: AlarmEventType;
    zoneId: string;
    level: string;
    flags: string[];
    score: number;
    timestamp: Date;
}

export async function logAlarmEvent(event: AlarmEvent): Promise<void> {
    const db = await getMongo();
    await db.collection("alarm_events").insertOne({
        ...event,
        timestamp: new Date(),
    });
    console.log(
        `[MONGO] alarm_event: ${event.eventType} zone=${event.zoneId} level=${event.level}`,
    );
}
