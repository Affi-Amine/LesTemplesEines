ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_method_check;

ALTER TABLE appointments
    ADD CONSTRAINT appointments_payment_method_check
        CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'check', 'other', 'treatwell', 'gift_card', 'loyalty', 'mixed'));
