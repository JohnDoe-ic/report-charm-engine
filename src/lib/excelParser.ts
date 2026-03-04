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

    // Detect column indices
    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => { colMap[h] = i; });

    const getCol = (name: string) => colMap[name] ?? -1;
    const hasDistrict = getCol('Район') !== -1;
    const hasSettlement = getCol('Поселок') !== -1;

    // Parse data rows (skip header + empty row after it)
    for (let r = headerIdx + 2; r < rows.length; r++) {
      const row = rows[r].map(c => String(c).trim());
      const region = row[getCol('Регион')] || '';
      const city = row[getCol('Город')] || '';
      
      if (!region && !city) continue; // skip empty rows

      const addressCol = getCol('Адрес');
      const address = addressCol !== -1 ? row[addressCol] : '';

      const loc: SalonLocation = {
        id: `loc-${idCounter++}`,
        region,
        city,
        district: hasDistrict ? row[getCol('Район')] : undefined,
        settlement: hasSettlement ? row[getCol('Поселок')] : undefined,
        address,
        commercialPartner: row[getCol('Коммерческий партнер')] || undefined,
        salonFormat: row[getCol('Формат салона')] || '',
        status: row[getCol('Статус')] || '',
        comment: row[getCol('Комментарий')] || undefined,
        openingDate: row[getCol('Дата открытия')] || undefined,
        sheetName,
      };

      allLocations.push(loc);
    }
  }

  return allLocations;
}
