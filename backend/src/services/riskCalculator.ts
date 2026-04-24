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
// NOT: Bu eşikler pyrosense-rules.jrl ile birebir hizalıdır.
// Değişiklik yapılırken her iki dosya birlikte güncellenmelidir.
//
// CO2 eşikleri v2'de 750-1000 ppm aralığına yükseltildi:
//   - NDIR sensör doğruluğu ±200 ppm bandındadır
//   - 2026 atmosferik baz ~422 ppm; 430-560 ppm eski eşikler ölçüm
//     gürültüsü içindeydi ve yanlış alarm üretiyordu
//   - EarlySignal CO2+smoke kombinasyon kuralıdır; CO2 tek başına alarm üretmez
//
// Tür bazlı düzeltmeler (v1→v2):
//   RedPine:        droughtTemp 36→32, droughtHum 20→30, smoke 100→75, wind 9→7
//   Shrubland:      droughtTemp 34→30, droughtHum 22→25, smoke 80→60, wind 7→6, spreadTemp 30→28
//   OrientalSpruce: droughtTemp 26→33, smoke 110→140, spreadTemp 22→28
//   ScotsPine:      droughtTemp 26→28, smoke 70→80, spreadTemp 23→25
//   SilverFir:      droughtTemp 28→33, spreadTemp 24→28
//   Juniper:        droughtTemp 32→30, spreadWind 8→7, spreadTemp 29→27
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
    // Kızılçam — Türkiye'nin en yangın duyarlı türü (Akdeniz-Ege kıyı kuşağı)
    RedPine: {
        droughtTemp: 32,
        droughtHum: 30,
        smokeAlarm: 75,
        spreadWind: 7,
        spreadTemp: 30,
        earlySignalCo2: 800,
        earlySignalSmoke: 40,
    },
    // Karaçam — iç Anadolu, 400-2000m, kontinental
    BlackPine: {
        droughtTemp: 30,
        droughtHum: 30,
        smokeAlarm: 75,
        spreadWind: 7,
        spreadTemp: 27,
        earlySignalCo2: 850,
        earlySignalSmoke: 50,
    },
    // Sarıçam — Doğu Anadolu, yüksek rakım (1000-2200m), kıta iklimi
    ScotsPine: {
        droughtTemp: 28,
        droughtHum: 30,
        smokeAlarm: 80,
        spreadWind: 7,
        spreadTemp: 25,
        earlySignalCo2: 850,
        earlySignalSmoke: 50,
    },
    // Toros Sediri — Batı/Orta/Doğu Toroslar, 1000-2000m, kireçli yamaç
    TaurusCedar: {
        droughtTemp: 30,
        droughtHum: 28,
        smokeAlarm: 85,
        spreadWind: 7,
        spreadTemp: 28,
        earlySignalCo2: 870,
        earlySignalSmoke: 55,
    },
    // Göknar — Kuzey Anadolu + Toros kuşağı, nemli-serin, 1200-2000m
    SilverFir: {
        droughtTemp: 33,
        droughtHum: 25,
        smokeAlarm: 105,
        spreadWind: 9,
        spreadTemp: 28,
        earlySignalCo2: 900,
        earlySignalSmoke: 65,
    },
    // Doğu Ladini — Doğu Karadeniz (Ordu→Artvin), en nemli orman; sis/nem FP riski
    OrientalSpruce: {
        droughtTemp: 33,
        droughtHum: 22,
        smokeAlarm: 140,
        spreadWind: 10,
        spreadTemp: 28,
        earlySignalCo2: 950,
        earlySignalSmoke: 75,
    },
    // Meşe — Türkiye geneli yaygın, çok heterojen grup
    Oak: {
        droughtTemp: 34,
        droughtHum: 25,
        smokeAlarm: 110,
        spreadWind: 9,
        spreadTemp: 30,
        earlySignalCo2: 900,
        earlySignalSmoke: 70,
    },
    // Kayın — Karadeniz, nemli ve ılıman, 500-1800m
    OrientalBeech: {
        droughtTemp: 35,
        droughtHum: 25,
        smokeAlarm: 120,
        spreadWind: 10,
        spreadTemp: 32,
        earlySignalCo2: 950,
        earlySignalSmoke: 80,
    },
    // Kızılağaç — riparian (dere/ırmak kenarı); en yüksek alarm bariyeri
    Alder: {
        droughtTemp: 36,
        droughtHum: 20,
        smokeAlarm: 130,
        spreadWind: 11,
        spreadTemp: 33,
        earlySignalCo2: 1000,
        earlySignalSmoke: 85,
    },
    // Maki — Akdeniz kıyısı, en agresif ön-alarm sınıfı; hızlı yayılım
    Shrubland: {
        droughtTemp: 30,
        droughtHum: 25,
        smokeAlarm: 60,
        spreadWind: 6,
        spreadTemp: 28,
        earlySignalCo2: 750,
        earlySignalSmoke: 30,
    },
    // Ardıç — kuru iç Anadolu, yarı-kurak, açık yapılı yamaç
    Juniper: {
        droughtTemp: 30,
        droughtHum: 28,
        smokeAlarm: 80,
        spreadWind: 7,
        spreadTemp: 27,
        earlySignalCo2: 880,
        earlySignalSmoke: 55,
    },
    // Karma orman — ortalama eşikler; üretimde dominantSpecies ile ayrıştırılmalı
    Mixed: {
        droughtTemp: 31,
        droughtHum: 30,
        smokeAlarm: 90,
        spreadWind: 8,
        spreadTemp: 28,
        earlySignalCo2: 880,
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
