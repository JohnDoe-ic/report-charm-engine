import { SalonLocation, normalizeStatus, StatusKey } from '@/lib/types';
import { DrillDownContext } from './DrillDownDrawer';
import { exportChartToExcel } from '@/lib/chartExport';
import { Download } from 'lucide-react';

interface RegionStatusHeatmapProps {
  data: SalonLocation[];
  onDrillDown?: (context: DrillDownContext) => void;
}

const STATUS_ORDER: { key: StatusKey; label: string; color: string }[] = [
  { key: 'open', label: 'Откр', color: 'hsl(var(--status-open))' },
  { key: 'contract', label: 'Дог', color: 'hsl(var(--status-contract))' },
  { key: 'approved', label: 'Одобр', color: 'hsl(var(--status-approved))' },
  { key: 'evaluation', label: 'Оцен', color: 'hsl(var(--status-evaluation))' },
  { key: 'no-rent', label: 'Нет', color: 'hsl(var(--status-no-rent))' },
  { key: 'rejected', label: 'Отказ', color: 'hsl(var(--status-rejected))' },
  { key: 'other', label: 'Прочее', color: 'hsl(var(--status-other))' },
];

const RegionStatusHeatmap = ({ data, onDrillDown }: RegionStatusHeatmapProps) => {
  const regionStatusMap = new Map<string, Record<StatusKey, number>>();

  data.forEach((d) => {
    if (!d.region) return;
    if (!regionStatusMap.has(d.region)) {
      regionStatusMap.set(d.region, { open: 0, contract: 0, evaluation: 0, 'no-rent': 0, rejected: 0, approved: 0, other: 0 });
    }
    const entry = regionStatusMap.get(d.region)!;
    const { key } = normalizeStatus(d.status);
    entry[key]++;
  });

  const regions = Array.from(regionStatusMap.entries())
    .map(([region, counts]) => ({ region, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  const maxVal = Math.max(...regions.flatMap((r) => Object.values(r.counts)), 1);

  const handleCellClick = (region: string, statusKey: StatusKey, statusLabel: string) => {
    if (!onDrillDown) return;
    const rows = data.filter((d) => d.region === region && normalizeStatus(d.status).key === statusKey);
    if (rows.length === 0) return;
    onDrillDown({
      title: `${region} — ${statusLabel}`,
      description: `Локации в "${region}" со статусом "${statusLabel}"`,
      columns: [{ axis: 'Строка', field: 'Регион' }, { axis: 'Столбец', field: 'Статус' }],
      aggregation: 'Количество (count)',
      filters: [{ field: 'Регион', value: region }, { field: 'Статус', value: statusLabel }],
      rows,
    });
  };

  if (regions.length === 0) {
    return (
      <div className="dashboard-section">
        <p className="section-title">Регион × Статус</p>
        <p className="text-xs text-muted-foreground">Нет данных</p>
      </div>
    );
  }

  return (
    <div className="dashboard-section">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Регион × Статус</p>
        <button
          type="button"
          onClick={() => exportChartToExcel(regions.map(r => {
            const row: Record<string, any> = { Регион: r.region };
            STATUS_ORDER.forEach(s => { row[s.label] = r.counts[s.key]; });
            row['Всего'] = r.total;
            return row;
          }), 'region-status')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3 w-3" />
          Excel
        </button>
      </div>
      <div className="overflow-auto max-h-[360px]">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-display uppercase tracking-wider text-muted-foreground py-2 px-2 sticky top-0 bg-card z-10">Регион</th>
              {STATUS_ORDER.map((s) => (
                <th key={s.key} className="text-center font-display uppercase tracking-wider py-2 px-1.5 sticky top-0 bg-card z-10" style={{ color: s.color, fontSize: 10 }}>
                  {s.label}
                </th>
              ))}
              <th className="text-center font-display uppercase tracking-wider text-muted-foreground py-2 px-2 sticky top-0 bg-card z-10">Σ</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.region} className="border-t border-border/30 hover:bg-secondary/40 transition-colors">
                <td className="py-2 px-2 font-medium text-foreground/80 max-w-[130px] truncate">{r.region}</td>
                {STATUS_ORDER.map((s) => {
                  const val = r.counts[s.key];
                  const opacity = val > 0 ? Math.max(0.15, val / maxVal) : 0;
                  return (
                    <td
                      key={s.key}
                      className="text-center py-2 px-1.5 cursor-pointer transition-all hover:ring-1 hover:ring-primary/40 rounded-md font-display font-medium"
                      style={{
                        backgroundColor: val > 0 ? `color-mix(in srgb, ${s.color} ${Math.round(opacity * 100)}%, transparent)` : 'transparent',
                        color: val > 0 ? s.color : 'hsl(var(--muted-foreground))',
                      }}
                      onClick={() => handleCellClick(r.region, s.key, s.label)}
                    >
                      {val || '·'}
                    </td>
                  );
                })}
                <td className="text-center py-2 px-2 font-display font-bold text-foreground/70">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegionStatusHeatmap;
