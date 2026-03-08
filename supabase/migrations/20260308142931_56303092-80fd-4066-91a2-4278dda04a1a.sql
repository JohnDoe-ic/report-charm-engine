ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS state text DEFAULT null;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS state_data jsonb DEFAULT null;