import { useState, useEffect, useCallback } from "react";
import { RiskUpdate, AlarmEntry, SensorDataPoint, ZoneUpdateMap } from "./types";
import RiskCard from "./components/RiskCard";
import ZoneMap from "./components/ZoneMap";
import AlarmList from "./components/AlarmList";
import SensorChart from "./components/SensorChart";
import ScenarioControl from "./components/ScenarioControl";
import { WeatherWidget } from "./components/WeatherWidget";
import ReasoningLog from "./components/ReasoningLog";

const WS_URL = "ws://localhost:3002";
const MAX_HISTORY = 20;

const ZONES = [
    {
        zoneId: "zone_a",
        label: "Düzlerçamı Kızılçam",
        shortLabel: "Z1 Düzlerçamı",
        lat: 36.97,
        lon: 30.53,
        topology: "slope",
        forestType: "RedPine",
    },
    {
        zoneId: "zone_b",
        label: "Güver Vadisi Meşeliği",
        shortLabel: "Z2 Güver Vadisi",
        lat: 37.01,
        lon: 30.51,
        topology: "valley",
        forestType: "Oak",
    },
    {
        zoneId: "zone_c",
        label: "Güllük Dağı Karma",
        shortLabel: "Z3 Güllük Dağı",
        lat: 37.03,
        lon: 30.47,
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
                setTimeout(connect, 3000);
            };

            ws.onmessage = (e) => {
                const data: RiskUpdate = JSON.parse(e.data);

                if (data.type !== "RISK_UPDATE") return;

                setZoneUpdates((prev) => ({ ...prev, [data.zoneId]: data }));

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
                    setAlarms((prev) => {
                        const alreadyActive = prev.some(
                            (a) => a.zoneId === data.zoneId && a.active,
                        );
                        if (alreadyActive) {
                            return prev;
                        }
                        return [entry, ...prev].slice(0, 20);
                    });
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

    useEffect(() => {
        fetch("/api/active-alarms")
            .then((r) => r.json())
            .then((rows: any[]) => {
                const loaded: AlarmEntry[] = rows.map((r) => ({
                    id: `pg-${r.zoneId}-${r.created_at}`,
                    zoneId: r.zone_id,
                    level: r.level,
                    score: 0,
                    openedAt: r.created_at,
                    active: true,
                }));
                setAlarms(loaded);
            })
            .catch(console.error);
    }, []);

    const handleScenario = useCallback(async (zoneId: string, scenario: string) => {
        await fetch("/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario, zone_id: zoneId }),
        });
    }, []);

    const activeZoneObj = ZONES.find((z) => z.zoneId === activeZone);

    return (
        <div className="app">
            {/* ── Header ── */}
            <header className="header">
                <div className="header-brand">
                    <div className="header-brand-top">
                        <span style={{ fontSize: 20 }}>🔥</span>
                        <span className="header-logo-text">PyroSense</span>
                        <div className={`header-live ${connected ? "" : "offline"}`}>
                            <span
                                className={`header-live-dot ${connected ? "" : "offline"} pulse-live`}
                            />
                            {connected ? "CANLI" : "BAĞLANTI YOK"}
                        </div>
                    </div>
                    <span className="header-tagline">
                        Orman Yangını Erken Uyarı Sistemi
                    </span>
                </div>

                <nav className="header-nav">
                    <a href="#" className="active">
                        Dashboard
                    </a>
                    <a href="#">Harita</a>
                    <a href="#">Analitik</a>
                    <a href="#">Kaynaklar</a>
                </nav>

                <div className="header-actions">
                    <button className="btn-deploy">Ekip Konuşlandır</button>
                    <span
                        className="material-symbols-outlined header-icon"
                        style={{ fontVariationSettings: "'FILL' 0" }}
                    >
                        notifications_active
                    </span>
                    <span
                        className="material-symbols-outlined header-icon"
                        style={{ fontVariationSettings: "'FILL' 0" }}
                    >
                        settings
                    </span>
                </div>
            </header>

            {/* ── Main 3-Column Grid ── */}
            <div className="main-grid">
                <aside className="sidebar">
                    {ZONES.map((z) => (
                        <RiskCard
                            key={z.zoneId}
                            zone={z}
                            update={zoneUpdates[z.zoneId]}
                        />
                    ))}
                    <WeatherWidget />
                </aside>

                <section className="center-col">
                    <ZoneMap zones={ZONES} updates={zoneUpdates} />
                    <ScenarioControl zones={ZONES} onScenarioChange={handleScenario} />
                </section>

                <aside className="alarm-col">
                    <AlarmList alarms={alarms} />
                    <ReasoningLog zoneUpdates={zoneUpdates} zones={ZONES} />
                </aside>
            </div>

            {/* ── Fixed Bottom: Sensor Charts ── */}
            <section className="chart-section">
                <div className="chart-tabs">
                    {ZONES.map((z) => (
                        <button
                            key={z.zoneId}
                            className={`tab ${activeZone === z.zoneId ? "active" : ""}`}
                            onClick={() => setActiveZone(z.zoneId)}
                        >
                            {z.shortLabel}
                        </button>
                    ))}
                    <span className="chart-label">
                        SENSOR GRAFİKLERİ &nbsp;•&nbsp; SON {MAX_HISTORY} KAYIT
                    </span>
                </div>
                <div className="chart-content">
                    <SensorChart
                        data={history[activeZone] ?? []}
                        zoneId={activeZoneObj?.shortLabel ?? activeZone}
                    />
                </div>
            </section>
        </div>
    );
}
