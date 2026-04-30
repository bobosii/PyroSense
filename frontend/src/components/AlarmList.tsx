import { AlarmEntry, RiskLevel } from "../types";

const LEVEL_COLORS: Record<RiskLevel, string> = {
    LOW: "#22c55e",
    MODERATE: "#f59e0b",
    HIGH: "#f97316",
    EXTREME: "#ef4444",
};

const ZONE_LABELS: Record<string, string> = {
    zone_redpine: "Kızılçam — Muğla",
    zone_blackpine: "Karaçam — Kastamonu",
    zone_scotspine: "Sarıçam — Sarıkamış",
    zone_tauruscedar: "Toros Sediri",
    zone_silverfir: "Göknar — Bolu",
    zone_orientalspruce: "D.Ladini — Rize",
    zone_oak: "Meşe — Kızılcahamam",
    zone_orientalbeech: "D.Kayını — Karabük",
    zone_alder: "Kızılağaç — Göksu",
    zone_shrubland: "Maki — Antalya",
    zone_juniper: "Ardıç — Beyşehir",
    zone_mixed: "Karma — Belgrad",
};

const LEVEL_TR: Record<RiskLevel, string> = {
    LOW: "Düşük",
    MODERATE: "Orta",
    HIGH: "Yüksek",
    EXTREME: "Kritik",
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
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
            {/* Header */}
            <div className="alarm-list-header">
                <span className="alarm-list-title">Alarmlar</span>
            </div>

            <div className="alarm-body">
                {/* Active alarms */}
                <div className="alarm-section">
                    <div className="alarm-section-label active-label">
                        <span className="alarm-active-dot pulse-live" />
                        AKTİF
                        {active.length > 0 && (
                            <span className="alarm-count">{active.length}</span>
                        )}
                    </div>

                    {active.length === 0 ? (
                        <div className="alarm-empty">Aktif alarm yok</div>
                    ) : (
                        active.map((a) => {
                            const color = LEVEL_COLORS[a.level];
                            return (
                                <div
                                    key={a.id}
                                    className="alarm-entry"
                                    style={{ borderColor: `${color}40` }}
                                >
                                    <div className="alarm-entry-top">
                                        <span className="alarm-entry-id">
                                            {ZONE_LABELS[a.zoneId] ?? a.zoneId}
                                        </span>
                                        <span className="alarm-entry-time-badge">
                                            {formatTime(a.openedAt)}
                                        </span>
                                    </div>
                                    <span className="alarm-entry-desc" style={{ color }}>
                                        {LEVEL_TR[a.level]} Risk — Skor {a.score}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Closed alarms */}
                <div className="alarm-section">
                    <div className="alarm-section-label closed-label">SON KAPANANLAR</div>

                    {closed.length === 0 ? (
                        <div className="alarm-empty">Henüz kapanan alarm yok</div>
                    ) : (
                        closed.slice(0, 8).map((a) => (
                            <div key={a.id} className="alarm-entry closed">
                                <span className="alarm-entry-id">
                                    {ZONE_LABELS[a.zoneId] ?? a.zoneId}
                                    {" — "}
                                    {formatTime(a.openedAt)}
                                    {a.closedAt && ` › ${formatTime(a.closedAt)}`}
                                </span>
                                <span className="resolved-badge">ÇÖZÜLDÜ</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
