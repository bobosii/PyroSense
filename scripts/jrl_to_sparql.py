#!/usr/bin/env python3
"""
jrl_to_sparql.py
================
pyrosense-rules.jrl dosyasını parse eder ve
backend/src/generated/ruleThresholds.ts dosyasını üretir.

Kullanım:
    python3 scripts/jrl_to_sparql.py

.jrl değiştiğinde bu scripti çalıştır. Üretilen dosyayı
manuel düzenleme — değişiklikler bir sonraki codegen'de ezilir.
"""

import re
import sys
from pathlib import Path

ROOT        = Path(__file__).parent.parent
JRL_PATH    = ROOT / "ontology" / "pyrosense-rules.jrl"
OUTPUT_DIR  = ROOT / "backend" / "src" / "generated"
OUTPUT_PATH = OUTPUT_DIR / "ruleThresholds.ts"


# ── Yardımcı parse fonksiyonları ──────────────────────────────────────────────

def extract_rule_blocks(content):
    pattern = re.compile(r'\[(\w+):(.*?)\]', re.DOTALL)
    return [(m.group(1), m.group(2)) for m in pattern.finditer(content)]

def get_flag(body):
    m = re.search(r'riskFlag["\s>]+([A-Z_]+)"', body)
    return m.group(1) if m else None

def get_forest_type(body):
    m = re.search(r'forestType["\s>]+"(\w+)"', body)
    return m.group(1) if m else None

def get_topology(body):
    m = re.search(r'topology["\s>]+"(\w+)"', body)
    return m.group(1) if m else None

def get_product_base(body):
    m = re.search(r'product\(([\d.]+),\s*\?mult', body)
    return float(m.group(1)) if m else None

def get_greater(body, var):
    m = re.search(rf'greaterThan\(\?{var},\s*([\d.]+)\)', body)
    return float(m.group(1)) if m else None

def get_less(body, var):
    m = re.search(rf'lessThan\(\?{var},\s*([\d.]+)\)', body)
    return float(m.group(1)) if m else None


# ── Ana parse ─────────────────────────────────────────────────────────────────

def parse(jrl_content):
    blocks = extract_rule_blocks(jrl_content)

    drought_risk   = {}
    smoke_alarm    = {}
    spread_risk    = {}
    early_signal   = {}
    topology_rules = {}

    for name, body in blocks:
        if name.startswith("DroughtMult_"):
            continue

        flag = get_flag(body)
        if not flag:
            continue

        ft   = get_forest_type(body)
        topo = get_topology(body)

        if ft:
            if flag == "HIGH_DROUGHT_RISK":
                base = get_product_base(body)
                hum  = get_less(body, "hum")
                if base and hum:
                    drought_risk[ft] = {"tempBase": base, "humMax": hum}

            elif flag == "SMOKE_ALARM":
                base = get_product_base(body)
                if base:
                    smoke_alarm[ft] = {"smokeBase": base}

            elif flag == "HIGH_SPREAD_RISK":
                base     = get_product_base(body)
                temp_min = get_greater(body, "temp")
                if base and temp_min:
                    spread_risk[ft] = {"windBase": base, "tempMin": temp_min}

            elif flag == "EARLY_FIRE_SIGNAL":
                co2   = get_greater(body, "co2")
                smoke = get_greater(body, "smoke")
                if co2 and smoke:
                    early_signal[ft] = {"co2Min": co2, "smokeMin": smoke}

        elif topo:
            entry = {}
            wind    = get_greater(body, "wind")
            temp    = get_greater(body, "temp")
            hum     = get_less(body, "hum")
            dir_min = get_greater(body, "windDir")
            dir_max = get_less(body, "windDir")
            if wind:    entry["windMin"]    = wind
            if temp:    entry["tempMin"]    = temp
            if hum:     entry["humMax"]     = hum
            if dir_min: entry["windDirMin"] = dir_min
            if dir_max: entry["windDirMax"] = dir_max
            topology_rules[flag] = entry

    return {
        "HIGH_DROUGHT_RISK": drought_risk,
        "SMOKE_ALARM":       smoke_alarm,
        "HIGH_SPREAD_RISK":  spread_risk,
        "EARLY_FIRE_SIGNAL": early_signal,
    }, topology_rules


