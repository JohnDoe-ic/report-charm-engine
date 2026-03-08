CREATE TABLE public.tracked_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key text NOT NULL UNIQUE,
  region text,
  city text,
  address text,
  status text,
  salon_format text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  first_report_id uuid REFERENCES public.reports(id),
  is_baseline boolean NOT NULL DEFAULT false
);

ALTER TABLE public.tracked_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tracked_locations" ON public.tracked_locations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tracked_locations" ON public.tracked_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tracked_locations" ON public.tracked_locations FOR UPDATE USING (true) WITH CHECK (true);