-- Neon/Postgres seed data for Les Temples Eines
-- Inserts a small, coherent dataset so the app has something to render.

-- Extensions are managed by the platform; no CREATE EXTENSION statements here.

-- ============================================================================
-- SALONS
-- ============================================================================
-- Idempotent inserts (avoid ON CONFLICT for broader compatibility)
INSERT INTO salons (name, slug, address, city, phone, email, description, opening_hours)
SELECT
  'Les Temples - Paris', 'temple-paris', '123 Rue de la Paix, 75000 Paris', 'Paris',
  '+33 1 23 45 67 89', 'paris@lestemples.fr',
  'Sanctuary of relaxation in the heart of Paris',
  '{"monday":{"open":"10:00","close":"20:00"},"tuesday":{"open":"10:00","close":"20:00"},"wednesday":{"open":"10:00","close":"20:00"},"thursday":{"open":"10:00","close":"20:00"},"friday":{"open":"10:00","close":"21:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"19:00"}}'
WHERE NOT EXISTS (SELECT 1 FROM salons WHERE slug = 'temple-paris');

INSERT INTO salons (name, slug, address, city, phone, email, description, opening_hours)
SELECT
  'Les Temples - Lyon', 'temple-lyon', '456 Avenue de la République, 69000 Lyon', 'Lyon',
  '+33 4 72 34 56 78', 'lyon@lestemples.fr',
  'Wellness retreat in the vibrant city of Lyon',
  '{"monday":{"open":"10:00","close":"20:00"},"tuesday":{"open":"10:00","close":"20:00"},"wednesday":{"open":"10:00","close":"20:00"},"thursday":{"open":"10:00","close":"20:00"},"friday":{"open":"10:00","close":"21:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"19:00"}}'
WHERE NOT EXISTS (SELECT 1 FROM salons WHERE slug = 'temple-lyon');

INSERT INTO salons (name, slug, address, city, phone, email, description, opening_hours)
SELECT
  'Les Temples - Marseille', 'temple-marseille', '789 Boulevard de la Corniche, 13000 Marseille', 'Marseille',
  '+33 4 91 23 45 67', 'marseille@lestemples.fr',
  'Mediterranean escape with sea views',
  '{"monday":{"open":"10:00","close":"20:00"},"tuesday":{"open":"10:00","close":"20:00"},"wednesday":{"open":"10:00","close":"20:00"},"thursday":{"open":"10:00","close":"20:00"},"friday":{"open":"10:00","close":"21:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"19:00"}}'
WHERE NOT EXISTS (SELECT 1 FROM salons WHERE slug = 'temple-marseille');

-- ============================================================================
-- SERVICES (linked to salons via subqueries)
-- ============================================================================
INSERT INTO services (salon_id, name, description, duration_minutes, price_cents, category, image_url)
SELECT (SELECT id FROM salons WHERE slug='temple-paris'), 'Massage Relaxant', 'Soothing full-body massage to release tension', 60, 8900, 'Détente', '/relaxation-massage.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-paris') AND name='Massage Relaxant'
);
INSERT INTO services (salon_id, name, description, duration_minutes, price_cents, category, image_url)
SELECT (SELECT id FROM salons WHERE slug='temple-paris'), 'Massage aux Pierres Chaudes', 'Therapeutic massage with heated stones', 75, 10900, 'Thérapeutique', '/hot-stone-massage.png'
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-paris') AND name='Massage aux Pierres Chaudes'
);
INSERT INTO services (salon_id, name, description, duration_minutes, price_cents, category, image_url)
SELECT (SELECT id FROM salons WHERE slug='temple-paris'), 'Soin du Visage Premium', 'Luxurious facial treatment with organic products', 45, 7900, 'Détente', '/facial-spa-treatment.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-paris') AND name='Soin du Visage Premium'
);
INSERT INTO services (salon_id, name, description, duration_minutes, price_cents, category, image_url)
SELECT (SELECT id FROM salons WHERE slug='temple-lyon'), 'Massage Relaxant', 'Soothing full-body massage to release tension', 60, 8900, 'Détente', '/relaxation-massage.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-lyon') AND name='Massage Relaxant'
);
INSERT INTO services (salon_id, name, description, duration_minutes, price_cents, category, image_url)
SELECT (SELECT id FROM salons WHERE slug='temple-lyon'), 'Massage en Duo', 'Couples massage experience', 60, 17900, 'Détente', '/couples-massage-spa.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-lyon') AND name='Massage en Duo'
);
INSERT INTO services (salon_id, name, description, duration_minutes, price_cents, category, image_url)
SELECT (SELECT id FROM salons WHERE slug='temple-marseille'), 'Massage Sportif', 'Deep tissue massage for athletes', 60, 9900, 'Sportif', '/sports-massage.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-marseille') AND name='Massage Sportif'
);
INSERT INTO services (salon_id, name, description, duration_minutes, price_cents, category, image_url)
SELECT (SELECT id FROM salons WHERE slug='temple-marseille'), 'Massage aux Pierres Chaudes', 'Therapeutic massage with heated stones', 75, 10900, 'Thérapeutique', '/hot-stone-massage.png'
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-marseille') AND name='Massage aux Pierres Chaudes'
);

