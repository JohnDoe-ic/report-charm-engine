import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---- Excel parser (for salon reports) ----
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
    const getVal = (row: string[], name: string) => { const idx = colMap[name] ?? -1; return idx !== -1 ? row[idx] || '' : ''; };
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

function extractDocument(message: any) {
  if (message.document) return message.document;
  if (message.reply_to_message?.document) return message.reply_to_message.document;
  return null;
}

// ---- State helpers ----
async function setState(supabase: any, staffId: string, state: string | null, stateData?: any) {
  await supabase.from('staff').update({ state, state_data: stateData || null }).eq('id', staffId);
}

async function getOrCreateStaffEntry(supabase: any, userId: number, username: string) {
  const { data } = await supabase.from('staff').select('*').eq('telegram_user_id', userId).single();
  return data;
}

// ---- Keyboards ----
function mainMenuKeyboard(isRegistered: boolean, isAdmin: boolean) {
  const rows: any[][] = [];
  if (!isRegistered) {
    rows.push([{ text: '👤 Регистрация', callback_data: 'menu_register' }]);
  } else {
    rows.push([{ text: '📍 Открыть смену', callback_data: 'menu_shift' }]);
    if (isAdmin) {
      rows.push([
        { text: '📊 Отчёт по сотрудникам', callback_data: 'staff_report' },
        { text: '👑 Назначить админа', callback_data: 'menu_set_admin' },
      ]);
      rows.push([{ text: '✏️ Корректировка смен', callback_data: 'admin_edit_shifts' }]);
    }
  }
  rows.push([{ text: '📁 Загрузить Excel', callback_data: 'menu_excel_hint' }]);
  return { inline_keyboard: rows };
}

function shiftKeyboard(sales: number, activations: number, topups: number) {
  return {
    inline_keyboard: [
      [
        { text: `🛒 +Продажа (${sales})`, callback_data: 'staff_sale' },
        { text: sales > 0 ? `🛒 -1` : ' ', callback_data: sales > 0 ? 'undo_sale' : 'noop' },
      ],
      [
        { text: `📱 +Активация (${activations})`, callback_data: 'staff_activation' },
        { text: activations > 0 ? `📱 -1` : ' ', callback_data: activations > 0 ? 'undo_activation' : 'noop' },
      ],
      [
        { text: `💰 +Пополнение (${topups})`, callback_data: 'staff_topup' },
        { text: topups > 0 ? `💰 -1` : ' ', callback_data: topups > 0 ? 'undo_topup' : 'noop' },
      ],
      [
        { text: '📍 Сменить локацию', callback_data: 'staff_change_location' },
        { text: '🏁 Завершить смену', callback_data: 'staff_end_shift' },
      ],
    ],
  };
}

function editShiftKeyboard(shiftId: string, sales: number, activations: number, topups: number) {
  return {
    inline_keyboard: [
      [
        { text: `🛒 +1`, callback_data: `edit_add_sale_${shiftId}` },
        { text: `Продажи: ${sales}`, callback_data: 'noop' },
        { text: sales > 0 ? `🛒 -1` : ' ', callback_data: sales > 0 ? `edit_rm_sale_${shiftId}` : 'noop' },
      ],
      [
        { text: `📱 +1`, callback_data: `edit_add_act_${shiftId}` },
        { text: `Активации: ${activations}`, callback_data: 'noop' },
        { text: activations > 0 ? `📱 -1` : ' ', callback_data: activations > 0 ? `edit_rm_act_${shiftId}` : 'noop' },
      ],
      [
        { text: `💰 +1`, callback_data: `edit_add_top_${shiftId}` },
        { text: `Пополнения: ${topups}`, callback_data: 'noop' },
        { text: topups > 0 ? `💰 -1` : ' ', callback_data: topups > 0 ? `edit_rm_top_${shiftId}` : 'noop' },
      ],
      [{ text: '✅ Готово', callback_data: 'edit_done' }],
    ],
  };
}

