
-- Update payments table to support new payment methods
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE payments 
  ADD CONSTRAINT payments_method_check 
  CHECK (method IN ('cash', 'card', 'check', 'other', 'treatwell', 'gift_card', 'loyalty'));
