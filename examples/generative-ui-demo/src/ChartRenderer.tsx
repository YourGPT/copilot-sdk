import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ChartRendererProps } from "@yourgpt/copilot-sdk/experimental";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];

// Reshape datasets + labels → recharts data format
function toRechartsData(
  labels: string[],
  datasets: { label: string; data: number[] }[],
) {
  return labels.map((label, i) => {
    const point: Record<string, string | number> = { name: label };
    for (const ds of datasets) {
      point[ds.label] = ds.data[i] ?? 0;
    }
    return point;
  });
}

export function ChartRenderer({ payload }: ChartRendererProps) {
  const { chartType, labels, datasets, title, xLabel, yLabel } = payload;
  const data = toRechartsData(labels, datasets);
  const dataKeys = datasets.map((ds) => ds.label);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {title && (
        <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={220}>
        {chartType === "pie" ? (
          <PieChart>
            <Pie
              data={data.map((d) => ({
                name: d.name,
                value: Number(d[dataKeys[0]] ?? 0),
              }))}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              label={
                xLabel
                  ? { value: xLabel, position: "insideBottom", offset: -5 }
                  : undefined
              }
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={
                yLabel
                  ? { value: yLabel, angle: -90, position: "insideLeft" }
                  : undefined
              }
            />
            <Tooltip />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : chartType === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        ) : chartType === "scatter" ? (
          <ScatterChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={dataKeys[0]}
              tick={{ fontSize: 11 }}
              name={dataKeys[0]}
            />
            <YAxis
              dataKey={dataKeys[1] ?? dataKeys[0]}
              tick={{ fontSize: 11 }}
              name={dataKeys[1] ?? dataKeys[0]}
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill={COLORS[0]} />
          </ScatterChart>
        ) : (
          // Default: bar
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              label={
                xLabel
                  ? { value: xLabel, position: "insideBottom", offset: -5 }
                  : undefined
              }
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={
                yLabel
                  ? { value: yLabel, angle: -90, position: "insideLeft" }
                  : undefined
              }
            />
            <Tooltip />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
