import { useState, useRef, useMemo } from 'react';
import { SalonLocation, normalizeStatus } from '@/lib/types';
import { Sparkles, Send, Loader2, X } from 'lucide-react';

interface AiReportPanelProps {
  data: SalonLocation[];
}

function buildDataSummary(data: SalonLocation[]): string {
  const totalLocations = data.length;
  const statusMap = new Map<string, number>();
  const regionMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const formatMap = new Map<string, number>();

  data.forEach((d) => {
    const { label } = normalizeStatus(d.status);
    statusMap.set(label, (statusMap.get(label) || 0) + 1);
    if (d.region) regionMap.set(d.region, (regionMap.get(d.region) || 0) + 1);
    if (d.city) cityMap.set(d.city, (cityMap.get(d.city) || 0) + 1);
    const fmt = d.salonFormat || 'Не указан';
    formatMap.set(fmt, (formatMap.get(fmt) || 0) + 1);
  });

  const sortedEntries = (m: Map<string, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1]);

  let summary = `Всего локаций: ${totalLocations}\n\n`;
  summary += `Статусы:\n${sortedEntries(statusMap).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`;
  summary += `Регионы (топ-15):\n${sortedEntries(regionMap).slice(0, 15).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`;
  summary += `Города (топ-20):\n${sortedEntries(cityMap).slice(0, 20).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`;
  summary += `Форматы:\n${sortedEntries(formatMap).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;

  return summary;
}

async function streamAiReport(
  query: string,
  dataSummary: string,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-report`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ query, dataSummary }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Ошибка' }));
    onError(err.error || `Ошибка ${resp.status}`);
    return;
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* partial json, ignore */ }
    }
  }
  onDone();
}

const SUGGESTIONS = [
  'Какие регионы показывают лучшую динамику открытий?',
  'Сравни форматы салонов по статусам',
  'Какие города лидируют по количеству открытых салонов?',
  'Дай сводку по проблемным локациям (отказы, нет аренды)',
];

const AiReportPanel = ({ data }: AiReportPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const responseRef = useRef('');

  const dataSummary = useMemo(() => buildDataSummary(data), [data]);

  const handleSubmit = async (text?: string) => {
    const q = text || query;
    if (!q.trim() || loading) return;
    setQuery(q);
    setLoading(true);
    setResponse('');
    setError('');
    responseRef.current = '';
    setExpanded(true);

    await streamAiReport(
      q,
      dataSummary,
      (delta) => {
        responseRef.current += delta;
        setResponse(responseRef.current);
      },
      () => setLoading(false),
      (err) => { setError(err); setLoading(false); },
    );
  };

  if (!expanded) {
    return (
      <div className="dashboard-section">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="section-title mb-0">AI-аналитик</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Задайте вопрос по данным — AI проанализирует и даст ответ
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Например: Какие регионы лидируют по открытиям?"
            className="flex-1 h-9 rounded-md border border-border bg-secondary px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!query.trim()}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Спросить
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-section">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="section-title mb-0">AI-аналитик</p>
        </div>
        <button
          onClick={() => { setExpanded(false); setResponse(''); setError(''); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Задайте вопрос..."
          className="flex-1 h-9 rounded-md border border-border bg-secondary px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={!query.trim() || loading}
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-3">
          {error}
        </div>
      )}

      {(response || loading) && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 max-h-[500px] overflow-auto">
          <div className="prose prose-sm prose-invert max-w-none text-foreground/90 text-sm whitespace-pre-wrap">
            {response}
            {loading && !response && (
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Анализирую данные...
              </span>
            )}
            {loading && response && <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5" />}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiReportPanel;
