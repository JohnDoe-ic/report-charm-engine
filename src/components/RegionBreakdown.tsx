import { SalonLocation, normalizeStatus } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface RegionBreakdownProps {
  data: SalonLocation[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 text-sm shadow-lg">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.filter((p: any) => p.value > 0).map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.fill }} />
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const RegionBreakdown = ({ data }: RegionBreakdownProps) => {
  const regionMap = new Map<string, { total: number; open: number; contract: number; evaluation: number }>();

  data.forEach((d) => {
    if (!d.region) return;
    if (!regionMap.has(d.region)) regionMap.set(d.region, { total: 0, open: 0, contract: 0, evaluation: 0 });
    const entry = regionMap.get(d.region)!;
    entry.total++;
    const { key } = normalizeStatus(d.status);
    if (key === 'open') entry.open++;
    if (key === 'contract') entry.contract++;
    if (key === 'evaluation') entry.evaluation++;
  });

  const chartData = Array.from(regionMap.entries())
    .map(([region, vals]) => ({ region, ...vals }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="dashboard-section">
      <p className="section-title">Регионы</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="region" tick={{ fill: 'hsl(220,15%,70%)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'hsl(220,10%,45%)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(220,10%,45%)' }} />
          <Bar dataKey="total" name="Всего" fill="hsl(225, 15%, 25%)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="contract" name="На договоре" fill="hsl(175, 70%, 42%)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="evaluation" name="Оценка" fill="hsl(38, 90%, 55%)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="open" name="Открыто" fill="hsl(140, 55%, 45%)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RegionBreakdown;
