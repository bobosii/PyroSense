import { InferredFlag } from "./inferenceService";

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

// FLAME_DETECTED olmadan ulaşılabilecek maksimum skor.
// Projenin amacı yangın öncesi uyarıdır; EXTREME seviyesi yalnızca
// alev sensörü doğrudan ateş tespit ettiğinde anlam taşır.
// Bu kısıt olmadan prefire senaryosu birden fazla ağır bayrak
// üst üste geldiğinde 100'e ulaşıp EXTREME üretebiliyor.
const MAX_SCORE_WITHOUT_FLAME = 79;

export function calculateScore(inferredFlags: InferredFlag[]): RiskResult {
    const flags: string[] = inferredFlags.map((f) => f.rule);

    const reasoningLog: ReasoningEntry[] = inferredFlags.map((f) => ({
        rule: f.rule,
        label: f.label,
        condition: f.condition,
        weight: f.weight,
    }));

    const rawScore = inferredFlags.reduce((sum, f) => sum + f.weight, 0);
    const hasFlame = flags.includes("FLAME_DETECTED");

    // Alev tespiti yoksa skor HIGH seviyesinde (≤75) kısıtlanır.
    // Alev tespiti varsa skor 100'e kadar çıkabilir (EXTREME).
    const score = hasFlame
        ? Math.min(100, rawScore)
        : Math.min(MAX_SCORE_WITHOUT_FLAME, rawScore);

    const level: RiskLevel =
        score >= 80 ? "EXTREME" : score >= 60 ? "HIGH" : score >= 35 ? "MODERATE" : "LOW";

    return { score, level, flags, reasoningLog };
}
