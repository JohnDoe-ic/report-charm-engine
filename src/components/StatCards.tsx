import { SalonLocation, normalizeStatus } from '@/lib/types';
import { Building2, MapPin, FileCheck, AlertTriangle, CheckCircle } from 'lucide-react';

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
    { label: 'Всего локаций', value: total, icon: Building2, color: 'text-primary' },
    { label: 'Городов', value: cities, icon: MapPin, color: 'text-accent' },
    { label: 'Открыто', value: openCount, icon: CheckCircle, color: 'text-status-open' },
    { label: 'На договоре', value: contractCount, icon: FileCheck, color: 'text-status-contract' },
    { label: 'На оценке', value: evaluationCount, icon: AlertTriangle, color: 'text-status-evaluation' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </div>
          <p className="stat-value">{card.value}</p>
          <p className="stat-label mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  );
};

export default StatCards;
