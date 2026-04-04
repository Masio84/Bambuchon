-- Migration: Add image_url and fecha columns to gastos table
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS imagen_url TEXT;
