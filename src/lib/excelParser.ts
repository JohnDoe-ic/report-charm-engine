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
      return idx !== -1 ? String(row[idx] || '').trim() : '';
    };

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
      const city = getValMulti(row, 'Город', 'Город/НП');
      const address = getVal(row, 'Адрес');
      
      if (!region && !city) continue;

      const status = getValMulti(row, 'Статус аренды', 'Статус');
      
      const loc: SalonLocation = {
        id: `loc-${idCounter++}`,
        region,
        city,
        district: getValMulti(row, 'Район', 'Район города/НП') || undefined,
        address,
        commercialPartner: getVal(row, 'Коммерческий партнер') || undefined,
        probability: getVal(row, 'Вероятность') || undefined,
        regionApproval: getValMulti(row, 'Согласование КБ региона', 'Согласование КБ') || undefined,
        kcApproval: getVal(row, 'Согласование КЦ') || undefined,
        commercialApproval: getValMulti(row, 'Согласование коммерции') || undefined,
        salonFormat: getValMulti(row, 'Формат салона', 'Формат') || '',
        status: status || 'не указан',
        generalStatus: getVal(row, 'Статус') || undefined,
        salonType: getVal(row, 'Тип салона') || undefined,
        furnitureStatus: getVal(row, 'Статус мебели') || undefined,
        repair: getVal(row, 'Ремонт') || undefined,
        repairStatus: getValMulti(row, 'Статус ремонт', 'Статус ремонта') || undefined,
        photoLocation: getVal(row, 'Фото локации') || undefined,
        comment: getValMulti(row, 'Комментарий', 'Комментари й') || undefined,
        openingPlan: getVal(row, 'План открытия') || undefined,
        openingDate: getVal(row, 'Дата открытия') || undefined,
        // Rent
        rentDate: getVal(row, 'Дата заключения договора на аренду') || undefined,
        rentAmount: getValMulti(row, 'Сумма, без НДС') || undefined,
        rentArea: getVal(row, 'Арендуемая площадь') || undefined,
        rentPricePerM: getValMulti(row, 'Стоимость метра, без ндс') || undefined,
        landlord: getVal(row, 'Арендодатель') || undefined,
        // Repair details
        repairMeasurements: getValMulti(row, 'Замеры ремонт', 'Замеры') || undefined,
        repairDrawing: getValMulti(row, 'Отрисовка ремонт', 'Отрисовка') || undefined,
        repairEstimate: getVal(row, 'Получение сметы от подрядчика') || undefined,
        repairTimeline: getVal(row, 'Сроки ремонта') || undefined,
        repairFormat: getVal(row, 'Формат ремонта') || undefined,
        // Furniture details
        furnitureMeasurements: getValMulti(row, 'Замеры мебель', 'Замеры5') || undefined,
        furnitureDrawing: getValMulti(row, 'Отрисовка мебель', 'Отрисовка4') || undefined,
        furnitureOrder: getVal(row, 'Заказ') || undefined,
        // Legacy
        rentStatus: status || undefined,
        sheetName,
      };

      allLocations.push(loc);
    }
  }

  return allLocations;
}
