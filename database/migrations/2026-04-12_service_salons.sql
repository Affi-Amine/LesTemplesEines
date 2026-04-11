-- Allow one service to be available in multiple salons via a join table.

CREATE TABLE IF NOT EXISTS service_salons (
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (service_id, salon_id)
);

CREATE INDEX IF NOT EXISTS idx_service_salons_service_id ON service_salons(service_id);
CREATE INDEX IF NOT EXISTS idx_service_salons_salon_id ON service_salons(salon_id);

-- Backfill existing single-salon relations.
INSERT INTO service_salons (service_id, salon_id)
SELECT id, salon_id
FROM services
WHERE salon_id IS NOT NULL
ON CONFLICT (service_id, salon_id) DO NOTHING;

-- Keep the legacy column optional for backward compatibility during rollout.
ALTER TABLE services
ALTER COLUMN salon_id DROP NOT NULL;
