import { useState } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { SalonLocation } from '@/lib/types';
import FileUpload from '@/components/FileUpload';
import StatCards from '@/components/StatCards';
import StatusChart from '@/components/StatusChart';
import FormatChart from '@/components/FormatChart';
import RegionBreakdown from '@/components/RegionBreakdown';
import DataTable from '@/components/DataTable';
import { LayoutDashboard } from 'lucide-react';

const Index = () => {
  const [data, setData] = useState<SalonLocation[] | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFile = (buffer: ArrayBuffer) => {
    const locations = parseExcelFile(buffer);
    setData(locations);
    setFileName('Файл загружен');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">Салоны — Дашборд</h1>
          {data && (
            <span className="ml-auto text-sm text-muted-foreground">
              {data.length} локаций • {new Set(data.map(d => d.sheetName)).size} листов
            </span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {!data ? (
          <div className="max-w-xl mx-auto mt-20">
            <FileUpload onFileLoaded={handleFile} />
          </div>
        ) : (
          <>
            <StatCards data={data} />
            <StatusChart data={data} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RegionBreakdown data={data} />
              <FormatChart data={data} />
            </div>
            <DataTable data={data} />

            <div className="flex justify-center pt-4 pb-8">
              <button
                onClick={() => { setData(null); setFileName(''); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Загрузить другой файл
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
