export interface SalonLocation {
  id: string;
  region: string;
  city: string;
  district?: string;
  settlement?: string;
  address: string;
  commercialPartner?: string;
  commerceApproval?: string;
  salonFormat: string;
  photoLink?: string;
  status: string;
  comment?: string;
  openingDate?: string;
  rentDate?: string;
  rentAmount?: string;
  rentArea?: string;
  rentPricePerMeter?: string;
  landlord?: string;
  rentComment?: string;
  repairMeasurements?: string;
  repairDrawing?: string;
  repairEstimate?: string;
  repairTimeline?: string;
  repairFormat?: string;
  repairComment?: string;
  furnitureDrawing?: string;
  furnitureMeasurements?: string;
  furnitureOrder?: string;
  sheetName: string;
}

export type StatusKey = 'open' | 'contract' | 'evaluation' | 'no-rent' | 'rejected' | 'other';

export function normalizeStatus(raw: string): { key: StatusKey; label: string } {
  const s = raw.toLowerCase().trim();
  if (s === 'открыт') return { key: 'open', label: 'Открыт' };
  if (s.includes('выходим на договор') || s.includes('комерция согласовала')) return { key: 'contract', label: 'Выходим на договор' };
  if (s === 'оценка' || s.includes('смотрит коммерция')) return { key: 'evaluation', label: 'Оценка' };
  if (s.includes('нет аренды')) return { key: 'no-rent', label: 'Нет аренды' };
  if (s.includes('не согласовала')) return { key: 'rejected', label: 'Коммерция не согласовала' };
  return { key: 'other', label: raw || 'Не указан' };
}
