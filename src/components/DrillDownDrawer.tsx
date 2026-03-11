import { useState, useMemo } from 'react';
import { SalonLocation, normalizeStatus, StatusKey } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  open: 'bg-[hsl(140,55%,45%,0.15)] text-[hsl(140,55%,55%)] border-[hsl(140,55%,45%,0.3)]',
  contract: 'bg-[hsl(175,70%,42%,0.15)] text-[hsl(175,70%,52%)] border-[hsl(175,70%,42%,0.3)]',
  evaluation: 'bg-[hsl(38,90%,55%,0.15)] text-[hsl(38,90%,60%)] border-[hsl(38,90%,55%,0.3)]',
  'no-rent': 'bg-[hsl(225,10%,40%,0.15)] text-[hsl(225,10%,55%)] border-[hsl(225,10%,40%,0.3)]',
  rejected: 'bg-[hsl(0,65%,48%,0.15)] text-[hsl(0,65%,58%)] border-[hsl(0,65%,48%,0.3)]',
  other: 'bg-[hsl(270,50%,55%,0.15)] text-[hsl(270,50%,65%)] border-[hsl(270,50%,55%,0.3)]',
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
    const headers = ['Регион', 'Город/НП', 'Район', 'Адрес', 'Партнер', 'Вероятность', 'КБ региона', 'КЦ', 'Формат', 'Статус аренды', 'Тип салона', 'Мебель', 'Ремонт', 'Ст. ремонта', 'Лист'];
    const csvRows = context.rows.map((r) => [
      r.region, r.city, r.district || '', r.address, r.commercialPartner || '',
      r.probability || '', r.regionApproval || '', r.kcApproval || '',
      r.salonFormat, normalizeStatus(r.status).label, r.salonType || '',
      r.furnitureStatus || '', r.repair || '', r.repairStatus || '', r.sheetName,
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
          {/* How it was built */}
          <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Как построено
            </div>
            <p className="text-sm text-foreground/80">{context.description}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {context.columns.map((c) => (
                <span key={c.axis} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5">
                  {c.axis}: {c.field}
                </span>
              ))}
              <span className="text-xs bg-accent/10 text-accent border border-accent/20 rounded px-2 py-0.5">
                Агрегация: {context.aggregation}
              </span>
            </div>
            {context.filters.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {context.filters.map((f, i) => (
                  <span key={i} className="text-xs bg-muted text-muted-foreground rounded px-2 py-0.5">
                    {f.field} = {f.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Data table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider text-muted-foreground">
                <Rows3 className="h-3.5 w-3.5" />
                Данные элемента — {context.rows.length} строк
              </div>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>

            <div className="rounded-md border overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Регион</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Город</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Адрес</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Формат</TableHead>
                    <TableHead className="sticky top-0 bg-card text-xs font-display uppercase tracking-wider text-muted-foreground">Статус</TableHead>
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
