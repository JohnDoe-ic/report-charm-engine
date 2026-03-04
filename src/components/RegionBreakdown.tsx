import { SalonLocation, normalizeStatus } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RegionBreakdownProps {
  data: SalonLocation[];
}

const RegionBreakdown = ({ data }: RegionBreakdownProps) => {
  const regionMap = new Map<string, { total: number; open: number; contract: number }>();

  data.forEach((d) => {
    if (!d.region) return;
    if (!regionMap.has(d.region)) regionMap.set(d.region, { total: 0, open: 0, contract: 0 });
    const entry = regionMap.get(d.region)!;
    entry.total++;
    const { key } = normalizeStatus(d.status);
    if (key === 'open') entry.open++;
    if (key === 'contract') entry.contract++;
  });

  const chartData = Array.from(regionMap.entries())
    .map(([region, vals]) => ({ region, ...vals }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="dashboard-section">
      <h3 className="text-lg font-semibold mb-4 font-display">По регионам</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="region" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total" name="Всего" fill="hsl(190, 80%, 35%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="contract" name="На договоре" fill="hsl(35, 90%, 55%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="open" name="Открыто" fill="hsl(150, 60%, 40%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RegionBreakdown;
