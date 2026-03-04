import { useCallback } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (data: ArrayBuffer) => void;
}

const FileUpload = ({ onFileLoaded }: FileUploadProps) => {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [onFileLoaded]
  );

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onFileLoaded(e.target.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="dashboard-section flex flex-col items-center justify-center gap-4 border-2 border-dashed border-primary/30 cursor-pointer hover:border-primary/60 transition-colors min-h-[200px]"
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
      <Upload className="h-12 w-12 text-primary/50" />
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">
          Перетащите Excel-файл сюда
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          или нажмите для выбора файла (.xlsx)
        </p>
      </div>
    </div>
  );
};

export default FileUpload;
