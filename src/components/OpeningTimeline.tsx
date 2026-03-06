import { SalonLocation, normalizeStatus } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';

interface OpeningTimelineProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 text-sm shadow-lg">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="text-xs text-muted-foreground">
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const OpeningTimeline = ({ data, onDrillDown }: OpeningTimelineProps) => {
  // Group by opening date (month/year)
  const dateMap = new Map<string, { count: number; cumulative: number }>();
  const withDate = data.filter((d) => d.openingDate && d.openingDate.trim());

  // Parse dates and sort
  const parsed = withDate.map((d) => {
    const raw = d.openingDate!.trim();
    // Try common formats: DD.MM.YYYY, YYYY-MM-DD, etc.
    let date: Date | null = null;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('.');
      date = new Date(+year, +month - 1, +day);
    } else if (/^\d{4}-\d{2}/.test(raw)) {
      date = new Date(raw);
    } else {
      // Try Excel serial number
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 40000) {
        date = new Date((num - 25569) * 86400 * 1000);
      }
    }
    return { ...d, parsedDate: date };
  }).filter((d) => d.parsedDate && !isNaN(d.parsedDate.getTime()));

  parsed.sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  parsed.forEach((d) => {
    const dt = d.parsedDate!;
    const key = `${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
    const entry = dateMap.get(key) || { count: 0, cumulative: 0 };
    entry.count++;
    dateMap.set(key, entry);
  });

  let cumulative = 0;
  const chartData = Array.from(dateMap.entries()).map(([month, val]) => {
    cumulative += val.count;
    return { month, opened: val.count, cumulative };
  });

  if (chartData.length === 0) {
    return (
      <div className="dashboard-section">
        <p className="section-title">Открытия по месяцам</p>
        <p className="text-xs text-muted-foreground">Нет данных о датах открытия</p>
      </div>
    );
  }

  const handleClick = (e: any) => {
    if (!onDrillDown || !e?.activePayload) return;
    const payload = e.activePayload[0]?.payload;
    if (!payload?.month) return;
    const rows = parsed.filter((d) => {
      const dt = d.parsedDate!;
      return `${monthNames[dt.getMonth()]} ${dt.getFullYear()}` === payload.month;
    });
    onDrillDown({
      title: `Открытия: ${payload.month}`,
      description: `Локации, открытые в ${payload.month}`,
      columns: [{ axis: 'X', field: 'Месяц' }, { axis: 'Y', field: 'Количество открытий' }],
      aggregation: 'Количество (count)',
      filters: [{ field: 'Период', value: payload.month }],
      rows,
    });
  };

  return (
    <div className="dashboard-section">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Открытия по месяцам</p>
        <button
          type="button"
          onClick={() => exportChartToExcel(chartData.map(r => ({ Месяц: r.month, Открыто: r.opened, Накопительно: r.cumulative })), 'openings')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3 w-3" />
          Excel
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <defs>
            <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(175, 70%, 42%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(175, 70%, 42%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fill: 'hsl(220,15%,70%)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'hsl(220,10%,45%)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulative"
            name="Накопительно"
            stroke="hsl(175, 70%, 42%)"
            fill="url(#colorOpened)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="opened"
            name="Открыто"
            stroke="hsl(140, 55%, 45%)"
            fill="hsl(140, 55%, 45%)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OpeningTimeline;
