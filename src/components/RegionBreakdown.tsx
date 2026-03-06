import { SalonLocation, normalizeStatus } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Download } from 'lucide-react';

interface RegionBreakdownProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
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

const RegionBreakdown = ({ data, onDrillDown }: RegionBreakdownProps) => {
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

  const handleClick = (e: any) => {
    if (!onDrillDown || !e?.activePayload) return;
    const payload = e.activePayload[0]?.payload;
    if (!payload?.region) return;
    const rows = data.filter((d) => d.region === payload.region);
    onDrillDown({
      title: `Регион: ${payload.region}`,
      description: `Все локации в регионе "${payload.region}"`,
      columns: [{ axis: 'X', field: 'Регион' }, { axis: 'Y', field: 'Количество' }],
      aggregation: 'Количество (count) по статусам',
      filters: [{ field: 'Регион', value: payload.region }],
      rows,
    });
  };

  return (
    <div className="dashboard-section">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Регионы</p>
        <button
          type="button"
          onClick={() => exportChartToExcel(chartData.map(r => ({ Регион: r.region, Всего: r.total, Открыто: r.open, 'На договоре': r.contract, Оценка: r.evaluation })), 'regions')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3 w-3" />
          Excel
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
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
