export interface SalonLocation {
  id: string;
  region: string;
  city: string;
  district?: string;
  address: string;
  commercialPartner?: string;
  probability?: string;
  regionApproval?: string;
  kcApproval?: string;
  commercialApproval?: string;
  salonFormat: string;
  status: string; // Статус аренды (primary status for charts)
  generalStatus?: string; // Статус (general)
  salonType?: string;
  furnitureStatus?: string;
  repair?: string;
  repairStatus?: string;
  photoLocation?: string;
  comment?: string;
  openingPlan?: string;
  openingDate?: string;
  // Rent details
  rentDate?: string;
  rentAmount?: string;
  rentArea?: string;
  rentPricePerM?: string;
  landlord?: string;
  // Repair details
  repairMeasurements?: string;
  repairDrawing?: string;
  repairEstimate?: string;
  repairTimeline?: string;
  repairFormat?: string;
  // Furniture details
  furnitureMeasurements?: string;
  furnitureDrawing?: string;
  furnitureOrder?: string;
  // Legacy compat
  rentStatus?: string;
  sheetName: string;
}

export type StatusKey = 'open' | 'contract' | 'evaluation' | 'no-rent' | 'rejected' | 'approved' | 'other';

export function normalizeStatus(raw: string): { key: StatusKey; label: string } {
  const s = raw.toLowerCase().trim();
  if (s === 'открыт' || s === 'открыто') return { key: 'open', label: 'Открыт' };
  if (s.includes('выходим на договор') || s.includes('договор')) return { key: 'contract', label: 'На договоре' };
  if (s === 'оценка' || s.includes('смотрит коммерция') || s.includes('поиск')) return { key: 'evaluation', label: 'Оценка' };
  if (s.includes('нет аренды') || s.includes('нет помещени')) return { key: 'no-rent', label: 'Нет аренды' };
  if (s.includes('отказала') || s.includes('отказ') || s.includes('не согласовала')) return { key: 'rejected', label: 'Отказ' };
  if (s.includes('одобрила') || s.includes('согласовала') || s.includes('комерция согласовала')) return { key: 'approved', label: 'Одобрено' };
  return { key: 'other', label: raw || 'Не указан' };
}
