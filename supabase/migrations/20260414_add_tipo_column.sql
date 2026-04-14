-- Migration: Add tipo column to gastos table
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'egreso' CHECK (tipo IN ('egreso', 'ingreso'));
