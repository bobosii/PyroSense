import { getDb } from "./database";
import { WeatherData } from "./weatherService";

export async function saveWeatherCache(data: WeatherData): Promise<void> {
    const db = getDb();

    const sql = `INSERT INTO weather_cache
(zone_id, temperature, humidity, wind_speed, wind_direction, precipitation_30d, drought_class)
VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    await db.query(sql, [
        data.zoneId,
        data.temperature,
        data.humidity,
        data.windSpeed,
        data.windDirection,
        data.precipitation30d,
        data.droughtClass,
    ]);
}

export async function updateZoneDrought(
    zoneId: string,
    droughtClass: string,
): Promise<void> {
    const db = getDb();

    await db.query(`UPDATE zones SET drought_index = $1 WHERE zone_id = $2`, [
        droughtClass,
        zoneId,
    ]);
}

export async function getZoneDrought(zoneId: string): Promise<string> {
    const db = getDb();

    const result = await db.query(`SELECT drought_index FROM zones WHERE zone_id = $1`, [
        zoneId,
    ]);
    return result.rows[0]?.drought_index ?? "NormalMoisture";
}
