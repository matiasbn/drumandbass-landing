-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  last_name TEXT,
  email TEXT NOT NULL UNIQUE,
  instagram TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Only admins can SELECT
CREATE POLICY "Admins can view newsletter subscribers" ON newsletter_subscribers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can INSERT
CREATE POLICY "Admins can insert newsletter subscribers" ON newsletter_subscribers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can UPDATE
CREATE POLICY "Admins can update newsletter subscribers" ON newsletter_subscribers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );
