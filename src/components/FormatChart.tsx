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

interface FormatChartProps {
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

const FormatChart = ({ data }: FormatChartProps) => {
  const formatStatusMap = new Map<string, Record<string, number>>();
  data.forEach((d) => {
    const format = (d.salonFormat || 'Не указан').toLowerCase();
    const { key } = normalizeStatus(d.status);
    if (!formatStatusMap.has(format)) formatStatusMap.set(format, {});
    const entry = formatStatusMap.get(format)!;
    entry[key] = (entry[key] || 0) + 1;
  });

  const chartData = Array.from(formatStatusMap.entries())
    .map(([format, statuses]) => ({
      format,
      ...statuses,
      total: Object.values(statuses).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const statusConfig: { key: string; label: string; color: string }[] = [
    { key: 'open', label: 'Открыт', color: 'hsl(140, 55%, 45%)' },
    { key: 'contract', label: 'На договоре', color: 'hsl(175, 70%, 42%)' },
    { key: 'evaluation', label: 'Оценка', color: 'hsl(38, 90%, 55%)' },
    { key: 'no-rent', label: 'Нет аренды', color: 'hsl(225, 10%, 40%)' },
    { key: 'rejected', label: 'Отказ', color: 'hsl(0, 65%, 48%)' },
    { key: 'other', label: 'Прочее', color: 'hsl(270, 50%, 55%)' },
  ];

  return (
    <div className="dashboard-section">
      <p className="section-title">Форматы × Статусы</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ bottom: 5 }}>
          <XAxis dataKey="format" tick={{ fill: 'hsl(220,15%,70%)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'hsl(220,10%,45%)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'hsl(220,10%,45%)' }}
          />
          {statusConfig.map(({ key, label, color }) => (
            <Bar key={key} dataKey={key} name={label} stackId="a" fill={color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FormatChart;
