import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SalonLocation {
  id: string;
  region: string;
  city: string;
  district?: string;
  settlement?: string;
  address: string;
  commercialPartner?: string;
  salonFormat: string;
  status: string;
  comment?: string;
  openingDate?: string;
  sheetName: string;
}

function parseExcelBuffer(data: ArrayBuffer): SalonLocation[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const allLocations: SalonLocation[] = [];
  let idCounter = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 3) continue;

    let headerIdx = -1;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i].map(c => String(c).trim());
      if (row.includes('Регион')) { headerIdx = i; headers = row; break; }
    }
    if (headerIdx === -1) continue;

    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => { if (h) colMap[h] = i; });
    const getCol = (name: string) => colMap[name] ?? -1;
    const getVal = (row: string[], name: string) => {
      const idx = getCol(name);
      return idx !== -1 ? row[idx] || '' : '';
    };

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r].map(c => String(c).trim());
      const region = getVal(row, 'Регион');
      const city = getVal(row, 'Город');
      const status = getVal(row, 'Статус');
      const address = getVal(row, 'Адрес');
      if (!region && !city) continue;
      if (!status && !address) continue;

      allLocations.push({
        id: `loc-${idCounter++}`,
        region, city, address,
        district: getVal(row, 'Район') || undefined,
        settlement: getVal(row, 'Поселок') || undefined,
        commercialPartner: getVal(row, 'Коммерческий партнер') || undefined,
        salonFormat: getVal(row, 'Формат салона') || '',
        status: status || 'не указан',
        comment: getVal(row, 'Комментарий') || undefined,
        openingDate: getVal(row, 'Дата открытия') || undefined,
        sheetName,
      });
    }
  }
  return allLocations;
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const update = await req.json();
    console.log('Received update:', JSON.stringify(update).slice(0, 500));
    
    const message = update?.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const chatId = message.chat.id;
    const chatType = message.chat.type; // 'private', 'group', 'supergroup'
    const username = message.from?.username || message.from?.first_name || 'unknown';
    const doc = message.document;

    console.log(`Chat: ${chatId} (${chatType}), User: ${username}, Doc: ${doc?.file_name || 'none'}`);

    // Handle /start command
    if (message.text === '/start') {
      await sendTelegramMessage(BOT_TOKEN, chatId,
        '📊 Привет! Отправьте мне Excel-файл (.xlsx) и я построю интерактивный дашборд с графиками.\n\nПоддерживаются файлы с колонками: Регион, Город, Статус, Адрес и др.'
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!doc) {
      // In group chats, silently ignore non-document messages
      if (chatType !== 'private') {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      await sendTelegramMessage(BOT_TOKEN, chatId, '📎 Отправьте Excel-файл (.xlsx) для построения дашборда.');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fileName = (doc.file_name || '').toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
      || doc.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isXlsx) {
      await sendTelegramMessage(BOT_TOKEN, chatId, '❌ Поддерживаются только Excel-файлы (.xlsx).');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Acknowledge receipt
    await sendTelegramMessage(BOT_TOKEN, chatId, '⏳ Обрабатываю файл...');

    // Download file from Telegram
    const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${doc.file_id}`);
    const fileInfo = await fileInfoRes.json();
    console.log('File info:', JSON.stringify(fileInfo));
    const filePath = fileInfo.result?.file_path;
    if (!filePath) throw new Error('Cannot get file path from Telegram');

    const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    const fileBuffer = await fileRes.arrayBuffer();

    // Parse Excel
    const locations = parseExcelBuffer(fileBuffer);
    if (locations.length === 0) {
      await sendTelegramMessage(BOT_TOKEN, chatId,
        '❌ Не удалось распарсить файл. Убедитесь, что это Excel с колонками "Регион", "Город", "Статус".'
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save to DB
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        file_name: doc.file_name || 'telegram-upload.xlsx',
        file_size: doc.file_size || 0,
        file_type: 'xlsx',
        source: 'telegram',
        telegram_chat_id: String(chatId),
        telegram_username: username,
      })
      .select('id, share_id')
      .single();

    if (reportError) throw reportError;

    // Insert rows in batches
    const batchSize = 500;
    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize).map((loc, idx) => ({
        report_id: report.id,
        sheet_name: loc.sheetName,
        row_index: i + idx,
        data: loc,
      }));
      const { error } = await supabase.from('report_rows').insert(batch);
      if (error) console.error('Batch insert error:', error);
    }

    const APP_URL = Deno.env.get('APP_URL') || 'https://report-charm-engine.lovable.app';
    const shareUrl = `${APP_URL}/r/${report.share_id}`;

    await sendTelegramMessage(BOT_TOKEN, chatId,
      `✅ Дашборд готов! ${locations.length} локаций из файла "${doc.file_name}"`,
      {
        inline_keyboard: [[
          { text: '📊 Открыть графики', url: shareUrl }
        ]]
      }
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Telegram bot error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
