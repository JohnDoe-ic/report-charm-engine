import * as XLSX from 'xlsx';
import { SalonLocation } from './types';

export function parseExcelFile(data: ArrayBuffer): SalonLocation[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const allLocations: SalonLocation[] = [];
  let idCounter = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (rows.length < 2) continue;

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

    // Try multiple possible column name variants
    const getValMulti = (row: string[], ...names: string[]) => {
      for (const name of names) {
        const v = getVal(row, name);
        if (v) return v;
      }
      return '';
    };

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r].map(c => String(c).trim());
      const region = getVal(row, 'Регион');
      const city = getValMulti(row, 'Город/НП', 'Город');
      const address = getVal(row, 'Адрес');
      
      // Skip rows without meaningful data
      if (!region && !city) continue;

      const rentStatus = getValMulti(row, 'Статус аренды', 'Статус');
      
      const loc: SalonLocation = {
        id: `loc-${idCounter++}`,
        region,
        city,
        district: getValMulti(row, 'Район города/НП', 'Район') || undefined,
        address,
        commercialPartner: getVal(row, 'Коммерческий партнер') || undefined,
        probability: getVal(row, 'Вероятность') || undefined,
        regionApproval: getValMulti(row, 'Согласование КБ региона', 'Согласование КБ') || undefined,
        kcApproval: getValMulti(row, 'Согласование КЦ') || undefined,
        salonFormat: getValMulti(row, 'Формат салона', 'Формат') || '',
        rentStatus: rentStatus || undefined,
        salonType: getVal(row, 'Тип салона') || undefined,
        furnitureStatus: getVal(row, 'Статус мебели') || undefined,
        repair: getVal(row, 'Ремонт') || undefined,
        repairStatus: getValMulti(row, 'Статус ремонт', 'Статус ремонта') || undefined,
        status: rentStatus || 'не указан',
        openingDate: getVal(row, 'Дата открытия') || undefined,
        sheetName,
      };

      allLocations.push(loc);
    }
  }

  return allLocations;
}
