-- Supabase SQL Schema for Drum and Bass Chile Club
-- Run this in your Supabase SQL Editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles table
-- Users can view all profiles (for displaying usernames in club)
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile, admins can update any profile
CREATE POLICY "Users can update their own profile or admin can update any" ON profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Chat messages table (if not exists)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for chat messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Everyone can view chat messages
CREATE POLICY "Chat messages are viewable by everyone" ON chat_messages
  FOR SELECT USING (true);

-- Authenticated users can insert chat messages
CREATE POLICY "Authenticated users can insert chat messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Migration: Add character customization columns to profiles
-- Run this manually in Supabase Dashboard SQL Editor:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS player_color TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS face_type INTEGER;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS costume_id TEXT DEFAULT 'default';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accessory_id TEXT DEFAULT 'none';

-- Migration: Add gamification columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS high_score INTEGER DEFAULT 0;

-- Migration: Add admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS profiles_score_idx ON profiles(score DESC);

-- Newsletter subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  last_name TEXT,
  email TEXT NOT NULL UNIQUE,
  instagram TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for newsletter subscribers
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Only admins can view newsletter subscribers
CREATE POLICY "Admins can view newsletter subscribers" ON newsletter_subscribers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can insert newsletter subscribers
CREATE POLICY "Admins can insert newsletter subscribers" ON newsletter_subscribers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can update newsletter subscribers
CREATE POLICY "Admins can update newsletter subscribers" ON newsletter_subscribers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can delete newsletter subscribers
CREATE POLICY "Admins can delete newsletter subscribers" ON newsletter_subscribers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Junglists table (voluntary self-registration via Google; see
-- supabase/migrations/20260712000000_create_junglists.sql for the authoritative copy).
-- DJs (pk_profiles) are counted as junglists via email union, not duplicated here.
CREATE TABLE IF NOT EXISTS junglists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  instagram TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS junglists_user_id_idx ON junglists(user_id);
CREATE INDEX IF NOT EXISTS junglists_email_idx ON junglists(email);

ALTER TABLE junglists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Junglists can view own row or admin views all" ON junglists
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can insert own junglist row" ON junglists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Junglists can update own row or admin any" ON junglists
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Junglists can delete own row or admin any" ON junglists
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

DROP TRIGGER IF EXISTS junglists_updated_at ON junglists;
CREATE TRIGGER junglists_updated_at
  BEFORE UPDATE ON junglists
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Al registrarse como junglist, se elimina el correo de la lista de ravers
-- (newsletter_subscribers) para mantener listas disjuntas. SECURITY DEFINER para
-- poder borrar pese a la RLS admin-only de esa tabla.
CREATE OR REPLACE FUNCTION remove_raver_on_junglist_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM newsletter_subscribers WHERE lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS junglists_dedupe_ravers ON junglists;
CREATE TRIGGER junglists_dedupe_ravers
  AFTER INSERT ON junglists
  FOR EACH ROW EXECUTE FUNCTION remove_raver_on_junglist_insert();

-- CMS propio (reemplazo de Contentful): eventos y streamings (see
-- supabase/migrations/20260715000000_create_cms_events_streamings.sql for the
-- authoritative copy, incl. the public 'flyers' storage bucket + policies).
-- Fechas como TEXT 'YYYY-MM-DDTHH:mm' (hora local, mismo formato que Contentful).
CREATE TABLE IF NOT EXISTS cms_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  venue TEXT,
  address TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  description_html TEXT,
  -- URL de venta ACTIVA (la que muestra el sitio en el botón TICKETS).
  tickets TEXT,
  -- Historial de TODAS las URLs de venta que usó el evento (incluida la activa).
  -- Se guardan todas para que analytics nunca pierda clics al cambiar el link.
  ticket_links TEXT[] NOT NULL DEFAULT '{}',
  info TEXT,
  flyer_url TEXT,
  flyer_width INTEGER,
  flyer_height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS cms_events_date_idx ON cms_events(date);

ALTER TABLE cms_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cms events" ON cms_events
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert cms events" ON cms_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update cms events" ON cms_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete cms events" ON cms_events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