# ── TypeScript üret ───────────────────────────────────────────────────────────

def build_forest_block(thresholds):
    lines = []
    for ft, vals in thresholds.items():
        kv = ", ".join(f"{k}: {v}" for k, v in vals.items())
        pad = " " * max(1, 16 - len(ft))
        lines.append(f"    {ft}:{pad}{{ {kv} }},")
    return "\n".join(lines)

def build_topo_block(topo_rules):
    lines = []
    for flag, vals in topo_rules.items():
        kv = ", ".join(f"{k}: {v}" for k, v in vals.items())
        pad = " " * max(1, 28 - len(flag))
        lines.append(f"  {flag}:{pad}{{ {kv} }},")
    return "\n".join(lines)

def generate_ts(forest_rules, topo_rules, jrl_path):
    dr  = build_forest_block(forest_rules["HIGH_DROUGHT_RISK"])
    sa  = build_forest_block(forest_rules["SMOKE_ALARM"])
    sr  = build_forest_block(forest_rules["HIGH_SPREAD_RISK"])
    es  = build_forest_block(forest_rules["EARLY_FIRE_SIGNAL"])
    tp  = build_topo_block(topo_rules)

    return (
        "// ============================================================\n"
        "// AUTO-GENERATED — DO NOT EDIT MANUALLY\n"
        f"// Source: {jrl_path}\n"
        "// Regenerate: npm run codegen  (python3 scripts/jrl_to_sparql.py)\n"
        "//\n"
        "// Bu dosya pyrosense-rules.jrl'deki esik degerlerini TypeScript'e\n"
        "// INSERT sorgu olusturur. .jrl degistiginde npm run codegen calistir.\n"
        "// ============================================================\n"
        "\n"
        "export interface DroughtRiskThreshold { tempBase: number; humMax: number }\n"
        "export interface SmokeAlarmThreshold  { smokeBase: number }\n"
        "export interface SpreadRiskThreshold  { windBase: number; tempMin: number }\n"
        "export interface EarlySignalThreshold { co2Min: number; smokeMin: number }\n"
        "export interface TopologyThreshold    { windMin?: number; tempMin?: number; humMax?: number; windDirMin?: number; windDirMax?: number }\n"
        "\n"
        "export const JRL_THRESHOLDS = {\n"
        "  HIGH_DROUGHT_RISK: {\n"
        f"{dr}\n"
        "  } as Record<string, DroughtRiskThreshold>,\n"
        "\n"
        "  SMOKE_ALARM: {\n"
        f"{sa}\n"
        "  } as Record<string, SmokeAlarmThreshold>,\n"
        "\n"
        "  HIGH_SPREAD_RISK: {\n"
        f"{sr}\n"
        "  } as Record<string, SpreadRiskThreshold>,\n"
        "\n"
        "  EARLY_FIRE_SIGNAL: {\n"
        f"{es}\n"
        "  } as Record<string, EarlySignalThreshold>,\n"
        "};\n"
        "\n"
        "export const TOPOLOGY_THRESHOLDS: Record<string, TopologyThreshold> = {\n"
        f"{tp}\n"
        "};\n"
    )


# ── Ana akış ─────────────────────────────────────────────────────────────────

def main():
    if not JRL_PATH.exists():
        print(f"HATA: {JRL_PATH} bulunamadi", file=sys.stderr)
        sys.exit(1)

    content = JRL_PATH.read_text(encoding="utf-8")
    forest_rules, topo_rules = parse(content)

    for flag, thresholds in forest_rules.items():
        if len(thresholds) != 12:
            print(f"UYARI: {flag} -> {len(thresholds)} orman tipi (beklenen 12)", file=sys.stderr)

    ts_code = generate_ts(forest_rules, topo_rules, str(JRL_PATH.relative_to(ROOT)))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(ts_code, encoding="utf-8")

    print(f"OK  {OUTPUT_PATH.relative_to(ROOT)} guncellendi")
    for flag, thresholds in forest_rules.items():
        print(f"    {flag}: {len(thresholds)} orman tipi")
    print(f"    Topoloji: {list(topo_rules.keys())}")


if __name__ == "__main__":
    main()
