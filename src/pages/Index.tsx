import { useState, useMemo, useCallback } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { saveReport, SavedReport } from '@/lib/reportService';
import { SalonLocation } from '@/lib/types';
import FileUpload from '@/components/FileUpload';
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
import { LayoutDashboard, RotateCcw, Link as LinkIcon, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [allData, setAllData] = useState<SalonLocation[] | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [savedReport, setSavedReport] = useState<SavedReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDownContext | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  const handleFile = async (buffer: ArrayBuffer, fileName: string, fileSize: number) => {
    const locations = parseExcelFile(buffer);
    setAllData(locations);
    setActiveSheet('all');
    setSavedReport(null);

    setSaving(true);
    try {
      const report = await saveReport(fileName, fileSize, locations);
      setSavedReport(report);
      toast.success('Отчёт сохранён', {
        description: `Ссылка: /r/${report.shareId}`,
      });
    } catch (err) {
      console.error('Failed to save report:', err);
      toast.error('Не удалось сохранить отчёт в БД');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!savedReport) return;
    const url = `${window.location.origin}/r/${savedReport.shareId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Ссылка скопирована');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDrillDown = useCallback((context: DrillDownContext) => {
    setDrillDown(context);
    setDrillDownOpen(true);
  }, []);

  const sheets = useMemo(() => {
    if (!allData) return [];
    return [...new Set(allData.map((d) => d.sheetName))];
  }, [allData]);

  const filteredData = useMemo(() => {
    if (!allData) return [];
    if (activeSheet === 'all') return allData;
    return allData.filter((d) => d.sheetName === activeSheet);
  }, [allData, activeSheet]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold tracking-tight font-display">САЛОНЫ</h1>
          </div>
          {allData && (
            <div className="flex items-center gap-4">
              {saving && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Сохранение...
                </span>
              )}
              {savedReport && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                  {copied ? 'Скопировано' : 'Поделиться'}
                </button>
              )}
              <span className="text-xs text-muted-foreground font-display">
                {filteredData.length} локаций
              </span>
              <button
                type="button"
                onClick={() => { setAllData(null); setActiveSheet('all'); setSavedReport(null); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сброс
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">
        {!allData ? (
          <FileUpload onFileLoaded={handleFile} />
        ) : (
          <>
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
          </>
        )}
      </main>

      <DrillDownDrawer
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        context={drillDown}
      />
    </div>
  );
};

export default Index;
