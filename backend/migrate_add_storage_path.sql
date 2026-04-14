-- Migration: Add storage_path column to sources table
-- Run this if your database was created from the OLD schema.sql (which lacked this column).
-- Safe to run multiple times — uses IF NOT EXISTS pattern.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sources' AND column_name = 'storage_path';
