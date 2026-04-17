import { useState } from "react";
import { ScenarioName } from "../types";

const SCENARIOS: { value: ScenarioName; label: string; color: string }[] = [
    { value: "normal", label: "🟢 Normal", color: "#22c55e" },
    { value: "prefire", label: "🟡 Yangın Öncesi", color: "#f59e0b" },
    { value: "activefire", label: "🔴 Aktif Yangın", color: "#ef4444" },
    { value: "sensorFault", label: "⚪ Sensör Arızası", color: "#94a3b8" },
];

interface ZoneInfo {
    zoneId: string;
    label: string;
}

interface Props {
    zones: ZoneInfo[];
    onScenarioChange: (zoneId: string, scenario: string) => Promise<void>;
}

export default function ScenarioControl({ zones, onScenarioChange }: Props) {
    // Her zone icin secili senaryo -> Default olarak hepsi normal senaryoda
    const [selected, setSelected] = useState<Record<string, ScenarioName>>(() =>
        Object.fromEntries(zones.map((z) => [z.zoneId, "normal"])),
    );

    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const handleChange = async (zoneId: string, scenario: ScenarioName) => {
        setSelected((prev) => ({ ...prev, [zoneId]: scenario }));
        setLoading((prev) => ({ ...prev, [zoneId]: true }));

        try {
            await onScenarioChange(zoneId, scenario);
        } catch (err: any) {
            console.error(err);
        }
        setLoading((prev) => ({ ...prev, [zoneId]: false }));
    };

    return (
        <div className="scenario-control">
            <h3 className="scenario-title">Senaryo Kontrolü</h3>

            <div className="scenario-rows">
                {zones.map((z) => {
                    const current = SCENARIOS.find((s) => s.value === selected[z.zoneId]);
                    return (
                        <div key={z.zoneId} className="scenario-row">
                            <span className="scenario-zone-label">
                                {z.zoneId.toUpperCase()}
                            </span>

                            <select
                                value={selected[z.zoneId]}
                                disabled={loading[z.zoneId]}
                                onChange={(e) =>
                                    handleChange(z.zoneId, e.target.value as ScenarioName)
                                }
                                style={{ borderColor: current?.color }}
                            >
                                {SCENARIOS.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>

                            {loading.zoneId && (
                                <span className="scenario-loading">↻</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
