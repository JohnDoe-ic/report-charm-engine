import { SalonLocation, normalizeStatus } from '@/lib/types';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface StatusChartProps {
  data: SalonLocation[];
}

const STATUS_COLORS: Record<string, string> = {
  'open': 'hsl(140, 55%, 45%)',
  'contract': 'hsl(175, 70%, 42%)',
  'evaluation': 'hsl(38, 90%, 55%)',
  'no-rent': 'hsl(225, 10%, 40%)',
  'rejected': 'hsl(0, 65%, 48%)',
  'other': 'hsl(270, 50%, 55%)',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 text-sm shadow-lg">
        <p className="text-foreground font-medium">{payload[0].name}</p>
        <p className="text-muted-foreground">{payload[0].value} локаций</p>
      </div>
    );
  }
  return null;
};

const StatusChart = ({ data }: StatusChartProps) => {
  const statusMap = new Map<string, { count: number; key: string }>();
  data.forEach((d) => {
    const { label, key } = normalizeStatus(d.status);
    const existing = statusMap.get(label);
    statusMap.set(label, { count: (existing?.count || 0) + 1, key });
  });
  const statusData = Array.from(statusMap.entries())
    .map(([name, { count, key }]) => ({ name, value: count, key }))
    .sort((a, b) => b.value - a.value);

  // City distribution (top 12)
  const cityMap = new Map<string, number>();
  data.forEach((d) => {
    if (d.city) cityMap.set(d.city, (cityMap.get(d.city) || 0) + 1);
  });
  const cityData = Array.from(cityMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="dashboard-section">
        <p className="section-title">Статусы</p>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {statusData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.key] || STATUS_COLORS['other']} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {statusData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: STATUS_COLORS[entry.key] || STATUS_COLORS['other'] }}
              />
              {entry.name} ({entry.value})
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <p className="section-title">Топ городов</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={cityData} layout="vertical" margin={{ left: 5, right: 15 }}>
            <XAxis type="number" tick={{ fill: 'hsl(220,10%,45%)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'hsl(220,15%,70%)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="hsl(175, 70%, 42%)" radius={[0, 3, 3, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatusChart;
