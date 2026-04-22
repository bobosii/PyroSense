import { useState } from "react";
import { ScenarioName } from "../types";

const SCENARIOS: { value: ScenarioName; label: string }[] = [
    { value: "normal",      label: "Normal İzleme"    },
    { value: "prefire",     label: "Yangın Öncesi"    },
    { value: "activefire",  label: "Aktif Yangın"     },
    { value: "sensorFault", label: "Sensör Arızası"   },
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
    const [selected, setSelected] = useState<Record<string, ScenarioName>>(() =>
        Object.fromEntries(zones.map((z) => [z.zoneId, "normal"])),
    );
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const handleChange = async (zoneId: string, scenario: ScenarioName) => {
        setSelected((prev) => ({ ...prev, [zoneId]: scenario }));
    };

    const handleApply = async (zoneId: string) => {
        setLoading((prev) => ({ ...prev, [zoneId]: true }));
        try {
            await onScenarioChange(zoneId, selected[zoneId]);
        } catch (err: unknown) {
            console.error(err);
        }
        setLoading((prev) => ({ ...prev, [zoneId]: false }));
    };

    return (
        <div className="scenario-control">
            <h3 className="scenario-title">Senaryo Kontrolü</h3>

            <div className="scenario-grid">
                {zones.map((z) => (
                    <div key={z.zoneId} className="scenario-col">
                        <span className="scenario-zone-label">{z.label}</span>

                        <select
                            value={selected[z.zoneId]}
                            disabled={loading[z.zoneId]}
                            onChange={(e) =>
                                handleChange(z.zoneId, e.target.value as ScenarioName)
                            }
                        >
                            {SCENARIOS.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>

                        <button
                            className="btn-scenario"
                            disabled={loading[z.zoneId]}
                            onClick={() => handleApply(z.zoneId)}
                        >
                            {loading[z.zoneId] ? (
                                <>Uygulanıyor <span className="scenario-spinner">↻</span></>
                            ) : (
                                "Uygula"
                            )}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
