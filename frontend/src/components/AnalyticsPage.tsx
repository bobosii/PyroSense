import { useEffect, useState, useCallback } from "react";
import HistoryPanel from "./HistoryPanel";

interface ValidationMetrics {
    activeFireDetection: {
        truePositive: number;
        falseNegative: number;
        precision: number | null;
        recall: number | null;
    };
    dangerDetection: {
        truePositive: number;
        falseNegative: number;
        recall: number | null;
    };
    normalConditions: {
        falsePositive: number;
        trueNegative: number;
        specificity: number | null;
    };
    sensorFault: {
        falseAlarms: number;
        correctlySuppressed: number;
    };
    totalReadings: number;
}

/* ── MetricBar ── */
function MetricBar({ value, color }: { value: number | null; color: string }) {
    if (value === null)
        return (
            <span
                style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 12,
                    color: "var(--text-dim)",
                }}
            >
                —
            </span>
        );
    const pct = Math.round(value * 100);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
                style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 99,
                    background: "var(--border-soft)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        borderRadius: 99,
                        transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                    }}
                />
            </div>
            <span
                style={{
                    color,
                    fontFamily: "var(--font-data)",
                    fontSize: 15,
                    fontWeight: 700,
                    minWidth: 44,
                    textAlign: "right",
                    letterSpacing: "-0.02em",
                }}
            >
                %{pct}
            </span>
        </div>
    );
}

/* ── StatRow ── */
function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "5px 0",
                borderBottom: "1px solid var(--border-soft)",
            }}
        >
            <span
                style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                }}
            >
                {label}
            </span>
            <span
                style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                }}
            >
                {value}
            </span>
        </div>
    );
}

/* ── StatCard ── */
function StatCard({
    title,
    subtitle,
    children,
    accent,
    icon,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    accent: string;
    icon: string;
}) {
    return (
        <div
            style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderTop: `3px solid ${accent}`,
                borderRadius: "var(--radius)",
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
            }}
        >
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>
                    {icon}
                </span>
                <div>
                    <div
                        style={{
                            fontFamily: "var(--font-label)",
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "var(--text)",
                        }}
                    >
                        {title}
                    </div>
                    <div
                        style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 10,
                            color: "var(--text-dim)",
                            marginTop: 3,
                            letterSpacing: "0.01em",
                        }}
                    >
                        {subtitle}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {children}
            </div>
        </div>
    );
}

