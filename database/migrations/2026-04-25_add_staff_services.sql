CREATE TABLE IF NOT EXISTS public.staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_services_staff_id ON public.staff_services(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service_id ON public.staff_services(service_id);
