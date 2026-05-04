ALTER TABLE services
ADD COLUMN IF NOT EXISTS category_order INTEGER NOT NULL DEFAULT 0;

WITH ordered_categories AS (
  SELECT
    category,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN category IS NULL OR BTRIM(category) = '' THEN 1 ELSE 0 END,
        category
    ) - 1 AS display_order
  FROM (
    SELECT DISTINCT NULLIF(BTRIM(category), '') AS category
    FROM services
  ) distinct_categories
)
UPDATE services
SET category_order = ordered_categories.display_order
FROM ordered_categories
WHERE COALESCE(NULLIF(BTRIM(services.category), ''), '') = COALESCE(ordered_categories.category, '');

CREATE INDEX IF NOT EXISTS idx_services_category_order ON services(category_order);
