-- Migration 0002: Seed baseline and styles
-- Meridian/83709 well baseline (verified 2025) and target style profiles

INSERT INTO water_baseline (date, ca, mg, na, cl, so4, alkalinity, ph)
VALUES ('2025-01-01', 37.1, 7.0, 43.7, 14.2, 56.2, 151.5, 7.9);

INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target) VALUES
  ('Belgian Tripel', 50, 5, 15, 35, 40, 5.3),
  ('Hefeweizen',     50, 10, 10, 60, 30, 5.4),
  ('IPA',           100, 15, 25, 50, 275, 5.3),
  ('Marzen',         75, 15, 10, 60, 80, 5.4),
  ('Mexican Lager',  45, 5, 10, 25, 30, 5.3),
  ('NEIPA',          75, 10, 20, 150, 50, 5.3),
  ('Stout',         100, 15, 30, 125, 50, 5.4);
