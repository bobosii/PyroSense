import { getDb } from "./database";
import { SensorMessage } from "../types/sensor";

export async function saveSensorReading(msg: SensorMessage): Promise<void> {
    const db = getDb();
    const sql = `INSERT INTO sensor_readings
      (time, device_id, zone_id, temperature, humidity, smoke_ppm,
       uv_index, wind_speed_ms, wind_dir_deg, flame_detected, co2_ppm,
       battery_pct, scenario)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;

    const values = [
        msg.timestamp,
        msg.device_id,
        msg.zone_id,
        msg.readings.temperature,
        msg.readings.humidity,
        msg.readings.smoke_ppm,
        msg.readings.uv_index,
        msg.readings.wind_speed_ms,
        msg.readings.wind_dir_deg,
        msg.readings.flame_detected,
        msg.readings.co2_ppm ?? null,
        msg.battery_pct,
        msg.scenario,
    ];

    await db.query(sql, values);
    console.log(`[DB] saved: ${msg.device_id} @ ${msg.timestamp}`);
}
