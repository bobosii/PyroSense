import { RiskUpdate, RiskLevel } from "../types";

const LEVEL_META: Record<RiskLevel, { color: string; label: string; filled: boolean }> = {
    LOW:      { color: "#34D399", label: "DÜŞÜK",  filled: false },
    MODERATE: { color: "#FBBF24", label: "ORTA",   filled: false },
    HIGH:     { color: "#FB923C", label: "YÜKSEK", filled: true  },
    EXTREME:  { color: "#F43F5E", label: "KRİTİK", filled: true  },
};

const FLAG_LABELS: Record<string, string> = {
    FLAME_DETECTED:            "ALEV",
    SMOKE_ALARM:               "DUMAN",
    HIGH_DROUGHT_RISK:         "KURAK",
    HIGH_SPREAD_RISK:          "YAYILIM",
    EARLY_FIRE_SIGNAL:         "ERKEN SİNYAL",
    VALLEY_WIND_AMPLIFICATION: "VADİ RÜZGAR",
    RIDGE_WIND_EXPOSURE:       "SIRT AÇIK",
    SLOPE_FIRE_SPREAD_CRITICAL:"YAMAÇ KRİTİK",
    DOWNWIND_SPREAD_THREAT:    "RÜZGAR ALT",
};

const FLAG_COLORS: Record<string, string> = {
    FLAME_DETECTED:            "#F43F5E",
    SMOKE_ALARM:               "#FB923C",
    EARLY_FIRE_SIGNAL:         "#FBBF24",
    HIGH_DROUGHT_RISK:         "#FBBF24",
    HIGH_SPREAD_RISK:          "#FB923C",
    DOWNWIND_SPREAD_THREAT:    "#38BDF8",
    VALLEY_WIND_AMPLIFICATION: "#94A3B8",
    RIDGE_WIND_EXPOSURE:       "#94A3B8",
    SLOPE_FIRE_SPREAD_CRITICAL:"#FB923C",
};

interface Props {
    zone: { zoneId: string; label: string };
    update?: RiskUpdate;
}

export default function RiskCard({ zone, update }: Props) {
    if (!update) {
        return (
            <div className="risk-card waiting">
                <div className="card-header">
                    <span className="card-zone-name">{zone.label.split(" — ")[0]}</span>
                </div>
                <span className="card-waiting-text">— bekleniyor</span>
            </div>
        );
    }

    const meta = LEVEL_META[update.level];
    const isExtreme = update.level === "EXTREME";
    const isHighOrExtreme = update.level === "HIGH" || update.level === "EXTREME";
    const sensorColor = isHighOrExtreme ? meta.color : undefined;

    // Short zone name (before —)
    const shortName = zone.label.split(" — ")[0];

    return (
        <div
            className={`risk-card ${isExtreme ? "extreme" : ""}`}
            style={{ borderLeftColor: meta.color }}
        >
            {/* Header */}
            <div className="card-header">
                <span className="card-zone-name">{shortName}</span>
                <span
                    className={`level-badge ${meta.filled ? "filled" : "outlined"} ${isExtreme ? "pulse" : ""}`}
                    style={
                        meta.filled
                            ? { backgroundColor: meta.color }
                            : { color: meta.color, borderColor: meta.color }
                    }
                >
                    {meta.label}
                </span>
            </div>

            {/* Score + bar */}
            <div className="card-score-row">
                <div className="card-score-top">
                    <span className="card-score-label">Risk Skoru</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                        <span className="card-score-value" style={{ color: meta.color }}>
                            {update.score}
                        </span>
                        <span className="card-score-max">/100</span>
                    </div>
                </div>
                <div className="score-bar-track">
                    <div
                        className="score-bar-fill"
                        style={{
                            width: `${update.score}%`,
                            background: meta.color,
                            opacity: 0.85,
                        }}
                    />
                </div>
            </div>

            {/* Sensors 2×2 */}
            <div className="card-sensors">
                <div className="sensor-item">
                    <span className="sensor-label">Sıcaklık</span>
                    <span className="sensor-value" style={sensorColor ? { color: sensorColor } : {}}>
                        {update.temperature.toFixed(1)}°C
                    </span>
                </div>
                <div className="sensor-item">
                    <span className="sensor-label">Nem</span>
                    <span className="sensor-value" style={sensorColor ? { color: sensorColor } : {}}>
                        %{update.humidity.toFixed(0)}
                    </span>
                </div>
                <div className="sensor-item">
                    <span className="sensor-label">Duman</span>
                    <span className="sensor-value" style={sensorColor ? { color: sensorColor } : {}}>
                        {update.smokePpm.toFixed(0)} ppm
                    </span>
                </div>
                <div className="sensor-item">
                    <span className="sensor-label">Rüzgar</span>
                    <span className="sensor-value">
                        {update.windSpeedMs.toFixed(1)} m/s
                    </span>
                </div>
            </div>

            {/* Flags */}
            {update.flags.length > 0 && (
                <div className="card-flags">
                    {update.flags.map((f) => (
                        <span
                            key={f}
                            className="flag-tag"
                            style={{
                                color: FLAG_COLORS[f] ?? "#94A3B8",
                                borderColor: `${FLAG_COLORS[f] ?? "#2E3D5C"}40`,
                                background: `${FLAG_COLORS[f] ?? "#94A3B8"}08`,
                            }}
                        >
                            {FLAG_LABELS[f] ?? f}
                        </span>
                    ))}
                </div>
            )}

            {/* Timestamp */}
            <div className="card-time">
                {new Date(update.timeStamp).toLocaleTimeString("tr-TR")}
            </div>
        </div>
    );
}
