import { useEffect, useState } from "react";
import { DroughtClass } from "../types";

interface WeatherRow {
    zone_id: string;
    temperature: number;
    humidity: number;
    wind_speed: number;
    wind_direction: number;
    precipitation_30d: number;
    drought_class: DroughtClass;
    fetched_at: string;
}

const DROUGHT_META = {
    NormalMoisture: { label: "Normal", color: "#22c55e" },
    ModerateDrought: { label: "Orta Kuraklık", color: "#f59e0b" },
    ExtremeDrought: { label: "Aşırı Kuraklık", color: "#ef4444" },
};

const ZONE_NAMES: Record<string, string> = {
    zone_a: "Düzlerçamı",
    zone_b: "Güver Vadisi",
    zone_c: "Güllük Dağı",
};

export function WeatherWidget() {
    const [data, setData] = useState<WeatherRow[]>([]);

    useEffect(() => {
        const load = () =>
            fetch("/api/weather")
                .then((r) => r.json())
                .then(setData)
                .catch(console.error);
        load();
        const id = setInterval(load, 60_000); // Her dakika guncelle
        return () => clearInterval(id);
    }, []);

    if (data.length === 0) {
        return null;
    }

    return (
        <div className="weather-widget">
            <div className="weather-title">
                <span
                    className="meterial-symbols-outlined"
                    style={{ fontSize: 14 }}
                ></span>
                METEOROLOJI * OPEN-METEO
            </div>
            {data.map((row) => {
                const drought = DROUGHT_META[row.drought_class];
                return (
                    <div key={row.zone_id} className="weather-row">
                        <span className="weather-zone">{ZONE_NAMES[row.zone_id]}</span>
                        <span className="weather-val">
                            {row.temperature.toFixed(1)}°C
                        </span>
                        <span className="weather-val">%{row.humidity}</span>
                        <span className="weather-val">
                            {row.wind_speed.toFixed(1)} m/s
                        </span>
                        <span
                            className="weather-drought"
                            style={{ color: drought.color }}
                        >
                            {drought.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
