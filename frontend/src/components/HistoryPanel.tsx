import { useState } from "react";

const ZONES = [
    { zoneId: "zone_redpine", label: "Kızılçam — Muğla/Menteşe" },
    { zoneId: "zone_blackpine", label: "Karaçam — Kastamonu" },
    { zoneId: "zone_scotspine", label: "Sarıçam — Sarıkamış/Kars" },
    { zoneId: "zone_tauruscedar", label: "Toros Sediri — Toros Dağları" },
    { zoneId: "zone_silverfir", label: "Göknar — Bolu/Abant" },
    { zoneId: "zone_orientalspruce", label: "Doğu Ladini — Rize/Artvin" },
    { zoneId: "zone_oak", label: "Meşe — Kızılcahamam/Ankara" },
    { zoneId: "zone_orientalbeech", label: "Doğu Kayını — Karabük/Yenice" },
    { zoneId: "zone_alder", label: "Kızılağaç — Göksu Deltası/Mersin" },
    { zoneId: "zone_shrubland", label: "Maki — Antalya Kıyısı" },
    { zoneId: "zone_juniper", label: "Ardıç — Beyşehir/Konya" },
    { zoneId: "zone_mixed", label: "Karma — Belgrad Ormanı/İstanbul" },
];

interface Row {
    time: string;
    temperature: number;
    humidity: number;
    smoke_ppm: number;
    wind_speed_ms: number;
    wind_dir_deg: number;
    flame_detected: boolean;
    co2_ppm: number | null;
    scenario: string;
}

function formatLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocal() {
    return formatLocal(new Date());
}

function todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return formatLocal(d);
}

