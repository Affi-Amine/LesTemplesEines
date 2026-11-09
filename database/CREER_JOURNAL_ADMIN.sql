-- Correctif cible : journal des modifications, sans toucher aux rendez-vous.
BEGIN;

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid REFERENCES public.salons(id) ON DELETE SET NULL,
  actor_id uuid,
  action_type varchar(100) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activity_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
