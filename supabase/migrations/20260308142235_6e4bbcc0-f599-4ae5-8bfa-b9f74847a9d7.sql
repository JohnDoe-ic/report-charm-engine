
-- Staff members table
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint UNIQUE NOT NULL,
  telegram_username text,
  full_name text NOT NULL,
  account_number text NOT NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  registered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view staff" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staff" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staff" ON public.staff FOR UPDATE USING (true) WITH CHECK (true);

-- Staff shifts table
CREATE TABLE public.staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  location_address text NOT NULL,
  photo_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shifts" ON public.staff_shifts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shifts" ON public.staff_shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shifts" ON public.staff_shifts FOR UPDATE USING (true) WITH CHECK (true);

-- Staff activities table (sales, activations, top-ups)
CREATE TABLE public.staff_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  shift_id uuid REFERENCES public.staff_shifts(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('sale', 'activation', 'topup')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view activities" ON public.staff_activities FOR SELECT USING (true);
CREATE POLICY "Anyone can insert activities" ON public.staff_activities FOR INSERT WITH CHECK (true);
