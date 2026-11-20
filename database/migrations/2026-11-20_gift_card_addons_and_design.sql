-- Gift cards: physical extras and the card's design
--
-- 1. gift_card_design_settings — one row: how the gift card PNG looks (theme,
--    title, tagline, validity, logo, optional background photo). Edited from
--    Administration › Cartes cadeaux › Générateur. Missing row/table = defaults.
-- 2. gift_card_addons — the physical extras sold with an online gift card (a
--    printed card in its box, a candle…): picture, price, delivery fee, extra
--    questions to ask the buyer. Managed from Administration › Cartes cadeaux ›
--    Cadeaux physiques.
-- 3. gift_card_addon_orders — one row per extra bought with a gift card, with
--    the delivery address and the answers, to prepare and ship.
--
-- Run it before deploying the matching code; the code degrades to "no extras,
-- default design" until then.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gift_card_design_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  theme VARCHAR(20) NOT NULL DEFAULT 'or-sombre' CHECK (theme IN ('or-sombre', 'ivoire', 'jade')),
  title VARCHAR(40) NOT NULL DEFAULT 'Carte Cadeau',
  tagline VARCHAR(80) NOT NULL DEFAULT 'Un moment de bien-être à offrir',
  footer_note VARCHAR(160) NOT NULL DEFAULT 'Présentez ce code lors de la réservation, en ligne ou au salon.',
  signature VARCHAR(60) NOT NULL DEFAULT 'Les Temples Thaïlande',
  show_logo BOOLEAN NOT NULL DEFAULT TRUE,
  validity_months INTEGER DEFAULT 12 CHECK (validity_months IS NULL OR validity_months BETWEEN 1 AND 60),
  background_image_url TEXT,
  updated_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.gift_card_design_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.gift_card_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  image_url TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  -- FALSE for an extra handed over at the salon: no address is asked.
  requires_shipping BOOLEAN NOT NULL DEFAULT TRUE,
  -- [{"label": "Couleur du ruban", "required": true}, ...]
  extra_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_card_addons_active ON public.gift_card_addons (is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.gift_card_addon_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES public.gift_card_addons(id) ON DELETE SET NULL,
  -- Snapshot at purchase: the catalogue can change afterwards.
  addon_name VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10),
  addon_price_cents INTEGER NOT NULL CHECK (addon_price_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  -- {"name", "phone", "line1", "line2", "postal_code", "city", "country"}; NULL when handed over at the salon.
  shipping JSONB,
  -- {"<question label>": "<answer>"}
  extra_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'a_preparer' CHECK (status IN ('a_preparer', 'expedie', 'livre', 'annule')),
  notes TEXT,
  stripe_checkout_session_id VARCHAR(255),
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_card_addon_orders_status ON public.gift_card_addon_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_card_addon_orders_gift_card ON public.gift_card_addon_orders (gift_card_id);

DROP TRIGGER IF EXISTS update_gift_card_addons_updated_at ON public.gift_card_addons;
CREATE TRIGGER update_gift_card_addons_updated_at BEFORE UPDATE ON public.gift_card_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gift_card_addon_orders_updated_at ON public.gift_card_addon_orders;
CREATE TRIGGER update_gift_card_addon_orders_updated_at BEFORE UPDATE ON public.gift_card_addon_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Server only (service role through the API); the browser roles get nothing.
REVOKE ALL ON public.gift_card_design_settings, public.gift_card_addons, public.gift_card_addon_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_card_design_settings, public.gift_card_addons, public.gift_card_addon_orders TO service_role;

COMMIT;
