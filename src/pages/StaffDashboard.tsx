import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { Users, ShoppingCart, Smartphone, Wallet, MapPin, Clock, Loader2 } from 'lucide-react';

interface StaffRow {
  'Сотрудник': string;
  'Лицевой счёт': string;
  'Роль': string;
  'Смен': number;
  'Локации': string;
  'Продажи': number;
  'Активации': number;
  'Пополнения': number;
  'Итого действий': number;
  'Telegram': string;
}

interface DetailRow {
  'Сотрудник': string;
  'Тип': string;
  'Адрес': string;
  'Дата/время': string;
}

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#6366f1', '#f59e0b', '#ef4444',
];

const StaffDashboard = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportName, setReportName] = useState('');

  useEffect(() => {
    if (!shareId) return;
    loadData();
  }, [shareId]);

  async function loadData() {
    setLoading(true);
    const { data: report } = await supabase.from('reports').select('*').eq('share_id', shareId).single();
    if (!report) { setLoading(false); return; }
    setReportName(report.file_name);

    // Fetch all rows
    const allRows: any[] = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('report_rows').select('*').eq('report_id', report.id).order('row_index').range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) { hasMore = false; } else { allRows.push(...data); hasMore = data.length === 1000; page++; }
    }

    const staff: StaffRow[] = allRows.filter(r => r.sheet_name === 'Сотрудники').map(r => r.data as any);
    const details: DetailRow[] = allRows.filter(r => r.sheet_name === 'Детали').map(r => r.data as any);
    setStaffRows(staff);
    setDetailRows(details);
    setLoading(false);
  }

  const totals = useMemo(() => {
    const sales = staffRows.reduce((s, r) => s + (r['Продажи'] || 0), 0);
    const activations = staffRows.reduce((s, r) => s + (r['Активации'] || 0), 0);
    const topups = staffRows.reduce((s, r) => s + (r['Пополнения'] || 0), 0);
    const shifts = staffRows.reduce((s, r) => s + (r['Смен'] || 0), 0);
    return { sales, activations, topups, shifts, total: sales + activations + topups };
  }, [staffRows]);

  const barData = useMemo(() => {
    return staffRows.map(r => ({
      name: r['Сотрудник'],
      Продажи: r['Продажи'] || 0,
      Активации: r['Активации'] || 0,
      Пополнения: r['Пополнения'] || 0,
    }));
  }, [staffRows]);

  const pieData = useMemo(() => {
    return [
      { name: 'Продажи', value: totals.sales },
      { name: 'Активации', value: totals.activations },
      { name: 'Пополнения', value: totals.topups },
    ].filter(d => d.value > 0);
  }, [totals]);

  const topPerformers = useMemo(() => {
    return [...staffRows].sort((a, b) => (b['Итого действий'] || 0) - (a['Итого действий'] || 0)).slice(0, 5);
  }, [staffRows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold tracking-tight">СОТРУДНИКИ</h1>
            <span className="text-xs text-muted-foreground">{reportName}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={<Users className="h-4 w-4" />} label="Сотрудников" value={staffRows.length} />
          <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="Продажи" value={totals.sales} />
          <StatCard icon={<Smartphone className="h-4 w-4" />} label="Активации" value={totals.activations} />
          <StatCard icon={<Wallet className="h-4 w-4" />} label="Пополнения" value={totals.topups} />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Смен" value={totals.shifts} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart: activities by staff */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Активность по сотрудникам</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Продажи" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Активации" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Пополнения" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart: activity breakdown */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Структура активностей</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top performers */}
        {topPerformers.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">🏆 Топ сотрудников</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {topPerformers.map((staff, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{i + 1}</div>
                  <div className="text-sm font-medium mt-1">{staff['Сотрудник']}</div>
                  <div className="text-xs text-muted-foreground mt-1">{staff['Итого действий']} действий</div>
                  <div className="text-xs text-muted-foreground">
                    🛒{staff['Продажи']} 📱{staff['Активации']} 💰{staff['Пополнения']}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff table */}
        <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3">Таблица сотрудников</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Сотрудник</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Л/С</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Роль</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Смен</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Продажи</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Активации</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Пополнения</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Итого</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Локации</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-3 font-medium">{r['Сотрудник']}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r['Лицевой счёт']}</td>
                  <td className="py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r['Роль'] === 'Администратор' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {r['Роль']}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">{r['Смен']}</td>
                  <td className="py-2 px-3 text-center font-medium">{r['Продажи']}</td>
                  <td className="py-2 px-3 text-center font-medium">{r['Активации']}</td>
                  <td className="py-2 px-3 text-center font-medium">{r['Пополнения']}</td>
                  <td className="py-2 px-3 text-center font-bold text-primary">{r['Итого действий']}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{r['Локации']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail activities */}
        {detailRows.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-3">Лог активностей ({detailRows.length})</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Сотрудник</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Тип</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Адрес</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Дата/время</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-3">{r['Сотрудник']}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r['Тип'] === 'Продажа' ? 'bg-green-500/20 text-green-400' :
                        r['Тип'] === 'Активация' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>{r['Тип']}</span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{r['Адрес']}</td>
                    <td className="py-2 px-3 text-muted-foreground">{r['Дата/время']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default StaffDashboard;
