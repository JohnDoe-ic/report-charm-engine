import { useState, useMemo } from 'react';
import { SalonLocation, normalizeStatus, StatusKey } from '@/lib/types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Download, ChevronDown, Info, Rows3 } from 'lucide-react';

export interface DrillDownContext {
  title: string;
  description: string;
  columns: { axis: string; field: string }[];
  aggregation: string;
  filters: { field: string; value: string }[];
  rows: SalonLocation[];
}

interface DrillDownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DrillDownContext | null;
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

const INITIAL_SHOW = 30;

const DrillDownDrawer = ({ open, onOpenChange, context }: DrillDownDrawerProps) => {
  const [showAll, setShowAll] = useState(false);

  const displayRows = useMemo(() => {
    if (!context) return [];
    return showAll ? context.rows : context.rows.slice(0, INITIAL_SHOW);
  }, [context, showAll]);

  const handleExportCSV = () => {
    if (!context) return;
    const headers = ['Регион', 'Город', 'Адрес', 'Партнер', 'Вероятность', 'КБ', 'КЦ', 'Формат', 'Статус', 'Тип', 'Мебель', 'Ремонт', 'Комментарий', 'Лист'];
    const csvRows = context.rows.map((r) => [
      r.region, r.city, r.address, r.commercialPartner || '', r.probability || '',
      r.regionApproval || '', r.kcApproval || '', r.salonFormat, normalizeStatus(r.status).label,
      r.salonType || '', r.furnitureStatus || '', r.repairStatus || r.repair || '',
      r.comment || '', r.sheetName,
    ]);
    const csv = [headers, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drill-down-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!context) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-foreground text-lg">{context.title}</SheetTitle>
          <SheetDescription className="sr-only">Детализация данных графика</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Как построено
            </div>
            <p className="text-sm text-foreground/80">{context.description}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {context.columns.map((c) => (
                <span key={c.axis} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5">
                  {c.axis}: {c.field}
                </span>
              ))}
              <span className="text-xs bg-accent/10 text-accent border border-accent/20 rounded-md px-2 py-0.5">
                Агрегация: {context.aggregation}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider text-muted-foreground">
                <Rows3 className="h-3.5 w-3.5" />
                {context.rows.length} строк
              </div>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>

            <div className="rounded-lg border overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="sticky top-0 bg-card text-xs font-display">Регион</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display">Город</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display">Адрес</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display">Вероятн.</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display">Формат</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((row) => {
                    const { key, label } = normalizeStatus(row.status);
                    return (
                      <TableRow key={row.id} className="border-border/50 hover:bg-secondary/50">
                        <TableCell className="text-xs">{row.region}</TableCell>
                        <TableCell className="text-xs">{row.city}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">{row.address}</TableCell>
                        <TableCell className="text-xs">{row.probability}</TableCell>
                        <TableCell className="text-xs">{row.salonFormat}</TableCell>
                        <TableCell>
                          <span className={`status-badge border ${statusBadgeStyles[key]}`}>{label}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {!showAll && context.rows.length > INITIAL_SHOW && (
              <button
                onClick={() => setShowAll(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mx-auto transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Показать ещё {context.rows.length - INITIAL_SHOW}
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DrillDownDrawer;
