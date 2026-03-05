-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id TEXT NOT NULL UNIQUE DEFAULT substring(gen_random_uuid()::text, 1, 8),
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  source TEXT DEFAULT 'web',
  telegram_chat_id TEXT,
  telegram_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create report_rows table
CREATE TABLE public.report_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL
);

-- Indexes
CREATE INDEX idx_reports_share_id ON public.reports(share_id);
CREATE INDEX idx_report_rows_report_id ON public.report_rows(report_id);
CREATE INDEX idx_report_rows_sheet ON public.report_rows(report_id, sheet_name);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_rows ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth)
CREATE POLICY "Anyone can view reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view report rows" ON public.report_rows FOR SELECT USING (true);
CREATE POLICY "Anyone can insert report rows" ON public.report_rows FOR INSERT WITH CHECK (true);