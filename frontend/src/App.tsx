import { useState, useEffect, useCallback } from "react";
import { RiskUpdate, AlarmEntry, SensorDataPoint, ZoneUpdateMap } from "./types";
import RiskCard from "./components/RiskCard";
import ZoneMap from "./components/ZoneMap";
import AlarmList from "./components/AlarmList";
import SensorChart from "./components/SensorChart";
import ScenarioControl from "./components/ScenarioControl";
import { Label } from "recharts";

const WS_URL = "ws://localhost:3002";
const MAX_HISTORY = 20;

const ZONES = [
    {
        zoneId: "zone_a",
        label: "Düzlerçamı Kızılçam",
        lat: 36.970,
        lon: 30.530,
        topology: "slope",
        forestType: "RedPine",
    },
    {
        zoneId: "zone_b",
        label: "Güver Vadisi Meşeliği",
        lat: 37.010,
        lon: 30.510,
        topology: "valley",
        forestType: "Oak",
    },
    {
        zoneId: "zone_c",
        label: "Güllük Dağı Karma",
        lat: 37.030,
        lon: 30.470,
        topology: "ridge",
        forestType: "Mixed",
    },
];

export default function App() {
    const [connected, setConnected] = useState(false);
    const [zoneUpdates, setZoneUpdates] = useState<ZoneUpdateMap>({});
    const [alarms, setAlarms] = useState<AlarmEntry[]>([]);
    const [history, setHistory] = useState<Record<string, SensorDataPoint[]>>({});
    const [activeZone, setActiveZone] = useState("zone_a");

    useEffect(() => {
        let ws: WebSocket;

        const connect = () => {
            ws = new WebSocket(WS_URL);

            ws.onopen = () => setConnected(true);
            ws.onclose = () => {
                setConnected(false);
                setTimeout(connect, 3000); // 3 saniye sonra tekrardan baglan
            };

            ws.onmessage = (e) => {
                const data: RiskUpdate = JSON.parse(e.data);

                if (data.type !== "RISK_UPDATE") {
                    return;
                }

                // Zone'un son durumunu guncelle
                setZoneUpdates((prev) => ({ ...prev, [data.zoneId]: data }));
                // Grafik icin sensor gecmisini guncelle
                setHistory((prev) => {
                    const zoneHist = prev[data.zoneId] ?? [];
                    const point: SensorDataPoint = {
                        time: new Date(data.timeStamp).toLocaleString("tr-TR"),
                        temperature: data.temperature,
                        humidity: data.humidity,
                        smokePpm: data.smokePpm,
                        windSpeedMs: data.windSpeedMs,
                    };
                    return {
                        ...prev,
                        [data.zoneId]: [...zoneHist, point].slice(-MAX_HISTORY),
                    };
                });
                if (data.alarm.justOpened) {
                    const entry: AlarmEntry = {
                        id: `${data.zoneId}-${Date.now()}`,
                        zoneId: data.zoneId,
                        level: data.level,
                        score: data.score,
                        openedAt: data.timeStamp,
                        active: true,
                    };
                    setAlarms((prev) => [entry, ...prev].slice(0, 20));
                }

                if (data.alarm.justClosed) {
                    setAlarms((prev) =>
                        prev.map((a) =>
                            a.zoneId === data.zoneId && a.active
                                ? { ...a, active: false, closedAt: data.timeStamp }
                                : a,
                        ),
                    );
                }
            };
        };
        connect();
        return () => ws?.close();
    }, []);
    // Senaryo degistir - SimulatorAPI'ye Post at
    const handleScenario = useCallback(async (zoneId: string, scenario: string) => {
        await fetch("/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario, zone_id: zoneId }),
        });
    }, []);
    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <span className="logo">🔥 PyroSense</span>
                <span className={`conn-status ${connected ? "online" : "offline"}`}>
                    {connected ? "CANLI" : "BAĞLANTI YOK"}
                </span>
                <span className="tagline">Orman Yangını Erken Uyarı Sistemi</span>
            </header>

            {/* Ana grid: sol + orta + sag */}
            <div className="main-grid">
                <aside className="sidebar">
                    {" "}
                    {ZONES.map((z) => (
                        <RiskCard
                            key={z.zoneId}
                            zone={z}
                            update={zoneUpdates[z.zoneId]}
                        />
                    ))}
                </aside>
                <section className="center-col">
                    <ZoneMap zones={ZONES} updates={zoneUpdates} />
                    <ScenarioControl zones={ZONES} onScenarioChange={handleScenario} />
                </section>

                <aside className="alarm-col">
                    <AlarmList alarms={alarms} />
                </aside>
            </div>

            {/* Alt Bolum: Sensor grafikleri */}
            <section className="chart-section">
                <div className="chart-tabs">
                    {ZONES.map((z) => (
                        <button
                            key={z.zoneId}
                            className={`tab ${activeZone === z.zoneId ? "active" : ""}`}
                        >
                            {z.label}
                        </button>
                    ))}
                </div>
                <SensorChart data={history[activeZone] ?? []} zoneId={activeZone} />
            </section>
        </div>
    );
}
