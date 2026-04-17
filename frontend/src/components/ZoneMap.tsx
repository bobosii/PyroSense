import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { RiskUpdate, RiskLevel, ZoneUpdateMap } from "../types";

const LEVEL_COLORS: Record<RiskLevel, string> = {
    LOW: "#22c55e",
    MODERATE: "#f59e0b",
    HIGH: "#f97316",
    EXTREME: "#ef4444",
};

interface ZoneInfo {
    zoneId: string;
    label: string;
    lat: number;
    lon: number;
}

interface Props {
    zones: ZoneInfo[];
    updates: ZoneUpdateMap;
}

function getColor(update?: RiskUpdate): string {
    if (!update) {
        return "#64748b"; // Henuz veri yok, gri don
    }

    return LEVEL_COLORS[update.level];
}

export default function ZoneMap({ zones, updates }: Props) {
    // Haritanin merkezi - 3 zone'un ortasi (Antalya bolgesi)
    const center: [number, number] = [36.8956, 30.7089];

    return (
        <div className="map-wrapper">
            <MapContainer
                center={center}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
            >
                {/* OpenStreetMap tile katmani */}
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                />
                {zones.map((z) => {
                    const update = updates[z.zoneId];
                    const color = getColor(update);

                    return (
                        <CircleMarker
                            key={z.zoneId}
                            center={[z.lat, z.lon]}
                            radius={10}
                            pathOptions={{
                                color: color,
                                fillColor: color,
                                fillOpacity: 0.5,
                                weight: 2,
                            }}
                        >
                            <Popup>
                                <div style={{ minWidth: 160 }}>
                                    <strong>{z.label}</strong>
                                    <br />
                                    {update ? (
                                        <>
                                            Risk: <strong>{update.score}/100</strong> -{" "}
                                            {update.level}
                                            <br />
                                            Sıcaklık: {update.temperature.toFixed(1)}°C
                                            <br />
                                            Nem: %{update.humidity.toFixed(0)}
                                            <br />
                                            Duman: {update.smokePpm.toFixed(0)} ppm
                                            {update.alarm.active && (
                                                <div
                                                    style={{
                                                        color: "#ef4444",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    ALARM AKTİF
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        "Veri Bekleniyor..."
                                    )}
                                </div>
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
