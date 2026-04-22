import { RiskUpdate, RiskLevel } from "../types";

const LEVEL_META: Record<RiskLevel, { color: string; label: string; filled: boolean }> = {
    LOW:      { color: "#22c55e", label: "DÜŞÜK",  filled: false },
    MODERATE: { color: "#f59e0b", label: "ORTA",   filled: false },
    HIGH:     { color: "#f97316", label: "YÜKSEK", filled: true  },
    EXTREME:  { color: "#ef4444", label: "KRİTİK", filled: true  },
};

const FLAG_LABELS: Record<string, string> = {
    FLAME_DETECTED:             "🔥 Alev Tespiti",
    SMOKE_ALARM:                "💨 Duman Alarmı",
    HIGH_DROUGHT_RISK:          "🌵 Kurak Koşul",
    HIGH_SPREAD_RISK:           "💨 Yayılım Riski",
    EARLY_FIRE_SIGNAL:          "⚠️ Erken Sinyal",
    VALLEY_WIND_AMPLIFICATION:  "🌬️ Vadi Rüzgarı",
    RIDGE_WIND_EXPOSURE:        "🌬️ Sırt Açıklığı",
    SLOPE_FIRE_SPREAD_CRITICAL: "⛰️ Yamaç Kritik",
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
                    <span className="card-zone-name">{zone.label}</span>
                </div>
                <span className="card-waiting-text">Veri bekleniyor…</span>
            </div>
        );
    }

    const meta = LEVEL_META[update.level];
    const isExtreme = update.level === "EXTREME";
    const isHighOrExtreme = update.level === "HIGH" || update.level === "EXTREME";

    // Sensor değerleri risk rengiyle mi gösterilecek?
    const sensorColor = isHighOrExtreme ? meta.color : "#e2e8f0";

    return (
        <div
            className={`risk-card ${isExtreme ? "extreme" : ""}`}
            style={{ borderLeftColor: meta.color }}
        >
            {/* Header: zone name + level badge */}
            <div className="card-header">
                <span className="card-zone-name">{zone.label}</span>
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

            {/* Score row */}
            <div className="card-score-row">
                <span className="card-score-label">Risk Skoru</span>
                <span className="card-score-value" style={{ color: meta.color }}>
                    {update.score}/100
                </span>
            </div>

            {/* Sensor grid */}
            <div className="card-sensors">
                <div className="sensor-item">
                    <span className="sensor-label">Sıcaklık</span>
                    <span className="sensor-value" style={{ color: sensorColor }}>
                        {update.temperature.toFixed(1)}°C
                    </span>
                </div>
                <div className="sensor-item">
                    <span className="sensor-label">Nem</span>
                    <span className="sensor-value" style={{ color: sensorColor }}>
                        %{update.humidity.toFixed(0)}
                    </span>
                </div>
                <div className="sensor-item">
                    <span className="sensor-label">Duman</span>
                    <span className="sensor-value" style={{ color: sensorColor }}>
                        {update.smokePpm.toFixed(0)} ppm
                    </span>
                </div>
                <div className="sensor-item">
                    <span className="sensor-label">Rüzgar</span>
                    <span className="sensor-value" style={{ color: "#e2e8f0" }}>
                        {update.windSpeedMs.toFixed(1)} m/s
                    </span>
                </div>
            </div>

            {/* Active flags */}
            {update.flags.length > 0 && (
                <div className="card-flags">
                    {update.flags.map((f) => (
                        <span key={f} className="flag-tag">
                            {FLAG_LABELS[f] ?? f}
                        </span>
                    ))}
                </div>
            )}

            {/* Timestamp */}
            <div className="card-time">
                {new Date(update.timeStamp).toLocaleString("tr-TR")}
            </div>
        </div>
    );
}
