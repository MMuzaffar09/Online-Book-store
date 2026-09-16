CREATE TABLE phone_otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_otp_phone ON phone_otp_verifications (phone_number);
CREATE INDEX idx_phone_otp_phone_created ON phone_otp_verifications (phone_number, created_at DESC);
CREATE INDEX idx_phone_otp_expires ON phone_otp_verifications (expires_at);

ALTER TABLE phone_otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_phone_otp"
  ON phone_otp_verifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);