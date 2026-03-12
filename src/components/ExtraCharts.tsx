import { SalonLocation, normalizeStatus } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Download, Users, Wrench } from 'lucide-react';

interface ExtraChartsProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
}

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))',
  'hsl(var(--status-open))', 'hsl(var(--status-evaluation))',
];

const TooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-foreground font-semibold text-xs">{label || payload[0]?.name}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-muted-foreground text-xs">{p.value} локаций</p>
        ))}
      </div>
    );
  }
  return null;
};

const ExtraCharts = ({ data, onDrillDown }: ExtraChartsProps) => {
  // Partner breakdown
  const partnerMap = new Map<string, number>();
  data.forEach((d) => {
    const partner = d.commercialPartner || 'Не указан';
    partnerMap.set(partner, (partnerMap.get(partner) || 0) + 1);
  });
  const partnerData = Array.from(partnerMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.name !== 'Не указан')
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Repair/furniture readiness
  const repairDone = data.filter(d => d.repairMeasurements && d.repairMeasurements.toLowerCase().includes('проведен')).length;
  const repairPossible = data.filter(d => d.repairMeasurements && d.repairMeasurements.toLowerCase().includes('возможн')).length;
  const repairNone = data.length - repairDone - repairPossible;

  const readinessData = [
    { name: 'Замеры проведены', value: repairDone },
    { name: 'Замеры возможны', value: repairPossible },
    { name: 'Нет данных', value: repairNone },
  ].filter(d => d.value > 0);

  // Rent data - locations with rent info
  const withRent = data.filter(d => d.rentAmount || d.rentArea);
  const rentByRegion = new Map<string, { count: number; totalArea: number }>();
  withRent.forEach(d => {
    const region = d.region || 'Не указан';
    if (!rentByRegion.has(region)) rentByRegion.set(region, { count: 0, totalArea: 0 });
    const entry = rentByRegion.get(region)!;
    entry.count++;
    const area = parseFloat(String(d.rentArea || '0').replace(/[^\d.]/g, ''));
    if (!isNaN(area)) entry.totalArea += area;
  });
  const rentData = Array.from(rentByRegion.entries())
    .map(([region, { count, totalArea }]) => ({ region, count, totalArea: Math.round(totalArea) }))
    .sort((a, b) => b.count - a.count);

  const handlePartnerClick = (e: any) => {
    if (!onDrillDown || !e?.activePayload) return;
    const name = e.activePayload[0]?.payload?.name;
    if (!name) return;
    const rows = data.filter(d => (d.commercialPartner || 'Не указан') === name);
    onDrillDown({
      title: `Партнер: ${name}`,
      description: `Все локации коммерческого партнера "${name}"`,
      columns: [{ axis: 'Y', field: 'Партнер' }],
      aggregation: 'Количество (count)',
      filters: [{ field: 'Партнер', value: name }],
      rows,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Partner chart */}
      {partnerData.length > 0 && (
        <div className="dashboard-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-chart-1" />
              <p className="section-title mb-0">Партнеры</p>
            </div>
            <button
              type="button"
              onClick={() => exportChartToExcel(partnerData.map(p => ({ Партнер: p.name, Количество: p.value })), 'partners')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-3 w-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={partnerData} layout="vertical" margin={{ left: 5, right: 10 }} onClick={handlePartnerClick} style={{ cursor: 'pointer' }}>
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipContent />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                {partnerData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Readiness pie */}
      {readinessData.length > 1 && (
        <div className="dashboard-section">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-4 w-4 text-chart-2" />
            <p className="section-title mb-0">Готовность (замеры)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={readinessData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {readinessData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<TooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {readinessData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {d.name}: <span className="font-display font-semibold">{d.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rent summary */}
      {rentData.length > 0 && (
        <div className="dashboard-section">
          <div className="flex items-center gap-2 mb-4">
            <p className="section-title mb-0">Аренда (с данными)</p>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-auto">
            {rentData.map((r, i) => (
              <div key={r.region} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-xs font-medium text-foreground/80 flex-1 truncate">{r.region}</span>
                <span className="text-xs font-display font-semibold text-primary">{r.count} лок.</span>
                {r.totalArea > 0 && (
                  <span className="text-xs text-muted-foreground">{r.totalArea} м²</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex justify-between text-xs">
            <span className="text-muted-foreground">Всего с арендой:</span>
            <span className="font-display font-bold text-primary">{withRent.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtraCharts;
