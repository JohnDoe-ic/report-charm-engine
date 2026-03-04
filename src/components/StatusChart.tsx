import { SalonLocation, normalizeStatus } from '@/lib/types';
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
  Legend,
} from 'recharts';

interface StatusChartProps {
  data: SalonLocation[];
}

const STATUS_COLORS: Record<string, string> = {
  'open': 'hsl(150, 60%, 40%)',
  'contract': 'hsl(190, 80%, 35%)',
  'evaluation': 'hsl(35, 90%, 55%)',
  'no-rent': 'hsl(220, 10%, 50%)',
  'rejected': 'hsl(0, 72%, 51%)',
  'other': 'hsl(260, 50%, 55%)',
};

const StatusChart = ({ data }: StatusChartProps) => {
  // Status distribution
  const statusMap = new Map<string, number>();
  data.forEach((d) => {
    const { label } = normalizeStatus(d.status);
    statusMap.set(label, (statusMap.get(label) || 0) + 1);
  });
  const statusData = Array.from(statusMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // City distribution (top 10)
  const cityMap = new Map<string, number>();
  data.forEach((d) => {
    if (d.city) cityMap.set(d.city, (cityMap.get(d.city) || 0) + 1);
  });
  const cityData = Array.from(cityMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const getStatusColor = (name: string) => {
    const entry = data.find((d) => normalizeStatus(d.status).label === name);
    if (!entry) return STATUS_COLORS['other'];
    return STATUS_COLORS[normalizeStatus(entry.status).key] || STATUS_COLORS['other'];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="dashboard-section">
        <h3 className="text-lg font-semibold mb-4 font-display">Распределение по статусам</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {statusData.map((entry) => (
                <Cell key={entry.name} fill={getStatusColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="dashboard-section">
        <h3 className="text-lg font-semibold mb-4 font-display">Топ-10 городов</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cityData} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(190, 80%, 35%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatusChart;
