import * as XLSX from 'xlsx';

export function exportChartToExcel(data: Record<string, any>[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Данные');
  XLSX.writeFile(wb, `${fileName}-${Date.now()}.xlsx`);
}
