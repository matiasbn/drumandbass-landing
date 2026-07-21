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
