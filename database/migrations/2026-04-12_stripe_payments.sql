ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

ALTER TABLE gift_cards
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

UPDATE appointments
SET payment_status = COALESCE(payment_status, 'unpaid')
WHERE payment_status IS NULL;

UPDATE appointments
SET paid_at = COALESCE(paid_at, updated_at, created_at)
WHERE payment_status = 'paid'
  AND paid_at IS NULL;

UPDATE appointments
SET payment_method = 'on_site'
WHERE payment_method IS NULL
  AND status <> 'blocked';

UPDATE gift_cards
SET payment_status = 'paid',
    paid_at = COALESCE(paid_at, purchased_at, created_at)
WHERE payment_status = 'unpaid';

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_check;
ALTER TABLE appointments
    ADD CONSTRAINT appointments_payment_status_check
        CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid', 'unpaid', 'failed', 'partial'));

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_method_check;
ALTER TABLE appointments
    ADD CONSTRAINT appointments_payment_method_check
        CHECK (
            payment_method IS NULL
            OR payment_method IN ('stripe', 'gift_card', 'on_site', 'cash', 'card', 'check', 'other', 'treatwell', 'loyalty', 'mixed')
        );

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments
    ADD CONSTRAINT payments_method_check
        CHECK (method IN ('stripe', 'gift_card', 'on_site', 'cash', 'card', 'check', 'other', 'treatwell', 'loyalty'));

ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_payment_status_check;
ALTER TABLE gift_cards
    ADD CONSTRAINT gift_cards_payment_status_check
        CHECK (payment_status IN ('paid', 'unpaid'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_stripe_checkout_session_id
    ON appointments(stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_stripe_checkout_session_id
    ON gift_cards(stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkout_type VARCHAR(32) NOT NULL CHECK (checkout_type IN ('gift_card', 'appointment')),
    stripe_checkout_session_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'failed')),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'eur',
    payload JSONB NOT NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    gift_card_id UUID REFERENCES gift_cards(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_type ON stripe_checkout_sessions(checkout_type);
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_status ON stripe_checkout_sessions(status);

DROP TRIGGER IF EXISTS update_stripe_checkout_sessions_updated_at ON stripe_checkout_sessions;
CREATE TRIGGER update_stripe_checkout_sessions_updated_at BEFORE UPDATE ON stripe_checkout_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
