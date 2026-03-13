import { SalonLocation, normalizeStatus } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { Download, Users, Wrench, BarChart3, Shield, Sofa, TrendingUp } from 'lucide-react';

interface ExtraChartsProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
}

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))',
  'hsl(var(--status-open))', 'hsl(var(--status-evaluation))',
];

const PROB_COLORS: Record<string, string> = {
  'высокая': 'hsl(var(--status-open))',
  'средняя': 'hsl(var(--status-evaluation))',
  'низкая': 'hsl(var(--status-rejected))',
};

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
  // === PROBABILITY BREAKDOWN ===
  const probMap = new Map<string, number>();
  data.forEach((d) => {
    const prob = d.probability?.toLowerCase()?.trim() || 'не указана';
    probMap.set(prob, (probMap.get(prob) || 0) + 1);
  });
  const probData = Array.from(probMap.entries())
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, rawName: name }))
    .filter(d => d.rawName !== 'не указана' && d.rawName !== 'нет')
    .sort((a, b) => b.value - a.value);

  // === APPROVAL PIPELINE (КБ + КЦ) ===
  const approvalStages = [
    { name: 'КБ: Да', value: data.filter(d => d.regionApproval?.toLowerCase()?.includes('да') || d.regionApproval?.toLowerCase()?.includes('согласован')).length },
    { name: 'КБ: Нет', value: data.filter(d => d.regionApproval?.toLowerCase() === 'нет').length },
    { name: 'КЦ: Да', value: data.filter(d => d.kcApproval?.toLowerCase()?.includes('да') || d.kcApproval?.toLowerCase()?.includes('согласован')).length },
    { name: 'КЦ: Нет', value: data.filter(d => d.kcApproval?.toLowerCase() === 'нет').length },
  ].filter(d => d.value > 0);

  // === SALON TYPE ===
  const typeMap = new Map<string, number>();
  data.forEach((d) => {
    const t = d.salonType?.trim() || 'Не указан';
    if (t.toLowerCase() !== 'нет') typeMap.set(t, (typeMap.get(t) || 0) + 1);
  });
  const typeData = Array.from(typeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.name !== 'Не указан')
    .sort((a, b) => b.value - a.value);

  // === FURNITURE STATUS ===
  const furnMap = new Map<string, number>();
  data.forEach((d) => {
    const f = d.furnitureStatus?.trim() || 'Не указан';
    if (f.toLowerCase() !== 'нет') furnMap.set(f, (furnMap.get(f) || 0) + 1);
  });
  const furnData = Array.from(furnMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.name !== 'Не указан')
    .sort((a, b) => b.value - a.value);

  // === REPAIR STATUS ===
  const repairMap = new Map<string, number>();
  data.forEach((d) => {
    const r = d.repairStatus?.trim() || d.repair?.trim() || 'Не указан';
    if (r.toLowerCase() !== 'нет') repairMap.set(r, (repairMap.get(r) || 0) + 1);
  });
  const repairData = Array.from(repairMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.name !== 'Не указан')
    .sort((a, b) => b.value - a.value);

  // === PARTNER BREAKDOWN ===
  const partnerMap = new Map<string, number>();
  data.forEach((d) => {
    const partner = d.commercialPartner || 'Не указан';
    if (partner.toLowerCase() !== 'нет') partnerMap.set(partner, (partnerMap.get(partner) || 0) + 1);
  });
  const partnerData = Array.from(partnerMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.name !== 'Не указан')
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // === RENT SUMMARY ===
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

  const handleProbClick = (_: any, index: number) => {
    if (!onDrillDown || !probData[index]) return;
    const name = probData[index].rawName;
    const rows = data.filter(d => (d.probability?.toLowerCase()?.trim() || 'не указана') === name);
    onDrillDown({
      title: `Вероятность: ${probData[index].name}`,
      description: `Локации с вероятностью "${probData[index].name}"`,
      columns: [{ axis: 'Категория', field: 'Вероятность' }],
      aggregation: 'Количество (count)',
      filters: [{ field: 'Вероятность', value: probData[index].name }],
      rows,
    });
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Probability + Approvals + Salon Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Probability pie */}
        {probData.length > 0 && (
          <div className="dashboard-section">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-chart-2" />
              <p className="section-title mb-0">Вероятность</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={probData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0} onClick={handleProbClick} style={{ cursor: 'pointer' }}>
                  {probData.map((entry) => (
                    <Cell key={entry.name} fill={PROB_COLORS[entry.rawName] || COLORS[probData.indexOf(entry) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {probData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROB_COLORS[d.rawName] || COLORS[0] }} />
                  {d.name}: <span className="font-display font-semibold">{d.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Approval pipeline */}
        {approvalStages.length > 0 && (
          <div className="dashboard-section">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-chart-1" />
              <p className="section-title mb-0">Согласования (КБ / КЦ)</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={approvalStages} margin={{ left: 5, right: 10 }}>
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipContent />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28}>
                  {approvalStages.map((entry, i) => (
                    <Cell key={i} fill={entry.name.includes('Да') ? 'hsl(var(--status-approved))' : 'hsl(var(--status-rejected))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Salon Type */}
        {typeData.length > 0 && (
          <div className="dashboard-section">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-chart-3" />
              <p className="section-title mb-0">Тип салона</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {typeData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {d.name}: <span className="font-display font-semibold">{d.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Furniture + Repair + Partners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Furniture status */}
        {furnData.length > 0 && (
          <div className="dashboard-section">
            <div className="flex items-center gap-2 mb-4">
              <Sofa className="h-4 w-4 text-chart-5" />
              <p className="section-title mb-0">Статус мебели</p>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-auto">
              {furnData.map((d, i) => {
                const pct = Math.round((d.value / data.length) * 100);
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground/80 truncate max-w-[70%]">{d.name}</span>
                      <span className="font-display font-semibold text-foreground">{d.value}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Repair status */}
        {repairData.length > 0 && (
          <div className="dashboard-section">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-4 w-4 text-chart-4" />
              <p className="section-title mb-0">Статус ремонта</p>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-auto">
              {repairData.map((d, i) => {
                const pct = Math.round((d.value / data.length) * 100);
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground/80 truncate max-w-[70%]">{d.name}</span>
                      <span className="font-display font-semibold text-foreground">{d.value}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[(i + 3) % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Partner chart */}
        {partnerData.length > 0 && (
          <div className="dashboard-section">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-chart-1" />
                <p className="section-title mb-0">Топ партнеры</p>
              </div>
              <button
                type="button"
                onClick={() => exportChartToExcel(partnerData.map(p => ({ Партнер: p.name, Количество: p.value })), 'partners')}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-3 w-3" />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
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
      </div>

      {/* Row 3: Rent summary */}
      {rentData.length > 0 && (
        <div className="dashboard-section">
          <div className="flex items-center gap-2 mb-4">
            <p className="section-title mb-0">Аренда по регионам</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {rentData.slice(0, 12).map((r) => (
              <div key={r.region} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="text-xs font-medium text-foreground/80 truncate">{r.region}</p>
                <p className="font-display text-lg font-bold text-primary">{r.count}</p>
                {r.totalArea > 0 && (
                  <p className="text-[10px] text-muted-foreground">{r.totalArea} м²</p>
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
