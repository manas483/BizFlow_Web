"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart as RePieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { formatCurrency } from "@/shared/lib/utils";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-primary/10 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-primary/40 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value.toString().includes('%') ? p.value : formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export const RevenueTrendChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={260}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
      <Tooltip content={<CustomTooltip />} />
      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
    </AreaChart>
  </ResponsiveContainer>
);

export const ProfitComparisonChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={260}>
    <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
      <XAxis type="number" hide />
      <YAxis dataKey="name" type="category" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
      <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
        {data.map((entry: any, index: number) => (
          <Cell key={`cell-${index}`} fill={entry.fill} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

const PIE_COLORS = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4"];

export const BreakdownPieChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={180}>
    <RePieChart>
      <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="amount">
        {data.map((_: any, i: number) => (
          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0.1)" />
        ))}
      </Pie>
      <Tooltip formatter={(v: any) => [formatCurrency(v), "Amount"]} contentStyle={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "8px" }} />
    </RePieChart>
  </ResponsiveContainer>
);
