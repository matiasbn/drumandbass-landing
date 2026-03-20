-- Add gamification columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS high_score INTEGER DEFAULT 0;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS profiles_score_idx ON profiles(score DESC);
