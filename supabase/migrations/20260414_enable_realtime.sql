-- Enable Realtime for the gastos table
-- This allows the dashboard to update automatically when a new record is inserted/updated/deleted
ALTER PUBLICATION supabase_realtime ADD TABLE gastos;
