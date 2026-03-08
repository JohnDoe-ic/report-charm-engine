import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';

interface TrackedLocation {
  first_seen_at: string;
  is_baseline: boolean;
  region: string | null;
}

export default function NewLocationsChart() {
  const [data, setData] = useState<TrackedLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const allRows: TrackedLocation[] = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: rows } = await supabase
        .from('tracked_locations')
        .select('first_seen_at, is_baseline, region')
        .eq('is_baseline', false)
        .order('first_seen_at')
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!rows || rows.length === 0) { hasMore = false; } else {
        allRows.push(...rows);
        hasMore = rows.length === 1000;
        page++;
      }
    }
    setData(allRows);
    setLoading(false);
  }

  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    const byDate: Record<string, number> = {};
    for (const loc of data) {
      const date = new Date(loc.first_seen_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
      byDate[date] = (byDate[date] || 0) + 1;
    }
    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }, [data]);

  const totalNew = data.length;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center h-[200px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chartData.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Динамика новых точек</h3>
        <span className="text-xs text-muted-foreground ml-auto">Всего новых: {totalNew}</span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar dataKey="count" name="Новых точек" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
