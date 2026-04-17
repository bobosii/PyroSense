// ============================================================
//  PyroSense Frontend — Shared Types
// ============================================================

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export type DroughtClass = "NormalMoisture" | "ModerateDrought" | "ExtremeDrought";

export type ScenarioName = "normal" | "prefire" | "activefire" | "sensorFault";

/** Live risk update pushed via WebSocket */
export interface RiskUpdate {
    type: "RISK_UPDATE";
    zoneId: string;
    score: number;
    level: RiskLevel;
    flags: string[];
    forestType: string;
    topology: string;
    temperature: number;
    humidity: number;
    smokePpm: number;
    windSpeedMs: number;
    timeStamp: string;
    alarm: {
        active: boolean;
        justOpened: boolean;
        justClosed: boolean;
    };
}

/** One entry in the alarm panel */
export interface AlarmEntry {
    id: string;
    zoneId: string;
    level: RiskLevel;
    score: number;
    openedAt: string;
    closedAt?: string;
    active: boolean;
}

/** One data point in sensor time-series charts */
export interface SensorDataPoint {
    time: string; // HH:mm:ss
    temperature: number;
    humidity: number;
    smokePpm: number;
    windSpeedMs: number;
}

/** Zone definition */
export interface ZoneInfo {
    zoneId: string;
    label: string;
    lat: number;
    lon: number;
    topology: string;
    forestType: string;
}

/** Record of latest update per zone */
export type ZoneUpdateMap = Record<string, RiskUpdate>;
