// ============================================================
// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Source: ontology/pyrosense-rules.jrl
// Regenerate: npm run codegen  (python3 scripts/jrl_to_sparql.py)
//
// Bu dosya pyrosense-rules.jrl'deki esik degerlerini TypeScript'e
// INSERT sorgu olusturur. .jrl degistiginde npm run codegen calistir.
// ============================================================

export interface DroughtRiskThreshold { tempBase: number; humMax: number }
export interface SmokeAlarmThreshold  { smokeBase: number }
export interface SpreadRiskThreshold  { windBase: number; tempMin: number }
export interface EarlySignalThreshold { co2Min: number; smokeMin: number }
export interface TopologyThreshold    { windMin?: number; tempMin?: number; humMax?: number; windDirMin?: number; windDirMax?: number }

export const JRL_THRESHOLDS = {
  HIGH_DROUGHT_RISK: {
    RedPine:         { tempBase: 32.0, humMax: 30.0 },
    BlackPine:       { tempBase: 30.0, humMax: 30.0 },
    ScotsPine:       { tempBase: 28.0, humMax: 30.0 },
    TaurusCedar:     { tempBase: 30.0, humMax: 28.0 },
    SilverFir:       { tempBase: 33.0, humMax: 25.0 },
    OrientalSpruce:  { tempBase: 33.0, humMax: 22.0 },
    Oak:             { tempBase: 34.0, humMax: 25.0 },
    OrientalBeech:   { tempBase: 35.0, humMax: 25.0 },
    Alder:           { tempBase: 36.0, humMax: 20.0 },
    Shrubland:       { tempBase: 30.0, humMax: 25.0 },
    Juniper:         { tempBase: 30.0, humMax: 28.0 },
    Mixed:           { tempBase: 31.0, humMax: 30.0 },
  } as Record<string, DroughtRiskThreshold>,

  SMOKE_ALARM: {
    RedPine:         { smokeBase: 75.0 },
    BlackPine:       { smokeBase: 75.0 },
    ScotsPine:       { smokeBase: 80.0 },
    TaurusCedar:     { smokeBase: 85.0 },
    SilverFir:       { smokeBase: 72.0 },
    OrientalSpruce:  { smokeBase: 72.0 },
    Oak:             { smokeBase: 80.0 },
    OrientalBeech:   { smokeBase: 72.0 },
    Alder:           { smokeBase: 72.0 },
    Shrubland:       { smokeBase: 60.0 },
    Juniper:         { smokeBase: 80.0 },
    Mixed:           { smokeBase: 90.0 },
  } as Record<string, SmokeAlarmThreshold>,

  HIGH_SPREAD_RISK: {
    RedPine:         { windBase: 7.0, tempMin: 30.0 },
    BlackPine:       { windBase: 7.0, tempMin: 27.0 },
    ScotsPine:       { windBase: 7.0, tempMin: 25.0 },
    TaurusCedar:     { windBase: 7.0, tempMin: 28.0 },
    SilverFir:       { windBase: 9.0, tempMin: 28.0 },
    OrientalSpruce:  { windBase: 10.0, tempMin: 28.0 },
    Oak:             { windBase: 9.0, tempMin: 30.0 },
    OrientalBeech:   { windBase: 10.0, tempMin: 32.0 },
    Alder:           { windBase: 11.0, tempMin: 33.0 },
    Shrubland:       { windBase: 6.0, tempMin: 28.0 },
    Juniper:         { windBase: 7.0, tempMin: 27.0 },
    Mixed:           { windBase: 8.0, tempMin: 28.0 },
  } as Record<string, SpreadRiskThreshold>,

  EARLY_FIRE_SIGNAL: {
    RedPine:         { co2Min: 800.0, smokeMin: 40.0 },
    BlackPine:       { co2Min: 850.0, smokeMin: 50.0 },
    ScotsPine:       { co2Min: 850.0, smokeMin: 50.0 },
    TaurusCedar:     { co2Min: 870.0, smokeMin: 55.0 },
    SilverFir:       { co2Min: 900.0, smokeMin: 65.0 },
    OrientalSpruce:  { co2Min: 950.0, smokeMin: 75.0 },
    Oak:             { co2Min: 900.0, smokeMin: 70.0 },
    OrientalBeech:   { co2Min: 950.0, smokeMin: 80.0 },
    Alder:           { co2Min: 1000.0, smokeMin: 85.0 },
    Shrubland:       { co2Min: 750.0, smokeMin: 30.0 },
    Juniper:         { co2Min: 880.0, smokeMin: 55.0 },
    Mixed:           { co2Min: 880.0, smokeMin: 60.0 },
  } as Record<string, EarlySignalThreshold>,
};

export const TOPOLOGY_THRESHOLDS: Record<string, TopologyThreshold> = {
  VALLEY_WIND_AMPLIFICATION:   { windMin: 6.0, tempMin: 25.0 },
  RIDGE_WIND_EXPOSURE:         { windMin: 8.0 },
  SLOPE_FIRE_SPREAD_CRITICAL:  { windMin: 5.0, tempMin: 30.0, humMax: 30.0 },
  SOUTH_WIND_SLOPE_HAZARD:     { windMin: 4.0, tempMin: 25.0, windDirMin: 134.0, windDirMax: 226.0 },
};
