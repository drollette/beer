-- Water Baseline table
CREATE TABLE IF NOT EXISTS water_baseline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  ca REAL NOT NULL,
  mg REAL NOT NULL,
  na REAL NOT NULL,
  cl REAL NOT NULL,
  so4 REAL NOT NULL,
  alkalinity REAL NOT NULL,
  ph REAL NOT NULL
);

-- Beer Styles table
CREATE TABLE IF NOT EXISTS beer_styles (
  name TEXT PRIMARY KEY,
  ca REAL NOT NULL,
  mg REAL NOT NULL,
  na REAL NOT NULL,
  cl REAL NOT NULL,
  so4 REAL NOT NULL,
  ph_target REAL NOT NULL
);

-- Seed default water baseline (Meridian/83709 well)
INSERT INTO water_baseline (date, ca, mg, na, cl, so4, alkalinity, ph)
VALUES ('2025-01-01', 37.1, 7.0, 43.7, 14.2, 56.2, 151.5, 7.9);

-- Seed beer styles with target water profiles
-- Values based on well-known brewing water targets for each style

-- Hefeweizen: soft water, low sulfate, moderate chloride
INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target)
VALUES ('Hefeweizen', 50, 10, 10, 60, 30, 5.4);

-- IPA: high sulfate for hop bitterness, moderate calcium
INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target)
VALUES ('IPA', 100, 15, 25, 50, 275, 5.3);

-- NEIPA: high chloride, low sulfate for soft mouthfeel
INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target)
VALUES ('NEIPA', 75, 10, 20, 150, 50, 5.3);

-- Märzen: moderate minerals, balanced
INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target)
VALUES ('Marzen', 75, 15, 10, 60, 80, 5.4);

-- Belgian Tripel: soft water, low minerals overall
INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target)
VALUES ('Belgian Tripel', 50, 5, 15, 35, 40, 5.3);

-- Mexican Lager: very soft, clean water
INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target)
VALUES ('Mexican Lager', 45, 5, 10, 25, 30, 5.3);

-- Stout: high chloride for smooth body, moderate sulfate
INSERT INTO beer_styles (name, ca, mg, na, cl, so4, ph_target)
VALUES ('Stout', 100, 15, 30, 125, 50, 5.4);
