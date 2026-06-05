import { RiskUpdate, ReasoningEntry, RiskLevel } from "../types";

const LEVEL_COLORS: Record<RiskLevel, string> = {
    LOW:      "#34D399",
    MODERATE: "#FBBF24",
    HIGH:     "#FB923C",
    EXTREME:  "#F43F5E",
};

const WEIGHT_COLOR = (w: number): string => {
    if (w >= 60) return "#F43F5E";
    if (w >= 30) return "#FB923C";
    if (w >= 20) return "#FBBF24";
    return "#4A5878";
};

const RULE_BORDER = (w: number): string => {
    if (w >= 60) return "#F43F5E";
    if (w >= 30) return "#FB923C";
    if (w >= 20) return "#FBBF24";
    return "#1C2236";
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
        if (!update || update.reasoningLog.length === 0) continue;
        for (const entry of update.reasoningLog) {
            entries.push({
                ...entry,
                zoneId: zone.zoneId,
                level: update.level,
                time: new Date(update.timeStamp).toLocaleTimeString("tr-TR"),
            });
        }
    }

    entries.sort((a, b) => b.weight - a.weight);

    return (
        <div className="reasoning-log">
            <div className="reasoning-header">
                <span className="reasoning-title">Akıl Yürütme</span>
                <span className="reasoning-count">{entries.length} kural</span>
            </div>

            <div className="reasoning-body">
                {entries.length === 0 ? (
                    <div className="reasoning-empty">Aktif kural yok</div>
                ) : (
                    entries.map((e, i) => (
                        <div
                            key={i}
                            className="reasoning-entry"
                            style={{ borderLeftColor: RULE_BORDER(e.weight) }}
                        >
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
                                {zones.find((z) => z.zoneId === e.zoneId)?.shortLabel ?? e.zoneId}
                                {" · "}
                                {e.time}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
