ALTER TABLE clients
    ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON clients(auth_user_id);

CREATE TABLE IF NOT EXISTS packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    number_of_sessions INTEGER NOT NULL CHECK (number_of_sessions > 0),
    allowed_services UUID[] NOT NULL DEFAULT '{}',
    allowed_installments INTEGER[] NOT NULL DEFAULT ARRAY[1],
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CHECK (array_length(allowed_services, 1) IS NULL OR array_length(allowed_services, 1) > 0),
    CHECK (
        allowed_installments <@ ARRAY[1, 2, 3]
        AND array_length(allowed_installments, 1) IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_packs_is_active ON packs(is_active);

DROP TRIGGER IF EXISTS update_packs_updated_at ON packs;
CREATE TRIGGER update_packs_updated_at BEFORE UPDATE ON packs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS client_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE RESTRICT,
    total_sessions INTEGER NOT NULL CHECK (total_sessions >= 0),
    remaining_sessions INTEGER NOT NULL CHECK (remaining_sessions >= 0 AND remaining_sessions <= total_sessions),
    installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count IN (1, 2, 3)),
    paid_installments INTEGER NOT NULL DEFAULT 0 CHECK (paid_installments >= 0 AND paid_installments <= installment_count),
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'active', 'partially_paid', 'paid', 'failed', 'cancelled')),
    stripe_subscription_id TEXT,
    stripe_subscription_schedule_id TEXT,
    stripe_checkout_session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_packs_client_id ON client_packs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_packs_pack_id ON client_packs(pack_id);
CREATE INDEX IF NOT EXISTS idx_client_packs_payment_status ON client_packs(payment_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_packs_checkout_session_id
    ON client_packs(stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_packs_subscription_id
    ON client_packs(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_client_packs_updated_at ON client_packs;
CREATE TRIGGER update_client_packs_updated_at BEFORE UPDATE ON client_packs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS client_pack_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_pack_id UUID NOT NULL REFERENCES client_packs(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_pack_usages_client_pack_id ON client_pack_usages(client_pack_id);
CREATE INDEX IF NOT EXISTS idx_client_pack_usages_used_at ON client_pack_usages(used_at);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_method_check;
ALTER TABLE appointments
    ADD CONSTRAINT appointments_payment_method_check
        CHECK (
            payment_method IS NULL
            OR payment_method IN ('stripe', 'gift_card', 'pack', 'on_site', 'cash', 'card', 'check', 'other', 'treatwell', 'loyalty', 'mixed')
        );

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments
    ADD CONSTRAINT payments_method_check
        CHECK (method IN ('stripe', 'gift_card', 'pack', 'on_site', 'cash', 'card', 'check', 'other', 'treatwell', 'loyalty'));

ALTER TABLE stripe_checkout_sessions DROP CONSTRAINT IF EXISTS stripe_checkout_sessions_checkout_type_check;
ALTER TABLE stripe_checkout_sessions
    ADD CONSTRAINT stripe_checkout_sessions_checkout_type_check
        CHECK (checkout_type IN ('gift_card', 'appointment', 'pack'));

ALTER TABLE stripe_checkout_sessions
    ADD COLUMN IF NOT EXISTS client_pack_id UUID REFERENCES client_packs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_subscription_id
    ON stripe_checkout_sessions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_pack_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public active packs are viewable by everyone" ON packs;
CREATE POLICY "Public active packs are viewable by everyone"
    ON packs FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Clients can view their own packs" ON client_packs;
CREATE POLICY "Clients can view their own packs"
    ON client_packs FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM clients
            WHERE clients.id = client_packs.client_id
              AND clients.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can view their own pack usages" ON client_pack_usages;
CREATE POLICY "Clients can view their own pack usages"
    ON client_pack_usages FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM client_packs
            JOIN clients ON clients.id = client_packs.client_id
            WHERE client_packs.id = client_pack_usages.client_pack_id
              AND clients.auth_user_id = auth.uid()
        )
    );
