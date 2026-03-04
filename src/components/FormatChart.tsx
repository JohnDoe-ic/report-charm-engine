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

const FormatChart = ({ data }: FormatChartProps) => {
  // Format distribution with status breakdown
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

  const statusLabels: Record<string, string> = {
    open: 'Открыт',
    contract: 'На договоре',
    evaluation: 'Оценка',
    'no-rent': 'Нет аренды',
    rejected: 'Отказ',
    other: 'Прочее',
  };

  const colors: Record<string, string> = {
    open: 'hsl(150, 60%, 40%)',
    contract: 'hsl(190, 80%, 35%)',
    evaluation: 'hsl(35, 90%, 55%)',
    'no-rent': 'hsl(220, 10%, 50%)',
    rejected: 'hsl(0, 72%, 51%)',
    other: 'hsl(260, 50%, 55%)',
  };

  return (
    <div className="dashboard-section">
      <h3 className="text-lg font-semibold mb-4 font-display">Форматы салонов по статусам</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ bottom: 20 }}>
          <XAxis dataKey="format" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          {Object.entries(statusLabels).map(([key, label]) => (
            <Bar key={key} dataKey={key} name={label} stackId="a" fill={colors[key]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FormatChart;
