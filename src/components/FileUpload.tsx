import { useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (data: ArrayBuffer) => void;
}

const FileUpload = ({ onFileLoaded }: FileUploadProps) => {
  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onFileLoaded(e.target.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [onFileLoaded]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="mb-8 text-center">
        <FileSpreadsheet className="h-16 w-16 text-primary mx-auto mb-4 opacity-60" />
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">
          Загрузите отчёт
        </h2>
        <p className="text-muted-foreground mt-2 text-sm max-w-md">
          Перетащите Excel-файл с данными по салонам для визуализации показателей
        </p>
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="w-full max-w-md border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors duration-300 bg-card/50"
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.xlsx,.xls';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) readFile(file);
          };
          input.click();
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          .xlsx · .xls
        </span>
      </div>
    </div>
  );
};

export default FileUpload;
