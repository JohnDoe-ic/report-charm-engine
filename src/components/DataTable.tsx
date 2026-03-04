import { useState, useMemo } from 'react';
import { SalonLocation, normalizeStatus, StatusKey } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface DataTableProps {
  data: SalonLocation[];
}

const statusBadgeVariant: Record<StatusKey, string> = {
  open: 'bg-status-open/15 text-status-open border-status-open/30',
  contract: 'bg-status-contract/15 text-status-contract border-status-contract/30',
  evaluation: 'bg-status-evaluation/15 text-status-evaluation border-status-evaluation/30',
  'no-rent': 'bg-status-no-rent/15 text-status-no-rent border-status-no-rent/30',
  rejected: 'bg-status-rejected/15 text-status-rejected border-status-rejected/30',
  other: 'bg-status-other/15 text-status-other border-status-other/30',
};

const DataTable = ({ data }: DataTableProps) => {
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const regions = useMemo(() => [...new Set(data.map((d) => d.region).filter(Boolean))].sort(), [data]);
  const cities = useMemo(() => {
    const filtered = regionFilter !== 'all' ? data.filter((d) => d.region === regionFilter) : data;
    return [...new Set(filtered.map((d) => d.city).filter(Boolean))].sort();
  }, [data, regionFilter]);
  const statuses = useMemo(() => [...new Set(data.map((d) => normalizeStatus(d.status).label))].sort(), [data]);
  const formats = useMemo(() => [...new Set(data.map((d) => d.salonFormat).filter(Boolean))].sort(), [data]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (regionFilter !== 'all' && d.region !== regionFilter) return false;
      if (cityFilter !== 'all' && d.city !== cityFilter) return false;
      if (statusFilter !== 'all' && normalizeStatus(d.status).label !== statusFilter) return false;
      if (formatFilter !== 'all' && d.salonFormat !== formatFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          d.address.toLowerCase().includes(q) ||
          d.city.toLowerCase().includes(q) ||
          (d.comment || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, regionFilter, cityFilter, statusFilter, formatFilter, searchQuery]);

  return (
    <div className="dashboard-section">
      <h3 className="text-lg font-semibold mb-4 font-display">Сводная таблица</h3>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setCityFilter('all'); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Регион" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все регионы</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Город" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все города</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={formatFilter} onValueChange={setFormatFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Формат" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все форматы</SelectItem>
            {formats.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Поиск по адресу..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-[200px]"
        />

        <span className="text-sm text-muted-foreground self-center ml-auto">
          Найдено: {filtered.length}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 bg-card">Регион</TableHead>
              <TableHead className="sticky top-0 bg-card">Город</TableHead>
              <TableHead className="sticky top-0 bg-card">Адрес</TableHead>
              <TableHead className="sticky top-0 bg-card">Формат</TableHead>
              <TableHead className="sticky top-0 bg-card">Статус</TableHead>
              <TableHead className="sticky top-0 bg-card">Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const { key, label } = normalizeStatus(row.status);
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.region}</TableCell>
                  <TableCell>{row.city}</TableCell>
                  <TableCell className="max-w-[250px] truncate">{row.address}</TableCell>
                  <TableCell>{row.salonFormat}</TableCell>
                  <TableCell>
                    <span className={`status-badge border ${statusBadgeVariant[key]}`}>
                      {label}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground text-sm">
                    {row.comment}
                  </TableCell>
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
