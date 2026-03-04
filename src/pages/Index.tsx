import { useState, useMemo } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { SalonLocation } from '@/lib/types';
import FileUpload from '@/components/FileUpload';
import StatCards from '@/components/StatCards';
import StatusChart from '@/components/StatusChart';
import FormatChart from '@/components/FormatChart';
import RegionBreakdown from '@/components/RegionBreakdown';
import DataTable from '@/components/DataTable';
import SheetTabs from '@/components/SheetTabs';
import { LayoutDashboard, RotateCcw } from 'lucide-react';

const Index = () => {
  const [allData, setAllData] = useState<SalonLocation[] | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('all');

  const handleFile = (buffer: ArrayBuffer) => {
    const locations = parseExcelFile(buffer);
    setAllData(locations);
    setActiveSheet('all');
  };

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
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold tracking-tight font-display">САЛОНЫ</h1>
          </div>
          {allData && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground font-display">
                {filteredData.length} локаций
              </span>
              <button
                onClick={() => { setAllData(null); setActiveSheet('all'); }}
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
            {/* Sheet tabs */}
            {sheets.length > 1 && (
              <SheetTabs
                sheets={sheets}
                activeSheet={activeSheet}
                onSheetChange={setActiveSheet}
              />
            )}

            <StatCards data={filteredData} />
            <StatusChart data={filteredData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RegionBreakdown data={filteredData} />
              <FormatChart data={filteredData} />
            </div>
            <DataTable data={filteredData} />
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
