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

export function calculateScore(inferredFlags: InferredFlag[]): RiskResult {
    const flags: string[] = inferredFlags.map((f) => f.rule);

    const reasoningLog: ReasoningEntry[] = inferredFlags.map((f) => ({
        rule: f.rule,
        label: f.label,
        condition: f.condition,
        weight: f.weight,
    }));

    const score = Math.min(
        100,
        inferredFlags.reduce((sum, f) => sum + f.weight, 0),
    );

    const level: RiskLevel =
        score >= 80 ? "EXTREME" : score >= 60 ? "HIGH" : score >= 35 ? "MODERATE" : "LOW";

    return { score, level, flags, reasoningLog };
}
