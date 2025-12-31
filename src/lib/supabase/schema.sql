-- ============================================================================
-- FURLONG LIVE SHARING - DATABASE SCHEMA
-- ============================================================================
--
-- This schema enables real-time sharing of betting sessions.
-- Run this SQL in your Supabase dashboard (SQL Editor) to set up the tables.
--
-- Features:
-- - Live session sharing with unique share codes
-- - Real-time race and horse data synchronization
-- - Multi-race bet tracking
-- - Viewer count tracking
-- - Automatic expiration (24 hours)
--
-- ============================================================================

-- ============================================================================
-- TABLE: live_sessions
-- Main session table containing session metadata and settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code VARCHAR(10) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Session owner (optional, for future auth integration)
  owner_id UUID REFERENCES auth.users(id),

  -- Track info
  track_name VARCHAR(100) NOT NULL,
  track_code VARCHAR(10) NOT NULL,
  race_date DATE NOT NULL,

  -- Session settings
  total_bankroll INTEGER,
  experience_level VARCHAR(20),
  risk_style VARCHAR(20),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  viewer_count INTEGER DEFAULT 0
);

-- ============================================================================
-- TABLE: live_session_races
-- Race data within a session (verdict, value play, bet suggestions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_session_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  race_number INTEGER NOT NULL,

  -- Race verdict
  verdict VARCHAR(20), -- 'BET', 'CAUTION', 'PASS'
  confidence VARCHAR(20), -- 'HIGH', 'MEDIUM', 'LOW'

  -- Value play (if exists)
  value_play_post INTEGER,
  value_play_name VARCHAR(100),
  value_play_odds VARCHAR(20),
  value_play_edge INTEGER,

  -- Betting suggestions (JSON)
  bet_suggestions JSONB,

  -- Track conditions
  track_condition VARCHAR(20),

  -- Allocated budget
  allocated_budget INTEGER,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, race_number)
);

-- ============================================================================
-- TABLE: live_session_horses
-- Horse data within each race (odds, scratches, rankings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_session_horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  race_number INTEGER NOT NULL,
  post_position INTEGER NOT NULL,

  -- Horse info
  horse_name VARCHAR(100) NOT NULL,

  -- Odds
  morning_line VARCHAR(20),
  live_odds VARCHAR(20),
  fair_odds VARCHAR(20),
  edge INTEGER,

  -- Status
  is_scratched BOOLEAN DEFAULT FALSE,

  -- Scoring
  model_rank INTEGER,
  value_status VARCHAR(20), -- 'OVERLAY', 'FAIR', 'UNDERLAY'

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, race_number, post_position)
);

-- ============================================================================
-- TABLE: live_session_multi_race
-- Multi-race bet data (Pick 3, Pick 4, Daily Double, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_session_multi_race (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,

  bet_type VARCHAR(20) NOT NULL, -- 'DAILY_DOUBLE', 'PICK_3', 'PICK_4', etc.
  starting_race INTEGER NOT NULL,
  ending_race INTEGER NOT NULL,

  -- Ticket structure (JSON)
  legs JSONB NOT NULL,

  combinations INTEGER,
  total_cost DECIMAL(10,2),
  potential_return_min INTEGER,
  potential_return_max INTEGER,

  quality VARCHAR(20), -- 'PRIME', 'GOOD', 'MARGINAL'
  what_to_say TEXT,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable Row Level Security on all tables
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_races ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_multi_race ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can read active, non-expired sessions (for sharing)
CREATE POLICY "Anyone can view active sessions" ON live_sessions
  FOR SELECT USING (is_active = TRUE AND expires_at > NOW());

CREATE POLICY "Anyone can view session races" ON live_session_races
  FOR SELECT USING (
    session_id IN (SELECT id FROM live_sessions WHERE is_active = TRUE AND expires_at > NOW())
  );

CREATE POLICY "Anyone can view session horses" ON live_session_horses
  FOR SELECT USING (
    session_id IN (SELECT id FROM live_sessions WHERE is_active = TRUE AND expires_at > NOW())
  );

CREATE POLICY "Anyone can view session multi-race" ON live_session_multi_race
  FOR SELECT USING (
    session_id IN (SELECT id FROM live_sessions WHERE is_active = TRUE AND expires_at > NOW())
  );

-- For now, allow inserts/updates from anon (we'll add auth later)
CREATE POLICY "Anon can insert sessions" ON live_sessions
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Anon can update sessions" ON live_sessions
  FOR UPDATE USING (TRUE);

CREATE POLICY "Anon can insert races" ON live_session_races
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Anon can update races" ON live_session_races
  FOR UPDATE USING (TRUE);

CREATE POLICY "Anon can insert horses" ON live_session_horses
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Anon can update horses" ON live_session_horses
  FOR UPDATE USING (TRUE);

CREATE POLICY "Anon can insert multi-race" ON live_session_multi_race
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Anon can update multi-race" ON live_session_multi_race
  FOR UPDATE USING (TRUE);

-- ============================================================================
-- REALTIME CONFIGURATION
-- ============================================================================

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE live_session_races;
ALTER PUBLICATION supabase_realtime ADD TABLE live_session_horses;
ALTER PUBLICATION supabase_realtime ADD TABLE live_session_multi_race;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_live_sessions_updated_at
  BEFORE UPDATE ON live_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_session_races_updated_at
  BEFORE UPDATE ON live_session_races
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_session_horses_updated_at
  BEFORE UPDATE ON live_session_horses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWER COUNT FUNCTIONS
-- ============================================================================

-- Function to increment viewer count
CREATE OR REPLACE FUNCTION increment_viewer_count(session_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE live_sessions
  SET viewer_count = viewer_count + 1
  WHERE id = session_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement viewer count
CREATE OR REPLACE FUNCTION decrement_viewer_count(session_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE live_sessions
  SET viewer_count = GREATEST(0, viewer_count - 1)
  WHERE id = session_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_live_sessions_share_code ON live_sessions(share_code);
CREATE INDEX IF NOT EXISTS idx_live_sessions_active ON live_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_live_session_races_session ON live_session_races(session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_horses_session ON live_session_horses(session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_horses_race ON live_session_horses(session_id, race_number);
CREATE INDEX IF NOT EXISTS idx_live_session_multi_race_session ON live_session_multi_race(session_id);

-- ============================================================================
-- CLEANUP FUNCTION (optional - run periodically to clean up expired sessions)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM live_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
