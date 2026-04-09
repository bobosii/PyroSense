export interface SensorReadings {
    temperature: number;
    humidity: number;
    smoke_ppm: number;
    uv_index: number;
    wind_speed_ms: number;
    wind_dir_deg: number;
    flame_detected: boolean;
    co2_ppm?: number;
}

export interface SensorMessage {
    device_id: string;
    zone_id: string;
    forest_type: string;
    topology: string;
    timestamp: string;
    readings: SensorReadings;
    battery_pct: number;
    scenario: string;
    fw_version: string;
}
