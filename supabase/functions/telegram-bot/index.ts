import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SalonLocation {
  id: string; region: string; city: string; district?: string; settlement?: string;
  address: string; commercialPartner?: string; salonFormat: string; status: string;
  comment?: string; openingDate?: string; sheetName: string;
}

function parseExcelBuffer(data: ArrayBuffer): SalonLocation[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const allLocations: SalonLocation[] = [];
  let idCounter = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 3) continue;
    let headerIdx = -1; let headers: string[] = [];
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i].map(c => String(c).trim());
      if (row.includes('Регион')) { headerIdx = i; headers = row; break; }
    }
    if (headerIdx === -1) continue;
    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => { if (h) colMap[h] = i; });
    const getCol = (name: string) => colMap[name] ?? -1;
    const getVal = (row: string[], name: string) => { const idx = getCol(name); return idx !== -1 ? row[idx] || '' : ''; };
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r].map(c => String(c).trim());
      const region = getVal(row, 'Регион'); const city = getVal(row, 'Город');
      const status = getVal(row, 'Статус'); const address = getVal(row, 'Адрес');
      if (!region && !city) continue; if (!status && !address) continue;
      allLocations.push({
        id: `loc-${idCounter++}`, region, city, address,
        district: getVal(row, 'Район') || undefined, settlement: getVal(row, 'Поселок') || undefined,
        commercialPartner: getVal(row, 'Коммерческий партнер') || undefined,
        salonFormat: getVal(row, 'Формат салона') || '', status: status || 'не указан',
        comment: getVal(row, 'Комментарий') || undefined, openingDate: getVal(row, 'Дата открытия') || undefined,
        sheetName,
      });
    }
  }
  return allLocations;
}

// ---- Telegram helpers ----
async function tgApi(botToken: string, method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMsg(botToken: string, chatId: number | string, text: string, replyMarkup?: any, threadId?: number) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  if (threadId) body.message_thread_id = threadId;
  return tgApi(botToken, 'sendMessage', body);
}

async function editMsg(botToken: string, chatId: number | string, messageId: number, text: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return tgApi(botToken, 'editMessageText', body);
}

