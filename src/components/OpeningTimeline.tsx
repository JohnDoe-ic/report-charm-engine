import { SalonLocation, normalizeStatus } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';

interface OpeningTimelineProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-foreground font-semibold mb-1">{label}</p>
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
  const dateMap = new Map<string, { count: number; cumulative: number }>();
  const withDate = data.filter((d) => (d.openingDate && d.openingDate.trim()) || (d.openingPlan && d.openingPlan.trim()));

  // Use openingPlan as fallback for openingDate
  const getRawDate = (d: SalonLocation) => (d.openingDate?.trim() || d.openingPlan?.trim() || '');

  const parsed = withDate.map((d) => {
    const raw = getRawDate(d);
    let date: Date | null = null;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('.');
      date = new Date(+year, +month - 1, +day);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
      const parts = raw.split('/');
      const month = +parts[0];
      const day = +parts[1];
      let year = +parts[2];
      if (year < 100) year += 2000;
      date = new Date(year, month - 1, day);
    } else if (/^\d{4}-\d{2}/.test(raw)) {
      date = new Date(raw);
    } else {
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
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <defs>
            <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--status-open))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--status-open))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="cumulative" name="Накопительно" stroke="hsl(var(--primary))" fill="url(#colorCum)" strokeWidth={2} />
          <Area type="monotone" dataKey="opened" name="Открыто" stroke="hsl(var(--status-open))" fill="url(#colorOpened)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OpeningTimeline;
