import { useState, useEffect, useCallback } from "react";
import { RiskUpdate, AlarmEntry, SensorDataPoint, ZoneUpdateMap } from "./types";
import RiskCard from "./components/RiskCard";
import ZoneMap from "./components/ZoneMap";
import AlarmList from "./components/AlarmList";
import SensorChart from "./components/SensorChart";
import ScenarioControl from "./components/ScenarioControl";
import { WeatherWidget } from "./components/WeatherWidget";
import ReasoningLog from "./components/ReasoningLog";
import AnalyticsPage from "./components/AnalyticsPage";
import SourcesPage from "./components/SourcesPage";

type Page = "dashboard" | "analytics" | "kaynaklar";

const WS_URL = "ws://localhost:3002";
const MAX_HISTORY = 20;

const ZONES = [
    {
        zoneId: "zone_redpine",
        label: "Kızılçam — Muğla/Menteşe",
        shortLabel: "Kızılçam",
        lat: 37.2151,
        lon: 28.3627,
        topology: "slope",
        forestType: "RedPine",
    },
    {
        zoneId: "zone_blackpine",
        label: "Karaçam — Kastamonu",
        shortLabel: "Karaçam",
        lat: 41.378,
        lon: 33.7743,
        topology: "ridge",
        forestType: "BlackPine",
    },
    {
        zoneId: "zone_scotspine",
        label: "Sarıçam — Sarıkamış/Kars",
        shortLabel: "Sarıçam",
        lat: 40.3334,
        lon: 42.5905,
        topology: "ridge",
        forestType: "ScotsPine",
    },
    {
        zoneId: "zone_tauruscedar",
        label: "Toros Sediri — Toros Dağları",
        shortLabel: "Toros Sediri",
        lat: 37.1,
        lon: 34.6,
        topology: "slope",
        forestType: "TaurusCedar",
    },
    {
        zoneId: "zone_silverfir",
        label: "Göknar — Bolu/Abant",
        shortLabel: "Göknar",
        lat: 40.605,
        lon: 31.28,
        topology: "slope",
        forestType: "SilverFir",
    },
    {
        zoneId: "zone_orientalspruce",
        label: "Doğu Ladini — Rize/Artvin",
        shortLabel: "D.Ladini",
        lat: 41.05,
        lon: 40.5,
        topology: "slope",
        forestType: "OrientalSpruce",
    },
    {
        zoneId: "zone_oak",
        label: "Meşe — Kızılcahamam/Ankara",
        shortLabel: "Meşe",
        lat: 40.4697,
        lon: 32.6558,
        topology: "valley",
        forestType: "Oak",
    },
    {
        zoneId: "zone_orientalbeech",
        label: "Doğu Kayını — Karabük/Yenice",
        shortLabel: "D.Kayını",
        lat: 41.2,
        lon: 32.33,
        topology: "slope",
        forestType: "OrientalBeech",
    },
    {
        zoneId: "zone_alder",
        label: "Kızılağaç — Göksu Deltası/Mersin",
        shortLabel: "Kızılağaç",
        lat: 36.3,
        lon: 33.9833,
        topology: "valley",
        forestType: "Alder",
    },
    {
        zoneId: "zone_shrubland",
        label: "Maki — Antalya Kıyısı",
        shortLabel: "Maki",
        lat: 36.8841,
        lon: 30.7056,
        topology: "slope",
        forestType: "Shrubland",
    },
    {
        zoneId: "zone_juniper",
        label: "Ardıç — Beyşehir/Konya",
        shortLabel: "Ardıç",
        lat: 37.675,
        lon: 31.725,
        topology: "plain",
        forestType: "Juniper",
    },
    {
        zoneId: "zone_mixed",
        label: "Karma — Belgrad Ormanı/İstanbul",
        shortLabel: "Karma",
        lat: 41.2483,
        lon: 28.714,
        topology: "valley",
        forestType: "Mixed",
    },
];

export default function App() {
    const [currentPage, setCurrentPage] = useState<Page>("dashboard");
    const [connected, setConnected] = useState(false);
    const [zoneUpdates, setZoneUpdates] = useState<ZoneUpdateMap>({});
    const [alarms, setAlarms] = useState<AlarmEntry[]>([]);
    const [history, setHistory] = useState<Record<string, SensorDataPoint[]>>({});
    const [activeZone, setActiveZone] = useState("zone_redpine");
    const [refreshTick, setRefreshTick] = useState(0);
    const [theme, setTheme] = useState<"dark" | "light">("dark");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

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
                setRefreshTick((t) => t + 1);

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

                // Aktif alarmın skorunu ve seviyesini her RISK_UPDATE'te güncelle.
                // DB'den yüklenenlerde score=0 hardcoded gelir; bu satır onu düzeltir.
                if (data.alarm.active) {
                    setAlarms((prev) =>
                        prev.map((a) =>
                            a.zoneId === data.zoneId && a.active
                                ? { ...a, score: data.score, level: data.level }
                                : a,
                        ),
                    );
                }

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

                // Backend yeniden başladığında alarm manager state'i sıfırlanır;
                // PostgreSQL'den yüklenen eski OPEN alarmlar frontend'de "aktif"
                // görünmeye devam eder ama backend bunları bir daha kapatmaz.
                // Backend'den gelen alarm.active = false sinyali gerçek referans:
                // bu bölgede aktif alarm yoksa frontend state'ini senkronize et.
                if (!data.alarm.active) {
                    setAlarms((prev) => {
                        const hasStale = prev.some(
                            (a) => a.zoneId === data.zoneId && a.active,
                        );
                        if (!hasStale) return prev;
                        return prev.map((a) =>
                            a.zoneId === data.zoneId && a.active
                                ? { ...a, active: false, closedAt: data.timeStamp }
                                : a,
                        );
                    });
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
                    id: `pg-${r.zone_id}-${r.created_at}`,
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
                        <span className="header-logo-flame">🔥</span>
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
                    <a
                        href="#"
                        className={currentPage === "dashboard" ? "active" : ""}
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage("dashboard");
                        }}
                    >
                        Dashboard
                    </a>
                    <a
                        href="#"
                        className={currentPage === "analytics" ? "active" : ""}
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage("analytics");
                        }}
                    >
                        Analitik
                    </a>
                    <a
                        href="#"
                        className={currentPage === "kaynaklar" ? "active" : ""}
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage("kaynaklar");
                        }}
                    >
                        Kaynaklar
                    </a>
                </nav>

                <div className="header-actions">
                    <button
                        className="btn-theme"
                        onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                        title={theme === "dark" ? "Aydınlık mod" : "Karanlık mod"}
                    >
                        {theme === "dark" ? "☀️" : "🌙"}
                    </button>
                </div>
            </header>

            {/* ── Page Content ── */}
            {currentPage === "analytics" ? (
                <AnalyticsPage refreshTick={refreshTick} />
            ) : currentPage === "kaynaklar" ? (
                <SourcesPage />
            ) : (
                <>
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
                            <ScenarioControl
                                zones={ZONES}
                                onScenarioChange={handleScenario}
                                currentScenarios={zoneUpdates}
                            />
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
                </>
            )}
        </div>
    );
}
