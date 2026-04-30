import { RiskUpdate, ReasoningEntry, RiskLevel } from "../types";

const LEVEL_COLORS: Record<RiskLevel, string> = {
    LOW: "#22c55e",
    MODERATE: "#f59e0b",
    HIGH: "#f97316",
    EXTREME: "#ef4444",
};

const WEIGHT_COLOR = (w: number): string => {
    return w >= 50 ? "#ef4444" : w >= 25 ? "#f97316" : w >= 15 ? "#f59e0b" : "#64748b";
};
interface Props {
    zoneUpdates: Record<string, RiskUpdate>;
    zones: { zoneId: string; shortLabel: string }[];
}

export default function ReasoningLog({ zoneUpdates, zones }: Props) {
    const entries: (ReasoningEntry & {
        zoneId: string;
        level: RiskLevel;
        time: string;
    })[] = [];

    for (const zone of zones) {
        const update = zoneUpdates[zone.zoneId];
        if (!update || update.reasoningLog.length === 0) {
            continue;
        }
        for (const entry of update.reasoningLog) {
            entries.push({
                ...entry,
                zoneId: zone.zoneId,
                level: update.level,
                time: new Date(update.timeStamp).toLocaleString("tr-TR"),
            });
        }
    }

    entries.sort((a, b) => b.weight - a.weight);

    return (
        <div className="reasoning-log">
            <div className="reasoning-header">
                <span className="reasoning-title">AKIL YURUTME</span>
                <span className="reasoning-count">{entries.length} kural</span>
            </div>

            <div className="reasoning-body">
                {entries.length === 0 ? (
                    <div className="reasoning-empty">Aktif kural yok</div>
                ) : (
                    entries.map((e, i) => (
                        <div key={i} className="reasoning-entry">
                            <div className="reasoning-entry-top">
                                <span
                                    className="reasoning-rule"
                                    style={{ color: LEVEL_COLORS[e.level] }}
                                >
                                    {e.label}
                                </span>
                                <span
                                    className="reasoning-weight"
                                    style={{ color: WEIGHT_COLOR(e.weight) }}
                                >
                                    +{e.weight}
                                </span>
                            </div>
                            <div className="reasoning-condition">{e.condition}</div>
                            <div className="reasoning-zone-time">
                                {zones.find((z) => z.zoneId === e.zoneId)?.shortLabel ??
                                    e.zoneId}{" "}
                                • {e.time}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
