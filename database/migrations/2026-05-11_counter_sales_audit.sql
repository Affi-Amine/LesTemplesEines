ALTER TABLE gift_cards
    ADD COLUMN IF NOT EXISTS buyer_name TEXT,
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS sold_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE client_packs
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS sold_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

UPDATE gift_cards
SET payment_method = 'stripe'
WHERE payment_method IS NULL
  AND stripe_checkout_session_id IS NOT NULL;

UPDATE client_packs
SET payment_method = 'stripe'
WHERE payment_method IS NULL
  AND stripe_checkout_session_id IS NOT NULL;

ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_payment_method_check;
ALTER TABLE gift_cards
    ADD CONSTRAINT gift_cards_payment_method_check
        CHECK (
            payment_method IS NULL
            OR payment_method IN ('stripe', 'cash', 'card', 'check', 'other', 'on_site')
        );

ALTER TABLE client_packs DROP CONSTRAINT IF EXISTS client_packs_payment_method_check;
ALTER TABLE client_packs
    ADD CONSTRAINT client_packs_payment_method_check
        CHECK (
            payment_method IS NULL
            OR payment_method IN ('stripe', 'cash', 'card', 'check', 'other', 'on_site')
        );

CREATE INDEX IF NOT EXISTS idx_gift_cards_sold_by_staff_id ON gift_cards(sold_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_client_packs_sold_by_staff_id ON client_packs(sold_by_staff_id);
