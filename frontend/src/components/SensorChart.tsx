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
                {zoneId.toUpperCase()} İçin veri bekleniyor..
            </div>
        );
    }

    return (
        <div className="chart-wrapper">
            <ResponsiveContainer width="%100" height={220}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                        dataKey="time"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                        contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                        }}
                    />
                    <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />

                    <Line
                        type="monotone"
                        dataKey="temperature"
                        name="Sıcaklık (°C)"
                        stroke="#f97316"
                        dot={false}
                        strokeWidth={2}
                    />
                    <Line
                        type="monotone"
                        dataKey="humidity"
                        name="Nem (%)"
                        stroke="#38bdf8"
                        dot={false}
                        strokeWidth={2}
                    />
                    <Line
                        type="monotone"
                        dataKey="smokePpm"
                        name="Duman (Ppm)"
                        stroke="#a78bfa"
                        dot={false}
                        strokeWidth={2}
                    />
                    <Line
                        type="monotone"
                        dataKey="windSpeedMs"
                        name="Rüzgar (m/s)"
                        stroke="#34d399"
                        dot={false}
                        strokeWidth={2}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
