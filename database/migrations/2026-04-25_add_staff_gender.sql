ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS gender VARCHAR(10)
CHECK (gender IN ('male', 'female'));
