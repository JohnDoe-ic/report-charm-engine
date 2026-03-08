import { supabase } from '@/integrations/supabase/client';
import { SalonLocation } from './types';

export interface SavedReport {
  id: string;
  shareId: string;
  fileName: string;
  createdAt: string;
}

export async function saveReport(
  fileName: string,
  fileSize: number,
  locations: SalonLocation[]
): Promise<SavedReport> {
  // Insert report
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .insert({
      file_name: fileName,
      file_size: fileSize,
      file_type: fileName.endsWith('.csv') ? 'csv' : 'xlsx',
      source: 'web',
    })
    .select('id, share_id, created_at')
    .single();

  if (reportError || !report) {
    throw new Error(`Failed to save report: ${reportError?.message}`);
  }

  // Insert rows in batches of 500
  const batchSize = 500;
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize).map((loc, idx) => ({
      report_id: report.id,
      sheet_name: loc.sheetName,
      row_index: i + idx,
      data: loc as any,
    }));

    const { error: rowError } = await supabase.from('report_rows').insert(batch);
    if (rowError) {
      throw new Error(`Failed to save rows: ${rowError.message}`);
    }
  }

  // --- Track new locations ---
  const { count: existingCount } = await supabase.from('tracked_locations').select('*', { count: 'exact', head: true });
  const isBaseline = (existingCount || 0) === 0;

  for (let i = 0; i < locations.length; i += 200) {
    const batch = locations.slice(i, i + 200);
    const inserts = batch.map(loc => ({
      location_key: `${loc.region}||${loc.city}||${loc.address}`.toLowerCase().trim(),
      region: loc.region,
      city: loc.city,
      address: loc.address,
      status: loc.status,
      salon_format: loc.salonFormat || null,
      first_report_id: report.id,
      is_baseline: isBaseline,
    }));
    await supabase.from('tracked_locations').upsert(inserts, { onConflict: 'location_key', ignoreDuplicates: true });
  }

  return {
    id: report.id,
    shareId: report.share_id,
    fileName,
    createdAt: report.created_at,
  };
}

export async function loadReport(shareId: string): Promise<{
  report: SavedReport;
  locations: SalonLocation[];
} | null> {
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('share_id', shareId)
    .single();

  if (reportError || !report) return null;

  // Fetch ALL rows with pagination to avoid 1000-row limit
  const allRows: any[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: rows, error: rowError } = await supabase
      .from('report_rows')
      .select('*')
      .eq('report_id', report.id)
      .order('row_index')
      .range(from, to);

    if (rowError) return null;
    if (!rows || rows.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...rows);
      hasMore = rows.length === pageSize;
      page++;
    }
  }

  const locations: SalonLocation[] = allRows.map((r) => ({
    ...(r.data as any),
    id: r.id,
    sheetName: r.sheet_name,
  }));

  return {
    report: {
      id: report.id,
      shareId: report.share_id,
      fileName: report.file_name,
      createdAt: report.created_at,
    },
    locations,
  };
}

export async function loadReportRows(
  reportId: string,
  filters: { sheetName?: string; statusKey?: string; region?: string; city?: string; format?: string },
  page: number = 0,
  pageSize: number = 50
): Promise<{ rows: SalonLocation[]; total: number }> {
  let query = supabase
    .from('report_rows')
    .select('*', { count: 'exact' })
    .eq('report_id', reportId);

  if (filters.sheetName) {
    query = query.eq('sheet_name', filters.sheetName);
  }

  const { data, count, error } = await query
    .order('row_index')
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) return { rows: [], total: 0 };

  let rows: SalonLocation[] = (data || []).map((r) => ({
    ...(r.data as any),
    id: r.id,
    sheetName: r.sheet_name,
  }));

  // Client-side filter for JSONB fields
  if (filters.statusKey) {
    const { normalizeStatus } = require('./types');
    rows = rows.filter((r) => normalizeStatus(r.status).key === filters.statusKey);
  }
  if (filters.region) rows = rows.filter((r) => r.region === filters.region);
  if (filters.city) rows = rows.filter((r) => r.city === filters.city);
  if (filters.format) rows = rows.filter((r) => r.salonFormat === filters.format);

  return { rows, total: count || 0 };
}
