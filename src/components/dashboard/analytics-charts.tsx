"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  backgroundColor: "var(--surface-raised)",
  color: "var(--foreground)",
  boxShadow: "0 12px 30px -14px rgba(15, 23, 42, .3)",
  fontSize: 12,
  fontWeight: 700,
};

export function TeacherTrendChart({
  data,
}: {
  data: Array<{ week: string; attendance: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="teacherArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1684e8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#1684e8" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 11, fontWeight: 600 }} />
        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "Attendance"]} />
        <Area
          type="monotone"
          dataKey="attendance"
          stroke="#1684e8"
          strokeWidth={3}
          fill="url(#teacherArea)"
          activeDot={{ r: 5, fill: "#1684e8", stroke: "white", strokeWidth: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StudentTrendChart({
  data,
}: {
  data: Array<{ week: string; attended: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 11, fontWeight: 600 }} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-soft)" }} />
        <Bar dataKey="attended" name="Classes attended" radius={[7, 7, 2, 2]}>
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={index === data.length - 1 ? "#1684e8" : "#cde8ff"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StudentDetailChart({
  data,
}: {
  data: Array<{ session: string; attendance: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="studentDetailArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.26} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 11, fontWeight: 600 }} />
        <YAxis domain={[0, 1]} ticks={[0, 1]} axisLine={false} tickLine={false} tickFormatter={(value) => (value ? "Present" : "Absent")} tick={{ fill: "var(--chart-muted)", fontSize: 10 }} width={58} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value) === 1 ? "Present" : "Absent", "Status"]} />
        <Area
          type="stepAfter"
          dataKey="attendance"
          stroke="#7c3aed"
          strokeWidth={3}
          fill="url(#studentDetailArea)"
          activeDot={{ r: 5, fill: "#7c3aed", stroke: "white", strokeWidth: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
