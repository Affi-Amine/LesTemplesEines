-- Sawan is in Montmorency. Its description still contained the old Lyon demo text.
-- Match the exact obsolete value so a later editorial update is never overwritten.
UPDATE public.salons
SET description = 'Un espace de massage et de bien-être à Montmorency.'
WHERE id = '6a275a0a-c5b1-4ca6-a345-a4a287a738ab'::uuid
  AND slug = 'temple-sawan'
  AND city = 'Montmorency'
  AND description = 'Wellness retreat in the vibrant city of Lyon';
