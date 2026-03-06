import { SalonLocation, normalizeStatus } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
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
import { Download } from 'lucide-react';

interface StatusChartProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
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

const StatusChart = ({ data, onDrillDown }: StatusChartProps) => {
  const statusMap = new Map<string, { count: number; key: string }>();
  data.forEach((d) => {
    const { label, key } = normalizeStatus(d.status);
    const existing = statusMap.get(label);
    statusMap.set(label, { count: (existing?.count || 0) + 1, key });
  });
  const statusData = Array.from(statusMap.entries())
    .map(([name, { count, key }]) => ({ name, value: count, key }))
    .sort((a, b) => b.value - a.value);

  const cityMap = new Map<string, number>();
  data.forEach((d) => {
    if (d.city) cityMap.set(d.city, (cityMap.get(d.city) || 0) + 1);
  });
  const cityData = Array.from(cityMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

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

  const handleLegendClick = (entry: typeof statusData[0]) => {
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
  };

  const handleBarClick = (barData: any) => {
    if (!onDrillDown || !barData?.name) return;
    const cityName = barData.name;
    const rows = data.filter((d) => d.city === cityName);
    onDrillDown({
      title: `Город: ${cityName}`,
      description: `Все локации в городе "${cityName}"`,
      columns: [{ axis: 'Y', field: 'Город' }, { axis: 'X', field: 'Количество' }],
      aggregation: 'Количество (count)',
      filters: [{ field: 'Город', value: cityName }],
      rows,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="dashboard-section">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Статусы</p>
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
              innerRadius={55}
              outerRadius={100}
              paddingAngle={2}
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
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {statusData.map((entry) => (
            <button
              type="button"
              key={entry.name}
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLegendClick(entry); }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: STATUS_COLORS[entry.key] || STATUS_COLORS['other'] }}
              />
              {entry.name} ({entry.value})
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Топ городов</p>
          <button
            type="button"
            onClick={() => exportChartToExcel(cityData.map(c => ({ Город: c.name, Количество: c.value })), 'top-cities')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Excel
          </button>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={cityData} layout="vertical" margin={{ left: 5, right: 15 }}>
            <XAxis type="number" tick={{ fill: 'hsl(220,10%,45%)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'hsl(220,15%,70%)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="value"
              fill="hsl(175, 70%, 42%)"
              radius={[0, 3, 3, 0]}
              barSize={16}
              onClick={handleBarClick}
              style={{ cursor: 'pointer' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatusChart;
