import { SalonLocation, normalizeStatus, StatusKey } from '@/lib/types';
import { Building2, MapPin, CheckCircle, FileCheck, Search, XCircle, ShieldCheck, TrendingUp } from 'lucide-react';

interface StatCardsProps {
  data: SalonLocation[];
}

const StatCards = ({ data }: StatCardsProps) => {
  const total = data.length;
  const regions = new Set(data.map((d) => d.region)).size;
  const cities = new Set(data.map((d) => d.city)).size;
  const openCount = data.filter((d) => normalizeStatus(d.status).key === 'open').length;
  const contractCount = data.filter((d) => normalizeStatus(d.status).key === 'contract').length;
  const evaluationCount = data.filter((d) => normalizeStatus(d.status).key === 'evaluation').length;
  const rejectedCount = data.filter((d) => normalizeStatus(d.status).key === 'rejected').length;
  const noRentCount = data.filter((d) => normalizeStatus(d.status).key === 'no-rent').length;

  const cards = [
    { label: 'Локаций', value: total, icon: Building2, color: 'var(--primary)' },
    { label: 'Регионов', value: regions, icon: TrendingUp, color: 'var(--chart-6)' },
    { label: 'Городов', value: cities, icon: MapPin, color: 'var(--accent)' },
    { label: 'Открыто', value: openCount, icon: CheckCircle, color: 'var(--status-open)' },
    { label: 'На договоре', value: contractCount, icon: FileCheck, color: 'var(--status-contract)' },
    { label: 'Оценка', value: evaluationCount, icon: Search, color: 'var(--status-evaluation)' },
    { label: 'Нет аренды', value: noRentCount, icon: XCircle, color: 'var(--status-no-rent)' },
    { label: 'Отказ', value: rejectedCount, icon: ShieldCheck, color: 'var(--status-rejected)' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="stat-card group">
          <div
            className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity rounded-xl"
            style={{ background: `linear-gradient(135deg, hsl(${card.color}), transparent)` }}
          />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-2">
              <card.icon className="h-3.5 w-3.5" style={{ color: `hsl(${card.color})` }} />
              <span className="stat-label text-[10px]">{card.label}</span>
            </div>
            <p className="font-display text-2xl font-bold tracking-tight" style={{ color: `hsl(${card.color})` }}>
              {card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatCards;