/* ── Main Page ── */
export default function AnalyticsPage({ refreshTick = 0 }: { refreshTick?: number }) {
    const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        fetch("/api/validation-metrics")
            .then((r) => r.json())
            .then((data) => {
                setMetrics(data);
                setError(null);
                setLastRefreshed(new Date());
            })
            .catch(() => setError("Metrikler yüklenemedi"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (refreshTick === 0) return;
        const timer = setTimeout(load, 2000);
        return () => clearTimeout(timer);
    }, [refreshTick, load]);

    return (
        <div
            style={{
                position: "fixed",
                top: "var(--header-h)",
                left: 0,
                right: 0,
                bottom: 0,
                overflowY: "auto",
                background: "var(--bg)",
                padding: "28px 32px 40px",
            }}
        >
            {/* ── Full-width content wrapper ── */}
            <div style={{ width: "100%" }}>
                {/* ── Page header ── */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginBottom: 32,
                        gap: 16,
                    }}
                >
                    <div>
                        <h2
                            style={{
                                margin: 0,
                                fontFamily: "var(--font-label)",
                                fontSize: 22,
                                fontWeight: 800,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "var(--text)",
                            }}
                        >
                            Sistem Doğrulama Metrikleri
                        </h2>
                        <p
                            style={{
                                margin: "6px 0 0",
                                fontFamily: "var(--font-data)",
                                fontSize: 11,
                                color: "var(--text-dim)",
                                letterSpacing: "0.01em",
                            }}
                        >
                            Simülatör senaryo ground-truth'u ile ontoloji çıkarım
                            sonuçları karşılaştırması
                        </p>
                    </div>

                    {/* Refresh button — always visible */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 6,
                            flexShrink: 0,
                        }}
                    >
                        <button
                            onClick={load}
                            disabled={loading}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-mid)",
                                color: loading ? "var(--text-dim)" : "var(--text-muted)",
                                borderRadius: "var(--radius)",
                                padding: "7px 16px",
                                cursor: loading ? "not-allowed" : "pointer",
                                fontFamily: "var(--font-label)",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                transition:
                                    "background 0.15s, border-color 0.15s, color 0.15s",
                                opacity: loading ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    (e.target as HTMLButtonElement).style.background =
                                        "var(--bg-hover)";
                                    (e.target as HTMLButtonElement).style.borderColor =
                                        "var(--border-hi)";
                                    (e.target as HTMLButtonElement).style.color =
                                        "var(--text)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                (e.target as HTMLButtonElement).style.background =
                                    "var(--bg-card)";
                                (e.target as HTMLButtonElement).style.borderColor =
                                    "var(--border-mid)";
                                (e.target as HTMLButtonElement).style.color =
                                    "var(--text-muted)";
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-block",
                                    animation: loading
                                        ? "spin 0.8s linear infinite"
                                        : "none",
                                    fontSize: 12,
                                }}
                            >
                                ↻
                            </span>
                            {loading ? "Yükleniyor" : "Yenile"}
                        </button>
                        {lastRefreshed && (
                            <span
                                style={{
                                    fontFamily: "var(--font-data)",
                                    fontSize: 10,
                                    color: "var(--text-faint)",
                                    letterSpacing: "0.02em",
                                }}
                            >
                                {lastRefreshed.toLocaleTimeString("tr-TR")}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Error state ── */}
                {error && (
                    <div
                        style={{
                            background: "var(--risk-ext-dim)",
                            border: "1px solid rgba(244,63,94,0.25)",
                            borderRadius: "var(--radius)",
                            padding: "10px 16px",
                            marginBottom: 24,
                            fontFamily: "var(--font-data)",
                            fontSize: 12,
                            color: "var(--risk-extreme)",
                        }}
                    >
                        {error}
                    </div>
                )}

                {metrics && (
                    <>
                        {/* ── Total readings banner ── */}
                        <div
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                                borderLeft: "3px solid var(--accent)",
                                borderRadius: "var(--radius)",
                                padding: "14px 22px",
                                marginBottom: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: "var(--font-label)",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    color: "var(--text-dim)",
                                }}
                            >
                                Toplam Analiz Edilen Okuma
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: 8,
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "var(--font-data)",
                                        fontSize: 28,
                                        fontWeight: 700,
                                        color: "var(--accent)",
                                        letterSpacing: "-0.03em",
                                    }}
                                >
                                    {metrics.totalReadings.toLocaleString("tr-TR")}
                                </span>
                                <span
                                    style={{
                                        fontFamily: "var(--font-label)",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        color: "var(--text-dim)",
                                    }}
                                >
                                    kayıt
                                </span>
                            </div>
                        </div>

                        {/* ── 3-column metric cards, centered ── */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: 16,
                                marginBottom: 28,
                            }}
                        >
                            {/* Yangın Öncesi Tehlike */}
                            <StatCard
                                title="Yangın Öncesi"
                                subtitle="prefire → MODERATE+ beklenir"
                                accent="var(--risk-high)"
                                icon="🔥"
                            >
                                <StatRow
                                    label="Doğru Pozitif (TP)"
                                    value={metrics.dangerDetection.truePositive.toLocaleString(
                                        "tr-TR",
                                    )}
                                />
                                <StatRow
                                    label="Yanlış Negatif (FN)"
                                    value={metrics.dangerDetection.falseNegative.toLocaleString(
                                        "tr-TR",
                                    )}
                                />
                                <div style={{ paddingTop: 10 }}>
                                    <div
                                        style={{
                                            fontFamily: "var(--font-label)",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                            color: "var(--text-faint)",
                                            marginBottom: 7,
                                        }}
                                    >
                                        Recall
                                    </div>
                                    <MetricBar
                                        value={metrics.dangerDetection.recall}
                                        color="var(--risk-high)"
                                    />
                                </div>
                            </StatCard>

                            {/* Normal Koşullar */}
                            <StatCard
                                title="Normal Koşullar"
                                subtitle="normal → LOW beklenir"
                                accent="var(--risk-low)"
                                icon="🌲"
                            >
                                <StatRow
                                    label="Doğru Negatif (TN)"
                                    value={metrics.normalConditions.trueNegative.toLocaleString(
                                        "tr-TR",
                                    )}
                                />
                                <StatRow
                                    label="Yanlış Pozitif (FP)"
                                    value={metrics.normalConditions.falsePositive.toLocaleString(
                                        "tr-TR",
                                    )}
                                />
                                <div style={{ paddingTop: 10 }}>
                                    <div
                                        style={{
                                            fontFamily: "var(--font-label)",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                            color: "var(--text-faint)",
                                            marginBottom: 7,
                                        }}
                                    >
                                        Specificity
                                    </div>
                                    <MetricBar
                                        value={metrics.normalConditions.specificity}
                                        color="var(--risk-low)"
                                    />
                                </div>
                            </StatCard>

                            {/* Sensör Arızası */}
                            <StatCard
                                title="Sensör Arızası"
                                subtitle="sensorFault → HIGH/EXTREME olmamalı"
                                accent="var(--secondary)"
                                icon="⚙️"
                            >
                                <StatRow
                                    label="Doğru Bastırılan"
                                    value={metrics.sensorFault.correctlySuppressed.toLocaleString(
                                        "tr-TR",
                                    )}
                                />
                                <StatRow
                                    label="Yanlış Alarm"
                                    value={metrics.sensorFault.falseAlarms.toLocaleString(
                                        "tr-TR",
                                    )}
                                />
                                {metrics.sensorFault.falseAlarms +
                                    metrics.sensorFault.correctlySuppressed >
                                    0 && (
                                    <div style={{ paddingTop: 10 }}>
                                        <div
                                            style={{
                                                fontFamily: "var(--font-label)",
                                                fontSize: 10,
                                                fontWeight: 700,
                                                letterSpacing: "0.1em",
                                                textTransform: "uppercase",
                                                color: "var(--text-faint)",
                                                marginBottom: 7,
                                            }}
                                        >
                                            Bastırma Oranı
                                        </div>
                                        <MetricBar
                                            value={
                                                metrics.sensorFault.correctlySuppressed /
                                                (metrics.sensorFault.falseAlarms +
                                                    metrics.sensorFault
                                                        .correctlySuppressed)
                                            }
                                            color="var(--secondary)"
                                        />
                                    </div>
                                )}
                            </StatCard>
                        </div>

                        {/* ── Ground Truth note ── */}
                        <div
                            style={{
                                padding: "12px 18px",
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-soft)",
                                borderRadius: "var(--radius)",
                                marginBottom: 32,
                                display: "flex",
                                gap: 10,
                                alignItems: "flex-start",
                            }}
                        >
                            <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                                ℹ️
                            </span>
                            <p
                                style={{
                                    margin: 0,
                                    fontFamily: "var(--font-data)",
                                    fontSize: 11,
                                    color: "var(--text-dim)",
                                    lineHeight: 1.7,
                                }}
                            >
                                <strong
                                    style={{
                                        fontFamily: "var(--font-label)",
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                        color: "var(--text-muted)",
                                        fontSize: 10,
                                    }}
                                >
                                    Ground Truth:{" "}
                                </strong>
                                Simülatör her okumaya senaryo etiketi yazar (normal /
                                prefire / activefire / sensorFault). Ontoloji motoru bu
                                etiketlere bakmaz — yalnızca ham sensör değerleri üzerinde
                                SPARQL çıkarımı yapar. Bu tablo ikisinin örtüşme oranını
                                gösterir.
                            </p>
                        </div>

                        {/* ── History Panel ── */}
                        <HistoryPanel />
                    </>
                )}

                {/* Loading skeleton */}
                {loading && !metrics && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 16,
                            marginTop: 28,
                        }}
                    >
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                style={{
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border)",
                                    borderTop: "3px solid var(--border-mid)",
                                    borderRadius: "var(--radius)",
                                    padding: "20px 22px",
                                    height: 180,
                                    opacity: 0.5,
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