DROP TRIGGER IF EXISTS cms_events_updated_at ON cms_events;
CREATE TRIGGER cms_events_updated_at
  BEFORE UPDATE ON cms_events
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE IF NOT EXISTS cms_streamings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  date TEXT NOT NULL,
  end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS cms_streamings_date_idx ON cms_streamings(date);

ALTER TABLE cms_streamings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cms streamings" ON cms_streamings
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert cms streamings" ON cms_streamings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update cms streamings" ON cms_streamings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete cms streamings" ON cms_streamings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

DROP TRIGGER IF EXISTS cms_streamings_updated_at ON cms_streamings;
CREATE TRIGGER cms_streamings_updated_at
  BEFORE UPDATE ON cms_streamings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- CAMPAÑAS DE EMAIL (migración 20260722000000)
-- ═══════════════════════════════════════════════════════════════════════════
-- Campañas de email (persistencia + destinatarios) para poder revisarlas y medir
-- su eficiencia. El id de la campaña sirve además como campaign_id (utm) para el
-- tracking en GA, y como ancla del cupón de descuento.
--
-- campaign_recipients guarda una fila por correo enviado → así se ve A QUIÉNES se
-- envió y (con el webhook de Resend, Fase B) quién abrió/clickeó.
--
-- Aplicar manualmente en el SQL Editor de Supabase.

-- ── Campañas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  template TEXT,                 -- 'evento' | 'custom'
  event_id UUID REFERENCES cms_events(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  title TEXT,
  body_html TEXT,
  image_url TEXT,                -- URL o data-uri de la imagen del correo
  button_text TEXT,
  button_url TEXT,
  coupon_code TEXT,             -- cupón de descuento ligado a la campaña
  coupon_description TEXT,
  audiences TEXT[],             -- audiencias enviadas (ravers, registered, pks, junglists)
  recipients INTEGER DEFAULT 0,  -- total de destinatarios
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sent',    -- 'draft' | 'sent'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS campaigns_created_idx ON campaigns(created_at DESC);

-- ── Destinatarios ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  resend_id TEXT,               -- id del envío en Resend (para casar los webhooks)
  status TEXT DEFAULT 'sent',    -- sent | delivered | opened | clicked | bounced
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  -- El id (uuid aleatorio) de esta fila viaja en el link del correo (?ct=<id>).
  -- Al aterrizar, /api/campaign-visit lo marca → sabemos QUIÉN visitó, en tiempo
  -- real y sin columna extra ni exponer el correo.
  visited_at TIMESTAMPTZ,       -- PRIMERA visita a la landing desde su link
  visit_count INTEGER DEFAULT 0, -- TOTAL de clics/visitas de ese destinatario
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_recipients_resend_idx ON campaign_recipients(resend_id);

-- ── RLS: solo admins ────────────────────────────────────────────────────────
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaigns" ON campaigns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

CREATE POLICY "Admins manage campaign_recipients" ON campaign_recipients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- ── Marcar visita (público, sin exponer datos) ──────────────────────────────
-- La landing llama a esta función con el id del destinatario (el uuid de la fila,
-- que viajó en el link). Corre como SECURITY DEFINER (salta el RLS) y solo setea
-- visited_at/visit_count de esa fila; no lee ni devuelve nada. Así no hace falta
-- service-role, ni columna token, ni exponer el email en la URL.
CREATE OR REPLACE FUNCTION mark_campaign_visit(p_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE campaign_recipients
  SET visited_at = COALESCE(visited_at, NOW()),
      visit_count = visit_count + 1,
      status = CASE WHEN status IN ('sent', 'delivered', 'opened') THEN 'clicked' ELSE status END
  WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION mark_campaign_visit(UUID) TO anon, authenticated;

-- Marca la apertura (pixel del correo). Igual que la visita pero para opened_at.
-- Ojo: las aperturas por pixel son poco fiables (pre-carga/bloqueo de imágenes).
CREATE OR REPLACE FUNCTION mark_campaign_open(p_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE campaign_recipients
  SET opened_at = COALESCE(opened_at, NOW()),
      status = CASE WHEN status IN ('sent', 'delivered') THEN 'opened' ELSE status END
  WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION mark_campaign_open(UUID) TO anon, authenticated;
