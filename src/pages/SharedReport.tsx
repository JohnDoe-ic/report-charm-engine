import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loadReport } from '@/lib/reportService';
import { SalonLocation } from '@/lib/types';
import StatCards from '@/components/StatCards';
import StatusChart from '@/components/StatusChart';
import FormatChart from '@/components/FormatChart';
import RegionBreakdown from '@/components/RegionBreakdown';
import OpeningTimeline from '@/components/OpeningTimeline';
import RegionStatusHeatmap from '@/components/RegionStatusHeatmap';
import DataTable from '@/components/DataTable';
import SheetTabs from '@/components/SheetTabs';
import DrillDownDrawer, { DrillDownContext } from '@/components/DrillDownDrawer';
import AiReportPanel from '@/components/AiReportPanel';
import { LayoutDashboard, Loader2, AlertCircle, Home } from 'lucide-react';

const SharedReport = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allData, setAllData] = useState<SalonLocation[]>([]);
  const [reportName, setReportName] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [activeSheet, setActiveSheet] = useState('all');
  const [drillDown, setDrillDown] = useState<DrillDownContext | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  useEffect(() => {
    if (!shareId) return;
    loadReport(shareId).then((result) => {
      if (!result) {
        setError('Отчёт не найден');
      } else {
        setAllData(result.locations);
        setReportName(result.report.fileName);
        setReportDate(new Date(result.report.createdAt).toLocaleDateString('ru-RU'));
      }
      setLoading(false);
    }).catch(() => {
      setError('Ошибка загрузки');
      setLoading(false);
    });
  }, [shareId]);

  const handleDrillDown = useCallback((context: DrillDownContext) => {
    setDrillDown(context);
    setDrillDownOpen(true);
  }, []);

  const sheets = useMemo(() => {
    return [...new Set(allData.map((d) => d.sheetName))];
  }, [allData]);

  const filteredData = useMemo(() => {
    if (activeSheet === 'all') return allData;
    return allData.filter((d) => d.sheetName === activeSheet);
  }, [allData, activeSheet]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-display">Загрузка отчёта...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-foreground font-display text-lg">{error}</p>
          <Link to="/" className="text-xs text-primary hover:underline flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5" />
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold tracking-tight font-display">САЛОНЫ</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-display">{reportName}</span>
            <span className="text-xs text-muted-foreground">{reportDate}</span>
            <span className="text-xs text-muted-foreground font-display">{filteredData.length} локаций</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">
        {sheets.length > 1 && (
          <SheetTabs sheets={sheets} activeSheet={activeSheet} onSheetChange={setActiveSheet} />
        )}
        <StatCards data={filteredData} />
        <StatusChart data={filteredData} onDrillDown={handleDrillDown} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RegionBreakdown data={filteredData} onDrillDown={handleDrillDown} />
          <FormatChart data={filteredData} onDrillDown={handleDrillDown} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OpeningTimeline data={filteredData} onDrillDown={handleDrillDown} />
          <RegionStatusHeatmap data={filteredData} onDrillDown={handleDrillDown} />
        </div>
        <AiReportPanel data={filteredData} />
        <DataTable data={filteredData} />
      </main>

      <DrillDownDrawer
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        context={drillDown}
      />
    </div>
  );
};

export default SharedReport;
