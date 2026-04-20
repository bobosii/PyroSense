// ============================================================
//  PyroSense Weather Service
//  Open-Meteo API — gerçek meteoroloji verisi + kuraklık indeksi
// ============================================================

import axios from "axios";
import { OPEN_METEO_URL } from "../constants";

export interface WeatherData {
    zoneId: string;
    temperature: number;
    humidity: number; // %
    windSpeed: number; // m/s
    windDirection: number; // Ruzgar derecesi
    precipitation30d: number; // Son 30 gunluk toplam yagis
    droughtClass: "NormalMoisture" | "ModerateDrought" | "ExtremeDrought";
}

const ZONE_COORDS: Record<string, { lat: number; lon: number }> = {
    zone_a: { lat: 36.97, lon: 30.53 }, // Düzlerçamı Kızılçam ormanı
    zone_b: { lat: 37.01, lon: 30.51 }, // Güver Vadisi Meşeliği
    zone_c: { lat: 37.03, lon: 30.47 }, // Güllük Dağı Karma orman
};

function calcDroughtClass(precipitation30d: number): WeatherData["droughtClass"] {
    if (precipitation30d < 10) return "ExtremeDrought";
    if (precipitation30d < 40) return "ModerateDrought";
    return "NormalMoisture";
}

export async function fetchWeather(zoneId: string): Promise<WeatherData | null> {
    const coords = ZONE_COORDS[zoneId];
    if (!coords) return null;

    try {
        const response = await axios.get(`${OPEN_METEO_URL}/forecast`, {
            params: {
                latitude: coords.lat,
                longitude: coords.lon,
                current:
                    "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
                daily: "precipitation_sum",
                timezone: "Europe/Istanbul",
                past_days: 30,
                forecast_days: 1,
            },
        });

        const current = response.data.current;
        const daily = response.data.daily;

        // son 30 gunluk toplam yagis
        const precipitation30d: number = (daily.precipitation_sum as number[]).reduce(
            (sum: number, v: number) => sum + (v ?? 0),
            0,
        );

        return {
            zoneId,
            temperature: current.temperature_2m,
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            windDirection: current.wind_direction_10m,
            precipitation30d: Math.round(precipitation30d * 10) / 10,
            droughtClass: calcDroughtClass(precipitation30d),
        };
    } catch (err) {
        console.error(`[WEATHER] ${zoneId} fetch hatasi: ${err}`);
        return null;
    }
}

export async function fetchAllZones(): Promise<WeatherData[]> {
    const results = await Promise.all(
        Object.keys(ZONE_COORDS).map((zoneId) => fetchWeather(zoneId)),
    );

    return results.filter((r): r is WeatherData => r !== null);
}