-- ============================================================================
-- STAFF (seed accounts with bcrypt via pgcrypto)
-- password for all seed users: password123
-- ============================================================================
-- bcrypt hash for "password123" with cost 12
INSERT INTO staff (salon_id, email, password_hash, first_name, last_name, phone, role, photo_url, specialties)
SELECT (SELECT id FROM salons WHERE slug='temple-paris'), 'sophie.martin@lestemples.fr', '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Sophie', 'Martin', '+33 6 11 22 33 44', 'therapist', '/professional-woman-diverse.png', ARRAY['Massage Relaxant','Massage aux Pierres Chaudes','Soin du Visage']
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email='sophie.martin@lestemples.fr');

INSERT INTO staff (salon_id, email, password_hash, first_name, last_name, phone, role, photo_url, specialties)
SELECT (SELECT id FROM salons WHERE slug='temple-paris'), 'jean.dupont@lestemples.fr', '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Jean', 'Dupont', '+33 6 55 66 77 88', 'therapist', '/professional-man.jpg', ARRAY['Massage Sportif','Massage Relaxant']
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email='jean.dupont@lestemples.fr');

INSERT INTO staff (salon_id, email, password_hash, first_name, last_name, phone, role, photo_url, specialties)
SELECT (SELECT id FROM salons WHERE slug='temple-lyon'), 'marie.leclerc@lestemples.fr', '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Marie', 'Leclerc', '+33 6 22 33 44 55', 'therapist', '/professional-woman-diverse.png', ARRAY['Massage Relaxant','Massage en Duo','Soin du Visage']
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email='marie.leclerc@lestemples.fr');

INSERT INTO staff (salon_id, email, password_hash, first_name, last_name, phone, role, photo_url, specialties)
SELECT (SELECT id FROM salons WHERE slug='temple-marseille'), 'pierre.rousseau@lestemples.fr', '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Pierre', 'Rousseau', '+33 6 99 88 77 66', 'therapist', '/professional-man.jpg', ARRAY['Massage Sportif','Massage aux Pierres Chaudes']
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email='pierre.rousseau@lestemples.fr');

-- ============================================================================
-- CLIENTS
-- ============================================================================
INSERT INTO clients (phone, email, first_name, last_name, internal_notes, loyalty_status, total_spent_cents, visit_count, last_visit_date)
SELECT '+33 6 12 34 56 78', 'alice@example.com', 'Alice', 'Dupont', 'Prefers quiet environment', 'regular', 8900, 1, CURRENT_DATE - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE phone = '+33 6 12 34 56 78');

INSERT INTO clients (phone, email, first_name, last_name, internal_notes, loyalty_status, total_spent_cents, visit_count, last_visit_date)
SELECT '+33 6 98 76 54 32', 'marc@example.com', 'Marc', 'Leblanc', 'Regular client, athlete', 'vip', 29700, 3, CURRENT_DATE - INTERVAL '7 days'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE phone = '+33 6 98 76 54 32');

-- ============================================================================
-- APPOINTMENTS (linking salons/staff/services/clients)
-- ============================================================================
INSERT INTO appointments (salon_id, client_id, staff_id, service_id, start_time, end_time, status, client_notes, internal_notes, payment_status, amount_paid_cents)
SELECT
  (SELECT id FROM salons WHERE slug='temple-paris'),
  (SELECT id FROM clients WHERE phone='+33 6 12 34 56 78'),
  (SELECT id FROM staff WHERE email='sophie.martin@lestemples.fr'),
  (SELECT id FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-paris') AND name='Massage Relaxant'),
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day' + INTERVAL '60 minutes',
  'confirmed',
  'First time client, prefers quiet environment',
  NULL,
  'paid',
  8900
WHERE NOT EXISTS (
  SELECT 1 FROM appointments
  WHERE client_id = (SELECT id FROM clients WHERE phone='+33 6 12 34 56 78')
    AND CAST(start_time AS DATE) = CURRENT_DATE + 1
);

INSERT INTO appointments (salon_id, client_id, staff_id, service_id, start_time, end_time, status, client_notes, internal_notes, payment_status, amount_paid_cents)
SELECT
  (SELECT id FROM salons WHERE slug='temple-paris'),
  (SELECT id FROM clients WHERE phone='+33 6 98 76 54 32'),
  (SELECT id FROM staff WHERE email='jean.dupont@lestemples.fr'),
  (SELECT id FROM services WHERE salon_id=(SELECT id FROM salons WHERE slug='temple-paris') AND name='Massage aux Pierres Chaudes'),
  NOW() + INTERVAL '2 days',
  NOW() + INTERVAL '2 days' + INTERVAL '60 minutes',
  'confirmed',
  NULL,
  NULL,
  'unpaid',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM appointments
  WHERE client_id = (SELECT id FROM clients WHERE phone='+33 6 98 76 54 32')
    AND CAST(start_time AS DATE) = CURRENT_DATE + 2
);

-- Done.
