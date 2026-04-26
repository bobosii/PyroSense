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
    zone_redpine:        { lat: 37.2151, lon: 28.3627 }, // Kızılçam — Muğla/Menteşe
    zone_blackpine:      { lat: 41.3780, lon: 33.7743 }, // Karaçam — Kastamonu
    zone_scotspine:      { lat: 40.3334, lon: 42.5905 }, // Sarıçam — Sarıkamış/Kars
    zone_tauruscedar:    { lat: 37.1000, lon: 34.6000 }, // Toros Sediri — Toros Dağları
    zone_silverfir:      { lat: 40.7350, lon: 31.6000 }, // Göknar — Bolu/Abant
    zone_orientalspruce: { lat: 41.0500, lon: 40.5000 }, // Doğu Ladini — Rize/Artvin
    zone_oak:            { lat: 40.4697, lon: 32.6558 }, // Meşe — Kızılcahamam
    zone_orientalbeech:  { lat: 41.2000, lon: 32.6000 }, // Doğu Kayını — Karabük
    zone_alder:          { lat: 36.3000, lon: 33.9833 }, // Kızılağaç — Göksu Deltası
    zone_shrubland:      { lat: 36.8841, lon: 30.7056 }, // Maki — Antalya
    zone_juniper:        { lat: 37.6750, lon: 31.7250 }, // Ardıç — Beyşehir/Konya
    zone_mixed:          { lat: 41.1944, lon: 28.9514 }, // Karma — Belgrad Ormanı/İstanbul
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
