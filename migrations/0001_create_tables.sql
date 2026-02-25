-- Migration 0001: Initial schema
-- Creates the core tables for the Brew Day Water Helper

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

CREATE TABLE IF NOT EXISTS beer_styles (
  name TEXT PRIMARY KEY,
  ca REAL NOT NULL,
  mg REAL NOT NULL,
  na REAL NOT NULL,
  cl REAL NOT NULL,
  so4 REAL NOT NULL,
  ph_target REAL NOT NULL
);
