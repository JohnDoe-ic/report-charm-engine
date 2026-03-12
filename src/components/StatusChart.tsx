import { SalonLocation, normalizeStatus, StatusKey } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Download } from 'lucide-react';

interface StatusChartProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'hsl(var(--status-open))',
  contract: 'hsl(var(--status-contract))',
  evaluation: 'hsl(var(--status-evaluation))',
  'no-rent': 'hsl(var(--status-no-rent))',
  rejected: 'hsl(var(--status-rejected))',
  approved: 'hsl(var(--status-approved))',
  other: 'hsl(var(--status-other))',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-foreground font-semibold">{payload[0].name}</p>
        <p className="text-muted-foreground text-xs">{payload[0].value} локаций ({((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%)</p>
      </div>
    );
  }
  return null;
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-foreground font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-muted-foreground text-xs">{p.value} локаций</p>
        ))}
      </div>
    );
  }
  return null;
};

const StatusChart = ({ data, onDrillDown }: StatusChartProps) => {
  const total = data.length;
  const statusMap = new Map<string, { count: number; key: string }>();
  data.forEach((d) => {
    const { label, key } = normalizeStatus(d.status);
    const existing = statusMap.get(label);
    statusMap.set(label, { count: (existing?.count || 0) + 1, key });
  });
  const statusData = Array.from(statusMap.entries())
    .map(([name, { count, key }]) => ({ name, value: count, key, total }))
    .sort((a, b) => b.value - a.value);

  const cityMap = new Map<string, { count: number; statuses: Record<string, number> }>();
  data.forEach((d) => {
    if (!d.city) return;
    if (!cityMap.has(d.city)) cityMap.set(d.city, { count: 0, statuses: {} });
    const entry = cityMap.get(d.city)!;
    entry.count++;
    const { key } = normalizeStatus(d.status);
    entry.statuses[key] = (entry.statuses[key] || 0) + 1;
  });
  const cityData = Array.from(cityMap.entries())
    .map(([name, { count, statuses }]) => ({ name, value: count, ...statuses }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const handlePieClick = (_: any, index: number) => {
    if (!onDrillDown) return;
    const entry = statusData[index];
    if (!entry) return;
    const rows = data.filter((d) => normalizeStatus(d.status).label === entry.name);
    onDrillDown({
      title: `Статус: ${entry.name}`,
      description: `Все локации со статусом "${entry.name}"`,
      columns: [{ axis: 'Категория', field: 'Статус' }],
      aggregation: 'Количество (count)',
      filters: [{ field: 'Статус', value: entry.name }],
      rows,
    });
  };

  const handleBarClick = (barData: any) => {
    if (!onDrillDown || !barData?.name) return;
    const rows = data.filter((d) => d.city === barData.name);
    onDrillDown({
      title: `Город: ${barData.name}`,
      description: `Все локации в городе "${barData.name}"`,
      columns: [{ axis: 'Y', field: 'Город' }, { axis: 'X', field: 'Количество' }],
      aggregation: 'Количество (count)',
      filters: [{ field: 'Город', value: barData.name }],
      rows,
    });
  };

  const statusKeys: { key: string; label: string }[] = [
    { key: 'open', label: 'Открыт' },
    { key: 'contract', label: 'На договоре' },
    { key: 'evaluation', label: 'Оценка' },
    { key: 'no-rent', label: 'Нет аренды' },
    { key: 'rejected', label: 'Отказ' },
    { key: 'approved', label: 'Одобрено' },
    { key: 'other', label: 'Прочее' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="dashboard-section">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Распределение статусов</p>
          <button
            type="button"
            onClick={() => exportChartToExcel(statusData.map(s => ({ Статус: s.name, Количество: s.value })), 'statuses')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Excel
          </button>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={105}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
              onClick={handlePieClick}
              style={{ cursor: 'pointer' }}
            >
              {statusData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.key] || STATUS_COLORS['other']} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
          {statusData.map((entry) => (
            <button
              type="button"
              key={entry.name}
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => {
                if (!onDrillDown) return;
                const rows = data.filter((d) => normalizeStatus(d.status).label === entry.name);
                onDrillDown({
                  title: `Статус: ${entry.name}`,
                  description: `Все локации со статусом "${entry.name}"`,
                  columns: [{ axis: 'Категория', field: 'Статус' }],
                  aggregation: 'Количество (count)',
                  filters: [{ field: 'Статус', value: entry.name }],
                  rows,
                });
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLORS[entry.key] || STATUS_COLORS['other'] }}
              />
              {entry.name} <span className="font-display font-semibold">{entry.value}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Топ-15 городов</p>
          <button
            type="button"
            onClick={() => exportChartToExcel(cityData.map(c => ({ Город: c.name, Количество: c.value })), 'top-cities')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Excel
          </button>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={cityData} layout="vertical" margin={{ left: 5, right: 15 }}>
            <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {statusKeys.map(({ key, label }) => (
              <Bar key={key} dataKey={key} name={label} stackId="a" fill={STATUS_COLORS[key]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatusChart;