async function getShiftCounts(supabase: any, shiftId: string) {
  const { count: s } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId).eq('activity_type', 'sale');
  const { count: a } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId).eq('activity_type', 'activation');
  const { count: t } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId).eq('activity_type', 'topup');
  return { sales: s || 0, activations: a || 0, topups: t || 0 };
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
    console.log('Update:', JSON.stringify(update).slice(0, 1200));

    // ==================== CALLBACK QUERIES ====================
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data as string;
      const userId = cb.from.id;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const username = cb.from?.username || cb.from?.first_name || 'unknown';

      const staff = await getOrCreateStaffEntry(supabase, userId, username);

      // --- Menu: Register ---
      if (data === 'menu_register') {
        if (staff) {
          await answerCb(BOT_TOKEN, cb.id, '✅ Вы уже зарегистрированы');
          return ok();
        }
        // First registered user becomes admin
        const { count: totalStaff } = await supabase.from('staff').select('*', { count: 'exact', head: true });
        const assignRole = (totalStaff || 0) === 0 ? 'admin' : 'employee';
        await supabase.from('staff').insert({
          telegram_user_id: userId, telegram_username: username,
          full_name: '—', account_number: '—', state: 'await_name', role: assignRole,
        });
        await answerCb(BOT_TOKEN, cb.id);
        const roleHint = assignRole === 'admin' ? '\n\n👑 Вы будете назначены <b>администратором</b>!' : '';
        await sendMsg(BOT_TOKEN, chatId, `👤 <b>Регистрация</b>${roleHint}\n\nВведите ваше <b>Имя и Фамилию</b>:`);
        return ok();
      }

      // --- Menu: Open shift ---
      if (data === 'menu_shift') {
        if (!staff) { await answerCb(BOT_TOKEN, cb.id, '❌ Сначала зарегистрируйтесь'); return ok(); }
        // Check for active shift
        const { data: activeShift } = await supabase.from('staff_shifts').select('*').eq('staff_id', staff.id).eq('is_active', true).single();
        if (activeShift) {
          await answerCb(BOT_TOKEN, cb.id, 'У вас уже открыта смена');
          const { count: s } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', activeShift.id).eq('activity_type', 'sale');
          const { count: a } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', activeShift.id).eq('activity_type', 'activation');
          const { count: t } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', activeShift.id).eq('activity_type', 'topup');
          await sendMsg(BOT_TOKEN, chatId,
            `📍 <b>${activeShift.location_address}</b>\n👤 ${staff.full_name}\n\n🛒 Продажи: ${s||0}\n📱 Активации: ${a||0}\n💰 Пополнения: ${t||0}`,
            shiftKeyboard(s||0, a||0, t||0)
          );
          return ok();
        }
        await setState(supabase, staff.id, 'await_shift_address');
        await answerCb(BOT_TOKEN, cb.id);
        await sendMsg(BOT_TOKEN, chatId, '📍 <b>Открытие смены</b>\n\nВведите <b>адрес точки</b>:');
        return ok();
      }

      // --- Menu: Set admin ---
      if (data === 'menu_set_admin') {
        if (!staff || staff.role !== 'admin') { await answerCb(BOT_TOKEN, cb.id, '❌ Только для админов'); return ok(); }
        await setState(supabase, staff.id, 'await_admin_username');
        await answerCb(BOT_TOKEN, cb.id);
        await sendMsg(BOT_TOKEN, chatId, '👑 Введите <b>@username</b> сотрудника, которого хотите назначить администратором:');
        return ok();
      }

      // --- Menu: Excel hint ---
      if (data === 'menu_excel_hint') {
        await answerCb(BOT_TOKEN, cb.id);
        await sendMsg(BOT_TOKEN, chatId, '📁 Просто отправьте Excel-файл (.xlsx) в этот чат, и я построю интерактивный дашборд.');
        return ok();
      }

      // --- Staff activity buttons ---
      if (!staff) { await answerCb(BOT_TOKEN, cb.id, '❌ Не зарегистрированы'); return ok(); }

      const { data: shift } = await supabase.from('staff_shifts').select('*').eq('staff_id', staff.id).eq('is_active', true).order('started_at', { ascending: false }).limit(1).single();

      if (data === 'staff_sale' || data === 'staff_activation' || data === 'staff_topup') {
        if (!shift) { await answerCb(BOT_TOKEN, cb.id, '❌ Нет активной смены'); return ok(); }
        const typeMap: Record<string, string> = { staff_sale: 'sale', staff_activation: 'activation', staff_topup: 'topup' };
        const labelMap: Record<string, string> = { staff_sale: 'Продажа', staff_activation: 'Активация', staff_topup: 'Пополнение' };
        await supabase.from('staff_activities').insert({ staff_id: staff.id, shift_id: shift.id, activity_type: typeMap[data] });
        const { count: s } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'sale');
        const { count: a } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'activation');
        const { count: t } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'topup');
        await answerCb(BOT_TOKEN, cb.id, `✅ ${labelMap[data]} +1`);
        await editMsg(BOT_TOKEN, chatId, messageId,
          `📍 <b>${shift.location_address}</b>\n👤 ${staff.full_name}\n\n🛒 Продажи: ${s||0}\n📱 Активации: ${a||0}\n💰 Пополнения: ${t||0}`,
          shiftKeyboard(s||0, a||0, t||0)
        );
        return ok();
      }

      // --- Undo activity buttons ---
      if (data === 'undo_sale' || data === 'undo_activation' || data === 'undo_topup') {
        if (!shift) { await answerCb(BOT_TOKEN, cb.id, '❌ Нет активной смены'); return ok(); }
        const undoMap: Record<string, string> = { undo_sale: 'sale', undo_activation: 'activation', undo_topup: 'topup' };
        const labelMap: Record<string, string> = { undo_sale: 'Продажа', undo_activation: 'Активация', undo_topup: 'Пополнение' };
        const actType = undoMap[data];
        // Delete the most recent activity of this type
        const { data: lastActivity } = await supabase.from('staff_activities').select('id').eq('shift_id', shift.id).eq('activity_type', actType).order('created_at', { ascending: false }).limit(1).single();
        if (lastActivity) {
          await supabase.from('staff_activities').delete().eq('id', lastActivity.id);
        }
        const { count: s } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'sale');
        const { count: a } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'activation');
        const { count: t } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'topup');
        await answerCb(BOT_TOKEN, cb.id, `↩️ ${labelMap[data]} -1`);
        await editMsg(BOT_TOKEN, chatId, messageId,
          `📍 <b>${shift.location_address}</b>\n👤 ${staff.full_name}\n\n🛒 Продажи: ${s||0}\n📱 Активации: ${a||0}\n💰 Пополнения: ${t||0}`,
          shiftKeyboard(s||0, a||0, t||0)
        );
        return ok();
      }

      if (data === 'staff_end_shift') {
        if (!shift) { await answerCb(BOT_TOKEN, cb.id, '❌ Нет активной смены'); return ok(); }
        await supabase.from('staff_shifts').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', shift.id);
        const { count: s } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'sale');
        const { count: a } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'activation');
        const { count: t } = await supabase.from('staff_activities').select('*', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('activity_type', 'topup');
        await answerCb(BOT_TOKEN, cb.id, '✅ Смена завершена');
        await editMsg(BOT_TOKEN, chatId, messageId,
          `🏁 <b>Смена завершена</b>\n📍 ${shift.location_address}\n👤 ${staff.full_name}\n\n🛒 Продажи: ${s||0}\n📱 Активации: ${a||0}\n💰 Пополнения: ${t||0}\n\nНажмите /start для главного меню.`
        );
        return ok();
      }

      if (data === 'staff_change_location') {
        if (!shift) { await answerCb(BOT_TOKEN, cb.id, '❌ Нет активной смены'); return ok(); }
        await supabase.from('staff_shifts').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', shift.id);
        await setState(supabase, staff.id, 'await_shift_address');
        await answerCb(BOT_TOKEN, cb.id);
        await sendMsg(BOT_TOKEN, chatId, '📍 Введите <b>новый адрес</b> точки:');
        return ok();
      }

      // --- Admin: report ---
      if (data === 'staff_report') {
        if (!staff || staff.role !== 'admin') { await answerCb(BOT_TOKEN, cb.id, '❌ Только для админов'); return ok(); }
        await answerCb(BOT_TOKEN, cb.id, '⏳ Генерирую отчёт...');
        const reportRes = await fetch(`${SUPABASE_URL}/functions/v1/staff-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ chatId: String(chatId) }),
        });
        const reportData = await reportRes.json();
        if (reportData.shareUrl) {
          await sendMsg(BOT_TOKEN, chatId, `📊 <b>Отчёт готов!</b>\n\n${reportData.summary || ''}`, {
            inline_keyboard: [[{ text: '📊 Открыть дашборд', url: reportData.shareUrl }]]
          });
        } else {
          await sendMsg(BOT_TOKEN, chatId, '❌ Не удалось сформировать отчёт');
        }
        return ok();
      }

      // --- Admin: edit shifts - select staff ---
      if (data === 'admin_edit_shifts') {
        if (!staff || staff.role !== 'admin') { await answerCb(BOT_TOKEN, cb.id, '❌ Только для админов'); return ok(); }
        const { data: allStaff } = await supabase.from('staff').select('id, full_name').neq('full_name', '—').order('full_name');
        if (!allStaff || allStaff.length === 0) { await answerCb(BOT_TOKEN, cb.id, 'Нет сотрудников'); return ok(); }
        const buttons = allStaff.map((s: any) => [{ text: s.full_name, callback_data: `edit_staff_${s.id}` }]);
        buttons.push([{ text: '◀️ Назад', callback_data: 'edit_done' }]);
        await answerCb(BOT_TOKEN, cb.id);
        await sendMsg(BOT_TOKEN, chatId, '✏️ <b>Корректировка смен</b>\n\nВыберите сотрудника:', { inline_keyboard: buttons });
        return ok();
      }

      // --- Admin: edit shifts - select shift for a staff member ---
      if (data.startsWith('edit_staff_')) {
        if (!staff || staff.role !== 'admin') { await answerCb(BOT_TOKEN, cb.id, '❌ Только для админов'); return ok(); }
        const targetStaffId = data.replace('edit_staff_', '');
        const { data: targetStaff } = await supabase.from('staff').select('full_name').eq('id', targetStaffId).single();
        const { data: shifts } = await supabase.from('staff_shifts').select('id, location_address, started_at, is_active').eq('staff_id', targetStaffId).order('started_at', { ascending: false }).limit(10);
        if (!shifts || shifts.length === 0) { await answerCb(BOT_TOKEN, cb.id, 'Нет смен'); return ok(); }
        const buttons = shifts.map((sh: any) => {
          const date = new Date(sh.started_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
          const label = `${date} — ${sh.location_address}${sh.is_active ? ' 🟢' : ''}`;
          return [{ text: label, callback_data: `edit_shift_${sh.id}` }];
        });
        buttons.push([{ text: '◀️ Назад', callback_data: 'admin_edit_shifts' }]);
        await answerCb(BOT_TOKEN, cb.id);
        await editMsg(BOT_TOKEN, chatId, messageId, `✏️ Смены: <b>${targetStaff?.full_name || '?'}</b>\n\nВыберите смену:`, { inline_keyboard: buttons });
        return ok();
      }

      // --- Admin: edit shift - show edit keyboard ---
      if (data.startsWith('edit_shift_')) {
        if (!staff || staff.role !== 'admin') { await answerCb(BOT_TOKEN, cb.id, '❌ Только для админов'); return ok(); }
        const shiftId = data.replace('edit_shift_', '');
        const { data: sh } = await supabase.from('staff_shifts').select('*, staff(full_name)').eq('id', shiftId).single();
        if (!sh) { await answerCb(BOT_TOKEN, cb.id, 'Смена не найдена'); return ok(); }
        const counts = await getShiftCounts(supabase, shiftId);
        const date = new Date(sh.started_at).toLocaleDateString('ru-RU');
        const staffName = (sh as any).staff?.full_name || '?';
        await answerCb(BOT_TOKEN, cb.id);
        await editMsg(BOT_TOKEN, chatId, messageId,
          `✏️ <b>Корректировка</b>\n👤 ${staffName}\n📍 ${sh.location_address}\n📅 ${date}`,
          editShiftKeyboard(shiftId, counts.sales, counts.activations, counts.topups)
        );
        return ok();
      }

      // --- Admin: edit shift +/- activity ---
      if (data.startsWith('edit_add_') || data.startsWith('edit_rm_')) {
        if (!staff || staff.role !== 'admin') { await answerCb(BOT_TOKEN, cb.id, '❌ Только для админов'); return ok(); }
        const isAdd = data.startsWith('edit_add_');
        const rest = data.replace(isAdd ? 'edit_add_' : 'edit_rm_', '');
        // rest = "sale_UUID" or "act_UUID" or "top_UUID"
        const typeKey = rest.substring(0, rest.indexOf('_'));
        const shiftId = rest.substring(rest.indexOf('_') + 1);
        const typeMap: Record<string, string> = { sale: 'sale', act: 'activation', top: 'topup' };
        const actType = typeMap[typeKey];
        if (!actType) { await answerCb(BOT_TOKEN, cb.id); return ok(); }

        // Get staff_id for the shift
        const { data: sh } = await supabase.from('staff_shifts').select('staff_id, location_address, started_at, staff(full_name)').eq('id', shiftId).single();
        if (!sh) { await answerCb(BOT_TOKEN, cb.id, 'Смена не найдена'); return ok(); }

        if (isAdd) {
          await supabase.from('staff_activities').insert({ staff_id: sh.staff_id, shift_id: shiftId, activity_type: actType });
          await answerCb(BOT_TOKEN, cb.id, '✅ +1');
        } else {
          const { data: last } = await supabase.from('staff_activities').select('id').eq('shift_id', shiftId).eq('activity_type', actType).order('created_at', { ascending: false }).limit(1).single();
          if (last) await supabase.from('staff_activities').delete().eq('id', last.id);
          await answerCb(BOT_TOKEN, cb.id, '↩️ -1');
        }

        const counts = await getShiftCounts(supabase, shiftId);
        const date = new Date(sh.started_at).toLocaleDateString('ru-RU');
        const staffName = (sh as any).staff?.full_name || '?';
        await editMsg(BOT_TOKEN, chatId, messageId,
          `✏️ <b>Корректировка</b>\n👤 ${staffName}\n📍 ${sh.location_address}\n📅 ${date}`,
          editShiftKeyboard(shiftId, counts.sales, counts.activations, counts.topups)
        );
        return ok();
      }

      // --- Admin: done editing ---
      if (data === 'edit_done') {
        await answerCb(BOT_TOKEN, cb.id);
        await editMsg(BOT_TOKEN, chatId, messageId, '✅ Корректировка завершена.\n\nНажмите /start для главного меню.');
        return ok();
      }

      if (data === 'noop') { await answerCb(BOT_TOKEN, cb.id); return ok(); }
      await answerCb(BOT_TOKEN, cb.id);
      return ok();
    }

    // ==================== MESSAGES ====================
    const message = update?.message;
    if (!message) return ok();

    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || 'unknown';
    const threadId = message.message_thread_id;
    const text = (message.text || '').trim();

    // --- /start → main menu ---
    if (text === '/start' || text === '/menu') {
      const staff = await getOrCreateStaffEntry(supabase, userId, username);
      const isRegistered = !!staff && staff.full_name !== '—';
      const isAdmin = staff?.role === 'admin';
      
      let greeting = '📊 <b>Бот отчётности</b>\n\n';
      if (isRegistered) {
        greeting += `👤 ${staff.full_name}\n`;
        if (isAdmin) greeting += '👑 Администратор\n';
        greeting += '\nВыберите действие:';
      } else {
        greeting += 'Добро пожаловать! Выберите действие:';
      }

      await sendMsg(BOT_TOKEN, chatId, greeting, mainMenuKeyboard(isRegistered, isAdmin), threadId);
      return ok();
    }

    // --- /admin (first admin self-promotion) ---
    if (text === '/admin') {
      const staff = await getOrCreateStaffEntry(supabase, userId, username);
      if (!staff || staff.full_name === '—') {
        await sendMsg(BOT_TOKEN, chatId, '❌ Сначала зарегистрируйтесь через /start', undefined, threadId);
        return ok();
      }
      const { count: adminCount } = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('role', 'admin');
      if (adminCount === 0) {
        await supabase.from('staff').update({ role: 'admin' }).eq('id', staff.id);
        await sendMsg(BOT_TOKEN, chatId, '👑 Вы назначены первым администратором!\n\nНажмите /start для главного меню.', undefined, threadId);
      } else if (staff.role !== 'admin') {
        await sendMsg(BOT_TOKEN, chatId, '❌ Администратор уже назначен. Обратитесь к нему.', undefined, threadId);
      } else {
        await sendMsg(BOT_TOKEN, chatId, '👑 Вы уже администратор.', undefined, threadId);
      }
      return ok();
    }

    // --- Handle state-based text inputs ---
    const staff = await getOrCreateStaffEntry(supabase, userId, username);

    if (staff && staff.state && text) {
      // Registration: awaiting name
      if (staff.state === 'await_name') {
        await supabase.from('staff').update({ full_name: text, state: 'await_account', state_data: null }).eq('id', staff.id);
        await sendMsg(BOT_TOKEN, chatId, `👤 <b>${text}</b>\n\nТеперь введите ваш <b>лицевой счёт</b>:`, undefined, threadId);
        return ok();
      }

      // Registration: awaiting account number
      if (staff.state === 'await_account') {
        await supabase.from('staff').update({ account_number: text, state: null, state_data: null }).eq('id', staff.id);
        const updatedStaff = { ...staff, account_number: text };
        await sendMsg(BOT_TOKEN, chatId,
          `✅ <b>Регистрация завершена!</b>\n\n👤 ${staff.full_name}\n📋 Лицевой счёт: ${text}\n\nНажмите /start для главного меню.`,
          mainMenuKeyboard(true, staff.role === 'admin'), threadId
        );
        return ok();
      }

      // Shift: awaiting address
      if (staff.state === 'await_shift_address') {
        // Close any active shift
        await supabase.from('staff_shifts').update({ is_active: false, ended_at: new Date().toISOString() }).eq('staff_id', staff.id).eq('is_active', true);
        // Create new shift
        await supabase.from('staff_shifts').insert({ staff_id: staff.id, location_address: text });
        await setState(supabase, staff.id, null);

        await sendMsg(BOT_TOKEN, chatId,
          `✅ <b>Смена открыта!</b>\n📍 ${text}\n👤 ${staff.full_name}\n\n📸 Отправьте фото точки (необязательно)\n\n🛒 Продажи: 0\n📱 Активации: 0\n💰 Пополнения: 0`,
          shiftKeyboard(0, 0, 0), threadId
        );
        return ok();
      }

      // Admin: awaiting username to promote
      if (staff.state === 'await_admin_username') {
        const targetUsername = text.replace('@', '').trim();
        await setState(supabase, staff.id, null);
        const { data: target } = await supabase.from('staff').select('*').eq('telegram_username', targetUsername).single();
        if (!target) {
          await sendMsg(BOT_TOKEN, chatId, `❌ Сотрудник @${targetUsername} не найден. Убедитесь, что он зарегистрирован.`, undefined, threadId);
        } else {
          await supabase.from('staff').update({ role: 'admin' }).eq('id', target.id);
          await sendMsg(BOT_TOKEN, chatId, `👑 @${targetUsername} (${target.full_name}) назначен администратором!`, undefined, threadId);
        }
        return ok();
      }
    }

    // --- Photo: save to active shift ---
    if (message.photo && message.photo.length > 0 && staff) {
      const { data: activeShift } = await supabase.from('staff_shifts').select('*').eq('staff_id', staff.id).eq('is_active', true).single();
      if (activeShift) {
        const photo = message.photo[message.photo.length - 1];
        const fileInfo = await tgApi(BOT_TOKEN, 'getFile', { file_id: photo.file_id });
        const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
        await supabase.from('staff_shifts').update({ photo_url: photoUrl }).eq('id', activeShift.id);
        await sendMsg(BOT_TOKEN, chatId, '📸 Фото точки сохранено!', undefined, threadId);
        return ok();
      }
    }

    // ==================== EXCEL FILE ====================
    const doc = extractDocument(message);
    if (doc) {
      const fileName = (doc.file_name || '').toLowerCase();
      const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || doc.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (!isXlsx) {
        if (chatType === 'private') await sendMsg(BOT_TOKEN, chatId, '❌ Поддерживаются только .xlsx файлы.');
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

      for (let i = 0; i < locations.length; i += 500) {
        const batch = locations.slice(i, i + 500).map((loc, idx) => ({
          report_id: report.id, sheet_name: loc.sheetName, row_index: i + idx, data: loc,
        }));
        await supabase.from('report_rows').insert(batch);
      }

      // --- Track new locations ---
      const { count: existingCount } = await supabase.from('tracked_locations').select('*', { count: 'exact', head: true });
      const isBaseline = (existingCount || 0) === 0;
      let newLocCount = 0;

      for (let i = 0; i < locations.length; i += 200) {
        const batch = locations.slice(i, i + 200);
        const inserts = batch.map(loc => {
          const key = `${loc.region}||${loc.city}||${loc.address}`.toLowerCase().trim();
          return {
            location_key: key,
            region: loc.region,
            city: loc.city,
            address: loc.address,
            status: loc.status,
            salon_format: loc.salonFormat || null,
            first_report_id: report.id,
            is_baseline: isBaseline,
          };
        });
        const { data: inserted } = await supabase.from('tracked_locations').upsert(inserts, { onConflict: 'location_key', ignoreDuplicates: true }).select('id');
        newLocCount += (inserted?.length || 0);
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
      const newLocText = isBaseline ? `\n\n🆕 Базовая загрузка (${locations.length} точек)` : `\n\n🆕 Новых точек: ${newLocCount}`;

      await sendMsg(BOT_TOKEN, chatId, `✅ <b>Дашборд готов!</b>\n\n📁 ${doc.file_name}\n📊 ${locations.length} локаций${newLocText}\n\nСтатусы:\n${topStatuses}\n\nРегионы:\n${topRegions}`,
        { inline_keyboard: [[{ text: '📊 Открыть дашборд', url: shareUrl }]] }, threadId
      );
      return ok();
    }

    // --- Default: show menu in private chats ---
    if (chatType === 'private') {
      const isRegistered = !!staff && staff.full_name !== '—';
      const isAdmin = staff?.role === 'admin';
      await sendMsg(BOT_TOKEN, chatId, '👆 Выберите действие:', mainMenuKeyboard(isRegistered, isAdmin), threadId);
    }

    return ok();
  } catch (error) {
    console.error('Bot error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: corsHeaders });
  }
});

function ok() {
  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
