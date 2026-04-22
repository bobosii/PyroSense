import type { SparqlReading } from "./sparqlService";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface ReasoningEntry {
    rule: string;
    label: string;
    condition: string;
    weight: number;
}

export interface RiskResult {
    score: number;
    level: RiskLevel;
    flags: string[];
    reasoningLog: ReasoningEntry[];
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
        droughtTemp: 36,
        droughtHum: 20,
        smokeAlarm: 100,
        spreadWind: 9,
        spreadTemp: 33,
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
        droughtTemp: 34,
        droughtHum: 22,
        smokeAlarm: 80,
        spreadWind: 7,
        spreadTemp: 30,
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

// Tek kaynak: tüm kural ağırlıkları
const WEIGHTS: Record<string, number> = {
    FLAME_DETECTED: 65,
    SMOKE_ALARM: 35,
    EARLY_FIRE_SIGNAL: 25,
    HIGH_SPREAD_RISK: 20,
    HIGH_DROUGHT_RISK: 20,
    SLOPE_FIRE_SPREAD_CRITICAL: 30,
    VALLEY_WIND_AMPLIFICATION: 15,
    RIDGE_WIND_EXPOSURE: 10,
};

export function calculateRisk(
    reading: SparqlReading,
    droughtClass: string = "NormalMoisture",
): RiskResult {
    const droughtMultiplier =
        droughtClass === "ExtremeDrought"
            ? 0.8
            : droughtClass === "ModerateDrought"
              ? 0.9
              : 1.0;

    const flags: string[] = [];
    const reasoningLog: ReasoningEntry[] = [];

    const base = THRESHHOLDS[reading.forestType] ?? THRESHHOLDS["Mixed"];
    const t = {
        ...base,
        droughtTemp: base.droughtTemp * droughtMultiplier,
        smokeAlarm: base.smokeAlarm * droughtMultiplier,
        spreadWind: base.spreadWind * droughtMultiplier,
    };

    const fire = (rule: string, label: string, condition: string) => {
        flags.push(rule);
        reasoningLog.push({ rule, label, condition, weight: WEIGHTS[rule] ?? 0 });
    };

    // ── Sensör Kuralları

    if (reading.flameDetected) {
        fire("FLAME_DETECTED", "Alev Tespiti", "Alev sensörü aktif sinyal verdi");
    }

    if (reading.temperature > t.droughtTemp && reading.humidity < t.droughtHum) {
        fire(
            "HIGH_DROUGHT_RISK",
            "Yüksek Kuraklık Riski",
            `Sıcaklık ${reading.temperature.toFixed(1)}°C > eşik ${t.droughtTemp.toFixed(1)}°C` +
                ` & Nem %${reading.humidity.toFixed(0)} < %${t.droughtHum}`,
        );
    }

    if (reading.smokePpm > t.smokeAlarm) {
        fire(
            "SMOKE_ALARM",
            "Duman Alarmı",
            `Duman ${reading.smokePpm.toFixed(0)} ppm > eşik ${t.smokeAlarm.toFixed(0)} ppm`,
        );
    }

    if (reading.windSpeedMs > t.spreadWind && reading.temperature > t.spreadTemp) {
        fire(
            "HIGH_SPREAD_RISK",
            "Yüksek Yayılım Riski",
            `Rüzgar ${reading.windSpeedMs.toFixed(1)} m/s > eşik ${t.spreadWind.toFixed(1)} m/s` +
                ` & Sıcaklık ${reading.temperature.toFixed(1)}°C > ${t.spreadTemp}°C`,
        );
    }

    if (reading.co2Ppm > t.earlySignalCo2 && reading.smokePpm > t.earlySignalSmoke) {
        fire(
            "EARLY_FIRE_SIGNAL",
            "Erken Yangın Sinyali",
            `CO₂ ${reading.co2Ppm} ppm > ${t.earlySignalCo2}` +
                ` & Duman ${reading.smokePpm.toFixed(0)} ppm > ${t.earlySignalSmoke}`,
        );
    }

    // ── Topoloji Kuralları

    if (
        reading.topology === "Valley" &&
        reading.windSpeedMs > 6 &&
        reading.temperature > 25
    ) {
        fire(
            "VALLEY_WIND_AMPLIFICATION",
            "Vadi Rüzgar Etkisi",
            `Vadi topolojisi & Rüzgar ${reading.windSpeedMs.toFixed(1)} m/s > 6 m/s` +
                ` & Sıcaklık ${reading.temperature.toFixed(1)}°C > 25°C`,
        );
    }

    if (reading.topology === "Ridge" && reading.windSpeedMs > 8) {
        fire(
            "RIDGE_WIND_EXPOSURE",
            "Sırt Rüzgar Açıklığı",
            `Sırt topolojisi & Rüzgar ${reading.windSpeedMs.toFixed(1)} m/s > 8 m/s`,
        );
    }

    if (
        reading.topology === "Slope" &&
        reading.windSpeedMs > 5 &&
        reading.humidity < 30 &&
        reading.temperature > 30
    ) {
        fire(
            "SLOPE_FIRE_SPREAD_CRITICAL",
            "Yamaç Yayılım Kritik",
            `Yamaç topolojisi & Rüzgar ${reading.windSpeedMs.toFixed(1)} m/s > 5 m/s` +
                ` & Nem %${reading.humidity.toFixed(0)} < %30` +
                ` & Sıcaklık ${reading.temperature.toFixed(1)}°C > 30°C`,
        );
    }

    // ── Skor & Seviye

    const score = Math.min(
        100,
        flags.reduce((sum, flag) => sum + (WEIGHTS[flag] ?? 0), 0),
    );

    const level: RiskLevel =
        score >= 80 ? "EXTREME" : score >= 60 ? "HIGH" : score >= 35 ? "MODERATE" : "LOW";

    return { score, level, flags, reasoningLog };
}
