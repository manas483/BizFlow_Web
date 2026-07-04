"use client";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { formatCurrency } from "@/shared/lib/utils";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-primary/10 rounded-xl p-3 shadow-xl">
      <p className="text-primary/40 text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export const RevenueChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={220}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
        </linearGradient>
      </defs>
      <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis hide />
      <Tooltip content={<CustomTooltip />} />
      <Area type="monotone" dataKey="sales" name="Sales" stroke="#8b5cf6" strokeWidth={2} fill="url(#salesGrad)" />
      <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="none" strokeDasharray="4 4" />
      <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} fill="url(#profitGrad)" />
    </AreaChart>
  </ResponsiveContainer>
);

export const ExpensePieChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={140}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={40}
        outerRadius={65}
        paddingAngle={3}
        dataKey="value"
      >
        {data.map((entry: any, index: number) => (
          <Cell key={index} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip
        formatter={(v: any) => [formatCurrency(v), ""]}
        contentStyle={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px" }}
      />
    </PieChart>
  </ResponsiveContainer>
);

const WeeklyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-primary/10 rounded-xl p-3 shadow-xl">
      <p className="text-primary/40 text-xs mb-1">{label}</p>
      <p className="text-xs font-semibold text-violet-400">{formatCurrency(payload[0]?.value)}</p>
    </div>
  );
};

export const WeeklySalesChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={110}>
    <BarChart data={data} barSize={18}>
      <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
      <YAxis hide />
      <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "rgba(139,92,246,0.08)" }} />
      <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);
