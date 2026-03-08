import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, dataSummary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Ты — старший аналитик по развитию розничной сети салонов связи телеком-операторов. Ты эксперт в открытии новых точек продаж, оценке коммерческой привлекательности локаций, анализе арендных ставок и форматов салонов.

Тебе предоставлена сводка данных из загруженного Excel-файла с информацией о салонах связи. Отвечай на вопросы пользователя, анализируй данные, давай экспертные рекомендации по развитию сети.

ВАЖНО — ФОРМАТ ОТВЕТА:
1. Используй markdown для структурированных ответов: заголовки ##, списки, **жирный текст**, таблицы.
2. Когда уместно, ОБЯЗАТЕЛЬНО строй графики. Для этого вставляй блок:

\`\`\`chart
{
  "type": "bar" | "pie" | "line",
  "title": "Название графика",
  "data": [
    {"name": "Категория 1", "value": 42},
    {"name": "Категория 2", "value": 28}
  ]
}
\`\`\`

3. Графики строй когда:
   - Пользователь просит визуализацию или график
   - Есть числовые сравнения (регионы, статусы, форматы)
   - Нужно показать распределение или рейтинг
4. Используй pie для долей, bar для сравнений, line для динамики
5. Будь конкретен, используй числа из данных
6. Давай экспертные рекомендации с точки зрения ритейла телеком-оператора

Сводка данных:
${dataSummary}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Исчерпан лимит AI-запросов." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Ошибка AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
