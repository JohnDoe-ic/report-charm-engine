import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const APP_URL = Deno.env.get('APP_URL') || 'https://report-charm-engine.lovable.app';

  try {
    const { chatId, dateFrom, dateTo } = await req.json();

    // Default: today
    const now = new Date();
    const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = dateTo ? new Date(dateTo) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Get all staff
    const { data: allStaff } = await supabase.from('staff').select('*');
    if (!allStaff || allStaff.length === 0) {
      return new Response(JSON.stringify({ error: 'No staff found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get shifts in date range
    const { data: shifts } = await supabase.from('staff_shifts').select('*').gte('started_at', from.toISOString()).lte('started_at', to.toISOString());

    // Get activities in date range
    const { data: activities } = await supabase.from('staff_activities').select('*').gte('created_at', from.toISOString()).lte('created_at', to.toISOString());

    // Build report data
    const staffMap = new Map(allStaff.map(s => [s.id, s]));
    const rows: any[] = [];

    for (const staff of allStaff) {
      const staffShifts = (shifts || []).filter(s => s.staff_id === staff.id);
      const staffActivities = (activities || []).filter(a => a.staff_id === staff.id);
      const sales = staffActivities.filter(a => a.activity_type === 'sale').length;
      const activations = staffActivities.filter(a => a.activity_type === 'activation').length;
      const topups = staffActivities.filter(a => a.activity_type === 'topup').length;
      const locations = [...new Set(staffShifts.map(s => s.location_address))];

      rows.push({
        'Сотрудник': staff.full_name,
        'Лицевой счёт': staff.account_number,
        'Роль': staff.role === 'admin' ? 'Администратор' : 'Сотрудник',
        'Смен': staffShifts.length,
        'Локации': locations.join('; '),
        'Продажи': sales,
        'Активации': activations,
        'Пополнения': topups,
        'Итого действий': sales + activations + topups,
        'Telegram': staff.telegram_username ? `@${staff.telegram_username}` : '',
      });
    }

    // Create Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Сотрудники');

    // Detail sheet with all activities
    const detailRows: any[] = [];
    for (const activity of (activities || [])) {
      const staff = staffMap.get(activity.staff_id);
      const shift = (shifts || []).find(s => s.id === activity.shift_id);
      const typeLabels: Record<string, string> = { sale: 'Продажа', activation: 'Активация', topup: 'Пополнение' };
      detailRows.push({
        'Сотрудник': staff?.full_name || 'Неизвестный',
        'Тип': typeLabels[activity.activity_type] || activity.activity_type,
        'Адрес': shift?.location_address || '',
        'Дата/время': new Date(activity.created_at).toLocaleString('ru-RU'),
      });
    }
    if (detailRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'Детали');
    }

    const excelBuffer = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Save as a report
    const { data: report, error: reportError } = await supabase.from('reports').insert({
      file_name: `staff-report-${from.toISOString().slice(0, 10)}.xlsx`,
      file_size: 0,
      file_type: 'xlsx',
      source: 'staff-report',
      telegram_chat_id: chatId || null,
    }).select('id, share_id').single();

    if (reportError) throw reportError;

    // Insert rows for the dashboard
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((row, idx) => ({
        report_id: report.id,
        sheet_name: 'Сотрудники',
        row_index: i + idx,
        data: row,
      }));
      await supabase.from('report_rows').insert(batch);
    }
    // Insert detail rows
    for (let i = 0; i < detailRows.length; i += batchSize) {
      const batch = detailRows.slice(i, i + batchSize).map((row, idx) => ({
        report_id: report.id,
        sheet_name: 'Детали',
        row_index: rows.length + i + idx,
        data: row,
      }));
      await supabase.from('report_rows').insert(batch);
    }

    const shareUrl = `${APP_URL}/staff/${report.share_id}`;

    // Build summary
    const totalSales = rows.reduce((s, r) => s + r['Продажи'], 0);
    const totalActivations = rows.reduce((s, r) => s + r['Активации'], 0);
    const totalTopups = rows.reduce((s, r) => s + r['Пополнения'], 0);
    const summary = `👥 Сотрудников: ${rows.length}\n🛒 Продажи: ${totalSales}\n📱 Активации: ${totalActivations}\n💰 Пополнения: ${totalTopups}`;

    return new Response(JSON.stringify({
      ok: true,
      shareUrl,
      shareId: report.share_id,
      summary,
      excelBase64: excelBuffer,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Staff report error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
