import { useState, useMemo } from 'react';
import { SalonLocation, normalizeStatus, StatusKey } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface DataTableProps {
  data: SalonLocation[];
}

const statusBadgeStyles: Record<StatusKey, string> = {
  open: 'bg-status-open/15 text-status-open border-status-open/30',
  contract: 'bg-status-contract/15 text-status-contract border-status-contract/30',
  evaluation: 'bg-status-evaluation/15 text-status-evaluation border-status-evaluation/30',
  'no-rent': 'bg-status-no-rent/15 text-status-no-rent border-status-no-rent/30',
  rejected: 'bg-status-rejected/15 text-status-rejected border-status-rejected/30',
  approved: 'bg-status-approved/15 text-status-approved border-status-approved/30',
  other: 'bg-status-other/15 text-status-other border-status-other/30',
};

const DataTable = ({ data }: DataTableProps) => {
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [probFilter, setProbFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const regions = useMemo(() => [...new Set(data.map((d) => d.region).filter(Boolean))].sort(), [data]);
  const cities = useMemo(() => {
    const filtered = regionFilter !== 'all' ? data.filter((d) => d.region === regionFilter) : data;
    return [...new Set(filtered.map((d) => d.city).filter(Boolean))].sort();
  }, [data, regionFilter]);
  const statuses = useMemo(() => [...new Set(data.map((d) => normalizeStatus(d.status).label))].sort(), [data]);
  const probs = useMemo(() => [...new Set(data.map((d) => d.probability).filter(Boolean))].sort() as string[], [data]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (regionFilter !== 'all' && d.region !== regionFilter) return false;
      if (cityFilter !== 'all' && d.city !== cityFilter) return false;
      if (statusFilter !== 'all' && normalizeStatus(d.status).label !== statusFilter) return false;
      if (probFilter !== 'all' && d.probability !== probFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          d.address.toLowerCase().includes(q) ||
          d.city.toLowerCase().includes(q) ||
          (d.commercialPartner || '').toLowerCase().includes(q) ||
          (d.comment || '').toLowerCase().includes(q) ||
          (d.district || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, regionFilter, cityFilter, statusFilter, probFilter, searchQuery]);

  return (
    <div className="dashboard-section">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Сводная таблица</p>
        <span className="text-xs text-muted-foreground font-display">
          {filtered.length} / {data.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setCityFilter('all'); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary border-border">
            <SelectValue placeholder="Регион" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все регионы</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary border-border">
            <SelectValue placeholder="Город" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все города</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs bg-secondary border-border">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={probFilter} onValueChange={setProbFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary border-border">
            <SelectValue placeholder="Вероятность" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            {probs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-[180px] h-8 text-xs bg-secondary border-border"
        />
      </div>

      <div className="rounded-lg border overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Регион</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Город</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Адрес</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Партнер</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Вероятн.</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">КБ</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">КЦ</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Формат</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Статус</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Тип</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Мебель</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Ремонт</TableHead>
              <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const { key, label } = normalizeStatus(row.status);
              return (
                <TableRow key={row.id} className="border-border/50 hover:bg-secondary/50">
                  <TableCell className="text-xs font-medium">{row.region}</TableCell>
                  <TableCell className="text-xs">{row.city}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{row.address}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{row.commercialPartner}</TableCell>
                  <TableCell className="text-xs">{row.probability}</TableCell>
                  <TableCell className="text-xs max-w-[80px] truncate">{row.regionApproval}</TableCell>
                  <TableCell className="text-xs max-w-[80px] truncate">{row.kcApproval}</TableCell>
                  <TableCell className="text-xs">{row.salonFormat}</TableCell>
                  <TableCell>
                    <span className={`status-badge border ${statusBadgeStyles[key]}`}>{label}</span>
                  </TableCell>
                  <TableCell className="text-xs">{row.salonType}</TableCell>
                  <TableCell className="text-xs max-w-[80px] truncate">{row.furnitureStatus}</TableCell>
                  <TableCell className="text-xs max-w-[80px] truncate">{row.repairStatus || row.repair}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">{row.comment}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default DataTable;
