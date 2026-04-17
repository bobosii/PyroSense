import { AlarmEntry, RiskLevel } from "../types";

const LEVEL_COLORS: Record<RiskLevel, string> = {
    LOW: "#22c55e",
    MODERATE: "#f59e0b",
    HIGH: "#f97316",
    EXTREME: "#ef4444",
};

const ZONE_LABELS: Record<string, string> = {
    zone_a: "Kuzey Çam",
    zone_b: "Güney Kayın",
    zone_c: "Doğu Karma",
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface Props {
    alarms: AlarmEntry[];
}

export default function AlarmList({ alarms }: Props) {
    const active = alarms.filter((a) => a.active);
    const closed = alarms.filter((a) => !a.active);

    return (
        <div className="alarm-list">
            <h2 className="alarm-list-title">Alarmlar</h2>

            {/* Aktif Alarmlar */}
            <div className="alarm-section">
                <div className="alarm-section-label">
                    AKTIF
                    {active.length > 0 && (
                        <span className="alarm-count">{active.length}</span>
                    )}
                </div>
                {active.length === 0 ? (
                    <div className="alarm-empty">Aktif alarm yok</div>
                ) : (
                    active.map((a) => (
                        <div key={a.id} className="alarm-entry active">
                            <div className="alarm-entry-top">
                                <span
                                    className="alarm-dot"
                                    style={{ background: LEVEL_COLORS[a.level] }}
                                />
                                <span className="alarm-zone">
                                    {ZONE_LABELS[a.zoneId] ?? a.zoneId}
                                </span>
                                <span
                                    className="alarm-level"
                                    style={{ color: LEVEL_COLORS[a.level] }}
                                >
                                    {a.level}
                                </span>
                                <span className="alarm-score">{a.score}</span>
                            </div>
                            <div className="alarm-entry-time">
                                Açıldı: {formatTime(a.openedAt)}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="alarm-section">
                <div className="alarm-section-label">SON KAPANANLAR</div>

                {closed.length === 0 ? (
                    <div className="alarm-empty">Henüz kapanan alarm yok</div>
                ) : (
                    closed.slice(0, 8).map((a) => (
                        <div key={a.id} className="alarm-entry closed">
                            <div className="alarm-entry-top">
                                <span className="alarm-dot closed-dot" />
                                <span className="alarm-zone">
                                    {ZONE_LABELS[a.zoneId] ?? a.zoneId}
                                </span>
                                <span className="alarm-level muted">{a.level}</span>
                            </div>
                            <div className="alarm-entry-time">
                                {formatTime(a.openedAt)}
                                {a.closedAt && ` -> ${formatTime(a.closedAt)}`}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
