import { useEffect, useState } from "react";

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

function MetricBar({ value, color }: { value: number | null; color: string }) {
    if (value === null) return <span style={{ color: "var(--text-dim)" }}>—</span>;
    const pct = Math.round(value * 100);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
                style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: "var(--border)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        borderRadius: 3,
                        transition: "width 0.6s ease",
                    }}
                />
            </div>
            <span style={{ color, fontFamily: "var(--font-data)", fontSize: 13, minWidth: 38 }}>
                %{pct}
            </span>
        </div>
    );
}

function StatCard({
    title,
    subtitle,
    children,
    accent,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    accent: string;
}) {
    return (
        <div
            style={{
                background: "var(--bg-card)",
                border: `1px solid var(--border)`,
                borderTop: `3px solid ${accent}`,
                borderRadius: 8,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            <div>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{title}</div>
                <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 2 }}>{subtitle}</div>
            </div>
            {children}
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</span>
            <span style={{ color: "var(--text)", fontFamily: "var(--font-data)", fontSize: 13 }}>
                {value}
            </span>
        </div>
    );
}

export default function AnalyticsPage() {
    const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        fetch("/api/validation-metrics")
            .then((r) => r.json())
            .then((data) => {
                setMetrics(data);
                setError(null);
            })
            .catch(() => setError("Metrikler yüklenemedi"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div
            style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px 32px",
                background: "var(--bg)",
            }}
        >
            {/* Başlık */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 28,
                }}
            >
                <div>
                    <h2
                        style={{
                            margin: 0,
                            color: "var(--text)",
                            fontSize: 18,
                            fontWeight: 600,
                        }}
                    >
                        Sistem Doğrulama Metrikleri
                    </h2>
                    <p
                        style={{
                            margin: "4px 0 0",
                            color: "var(--text-dim)",
                            fontSize: 12,
                        }}
                    >
                        Simülatör senaryo ground-truth'u ile ontoloji çıkarım sonuçları karşılaştırması
                    </p>
                </div>
                <button
                    onClick={load}
                    style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                        borderRadius: 6,
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontSize: 12,
                    }}
                >
                    Yenile
                </button>
            </div>

            {loading && (
                <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Yükleniyor...</div>
            )}
            {error && <div style={{ color: "var(--risk-extreme)", fontSize: 13 }}>{error}</div>}

            {metrics && (
                <>
                    {/* Toplam okuma */}
                    <div
                        style={{
                            background: "var(--bg-overlay)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            padding: "12px 20px",
                            marginBottom: 24,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                            Toplam Analiz Edilen Okuma
                        </span>
                        <span
                            style={{
                                color: "var(--secondary)",
                                fontFamily: "var(--font-data)",
                                fontSize: 22,
                                fontWeight: 700,
                            }}
                        >
                            {metrics.totalReadings.toLocaleString("tr-TR")}
                        </span>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: 16,
                        }}
                    >
                        {/* Aktif Yangın Tespiti */}
                        <StatCard
                            title="Aktif Yangın Tespiti"
                            subtitle="activefire senaryosu → HIGH/EXTREME beklenir"
                            accent="var(--risk-extreme)"
                        >
                            <Row label="Doğru Pozitif (TP)" value={metrics.activeFireDetection.truePositive} />
                            <Row label="Yanlış Negatif (FN)" value={metrics.activeFireDetection.falseNegative} />
                            <div style={{ marginTop: 4 }}>
                                <div style={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}>
                                    Precision
                                </div>
                                <MetricBar value={metrics.activeFireDetection.precision} color="var(--risk-extreme)" />
                            </div>
                            <div>
                                <div style={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}>
                                    Recall (Sensitivity)
                                </div>
                                <MetricBar value={metrics.activeFireDetection.recall} color="var(--risk-high)" />
                            </div>
                        </StatCard>

                        {/* Yangın Öncesi Tehlike */}
                        <StatCard
                            title="Yangın Öncesi Tehlike"
                            subtitle="prefire senaryosu → MODERATE+ beklenir"
                            accent="var(--risk-high)"
                        >
                            <Row label="Doğru Pozitif (TP)" value={metrics.dangerDetection.truePositive} />
                            <Row label="Yanlış Negatif (FN)" value={metrics.dangerDetection.falseNegative} />
                            <div style={{ marginTop: 4 }}>
                                <div style={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}>
                                    Recall
                                </div>
                                <MetricBar value={metrics.dangerDetection.recall} color="var(--risk-high)" />
                            </div>
                        </StatCard>

                        {/* Normal Koşullar */}
                        <StatCard
                            title="Normal Koşullar"
                            subtitle="normal senaryosu → LOW beklenir"
                            accent="var(--risk-low)"
                        >
                            <Row label="Doğru Negatif (TN)" value={metrics.normalConditions.trueNegative} />
                            <Row label="Yanlış Pozitif (FP)" value={metrics.normalConditions.falsePositive} />
                            <div style={{ marginTop: 4 }}>
                                <div style={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}>
                                    Specificity
                                </div>
                                <MetricBar value={metrics.normalConditions.specificity} color="var(--risk-low)" />
                            </div>
                        </StatCard>

                        {/* Sensör Arızası */}
                        <StatCard
                            title="Sensör Arızası Testi"
                            subtitle="sensorFault → HIGH/EXTREME olmamalı"
                            accent="var(--secondary)"
                        >
                            <Row label="Yanlış Alarm (hata)" value={metrics.sensorFault.falseAlarms} />
                            <Row
                                label="Doğru Bastırılan"
                                value={metrics.sensorFault.correctlySuppressed}
                            />
                            {metrics.sensorFault.falseAlarms + metrics.sensorFault.correctlySuppressed > 0 && (
                                <div style={{ marginTop: 4 }}>
                                    <div style={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}>
                                        Doğru Bastırma Oranı
                                    </div>
                                    <MetricBar
                                        value={
                                            metrics.sensorFault.correctlySuppressed /
                                            (metrics.sensorFault.falseAlarms +
                                                metrics.sensorFault.correctlySuppressed)
                                        }
                                        color="var(--secondary)"
                                    />
                                </div>
                            )}
                        </StatCard>
                    </div>

                    {/* Açıklama notu */}
                    <div
                        style={{
                            marginTop: 24,
                            padding: "12px 16px",
                            background: "var(--bg-card-low)",
                            border: "1px solid var(--border-muted)",
                            borderRadius: 6,
                            color: "var(--text-dim)",
                            fontSize: 11,
                            lineHeight: 1.6,
                        }}
                    >
                        <strong style={{ color: "var(--text-muted)" }}>Ground Truth:</strong>{" "}
                        Simülatör her okumaya senaryo etiketi yazar (normal / prefire / activefire / sensorFault).
                        Ontoloji motoru bu etiketlere bakmaz — yalnızca ham sensör değerleri üzerinde SPARQL
                        çıkarımı yapar. Bu tablo ikisinin örtüşme oranını gösterir.
                    </div>
                </>
            )}
        </div>
    );
}