export default function HistoryPanel() {
    const [zoneId, setZoneId] = useState("zone_redpine");
    const [from, setFrom] = useState(todayStart);
    const [to, setTo] = useState(nowLocal);
    const [limit, setLimit] = useState("200");
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [queried, setQueried] = useState(false);

    const buildUrl = (format?: string) => {
        const params = new URLSearchParams({
            from: new Date(from).toISOString(),
            to: new Date(to).toISOString(),
            limit,
            ...(format ? { format } : {}),
        });
        return `/api/history/${zoneId}?${params}`;
    };

    const handleQuery = async () => {
        setLoading(true);
        setError(null);
        setQueried(true);
        try {
            const res = await fetch(buildUrl());
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setRows(data);
        } catch (e: any) {
            setError(String(e.message));
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCsv = () => {
        window.open(buildUrl("csv"), "_blank");
    };

    const inputStyle: React.CSSProperties = {
        background: "var(--bg-overlay)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        color: "var(--text)",
        padding: "6px 10px",
        fontSize: 12,
    };

    return (
        <div
            style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "20px 24px",
                marginTop: 24,
            }}
        >
            {/* Başlık */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>
                    Tarihsel Sensör Verisi
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 2 }}>
                    Belirli bir bölge ve zaman aralığı için sensör okumalarını sorgula
                </div>
            </div>

            {/* Filtre satırı */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "flex-end",
                    marginBottom: 16,
                }}
            >
                {/* Bölge */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ color: "var(--text-dim)", fontSize: 11 }}>
                        Bölge
                    </label>
                    <select
                        value={zoneId}
                        onChange={(e) => setZoneId(e.target.value)}
                        style={{ ...inputStyle, minWidth: 220 }}
                    >
                        {ZONES.map((z) => (
                            <option key={z.zoneId} value={z.zoneId}>
                                {z.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Başlangıç */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ color: "var(--text-dim)", fontSize: 11 }}>
                        Başlangıç
                    </label>
                    <input
                        type="datetime-local"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        style={inputStyle}
                    />
                </div>

                {/* Bitiş */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ color: "var(--text-dim)", fontSize: 11 }}>
                        Bitiş
                    </label>
                    <input
                        type="datetime-local"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        style={inputStyle}
                    />
                </div>

                {/* Limit */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ color: "var(--text-dim)", fontSize: 11 }}>
                        Maks. Satır
                    </label>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        style={inputStyle}
                    >
                        <option value="50">50</option>
                        <option value="200">200</option>
                        <option value="500">500</option>
                        <option value="1000">1000</option>
                    </select>
                </div>

                {/* Butonlar */}
                <button
                    onClick={handleQuery}
                    disabled={loading}
                    style={{
                        background: "var(--secondary)",
                        border: "none",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "7px 18px",
                        fontSize: 12,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1,
                    }}
                >
                    {loading ? "Sorgulanıyor…" : "Sorgula"}
                </button>

                <button
                    onClick={handleCsv}
                    style={{
                        background: "var(--bg-overlay)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text-muted)",
                        padding: "7px 18px",
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                >
                    CSV İndir ↓
                </button>
            </div>

            {/* Sonuçlar */}
            {error && (
                <div
                    style={{
                        color: "var(--risk-extreme)",
                        fontSize: 12,
                        marginBottom: 12,
                    }}
                >
                    Hata: {error}
                </div>
            )}

            {queried && !loading && !error && rows.length === 0 && (
                <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                    Bu aralıkta kayıt bulunamadı.
                </div>
            )}

            {rows.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <div
                        style={{
                            color: "var(--text-dim)",
                            fontSize: 11,
                            marginBottom: 8,
                        }}
                    >
                        {rows.length} kayıt listeleniyor
                    </div>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 11,
                            fontFamily: "var(--font-data)",
                        }}
                    >
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                {[
                                    "Zaman",
                                    "Sıcaklık",
                                    "Nem",
                                    "Duman",
                                    "Rüzgar",
                                    "Alev",
                                    "CO₂",
                                    "Senaryo",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            textAlign: "left",
                                            padding: "6px 10px",
                                            color: "var(--text-muted)",
                                            fontWeight: 500,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr
                                    key={i}
                                    style={{
                                        borderBottom: "1px solid var(--border-muted)",
                                        background:
                                            i % 2 === 0
                                                ? "transparent"
                                                : "var(--bg-overlay)",
                                    }}
                                >
                                    <td
                                        style={{
                                            padding: "5px 10px",
                                            color: "var(--text-dim)",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {new Date(r.time).toLocaleString("tr-TR")}
                                    </td>
                                    <td
                                        style={{
                                            padding: "5px 10px",
                                            color: "var(--text)",
                                        }}
                                    >
                                        {r.temperature?.toFixed(1)}°C
                                    </td>
                                    <td
                                        style={{
                                            padding: "5px 10px",
                                            color: "var(--text)",
                                        }}
                                    >
                                        %{r.humidity?.toFixed(0)}
                                    </td>
                                    <td
                                        style={{
                                            padding: "5px 10px",
                                            color: "var(--text)",
                                        }}
                                    >
                                        {r.smoke_ppm?.toFixed(0)} ppm
                                    </td>
                                    <td
                                        style={{
                                            padding: "5px 10px",
                                            color: "var(--text)",
                                        }}
                                    >
                                        {r.wind_speed_ms?.toFixed(1)} m/s
                                    </td>
                                    <td style={{ padding: "5px 10px" }}>
                                        <span
                                            style={{
                                                color: r.flame_detected
                                                    ? "var(--risk-extreme)"
                                                    : "var(--text-dim)",
                                            }}
                                        >
                                            {r.flame_detected ? "🔥 Evet" : "—"}
                                        </span>
                                    </td>
                                    <td
                                        style={{
                                            padding: "5px 10px",
                                            color: "var(--text)",
                                        }}
                                    >
                                        {r.co2_ppm != null
                                            ? `${r.co2_ppm?.toFixed(0)} ppm`
                                            : "—"}
                                    </td>
                                    <td style={{ padding: "5px 10px" }}>
                                        <span
                                            style={{
                                                padding: "2px 7px",
                                                borderRadius: 4,
                                                fontSize: 10,
                                                background:
                                                    r.scenario === "activefire"
                                                        ? "var(--risk-extreme)"
                                                        : r.scenario === "prefire"
                                                          ? "var(--risk-high)"
                                                          : r.scenario === "sensorFault"
                                                            ? "var(--secondary)"
                                                            : "var(--bg-overlay)",
                                                color:
                                                    r.scenario === "normal"
                                                        ? "var(--text-muted)"
                                                        : "#fff",
                                            }}
                                        >
                                            {r.scenario}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
