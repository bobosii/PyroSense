import type { SparqlReading } from "./sparqlService";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface RiskResult {
    score: number; // 0-100
    level: RiskLevel;
    flags: string[]; // Tetiklenen kural isimleri
}

// Orman tiplerine gore esik degerleri

const THRESHHOLDS: Record<
    string,
    {
        droughtTemp: number;
        droughtHum: number;
        smokeAlarm: number;
        spreadWind: number;
        spreadTemp: number;
        earlySignalCo2: number;
        earlySignalSmoke: number;
    }
> = {
    RedPine: {
        droughtTemp: 28,
        droughtHum: 35,
        smokeAlarm: 60,
        spreadWind: 6,
        spreadTemp: 25,
        earlySignalCo2: 450,
        earlySignalSmoke: 40,
    },
    BlackPine: {
        droughtTemp: 30,
        droughtHum: 30,
        smokeAlarm: 75,
        spreadWind: 7,
        spreadTemp: 27,
        earlySignalCo2: 470,
        earlySignalSmoke: 50,
    },
    ScotsPine: {
        droughtTemp: 26,
        droughtHum: 30,
        smokeAlarm: 70,
        spreadWind: 7,
        spreadTemp: 23,
        earlySignalCo2: 460,
        earlySignalSmoke: 45,
    },
    TaurusCedar: {
        droughtTemp: 30,
        droughtHum: 28,
        smokeAlarm: 80,
        spreadWind: 7,
        spreadTemp: 26,
        earlySignalCo2: 480,
        earlySignalSmoke: 55,
    },
    SilverFir: {
        droughtTemp: 28,
        droughtHum: 25,
        smokeAlarm: 100,
        spreadWind: 9,
        spreadTemp: 24,
        earlySignalCo2: 500,
        earlySignalSmoke: 65,
    },
    OrientalSpruce: {
        droughtTemp: 26,
        droughtHum: 22,
        smokeAlarm: 110,
        spreadWind: 10,
        spreadTemp: 22,
        earlySignalCo2: 520,
        earlySignalSmoke: 70,
    },
    Oak: {
        droughtTemp: 34,
        droughtHum: 25,
        smokeAlarm: 110,
        spreadWind: 9,
        spreadTemp: 30,
        earlySignalCo2: 510,
        earlySignalSmoke: 70,
    },
    OrientalBeech: {
        droughtTemp: 35,
        droughtHum: 25,
        smokeAlarm: 120,
        spreadWind: 10,
        spreadTemp: 32,
        earlySignalCo2: 550,
        earlySignalSmoke: 80,
    },
    Alder: {
        droughtTemp: 36,
        droughtHum: 20,
        smokeAlarm: 130,
        spreadWind: 11,
        spreadTemp: 33,
        earlySignalCo2: 560,
        earlySignalSmoke: 85,
    },
    Shrubland: {
        droughtTemp: 26,
        droughtHum: 38,
        smokeAlarm: 50,
        spreadWind: 5,
        spreadTemp: 24,
        earlySignalCo2: 430,
        earlySignalSmoke: 35,
    },
    Juniper: {
        droughtTemp: 32,
        droughtHum: 28,
        smokeAlarm: 85,
        spreadWind: 8,
        spreadTemp: 29,
        earlySignalCo2: 490,
        earlySignalSmoke: 60,
    },
    Mixed: {
        droughtTemp: 31,
        droughtHum: 30,
        smokeAlarm: 90,
        spreadWind: 8,
        spreadTemp: 28,
        earlySignalCo2: 500,
        earlySignalSmoke: 60,
    },
};

export function calculateRisk(reading: SparqlReading): RiskResult {
    const flags: string[] = [];
    const t = THRESHHOLDS[reading.forestType] ?? THRESHHOLDS["Mixed"];

    if (reading.flameDetected) {
        flags.push("FLAME_DETECTED");
    }

    if (reading.temperature > t.droughtTemp && reading.humidity > t.droughtHum) {
        flags.push("HIGH_DROUGHT_RISK");
    }
    if (reading.smokePpm > t.smokeAlarm) {
        flags.push("SMOKE_ALARM");
    }

    if (reading.windSpeedMs > t.spreadWind && reading.temperature > t.spreadTemp) {
        flags.push("HIGH_SPREAD_RISK");
    }

    if (reading.co2Ppm > t.earlySignalCo2 && reading.smokePpm > t.earlySignalSmoke) {
        flags.push("EARLY_FIRE_SIGNAL");
    }

    // --- Topoloji kuralları ---
    if (
        reading.topology === "Valley" &&
        reading.windSpeedMs > 6 &&
        reading.temperature > 25
    ) {
        flags.push("VALLEY_WIND_AMPLIFICATION");
    }

    if (reading.topology === "Ridge" && reading.windSpeedMs > 8) {
        flags.push("RIDGE_WIND_EXPOSURE");
    }

    if (
        reading.topology === "Slope" &&
        reading.flameDetected &&
        reading.windSpeedMs > 3
    ) {
        flags.push("SLOPE_FIRE_SPREAD_CRITICAL");
    }

    const weights: Record<string, number> = {
        FLAME_DETECTED: 100,
        SLOPE_FIRE_SPREAD_CRITICAL: 95,
        SMOKE_ALARM: 75,
        EARLY_FIRE_SIGNAL: 70,
        HIGH_SPREAD_RISK: 65,
        HIGH_DROUGHT_RISK: 55,
        VALLEY_WIND_AMPLIFICATION: 50,
        RIDGE_WIND_EXPOSURE: 40,
    };

    let score = 0;

    for (const flag of flags) {
        const w = weights[flag] ?? 0;
        if (w > score) score = w;
    }
    // Topoloji çarpanı: birden fazla flag varsa skor %15 artar
    if (
        flags.length > 1 &&
        (flags.includes("VALLEY_WIND_AMPLIFICATION") ||
            flags.includes("SLOPE_FIRE_SPREAD_CRITICAL") ||
            flags.includes("RIDGE_WIND_EXPOSURE"))
    ) {
        score = Math.min(100, Math.round(score * 1.15));
    }

    const level: RiskLevel =
        score >= 80 ? "EXTREME" : score >= 60 ? "HIGH" : score >= 35 ? "MODERATE" : "LOW";

    return { score, level, flags };
}
