import * as XLSX from 'xlsx';
import { SalonLocation } from './types';

export function parseExcelFile(data: ArrayBuffer): SalonLocation[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const allLocations: SalonLocation[] = [];
  let idCounter = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (rows.length < 3) continue;

    // Find header row (contains "Регион")
    let headerIdx = -1;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i].map(c => String(c).trim());
      if (row.includes('Регион')) {
        headerIdx = i;
        headers = row;
        break;
      }
    }
    if (headerIdx === -1) continue;

    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => { if (h) colMap[h] = i; });

    const getCol = (name: string) => colMap[name] ?? -1;
    const getVal = (row: string[], name: string) => {
      const idx = getCol(name);
      return idx !== -1 ? row[idx] || '' : '';
    };
    const hasDistrict = getCol('Район') !== -1;
    const hasSettlement = getCol('Поселок') !== -1;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r].map(c => String(c).trim());
      const region = getVal(row, 'Регион');
      const city = getVal(row, 'Город');
      const status = getVal(row, 'Статус');
      const address = getVal(row, 'Адрес');
      
      // Skip rows without meaningful data
      if (!region && !city) continue;
      if (!status && !address) continue;

      const loc: SalonLocation = {
        id: `loc-${idCounter++}`,
        region,
        city,
        district: hasDistrict ? getVal(row, 'Район') : undefined,
        settlement: hasSettlement ? getVal(row, 'Поселок') : undefined,
        address,
        commercialPartner: getVal(row, 'Коммерческий партнер') || undefined,
        salonFormat: getVal(row, 'Формат салона') || '',
        status: status || 'не указан',
        comment: getVal(row, 'Комментарий') || undefined,
        openingDate: getVal(row, 'Дата открытия') || undefined,
        sheetName,
      };

      allLocations.push(loc);
    }
  }

  return allLocations;
}
