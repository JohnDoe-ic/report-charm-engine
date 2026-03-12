import { SalonLocation, normalizeStatus } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Download } from 'lucide-react';

interface FormatChartProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-foreground font-semibold mb-1">{label}</p>
        {payload.filter((p: any) => p.value > 0).map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const FormatChart = ({ data, onDrillDown }: FormatChartProps) => {
  const formatStatusMap = new Map<string, Record<string, number>>();
  data.forEach((d) => {
    const format = d.salonFormat || 'Не указан';
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
    { key: 'open', label: 'Открыт', color: 'hsl(var(--status-open))' },
    { key: 'contract', label: 'На договоре', color: 'hsl(var(--status-contract))' },
    { key: 'evaluation', label: 'Оценка', color: 'hsl(var(--status-evaluation))' },
    { key: 'approved', label: 'Одобрено', color: 'hsl(var(--status-approved))' },
    { key: 'no-rent', label: 'Нет аренды', color: 'hsl(var(--status-no-rent))' },
    { key: 'rejected', label: 'Отказ', color: 'hsl(var(--status-rejected))' },
    { key: 'other', label: 'Прочее', color: 'hsl(var(--status-other))' },
  ];

  const handleClick = (e: any) => {
    if (!onDrillDown || !e?.activePayload) return;
    const payload = e.activePayload[0]?.payload;
    if (!payload?.format) return;
    const rows = data.filter((d) => (d.salonFormat || 'Не указан') === payload.format);
    onDrillDown({
      title: `Формат: ${payload.format}`,
      description: `Все локации формата "${payload.format}" с разбивкой по статусам`,
      columns: [{ axis: 'X', field: 'Формат салона' }, { axis: 'Y', field: 'Количество' }, { axis: 'Серия', field: 'Статус' }],
      aggregation: 'Количество (count) по статусам (stacked)',
      filters: [{ field: 'Формат', value: payload.format }],
      rows,
    });
  };

  return (
    <div className="dashboard-section">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Форматы × Статусы</p>
        <button
          type="button"
          onClick={() => exportChartToExcel(chartData.map(r => {
            const row: Record<string, any> = { Формат: r.format };
            statusConfig.forEach(s => { row[s.label] = (r as any)[s.key] || 0; });
            row['Всего'] = r.total;
            return row;
          }), 'formats')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3 w-3" />
          Excel
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ bottom: 5 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <XAxis dataKey="format" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {statusConfig.map(({ key, label, color }) => (
            <Bar key={key} dataKey={key} name={label} stackId="a" fill={color} radius={key === 'other' ? [3, 3, 0, 0] : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FormatChart;
