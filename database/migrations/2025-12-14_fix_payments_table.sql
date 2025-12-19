
-- 1. Create payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'check', 'other', 'treatwell', 'gift_card', 'loyalty')),
    reference VARCHAR(255), -- Transaction reference or check number
    notes TEXT,
    recorded_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. If table exists, update the constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
        
        ALTER TABLE payments 
          ADD CONSTRAINT payments_method_check 
          CHECK (method IN ('cash', 'card', 'check', 'other', 'treatwell', 'gift_card', 'loyalty'));
    END IF;
END $$;
