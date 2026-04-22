import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { SensorDataPoint } from "../types";

interface Props {
    data: SensorDataPoint[];
    zoneId: string;
}

export default function SensorChart({ data, zoneId }: Props) {
    if (data.length === 0) {
        return (
            <div className="chart-empty">
                {zoneId} — veri bekleniyor…
            </div>
        );
    }

    return (
        <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                        dataKey="time"
                        tick={{ fill: "#64748b", fontSize: 10, fontFamily: "Space Grotesk" }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fill: "#64748b", fontSize: 10, fontFamily: "Space Grotesk" }}
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: 2,
                            fontSize: 12,
                            fontFamily: "Space Grotesk",
                            color: "#e2e8f0",
                        }}
                        labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
                    />
                    <Legend
                        wrapperStyle={{
                            color: "#64748b",
                            fontSize: 10,
                            fontFamily: "Inter",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            paddingTop: 0,
                        }}
                    />

                    <Line
                        type="monotone"
                        dataKey="temperature"
                        name="Sıcaklık (°C)"
                        stroke="#ef4444"
                        dot={false}
                        strokeWidth={1.5}
                    />
                    <Line
                        type="monotone"
                        dataKey="humidity"
                        name="Nem (%)"
                        stroke="#38bdf8"
                        dot={false}
                        strokeWidth={1.5}
                    />
                    <Line
                        type="monotone"
                        dataKey="smokePpm"
                        name="Duman (ppm)"
                        stroke="#a78bfa"
                        dot={false}
                        strokeWidth={1.5}
                    />
                    <Line
                        type="monotone"
                        dataKey="windSpeedMs"
                        name="Rüzgar (m/s)"
                        stroke="#f97316"
                        dot={false}
                        strokeWidth={1.5}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