async function answerCb(botToken: string, callbackQueryId: string, text?: string) {
  return tgApi(botToken, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

function extractDocument(message: any): { doc: any } | null {
  if (message.document) return { doc: message.document };
  if (message.reply_to_message?.document) return { doc: message.reply_to_message.document };
  return null;
}

// ---- Staff shift inline keyboard ----
function shiftKeyboard(sales: number, activations: number, topups: number) {
  return {
    inline_keyboard: [
      [
        { text: `🛒 Продажа (${sales})`, callback_data: 'staff_sale' },
        { text: `📱 Активация (${activations})`, callback_data: 'staff_activation' },
      ],
      [
        { text: `💰 Пополнение (${topups})`, callback_data: 'staff_topup' },
      ],
      [
        { text: '📍 Сменить локацию', callback_data: 'staff_change_location' },
        { text: '🏁 Завершить смену', callback_data: 'staff_end_shift' },
      ],
    ],
  };
}

// ---- Main handler ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!BOT_TOKEN) return new Response(JSON.stringify({ error: 'no token' }), { status: 500, headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const APP_URL = Deno.env.get('APP_URL') || 'https://report-charm-engine.lovable.app';

  try {
    const update = await req.json();
    console.log('Update:', JSON.stringify(update).slice(0, 1000));

    // ===== CALLBACK QUERY (inline buttons) =====
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data as string;
      const userId = cb.from.id;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;

      // Get staff
      const { data: staff } = await supabase.from('staff').select('*').eq('telegram_user_id', userId).single();
      if (!staff) { await answerCb(BOT_TOKEN, cb.id, '❌ Вы не зарегистрированы. Напишите /reg'); return ok(); }

      // Get active shift
      const { data: shift } = await supabase.from('staff_shifts').select('*').eq('staff_id', staff.id).eq('is_active', true).order('started_at', { ascending: false }).limit(1).single();

      if (data === 'staff_sale' || data === 'staff_activation' || data === 'staff_topup') {
        if (!shift) { await answerCb(BOT_TOKEN, cb.id, '❌ Нет активной смены'); return ok(); }
        const typeMap: Record<string, string> = { staff_sale: 'sale', staff_activation: 'activation', staff_topup: 'topup' };
        const labelMap: Record<string, string> = { staff_sale: 'Продажа', staff_activation: 'Активация', staff_topup: 'Пополнение' };
        await supabase.from('staff_activities').insert({ staff_id: staff.id, shift_id: shift.id, activity_type: typeMap[data] });

        // Get updated counts
        const { count: sales } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'sale');
        const { count: activations } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'activation');
        const { count: topups } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'topup');

        await answerCb(BOT_TOKEN, cb.id, `✅ ${labelMap[data]} +1`);
        await editMsg(BOT_TOKEN, chatId, messageId,
          `📍 <b>${shift.location_address}</b>\n👤 ${staff.full_name}\n\n🛒 Продажи: ${sales || 0}\n📱 Активации: ${activations || 0}\n💰 Пополнения: ${topups || 0}`,
          shiftKeyboard(sales || 0, activations || 0, topups || 0)
        );
        return ok();
      }

      if (data === 'staff_end_shift') {
        if (!shift) { await answerCb(BOT_TOKEN, cb.id, '❌ Нет активной смены'); return ok(); }
        await supabase.from('staff_shifts').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', shift.id);

        // Get total counts for this shift
        const { count: sales } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'sale');
        const { count: activations } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'activation');
        const { count: topups } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'topup');

        await answerCb(BOT_TOKEN, cb.id, '✅ Смена завершена');
        await editMsg(BOT_TOKEN, chatId, messageId,
          `🏁 <b>Смена завершена</b>\n📍 ${shift.location_address}\n👤 ${staff.full_name}\n\n🛒 Продажи: ${sales || 0}\n📱 Активации: ${activations || 0}\n💰 Пополнения: ${topups || 0}`
        );
        return ok();
      }

      if (data === 'staff_change_location') {
        if (!shift) { await answerCb(BOT_TOKEN, cb.id, '❌ Нет активной смены'); return ok(); }
        // Close current shift but keep activities
        await supabase.from('staff_shifts').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', shift.id);
        // Set state to awaiting new location
        await answerCb(BOT_TOKEN, cb.id, '📍 Отправьте новый адрес текстом');
        await sendMsg(BOT_TOKEN, chatId, '📍 Отправьте новый адрес точки текстовым сообщением:');
        return ok();
      }

      // Admin: request report
      if (data === 'staff_report') {
        if (staff.role !== 'admin') { await answerCb(BOT_TOKEN, cb.id, '❌ Только для администраторов'); return ok(); }
        await answerCb(BOT_TOKEN, cb.id, '⏳ Генерирую отчёт...');

        // Generate report via edge function
        const reportUrl = `${SUPABASE_URL}/functions/v1/staff-report`;
        const reportRes = await fetch(reportUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ chatId: String(chatId) }),
        });
        const reportData = await reportRes.json();

        if (reportData.shareUrl) {
          await sendMsg(BOT_TOKEN, chatId, `📊 <b>Отчёт по сотрудникам готов!</b>\n\n${reportData.summary || ''}`, {
            inline_keyboard: [[{ text: '📊 Открыть дашборд', url: reportData.shareUrl }]]
          });
        } else {
          await sendMsg(BOT_TOKEN, chatId, '❌ Не удалось сформировать отчёт');
        }
        return ok();
      }

      await answerCb(BOT_TOKEN, cb.id);
      return ok();
    }

    // ===== MESSAGE =====
    const message = update?.message;
    if (!message) return ok();

    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || 'unknown';
    const threadId = message.message_thread_id;
    const text = (message.text || '').trim();

    // --- /start ---
    if (text === '/start') {
      await sendMsg(BOT_TOKEN, chatId,
        '📊 <b>Бот отчётности</b>\n\n📁 Отправьте Excel-файл для дашборда\n👤 /reg — регистрация сотрудника\n📍 /shift — открыть смену\n📊 /report — отчёт по сотрудникам (админ)',
        undefined, threadId
      );
      return ok();
    }

    // --- /reg Name AccountNumber ---
    if (text.startsWith('/reg')) {
      const parts = text.replace('/reg', '').trim().split(/\s+/);
      if (parts.length < 2 || !parts[0]) {
        await sendMsg(BOT_TOKEN, chatId, '📝 Формат: <code>/reg Имя_Фамилия ЛицевойСчёт</code>\nПример: <code>/reg Иван_Петров 123456</code>', undefined, threadId);
        return ok();
      }
      const fullName = parts[0].replace(/_/g, ' ');
      const accountNumber = parts[1];

      // Check if already registered
      const { data: existing } = await supabase.from('staff').select('id').eq('telegram_user_id', userId).single();
      if (existing) {
        await sendMsg(BOT_TOKEN, chatId, '✅ Вы уже зарегистрированы. Используйте /shift для открытия смены.', undefined, threadId);
        return ok();
      }

      await supabase.from('staff').insert({
        telegram_user_id: userId,
        telegram_username: username,
        full_name: fullName,
        account_number: accountNumber,
      });
      await sendMsg(BOT_TOKEN, chatId, `✅ Регистрация успешна!\n👤 ${fullName}\n📋 Лицевой счёт: ${accountNumber}\n\nИспользуйте /shift для открытия смены.`, undefined, threadId);
      return ok();
    }

    // --- /admin userId ---
    if (text.startsWith('/admin')) {
      // Only existing admins can promote others
      const { data: caller } = await supabase.from('staff').select('*').eq('telegram_user_id', userId).single();
      // First admin: if no admins exist, allow self-promotion
      const { count: adminCount } = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('role', 'admin');

      if (adminCount === 0 && caller) {
        await supabase.from('staff').update({ role: 'admin' }).eq('id', caller.id);
        await sendMsg(BOT_TOKEN, chatId, '👑 Вы назначены первым администратором!', undefined, threadId);
        return ok();
      }

      if (!caller || caller.role !== 'admin') {
        await sendMsg(BOT_TOKEN, chatId, '❌ Только администраторы могут назначать роли.', undefined, threadId);
        return ok();
      }

      const targetUsername = text.replace('/admin', '').trim().replace('@', '');
      if (!targetUsername) {
        await sendMsg(BOT_TOKEN, chatId, '📝 Формат: <code>/admin @username</code>', undefined, threadId);
        return ok();
      }

      const { data: target, error: targetErr } = await supabase.from('staff').select('*').eq('telegram_username', targetUsername).single();
      if (!target || targetErr) {
        await sendMsg(BOT_TOKEN, chatId, `❌ Сотрудник @${targetUsername} не найден.`, undefined, threadId);
        return ok();
      }

      await supabase.from('staff').update({ role: 'admin' }).eq('id', target.id);
      await sendMsg(BOT_TOKEN, chatId, `👑 @${targetUsername} назначен администратором.`, undefined, threadId);
      return ok();
    }

    // --- /shift address ---
    if (text.startsWith('/shift')) {
      const { data: staff } = await supabase.from('staff').select('*').eq('telegram_user_id', userId).single();
      if (!staff) {
        await sendMsg(BOT_TOKEN, chatId, '❌ Сначала зарегистрируйтесь: /reg Имя_Фамилия ЛицевойСчёт', undefined, threadId);
        return ok();
      }

      const address = text.replace('/shift', '').trim();
      if (!address) {
        await sendMsg(BOT_TOKEN, chatId, '📍 Формат: <code>/shift Адрес точки</code>\nПример: <code>/shift ул. Ленина 42</code>', undefined, threadId);
        return ok();
      }

      // Close any active shift
      await supabase.from('staff_shifts').update({ is_active: false, ended_at: new Date().toISOString() }).eq('staff_id', staff.id).eq('is_active', true);

      // Create new shift
      const { data: newShift } = await supabase.from('staff_shifts').insert({
        staff_id: staff.id,
        location_address: address,
      }).select('id').single();

      await sendMsg(BOT_TOKEN, chatId,
        `📍 <b>${address}</b>\n👤 ${staff.full_name}\n\n🛒 Продажи: 0\n📱 Активации: 0\n💰 Пополнения: 0`,
        shiftKeyboard(0, 0, 0), threadId
      );
      return ok();
    }

    // --- /report (admin) ---
    if (text === '/report') {
      const { data: staff } = await supabase.from('staff').select('*').eq('telegram_user_id', userId).single();
      if (!staff || staff.role !== 'admin') {
        await sendMsg(BOT_TOKEN, chatId, '❌ Команда доступна только администраторам.', undefined, threadId);
        return ok();
      }

      await sendMsg(BOT_TOKEN, chatId, '📊 Сформировать отчёт по сотрудникам?', {
        inline_keyboard: [[{ text: '📊 Сформировать отчёт', callback_data: 'staff_report' }]]
      }, threadId);
      return ok();
    }

    // --- Check if user is awaiting location (has no active shift but is registered) ---
    if (text && !text.startsWith('/')) {
      const { data: staff } = await supabase.from('staff').select('*').eq('telegram_user_id', userId).single();
      if (staff) {
        const { data: activeShift } = await supabase.from('staff_shifts').select('*').eq('staff_id', staff.id).eq('is_active', true).single();
        if (!activeShift) {
          // Check if last shift was recently closed (location change scenario)
          const { data: lastShift } = await supabase.from('staff_shifts').select('*').eq('staff_id', staff.id).order('ended_at', { ascending: false }).limit(1).single();
          if (lastShift && lastShift.ended_at) {
            const endedAt = new Date(lastShift.ended_at).getTime();
            const now = Date.now();
            // If shift ended within last 5 minutes, treat as location change
            if (now - endedAt < 5 * 60 * 1000) {
              const { data: newShift } = await supabase.from('staff_shifts').insert({
                staff_id: staff.id,
                location_address: text,
              }).select('id').single();

              // Count today's activities across all shifts
              const today = new Date(); today.setHours(0,0,0,0);
              const { count: sales } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('staff_id', staff.id).gte('created_at', today.toISOString()).eq('activity_type', 'sale');
              const { count: activations } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('staff_id', staff.id).gte('created_at', today.toISOString()).eq('activity_type', 'activation');
              const { count: topups } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('staff_id', staff.id).gte('created_at', today.toISOString()).eq('activity_type', 'topup');

              await sendMsg(BOT_TOKEN, chatId,
                `📍 <b>${text}</b>\n👤 ${staff.full_name}\n\n🛒 Продажи: ${sales || 0}\n📱 Активации: ${activations || 0}\n💰 Пополнения: ${topups || 0}`,
                shiftKeyboard(sales || 0, activations || 0, topups || 0), threadId
              );
              return ok();
            }
          }
        }
      }
    }

    // --- Photo (for shift opening with photo) ---
    if (message.photo && message.photo.length > 0) {
      const { data: staff } = await supabase.from('staff').select('*').eq('telegram_user_id', userId).single();
      if (staff) {
        const { data: activeShift } = await supabase.from('staff_shifts').select('*').eq('staff_id', staff.id).eq('is_active', true).single();
        if (activeShift && !activeShift.photo_url) {
          // Get the largest photo
          const photo = message.photo[message.photo.length - 1];
          const fileInfo = await tgApi(BOT_TOKEN, 'getFile', { file_id: photo.file_id });
          const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
          await supabase.from('staff_shifts').update({ photo_url: photoUrl }).eq('id', activeShift.id);
          await sendMsg(BOT_TOKEN, chatId, '📸 Фото точки сохранено!', undefined, threadId);
          return ok();
        }
      }
    }

    // ===== EXCEL FILE PROCESSING (existing logic) =====
    const docResult = extractDocument(message);
    const doc = docResult?.doc;

    if (!doc) {
      if (chatType !== 'private') return ok();
      await sendMsg(BOT_TOKEN, chatId, '📎 Отправьте Excel-файл или используйте /reg /shift /report');
      return ok();
    }

    const fileName = (doc.file_name || '').toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || doc.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!isXlsx) {
      if (chatType !== 'private') return ok();
      await sendMsg(BOT_TOKEN, chatId, '❌ Поддерживаются только .xlsx файлы.');
      return ok();
    }

    await sendMsg(BOT_TOKEN, chatId, '⏳ Обрабатываю файл...', undefined, threadId);

    const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${doc.file_id}`);
    const fileInfo = await fileInfoRes.json();
    const filePath = fileInfo.result?.file_path;
    if (!filePath) throw new Error('Cannot get file path');

    const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    const fileBuffer = await fileRes.arrayBuffer();
    const locations = parseExcelBuffer(fileBuffer);

    if (locations.length === 0) {
      await sendMsg(BOT_TOKEN, chatId, '❌ Не удалось распарсить файл.', undefined, threadId);
      return ok();
    }

    const { data: report, error: reportError } = await supabase.from('reports').insert({
      file_name: doc.file_name || 'telegram.xlsx', file_size: doc.file_size || 0,
      file_type: 'xlsx', source: 'telegram',
      telegram_chat_id: String(chatId), telegram_username: username,
    }).select('id, share_id').single();
    if (reportError) throw reportError;

    const batchSize = 500;
    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize).map((loc, idx) => ({
        report_id: report.id, sheet_name: loc.sheetName, row_index: i + idx, data: loc,
      }));
      await supabase.from('report_rows').insert(batch);
    }

    const shareUrl = `${APP_URL}/r/${report.share_id}`;
    const statusCounts: Record<string, number> = {};
    const regionCounts: Record<string, number> = {};
    for (const loc of locations) {
      statusCounts[loc.status.toLowerCase()] = (statusCounts[loc.status.toLowerCase()] || 0) + 1;
      regionCounts[loc.region] = (regionCounts[loc.region] || 0) + 1;
    }
    const topStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => `  • ${s}: ${c}`).join('\n');
    const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r, c]) => `  • ${r}: ${c}`).join('\n');

    await sendMsg(BOT_TOKEN, chatId, `✅ <b>Дашборд готов!</b>\n\n📁 ${doc.file_name}\n📊 ${locations.length} локаций\n\nСтатусы:\n${topStatuses}\n\nРегионы:\n${topRegions}`,
      { inline_keyboard: [[{ text: '📊 Открыть дашборд', url: shareUrl }]] }, threadId
    );

    return ok();
  } catch (error) {
    console.error('Bot error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: corsHeaders });
  }
});

function ok() {
  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
