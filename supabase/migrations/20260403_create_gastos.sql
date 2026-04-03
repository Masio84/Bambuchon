-- Create the gastos table
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  concepto TEXT NOT NULL,
  importe NUMERIC(10, 2) NOT NULL,
  categoria TEXT NOT NULL,
  usuario TEXT, -- Jorge, Diana, etc.
  confirmado BOOLEAN DEFAULT FALSE,
  telegram_msg_id BIGINT, -- Optional: to track the original message
  telegram_user_id BIGINT -- Optional: who sent the message
);

-- Enable RLS
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role can do everything" ON gastos
  FOR ALL
  USING (true)
  WITH CHECK (true);
