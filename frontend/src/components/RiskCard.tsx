import { RiskUpdate, RiskLevel } from "../types";

// Her level için renk ve Türkçe karşılık
const LEVEL_META: Record<RiskLevel, { color: string; label: string }> = {
    LOW: { color: "#22c55e", label: "DÜŞÜK" },
    MODERATE: { color: "#f59e0b", label: "ORTA" },
    HIGH: { color: "#f97316", label: "YÜKSEK" },
    EXTREME: { color: "#ef4444", label: "KRİTİK" },
};

const FLAG_LABELS: Record<string, string> = {
    FLAME_DETECTED: "🔥 Alev Tespiti",
    SMOKE_ALARM: "💨 Duman Alarmı",
    HIGH_DROUGHT_RISK: "🌵 Kurak Koşul",
    HIGH_SPREAD_RISK: "💨 Yayılım Riski",
    EARLY_FIRE_SIGNAL: "⚠️ Erken Sinyal",
    VALLEY_WIND_AMPLIFICATION: "🌬️ Vadi Rüzgarı",
    RIDGE_WIND_EXPOSURE: "🌬️ Sırt Açıklığı",
    SLOPE_FIRE_SPREAD_CRITICAL: "⛰️ Yamaç Kritik",
};

interface Props {
    zone: { zoneId: string; label: string };
    update?: RiskUpdate;
}

export default function RiskCard({ zone, update }: Props) {
    // Henuz veri gelmemisse bekleme ekranini goster.
    if (!update) {
        return (
            <div className="risk-card waiting">
                <div className="card-zone-id">{zone.zoneId.toUpperCase()}</div>
                <div className="card-label">{zone.label}</div>
                <div className="card-waiting">Veri bekleniyor..</div>
            </div>
        );
    }

    const meta = LEVEL_META[update.level];

    return (
        <div className="risk-card" style={{ borderLeftColor: meta.color }}>
            <div className="card-header">
                <span className="card-zone-id">{zone.zoneId.toUpperCase()}</span>
                {update.alarm.active && <span className="alarm-badge">ALARM !</span>}
            </div>
            <div className="card-label">{zone.label}</div>

            {/* Sensor degerleri*/}
            <div className="card-sensors">
                <span>{update.temperature.toFixed(1)}</span>
                <span>{update.humidity.toFixed(0)}</span>
                <span>{update.smokePpm.toFixed(0)}ppm</span>
                <span>{update.windSpeedMs.toFixed(1)} m/s</span>
            </div>

            {/* Aktif Flagler */}
            {update.flags.length > 0 && (
                <div className="card-flags">
                    {update.flags.map((f) => (
                        <span key={f} className="flag">
                            {FLAG_LABELS[f] ?? f}
                        </span>
                    ))}
                </div>
            )}

            {/* Son Guncelleme Zamani */}
            <div className="card-time">
                {new Date(update.timeStamp).toLocaleString("tr-TR")}
            </div>
        </div>
    );
}
