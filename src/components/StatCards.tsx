import { SalonLocation, normalizeStatus } from '@/lib/types';
import { Building2, MapPin, FileCheck, Search, CheckCircle } from 'lucide-react';

interface StatCardsProps {
  data: SalonLocation[];
}

const StatCards = ({ data }: StatCardsProps) => {
  const total = data.length;
  const cities = new Set(data.map((d) => d.city)).size;
  const openCount = data.filter((d) => normalizeStatus(d.status).key === 'open').length;
  const contractCount = data.filter((d) => normalizeStatus(d.status).key === 'contract').length;
  const evaluationCount = data.filter((d) => normalizeStatus(d.status).key === 'evaluation').length;

  const cards = [
    { label: 'Локаций', value: total, icon: Building2, accent: 'text-primary' },
    { label: 'Городов', value: cities, icon: MapPin, accent: 'text-accent' },
    { label: 'Открыто', value: openCount, icon: CheckCircle, accent: 'text-status-open' },
    { label: 'На договоре', value: contractCount, icon: FileCheck, accent: 'text-status-contract' },
    { label: 'Оценка', value: evaluationCount, icon: Search, accent: 'text-status-evaluation' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <card.icon className={`h-4 w-4 ${card.accent}`} />
            <span className="stat-label">{card.label}</span>
          </div>
          <p className={`stat-value ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export default StatCards;
