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
  salonFormat: string;
  rentStatus?: string;
  salonType?: string;
  furnitureStatus?: string;
  repair?: string;
  repairStatus?: string;
  status: string;
  comment?: string;
  openingDate?: string;
  sheetName: string;
}

export type StatusKey = 'open' | 'contract' | 'evaluation' | 'no-rent' | 'rejected' | 'other';

export function normalizeStatus(raw: string): { key: StatusKey; label: string } {
  const s = raw.toLowerCase().trim();
  if (s === 'открыт' || s === 'открыто') return { key: 'open', label: 'Открыт' };
  if (s.includes('выходим на договор') || s.includes('комерция согласовала') || s.includes('договор')) return { key: 'contract', label: 'Выходим на договор' };
  if (s === 'оценка' || s.includes('смотрит коммерция') || s.includes('поиск')) return { key: 'evaluation', label: 'Оценка' };
  if (s.includes('нет аренды') || s.includes('нет помещени')) return { key: 'no-rent', label: 'Нет аренды' };
  if (s.includes('не согласовала') || s.includes('отказ')) return { key: 'rejected', label: 'Отказ' };
  return { key: 'other', label: raw || 'Не указан' };
}
